import { type NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getSession } from '@/lib/server/auth'

/**
 * GET  /api/admin/trips/import — Returns a downloadable CSV template for importing trails.
 * POST /api/admin/trips/import — Bulk import trails from a CSV file.
 *
 * Follows exact Field Names from the Payana Mitra App - Table Details sheet ("Trail Table"):
 *   Trail Id          — unique code, max 50 chars (required)
 *   Trail Name        — trail name, max 100 chars (required)
 *   Destination       — destination / region, max 100 chars (optional)
 *   Start Date        — DD-MM-YYYY, DD/MM/YYYY, or YYYY-MM-DD (optional)
 *   End Date          — DD-MM-YYYY, DD/MM/YYYY, or YYYY-MM-DD (optional, must be >= Start Date)
 *   Leader            — Leader name or 10-15 digit phone of assigned leader (optional)
 *   Active / Inactive — Active or Inactive (optional, default: Active)
 *   Remarks           — notes / trail overview, max 2000 chars (optional)
 */

async function requireAdmin() {
  const profile = await getSession()
  if (!profile) return { error: 'Unauthorized', status: 401 } as const
  if (profile.role !== 'admin') return { error: 'Forbidden', status: 403 } as const
  return { profile }
}

function parseCSV(text: string): Record<string, string>[] {
  const lines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n')
  const headerLine = lines.find(l => l.trim().length > 0)
  if (!headerLine) return []
  const headers = splitCSVRow(headerLine).map(h => h.trim())
  const rows: Record<string, string>[] = []
  for (let i = lines.indexOf(headerLine) + 1; i < lines.length; i++) {
    const line = lines[i]
    if (line.trim() === '') continue
    const values = splitCSVRow(line)
    const obj: Record<string, string> = {}
    headers.forEach((h, idx) => { obj[h] = (values[idx] ?? '').trim() })
    rows.push(obj)
  }
  return rows
}

function splitCSVRow(line: string): string[] {
  const fields: string[] = []
  let current = ''
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') { current += '"'; i++ }
        else inQuotes = false
      } else { current += ch }
    } else {
      if (ch === '"') { inQuotes = true }
      else if (ch === ',') { fields.push(current); current = '' }
      else { current += ch }
    }
  }
  fields.push(current)
  return fields
}

function getField(row: Record<string, string>, ...aliases: string[]): string {
  for (const a of aliases) {
    if (row[a] !== undefined && row[a].trim() !== '') return row[a].trim()
    const normTarget = a.toLowerCase().replace(/[\s_/.-]/g, '')
    for (const [k, v] of Object.entries(row)) {
      if (k.toLowerCase().replace(/[\s_/.-]/g, '') === normTarget && v.trim() !== '') {
        return v.trim()
      }
    }
  }
  return ''
}

function parseDateString(dateStr: string): string | null {
  const clean = dateStr.trim()
  if (!clean) return null
  // DD-MM-YYYY or DD/MM/YYYY
  const dmy = clean.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/)
  if (dmy) {
    const day = dmy[1].padStart(2, '0')
    const month = dmy[2].padStart(2, '0')
    const year = dmy[3]
    return `${year}-${month}-${day}`
  }
  // YYYY-MM-DD or YYYY/MM/DD
  const ymd = clean.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/)
  if (ymd) {
    const year = ymd[1]
    const month = ymd[2].padStart(2, '0')
    const day = ymd[3].padStart(2, '0')
    return `${year}-${month}-${day}`
  }
  return null
}

// ─── GET — Download template ──────────────────────────────────────────────────
export async function GET() {
  const guard = await requireAdmin()
  if ('error' in guard) return NextResponse.json({ error: guard.error }, { status: guard.status })

  // Uses Field Names matching "Trail Table" in the Table Details specification
  const lines = [
    'Trail Id,Trail Name,Destination,Start Date,End Date,Leader,Active / Inactive,Remarks',
    '003,The Asian Amazon Trail,Borneo,15-06-2026,20-06-2026,Devika Mohan,Active,UNESCO wildlife heartland',
    '004,Hampta Pass Trek,Manali Himachal Pradesh,10-07-2026,16-07-2026,Devika Mohan,Active,Moderate high-altitude summer trail',
    '005,Kudremukh Trail,Chikmagalur Karnataka,05-09-2026,08-09-2026,,Active,Western Ghats peak trail',
  ]

  return new NextResponse(lines.join('\n'), {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': 'attachment; filename="trails_import_template.csv"',
    },
  })
}

// ─── POST — Import CSV ────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  const guard = await requireAdmin()
  if ('error' in guard) return NextResponse.json({ error: guard.error }, { status: guard.status })

  let formData: FormData
  try { formData = await req.formData() } catch {
    return NextResponse.json({ error: 'Expected multipart/form-data' }, { status: 400 })
  }

  const fileEntry = formData.get('file')
  if (!fileEntry || typeof fileEntry === 'string') {
    return NextResponse.json({ error: '`file` field is missing or not a file' }, { status: 400 })
  }

  const file = fileEntry as File
  if (
    !file.name.toLowerCase().endsWith('.csv') &&
    !file.type.includes('csv') &&
    !file.type.includes('text')
  ) {
    return NextResponse.json({ error: 'File must be a CSV (.csv)' }, { status: 400 })
  }

  const csvText = await file.text()
  const rows = parseCSV(csvText)

  if (rows.length === 0) {
    return NextResponse.json({ error: 'CSV is empty or has no data rows' }, { status: 422 })
  }
  if (rows.length > 200) {
    return NextResponse.json({ error: 'Maximum 200 trails per import batch' }, { status: 422 })
  }

  const admin = createAdminClient()

  // 1. Fetch existing trip codes to detect duplicates
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: existingTrips } = await (admin.from('trips') as any)
    .select('trip_code') as { data: { trip_code: string }[] | null }

  const existingCodes = new Set((existingTrips ?? []).map((t: { trip_code: string }) => t.trip_code.toLowerCase()))

  // 2. Fetch leaders to resolve Leader (by name, phone, or ID)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: leaders } = await (admin.from('profiles') as any)
    .select('id, phone, first_name, last_name, role')
    .in('role', ['leader', 'admin']) as { data: { id: string; phone: string; first_name: string; last_name: string; role: string }[] | null }

  const leaderMap = new Map<string, string>()
  for (const l of (leaders ?? [])) {
    leaderMap.set(l.id.toLowerCase(), l.id)

    // phone lookups
    const cleanPhone = l.phone.replace(/\s+/g, '')
    leaderMap.set(cleanPhone, l.id)
    if (cleanPhone.startsWith('+91')) {
      leaderMap.set(cleanPhone.replace(/^\+91/, ''), l.id)
    } else {
      leaderMap.set(`+91${cleanPhone}`, l.id)
    }

    // name lookups (full name and first name)
    const fullName = `${l.first_name} ${l.last_name}`.trim().toLowerCase()
    if (fullName) leaderMap.set(fullName, l.id)
    const firstName = l.first_name.trim().toLowerCase()
    if (firstName && !leaderMap.has(firstName)) leaderMap.set(firstName, l.id)
  }

  type RowResult = {
    row: number
    trip_code: string
    status: 'created' | 'skipped' | 'error'
    id?: string
    error?: string
  }
  const results: RowResult[] = []

  for (let i = 0; i < rows.length; i++) {
    const raw = rows[i]
    const rowNum = i + 2

    // Supports both Sheet field names ('Trail Id', 'Trail Name', etc.) and legacy keys
    const trip_code   = getField(raw, 'Trail Id', 'TrailId', 'trip_code', 'code', 'trail_code')
    const name        = getField(raw, 'Trail Name', 'TrailName', 'name', 'trail_name', 'title')
    const destination = getField(raw, 'Destination', 'destination', 'location') || null
    const rawStart    = getField(raw, 'Start Date', 'StartDate', 'start_date')
    const rawEnd      = getField(raw, 'End Date', 'EndDate', 'end_date')
    const leaderInput = getField(raw, 'Leader', 'Leader Name', 'leader_phone', 'leader_id')
    const activeInput = getField(raw, 'Active / Inactive', 'Active/Inactive', 'Active', 'status', 'is_active')
    const remarks     = getField(raw, 'Remarks', 'remarks', 'itinerary', 'notes') || null

    if (!trip_code || trip_code.length > 50) {
      results.push({ row: rowNum, trip_code: trip_code || 'Row ' + rowNum, status: 'error', error: 'Trail Id is required (max 50 chars)' })
      continue
    }
    if (!name || name.length > 100) {
      results.push({ row: rowNum, trip_code, status: 'error', error: 'Trail Name is required (max 100 chars)' })
      continue
    }
    if (destination && destination.length > 100) {
      results.push({ row: rowNum, trip_code, status: 'error', error: 'Destination cannot exceed 100 chars' })
      continue
    }

    // Flexible date parsing (DD-MM-YYYY, DD/MM/YYYY, or YYYY-MM-DD)
    const start_date = rawStart ? parseDateString(rawStart) : null
    if (rawStart && !start_date) {
      results.push({ row: rowNum, trip_code, status: 'error', error: `Start Date "${rawStart}" is invalid. Use DD-MM-YYYY or YYYY-MM-DD.` })
      continue
    }

    const end_date = rawEnd ? parseDateString(rawEnd) : null
    if (rawEnd && !end_date) {
      results.push({ row: rowNum, trip_code, status: 'error', error: `End Date "${rawEnd}" is invalid. Use DD-MM-YYYY or YYYY-MM-DD.` })
      continue
    }

    if (start_date && end_date && new Date(end_date) < new Date(start_date)) {
      results.push({ row: rowNum, trip_code, status: 'error', error: 'End Date must be on or after Start Date' })
      continue
    }

    // Leader lookup by name, phone, or id
    let leader_id: string | null = null
    if (leaderInput) {
      const cleanInput = leaderInput.trim().toLowerCase()
      leader_id = leaderMap.get(cleanInput) ?? leaderMap.get(cleanInput.replace(/\s+/g, '')) ?? null
      if (!leader_id) {
        results.push({ row: rowNum, trip_code, status: 'error', error: `Leader "${leaderInput}" not found. Enter leader's full name or phone number.` })
        continue
      }
    }

    // Active / Inactive check
    const isInactive = activeInput.toLowerCase() === 'inactive' || activeInput.toLowerCase() === 'no' || activeInput.toLowerCase() === 'off'
    const is_active = !isInactive
    const status = isInactive ? 'archived' : 'draft'

    // Check duplicate
    if (existingCodes.has(trip_code.toLowerCase())) {
      results.push({ row: rowNum, trip_code, status: 'skipped', error: 'Trail Id already exists' })
      continue
    }

    // Insert trip
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: newTrip, error: insertErr } = await (admin.from('trips') as any)
        .insert({
          trip_code,
          name,
          destination,
          start_date,
          end_date,
          leader_id,
          status,
          is_active,
          remarks,
        })
        .select('id')
        .single()

      if (insertErr) {
        results.push({ row: rowNum, trip_code, status: 'error', error: insertErr.message })
        continue
      }

      existingCodes.add(trip_code.toLowerCase())
      results.push({ row: rowNum, trip_code, status: 'created', id: newTrip?.id })
    } catch (err) {
      results.push({ row: rowNum, trip_code, status: 'error', error: String(err) })
    }
  }

  const created    = results.filter(r => r.status === 'created').length
  const skipped    = results.filter(r => r.status === 'skipped').length
  const errorCount = results.filter(r => r.status === 'error').length

  return NextResponse.json({
    created,
    skipped,
    errorCount,
    results,
  })
}
