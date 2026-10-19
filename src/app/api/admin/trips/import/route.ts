import { type NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getSession } from '@/lib/server/auth'

/**
 * GET  /api/admin/trips/import — Returns a downloadable CSV template for importing trails/trips.
 * POST /api/admin/trips/import — Bulk import trails/trips from a CSV file.
 *
 * CSV Columns:
 *   trip_code    — unique code, max 50 chars (required)
 *   name         — trail name, max 100 chars (required)
 *   destination  — destination, max 100 chars (optional)
 *   start_date   — YYYY-MM-DD (optional)
 *   end_date     — YYYY-MM-DD (optional, must be >= start_date)
 *   leader_phone — 10-15 digit phone of assigned leader (optional)
 *   remarks      — notes, max 2000 chars (optional)
 */

const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/

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
  const headers = splitCSVRow(headerLine).map(h => h.trim().toLowerCase())
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

// ─── GET — Download template ──────────────────────────────────────────────────
export async function GET() {
  const guard = await requireAdmin()
  if ('error' in guard) return NextResponse.json({ error: guard.error }, { status: guard.status })

  const lines = [
    'trip_code,name,destination,start_date,end_date,leader_phone,remarks',
    'TRIP-2026-01,Hampta Pass Trek,Manali Himachal Pradesh,2026-06-15,2026-06-20,9000000002,Moderate summer trek',
    'TRIP-2026-02,Valley of Flowers,Uttarakhand,2026-07-10,2026-07-16,9000000002,UNESCO World Heritage trail',
    'TRIP-2026-03,Kudremukh Trail,Chikmagalur Karnataka,2026-09-05,2026-09-08,,Western Ghats peak trail',
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

  // 2. Fetch leaders to resolve leader_phone / leader_id
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: leaders } = await (admin.from('profiles') as any)
    .select('id, phone, role')
    .in('role', ['leader', 'admin']) as { data: { id: string; phone: string; role: string }[] | null }

  const leaderMap = new Map<string, string>()
  for (const l of (leaders ?? [])) {
    const clean = l.phone.replace(/\s+/g, '')
    leaderMap.set(clean, l.id)
    if (clean.startsWith('+91')) {
      leaderMap.set(clean.replace(/^\+91/, ''), l.id)
    } else {
      leaderMap.set(`+91${clean}`, l.id)
    }
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

    const trip_code   = (raw['trip_code'] ?? '').trim()
    const name        = (raw['name'] ?? '').trim()
    const destination = (raw['destination'] ?? '').trim() || null
    const start_date  = (raw['start_date'] ?? '').trim() || null
    const end_date    = (raw['end_date'] ?? '').trim() || null
    const leaderPhone = (raw['leader_phone'] ?? raw['leader_id'] ?? '').trim().replace(/\s+/g, '')
    const remarks     = (raw['remarks'] ?? '').trim() || null

    if (!trip_code || trip_code.length > 50) {
      results.push({ row: rowNum, trip_code, status: 'error', error: 'trip_code is required (max 50 chars)' })
      continue
    }
    if (!name || name.length > 100) {
      results.push({ row: rowNum, trip_code, status: 'error', error: 'name is required (max 100 chars)' })
      continue
    }
    if (destination && destination.length > 100) {
      results.push({ row: rowNum, trip_code, status: 'error', error: 'destination cannot exceed 100 chars' })
      continue
    }

    if (start_date && !DATE_REGEX.test(start_date)) {
      results.push({ row: rowNum, trip_code, status: 'error', error: 'start_date must be YYYY-MM-DD' })
      continue
    }
    if (end_date && !DATE_REGEX.test(end_date)) {
      results.push({ row: rowNum, trip_code, status: 'error', error: 'end_date must be YYYY-MM-DD' })
      continue
    }
    if (start_date && end_date && new Date(end_date) < new Date(start_date)) {
      results.push({ row: rowNum, trip_code, status: 'error', error: 'end_date must be on or after start_date' })
      continue
    }

    // Leader lookup
    let leader_id: string | null = null
    if (leaderPhone) {
      leader_id = leaderMap.get(leaderPhone) ?? null
      if (!leader_id) {
        results.push({ row: rowNum, trip_code, status: 'error', error: `Leader with phone "${leaderPhone}" not found or not a leader` })
        continue
      }
    }

    // Check duplicate
    if (existingCodes.has(trip_code.toLowerCase())) {
      results.push({ row: rowNum, trip_code, status: 'skipped', error: 'Trip code already exists' })
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
          status: 'draft',
          is_active: true,
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
