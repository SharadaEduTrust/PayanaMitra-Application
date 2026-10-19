import { type NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getSession, derivePassword, phoneToEmail, PHONE_REGEX } from '@/lib/server/auth'

/**
 * GET  /api/admin/users/import — Returns a downloadable CSV template with all supported columns.
 * POST /api/admin/users/import — Accepts multipart/form-data with a single `file` field (UTF-8 CSV).
 *                               Bulk-creates up to 500 users server-side with leader assignment support.
 *
 * CSV columns:
 *   phone           — 10-15 digit phone number (required)
 *   first_name      — string max 50 (required)
 *   last_name       — string max 50 (required)
 *   role            — guest | traveller | leader | admin (default: traveller)
 *   leader_phone    — optional phone number of assigned leader
 *   email           — optional contact e-mail
 *   location        — optional home location / city (max 50)
 *   date_of_joining — YYYY-MM-DD (optional)
 *   remarks         — freeform notes (optional)
 */

const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/

const ROLE_MAP: Record<string, 'traveller' | 'leader' | 'admin'> = {
  traveller: 'traveller',
  guest: 'traveller',
  leader: 'leader',
  admin: 'admin',
}

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

// ─── GET — download CSV template ─────────────────────────────────────────────
export async function GET() {
  const guard = await requireAdmin()
  if ('error' in guard) return NextResponse.json({ error: guard.error }, { status: guard.status })

  const lines = [
    'phone,first_name,last_name,role,leader_phone,email,location,date_of_joining,remarks',
    '9876543210,Amit,Sharma,guest,9000000002,amit.sharma@example.com,Mumbai,2024-01-15,Group A',
    '9876543211,Priya,Mehta,leader,,priya.mehta@example.com,Delhi,2024-02-01,Trail Leader',
    '9876543212,Rahul,Verma,guest,9000000002,,Delhi,2024-03-10,VIP guest',
    '9876543213,Sunita,Nair,traveller,,,Bangalore,,',
  ]
  return new NextResponse(lines.join('\n'), {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': 'attachment; filename="users_import_template.csv"',
    },
  })
}

// ─── POST — import CSV ────────────────────────────────────────────────────────
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
  if (rows.length > 500) {
    return NextResponse.json({ error: 'Maximum 500 users per import batch' }, { status: 422 })
  }

  const admin = createAdminClient()

  // Pre-load all existing profiles for phone duplicate detection and leader lookup
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: existingProfiles } = await (admin.from('profiles') as any)
    .select('id, phone, role') as { data: { id: string; phone: string; role: string }[] | null }

  const existingPhoneMap = new Map<string, string>()
  const leaderPhoneToIdMap = new Map<string, string>()

  for (const p of (existingProfiles ?? [])) {
    const clean = p.phone.replace(/\s+/g, '')
    existingPhoneMap.set(clean, p.id)
    if (clean.startsWith('+91')) {
      existingPhoneMap.set(clean.replace(/^\+91/, ''), p.id)
    } else {
      existingPhoneMap.set(`+91${clean}`, p.id)
    }

    if (['leader', 'admin'].includes(p.role)) {
      leaderPhoneToIdMap.set(clean, p.id)
      if (clean.startsWith('+91')) {
        leaderPhoneToIdMap.set(clean.replace(/^\+91/, ''), p.id)
      } else {
        leaderPhoneToIdMap.set(`+91${clean}`, p.id)
      }
    }
  }

  type RowResult = {
    row: number
    phone: string
    status: 'created' | 'skipped' | 'error'
    id?: string
    error?: string
  }
  const results: RowResult[] = []

  for (let i = 0; i < rows.length; i++) {
    const raw = rows[i]
    const rowNum = i + 2

    const rawPhone   = (raw['phone'] ?? '').trim().replace(/\s+/g, '')
    const first_name = (raw['first_name'] ?? '').trim()
    const last_name  = (raw['last_name'] ?? '').trim()
    const rawRole    = (raw['role'] ?? 'traveller').trim().toLowerCase()
    const leaderPhone = (raw['leader_phone'] ?? raw['leader_id'] ?? '').trim().replace(/\s+/g, '')

    // Field validation
    if (!PHONE_REGEX.test(rawPhone)) {
      results.push({ row: rowNum, phone: rawPhone, status: 'error', error: 'Phone must be a valid 10-15 digit number' })
      continue
    }
    if (!first_name || first_name.length > 50) {
      results.push({ row: rowNum, phone: rawPhone, status: 'error', error: 'first_name is required (max 50 chars)' })
      continue
    }
    if (!last_name || last_name.length > 50) {
      results.push({ row: rowNum, phone: rawPhone, status: 'error', error: 'last_name is required (max 50 chars)' })
      continue
    }

    const mappedRole = ROLE_MAP[rawRole]
    if (!mappedRole) {
      results.push({ row: rowNum, phone: rawPhone, status: 'error', error: `Invalid role "${rawRole}" — must be guest, traveller, leader, or admin` })
      continue
    }

    const location = (raw['location'] ?? '').trim() || null
    if (location && location.length > 50) {
      results.push({ row: rowNum, phone: rawPhone, status: 'error', error: 'Location cannot exceed 50 characters' })
      continue
    }

    const date_of_joining = (raw['date_of_joining'] ?? '').trim() || null
    if (date_of_joining && !DATE_REGEX.test(date_of_joining)) {
      results.push({ row: rowNum, phone: rawPhone, status: 'error', error: 'date_of_joining must be YYYY-MM-DD' })
      continue
    }

    // Leader lookup
    let leader_id: string | null = null
    if (leaderPhone) {
      if (['leader', 'admin'].includes(mappedRole)) {
        results.push({ row: rowNum, phone: rawPhone, status: 'error', error: 'Leaders and admins cannot be assigned a leader' })
        continue
      }
      leader_id = leaderPhoneToIdMap.get(leaderPhone) ?? null
      if (!leader_id) {
        results.push({ row: rowNum, phone: rawPhone, status: 'error', error: `Assigned leader with phone "${leaderPhone}" not found or not an active leader` })
        continue
      }
    }

    // Duplicate detection
    if (existingPhoneMap.has(rawPhone)) {
      results.push({ row: rowNum, phone: rawPhone, status: 'skipped', error: 'Phone already registered' })
      continue
    }

    // Create auth user + profile
    try {
      const initialPin = rawPhone.slice(-4)
      const email_auth = phoneToEmail(rawPhone)
      const password   = await derivePassword(rawPhone, initialPin)

      const { data: authData, error: authErr } = await admin.auth.admin.createUser({
        email: email_auth,
        password,
        email_confirm: true,
      })

      if (authErr || !authData.user) {
        results.push({ row: rowNum, phone: rawPhone, status: 'error', error: authErr?.message ?? 'Auth user creation failed' })
        continue
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: profileData, error: profileErr } = await (admin.from('profiles') as any)
        .insert({
          id: authData.user.id,
          phone: rawPhone,
          first_name,
          last_name,
          role: mappedRole,
          leader_id,
          email: raw['email'] ? raw['email'].trim() || null : null,
          location,
          date_of_joining,
          remarks: raw['remarks'] ? raw['remarks'].trim() || null : null,
          must_change_password: false,
          is_active: true,
        })
        .select('id')
        .single()

      if (profileErr) {
        await admin.auth.admin.deleteUser(authData.user.id)
        results.push({ row: rowNum, phone: rawPhone, status: 'error', error: profileErr.message })
        continue
      }

      // Record in map to prevent duplicate inserts within the same batch
      existingPhoneMap.set(rawPhone, profileData.id)
      if (rawPhone.startsWith('+91')) {
        existingPhoneMap.set(rawPhone.replace(/^\+91/, ''), profileData.id)
      } else {
        existingPhoneMap.set(`+91${rawPhone}`, profileData.id)
      }
      if (['leader', 'admin'].includes(mappedRole)) {
        leaderPhoneToIdMap.set(rawPhone, profileData.id)
        if (rawPhone.startsWith('+91')) {
          leaderPhoneToIdMap.set(rawPhone.replace(/^\+91/, ''), profileData.id)
        } else {
          leaderPhoneToIdMap.set(`+91${rawPhone}`, profileData.id)
        }
      }

      results.push({ row: rowNum, phone: rawPhone, status: 'created', id: profileData.id })
    } catch (err) {
      results.push({ row: rowNum, phone: rawPhone, status: 'error', error: String(err) })
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
