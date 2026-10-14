import { type NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getSession, derivePassword, phoneToEmail } from '@/lib/server/auth'

/**
 * GET  /api/admin/users/import
 *   Returns a downloadable CSV template with all supported columns.
 *
 * POST /api/admin/users/import
 *   Accepts multipart/form-data with a single `file` field (UTF-8 CSV).
 *   Parses and bulk-creates up to 500 users server-side.
 *
 * CSV columns (header row required, column order does not matter):
 *   phone           — 10-digit Indian mobile number (required)
 *   first_name      — string (required)
 *   last_name       — string (required)
 *   role            — traveller | leader | admin  (default: traveller)
 *   email           — optional contact e-mail
 *   location        — optional home location / city
 *   date_of_joining — YYYY-MM-DD (optional)
 *   remarks         — freeform notes (optional)
 *
 * Behaviour:
 *   - Phone numbers already in the system are SKIPPED (not an error).
 *   - Duplicate phones within the same CSV are skipped after the first.
 *   - Initial PIN = last 4 digits of phone; must_change_password = true.
 *   - Max 500 rows per upload.
 *   - No external npm dependencies — includes a built-in RFC-4180 CSV parser.
 *
 * Returns:
 *   { created, skipped, errorCount, results: [{ row, phone, status, id?, error? }] }
 */

const PHONE_REGEX = /^\d{10}$/
const VALID_ROLES = ['traveller', 'leader', 'admin'] as const
const DATE_REGEX  = /^\d{4}-\d{2}-\d{2}$/

// ─── Auth guard ───────────────────────────────────────────────────────────────
async function requireAdmin() {
  const profile = await getSession()
  if (!profile) return { error: 'Unauthorized', status: 401 } as const
  if (profile.role !== 'admin') return { error: 'Forbidden', status: 403 } as const
  return { profile }
}

// ─── Minimal RFC-4180 CSV parser (no external deps) ──────────────────────────
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
export async function GET(_req: NextRequest) {
  const guard = await requireAdmin()
  if ('error' in guard) return NextResponse.json({ error: guard.error }, { status: guard.status })

  const lines = [
    'phone,first_name,last_name,role,email,location,date_of_joining,remarks',
    '9876543210,Amit,Sharma,traveller,amit.sharma@example.com,Mumbai,2024-01-15,Group A',
    '9876543211,Priya,Mehta,leader,priya.mehta@example.com,Delhi,2024-02-01,',
    '9876543212,Rahul,Verma,traveller,,,2024-03-10,VIP guest',
    '9876543213,Sunita,Nair,traveller,,Bangalore,,',
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

  // ── Parse multipart form ──────────────────────────────────────────────────
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

  // ── Pre-load existing phones for fast duplicate detection ─────────────────
  const admin = createAdminClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: existingProfiles } = await (admin.from('profiles') as any).select('phone') as { data: { phone: string }[] | null }
  const existingPhones = new Set((existingProfiles ?? []).map((p: { phone: string }) => p.phone))

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
    const rowNum = i + 2  // 1-indexed, account for header row

    // ── Required fields ────────────────────────────────────────────────────
    const phone      = (raw['phone']      ?? '').trim()
    const first_name = (raw['first_name'] ?? '').trim()
    const last_name  = (raw['last_name']  ?? '').trim()
    const role       = (raw['role']       ?? 'traveller').trim().toLowerCase()

    if (!PHONE_REGEX.test(phone)) {
      results.push({ row: rowNum, phone, status: 'error', error: 'phone must be exactly 10 digits' })
      continue
    }
    if (!first_name) {
      results.push({ row: rowNum, phone, status: 'error', error: 'first_name is required' })
      continue
    }
    if (!last_name) {
      results.push({ row: rowNum, phone, status: 'error', error: 'last_name is required' })
      continue
    }
    if (!VALID_ROLES.includes(role as typeof VALID_ROLES[number])) {
      results.push({ row: rowNum, phone, status: 'error', error: `Invalid role "${role}" — must be traveller | leader | admin` })
      continue
    }

    // ── Optional fields ────────────────────────────────────────────────────
    const email           = raw['email']           ? raw['email'].trim()           || null : null
    const location        = raw['location']        ? raw['location'].trim()        || null : null
    const date_of_joining = raw['date_of_joining'] ? raw['date_of_joining'].trim() || null : null
    const remarks         = raw['remarks']         ? raw['remarks'].trim()         || null : null

    if (date_of_joining && !DATE_REGEX.test(date_of_joining)) {
      results.push({ row: rowNum, phone, status: 'error', error: 'date_of_joining must be YYYY-MM-DD' })
      continue
    }

    // ── Duplicate detection ────────────────────────────────────────────────
    if (existingPhones.has(phone)) {
      results.push({ row: rowNum, phone, status: 'skipped', error: 'Phone already registered' })
      continue
    }

    // ── Create auth user + profile ─────────────────────────────────────────
    try {
      const initialPin   = phone.slice(-4)
      const email_auth   = phoneToEmail(phone)
      const password     = await derivePassword(phone, initialPin)

      const { data: authData, error: authErr } = await admin.auth.admin.createUser({
        email: email_auth,
        password,
        email_confirm: true,
      })

      if (authErr || !authData.user) {
        results.push({ row: rowNum, phone, status: 'error', error: authErr?.message ?? 'Auth creation failed' })
        continue
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: profileData, error: profileErr } = await (admin.from('profiles') as any)
        .insert({
          id: authData.user.id,
          phone,
          first_name,
          last_name,
          role,
          email,
          location,
          date_of_joining,
          remarks,
          must_change_password: true,
          is_active: true,
        })
        .select('id')
        .single()

      if (profileErr) {
        await admin.auth.admin.deleteUser(authData.user.id)
        results.push({ row: rowNum, phone, status: 'error', error: profileErr.message })
        continue
      }

      existingPhones.add(phone)  // prevent duplicates within same CSV
      results.push({ row: rowNum, phone, status: 'created', id: profileData?.id })
    } catch (err) {
      results.push({ row: rowNum, phone, status: 'error', error: String(err) })
    }
  }

  const created    = results.filter(r => r.status === 'created').length
  const skipped    = results.filter(r => r.status === 'skipped').length
  const errorCount = results.filter(r => r.status === 'error').length

  return NextResponse.json({ created, skipped, errorCount, results })
}
