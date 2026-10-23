import { type NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getSession } from '@/lib/server/auth'

/**
 * GET  /api/admin/trips/mapping/import — Returns a downloadable CSV template for mapping guests to trails.
 * POST /api/admin/trips/mapping/import — Bulk maps guests to trails using Mobile Number & Trail Id.
 *
 * Supported CSV columns:
 *   Mobile Number of the Guest (or Mobile Number, Phone, User Id) — 10-15 digit phone
 *   Trail Id (or Trail Code, Trip Code, TrailId)                   — unique code of the trail
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

function cleanPhone(raw: string): string {
  return raw
    .replace(/['"`]/g, '')
    .trim()
    .replace(/\.0+$/, '')
    .replace(/[\s\-()]/g, '')
}

type ProfileRecord = {
  id: string
  phone: string
  first_name: string
  last_name: string
  role: string
  is_active: boolean
}

type TripRecord = {
  id: string
  trip_code: string
  name: string
  status: string
  is_active: boolean
}

function resolveProfile(inputPhone: string, phoneMap: Map<string, ProfileRecord>): ProfileRecord | null {
  const cleaned = cleanPhone(inputPhone)
  if (!cleaned) return null
  if (phoneMap.has(cleaned)) return phoneMap.get(cleaned)!
  if (cleaned.startsWith('+91') && phoneMap.has(cleaned.slice(3))) return phoneMap.get(cleaned.slice(3))!
  if (!cleaned.startsWith('+') && phoneMap.has(`+91${cleaned}`)) return phoneMap.get(`+91${cleaned}`)!
  if (cleaned.startsWith('91') && cleaned.length === 12 && phoneMap.has(cleaned.slice(2))) return phoneMap.get(cleaned.slice(2))!
  if (cleaned.startsWith('0') && cleaned.length === 11 && phoneMap.has(cleaned.slice(1))) return phoneMap.get(cleaned.slice(1))!
  return null
}

function resolveTrip(inputTrailId: string, tripMap: Map<string, TripRecord>): TripRecord | null {
  const clean = inputTrailId.trim().toLowerCase()
  if (!clean) return null
  if (tripMap.has(clean)) return tripMap.get(clean)!
  if (/^\d+$/.test(clean)) {
    const num = String(parseInt(clean, 10))
    if (tripMap.has(num)) return tripMap.get(num)!
    const padded = clean.padStart(3, '0')
    if (tripMap.has(padded)) return tripMap.get(padded)!
  }
  return null
}

// ─── GET — Download template ──────────────────────────────────────────────────
export async function GET() {
  const guard = await requireAdmin()
  if ('error' in guard) return NextResponse.json({ error: guard.error }, { status: guard.status })

  const lines = [
    'Mobile Number of the Guest,Trail Id',
    '9019911700,HIHGOK01',
    '9019911701,HIHGOK01',
    '9019911702,HIHGOK02',
  ]

  return new NextResponse(lines.join('\n'), {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': 'attachment; filename="trail_guest_mapping_template.csv"',
    },
  })
}

// ─── POST — Import CSV ────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  const guard = await requireAdmin()
  if ('error' in guard) return NextResponse.json({ error: guard.error }, { status: guard.status })

  let formData: FormData
  try {
    formData = await req.formData()
  } catch {
    return NextResponse.json({ error: 'Expected multipart/form-data with a "file" field' }, { status: 400 })
  }

  const file = formData.get('file')
  const defaultTripId = (formData.get('trip_id') as string | null)?.trim() || null

  if (!file || typeof file === 'string') {
    return NextResponse.json({ error: 'No file uploaded. Please upload a CSV file.' }, { status: 400 })
  }

  if (
    !file.name.toLowerCase().endsWith('.csv') &&
    !file.type.includes('csv') &&
    file.type !== 'text/plain'
  ) {
    return NextResponse.json({ error: 'File must be a CSV (.csv)' }, { status: 400 })
  }

  const csvText = await file.text()
  const rows = parseCSV(csvText)

  if (rows.length === 0) {
    return NextResponse.json({ error: 'CSV is empty or has no data rows' }, { status: 422 })
  }
  if (rows.length > 500) {
    return NextResponse.json({ error: 'Maximum 500 mappings per import batch' }, { status: 422 })
  }

  const admin = createAdminClient()

  // 1. Preload profiles to build phone lookup map
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: profiles, error: profileErr } = await (admin.from('profiles') as any)
    .select('id, phone, first_name, last_name, role, is_active') as { data: ProfileRecord[] | null; error: Error | null }

  if (profileErr) {
    return NextResponse.json({ error: `Failed to load guest profiles: ${profileErr.message}` }, { status: 500 })
  }

  const phoneMap = new Map<string, ProfileRecord>()
  for (const p of (profiles ?? [])) {
    const raw = cleanPhone(p.phone)
    if (raw) {
      phoneMap.set(raw, p)
      if (raw.startsWith('+91')) {
        phoneMap.set(raw.replace(/^\+91/, ''), p)
      } else {
        phoneMap.set(`+91${raw}`, p)
      }
      if (raw.startsWith('91') && raw.length === 12) {
        phoneMap.set(raw.slice(2), p)
      }
      if (raw.startsWith('0') && raw.length === 11) {
        phoneMap.set(raw.slice(1), p)
      }
    }
  }

  // 2. Preload trips to build trail lookup map
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: trips, error: tripsErr } = await (admin.from('trips') as any)
    .select('id, trip_code, name, status, is_active') as { data: TripRecord[] | null; error: Error | null }

  if (tripsErr) {
    return NextResponse.json({ error: `Failed to load trails: ${tripsErr.message}` }, { status: 500 })
  }

  const tripMap = new Map<string, TripRecord>()
  for (const t of (trips ?? [])) {
    const code = t.trip_code.trim().toLowerCase()
    tripMap.set(code, t)
    tripMap.set(t.id.toLowerCase(), t)
    const name = t.name.trim().toLowerCase()
    if (!tripMap.has(name)) tripMap.set(name, t)
    if (/^\d+$/.test(code)) {
      const num = String(parseInt(code, 10))
      tripMap.set(num, t)
      tripMap.set(code.padStart(3, '0'), t)
    }
  }

  // Default trip if supplied in query/form
  let fallbackTrip: TripRecord | null = null
  if (defaultTripId) {
    fallbackTrip = resolveTrip(defaultTripId, tripMap)
  }

  // 3. Preload existing trip memberships to detect duplicates
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: existingMembers, error: membersErr } = await (admin.from('trip_members') as any)
    .select('trip_id, user_id') as { data: { trip_id: string; user_id: string }[] | null; error: Error | null }

  if (membersErr) {
    return NextResponse.json({ error: `Failed to load existing memberships: ${membersErr.message}` }, { status: 500 })
  }

  const memberSet = new Set<string>()
  for (const m of (existingMembers ?? [])) {
    memberSet.add(`${m.trip_id}:${m.user_id}`)
  }

  type RowResult = {
    row: number
    phone: string
    trip_code: string
    guest_name?: string
    trip_name?: string
    status: 'created' | 'skipped' | 'error'
    id?: string
    error?: string
  }

  const results: RowResult[] = []

  for (let i = 0; i < rows.length; i++) {
    const raw = rows[i]
    const rowNum = i + 2 // 1-indexed, accounting for header row

    const rawPhone = getField(
      raw,
      'Mobile Number of the Guest',
      'Mobile Number',
      'Mobile',
      'Guest Mobile Number',
      'Guest Mobile',
      'Guest Phone',
      'Phone Number',
      'Phone',
      'User Id',
      'UserId',
      'phone',
      'mobile_number',
      'mobile',
      'user_id'
    )

    const rawTrailId = getField(
      raw,
      'Trail Id',
      'TrailId',
      'Trail ID',
      'Trail Code',
      'TrailCode',
      'Trip Code',
      'TripCode',
      'trip_code',
      'trail_id',
      'trail_code',
      'Trail',
      'code'
    ) || (fallbackTrip ? fallbackTrip.trip_code : '')

    // Validate phone input
    if (!rawPhone) {
      results.push({
        row: rowNum,
        phone: '—',
        trip_code: rawTrailId || '—',
        status: 'error',
        error: 'Mobile Number is required',
      })
      continue
    }

    const cleanInputPhone = cleanPhone(rawPhone)
    if (!/^\+?[0-9]{10,15}$/.test(cleanInputPhone)) {
      results.push({
        row: rowNum,
        phone: rawPhone,
        trip_code: rawTrailId || '—',
        status: 'error',
        error: `Invalid mobile number "${rawPhone}". Must be a 10-15 digit number.`,
      })
      continue
    }

    // Resolve guest profile
    const profile = resolveProfile(cleanInputPhone, phoneMap)
    if (!profile) {
      results.push({
        row: rowNum,
        phone: rawPhone,
        trip_code: rawTrailId || '—',
        status: 'error',
        error: `Guest with mobile number "${rawPhone}" is not registered. Please create or import the user first.`,
      })
      continue
    }

    // Validate and resolve Trail
    if (!rawTrailId) {
      results.push({
        row: rowNum,
        phone: rawPhone,
        trip_code: '—',
        guest_name: `${profile.first_name} ${profile.last_name}`,
        status: 'error',
        error: 'Trail Id is required',
      })
      continue
    }

    const trip = resolveTrip(rawTrailId, tripMap)
    if (!trip) {
      results.push({
        row: rowNum,
        phone: rawPhone,
        trip_code: rawTrailId,
        guest_name: `${profile.first_name} ${profile.last_name}`,
        status: 'error',
        error: `Trail with Id "${rawTrailId}" not found. Please verify the Trail Id.`,
      })
      continue
    }

    const membershipKey = `${trip.id}:${profile.id}`

    // Check if mapping already exists
    if (memberSet.has(membershipKey)) {
      results.push({
        row: rowNum,
        phone: profile.phone,
        trip_code: trip.trip_code,
        guest_name: `${profile.first_name} ${profile.last_name}`,
        trip_name: trip.name,
        status: 'skipped',
        error: `Guest is already mapped to ${trip.trip_code} (${trip.name})`,
      })
      continue
    }

    // Insert into trip_members
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: inserted, error: insertErr } = await (admin.from('trip_members') as any)
        .insert({
          trip_id: trip.id,
          user_id: profile.id,
        })
        .select('id')
        .single()

      if (insertErr) {
        // If it was a race duplicate, gracefully treat as skipped
        if (insertErr.code === '23505') {
          memberSet.add(membershipKey)
          results.push({
            row: rowNum,
            phone: profile.phone,
            trip_code: trip.trip_code,
            guest_name: `${profile.first_name} ${profile.last_name}`,
            trip_name: trip.name,
            status: 'skipped',
            error: 'Guest is already mapped to this trail',
          })
          continue
        }

        results.push({
          row: rowNum,
          phone: profile.phone,
          trip_code: trip.trip_code,
          guest_name: `${profile.first_name} ${profile.last_name}`,
          trip_name: trip.name,
          status: 'error',
          error: insertErr.message,
        })
        continue
      }

      memberSet.add(membershipKey)
      results.push({
        row: rowNum,
        phone: profile.phone,
        trip_code: trip.trip_code,
        guest_name: `${profile.first_name} ${profile.last_name}`,
        trip_name: trip.name,
        status: 'created',
        id: inserted?.id,
      })
    } catch (err) {
      results.push({
        row: rowNum,
        phone: profile.phone,
        trip_code: trip.trip_code,
        guest_name: `${profile.first_name} ${profile.last_name}`,
        trip_name: trip.name,
        status: 'error',
        error: String(err),
      })
    }
  }

  const created = results.filter(r => r.status === 'created').length
  const skipped = results.filter(r => r.status === 'skipped').length
  const errorCount = results.filter(r => r.status === 'error').length

  return NextResponse.json({
    created,
    skipped,
    errorCount,
    results,
  })
}
