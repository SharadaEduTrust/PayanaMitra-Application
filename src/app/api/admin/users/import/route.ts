import { type NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getSession, derivePassword, phoneToEmail, PHONE_REGEX } from '@/lib/server/auth'
import { encryptDocumentNumber } from '@/lib/crypto'

/**
 * GET  /api/admin/users/import — Returns a downloadable CSV template with field names from the specification.
 * POST /api/admin/users/import — Bulk-creates up to 500 users server-side with leader assignment and guest details.
 *
 * Follows exact Field Names from the Payana Mitra App - Table Details sheet ("User Table" & "Guest Details Table"):
 *   User Id / Mobile Number — 10-15 digit phone number (required)
 *   First Name              — string max 50 (required)
 *   Last Name               — string max 50 (required)
 *   Role                    — Guest / Leader / Admin (default: Guest)
 *   Leader Name             — Leader name or 10-15 digit phone of assigned leader (optional)
 *   Date of Joining         — DD-MM-YYYY, DD/MM/YYYY, or YYYY-MM-DD (optional)
 *   Active / Inactive       — Active or Inactive (optional, default: Active)
 *   Location                — optional home location / city (max 50)
 *   email id                — optional contact e-mail
 *   Remarks                 — freeform notes (optional)
 *
 * Optional Guest Details columns (from "Guest Details Table"):
 *   Date of Birth / dob     — DD-MM-YYYY, DD/MM/YYYY, or YYYY-MM-DD
 *   PAN                     — 10-char alphanumeric
 *   Passport No.            — alphanumeric
 *   Passport Expiry Date    — DD-MM-YYYY or YYYY-MM-DD
 *   Passport Issued Location— string max 50
 *   Travel Insurance No.    — alphanumeric
 *   Travel Insurance Company— string max 50
 *   Travel Insurance Expiry Date — DD-MM-YYYY or YYYY-MM-DD
 *   Food Preference         — Veg or Non Veg (veg / non_veg)
 *   Food Allergy            — string max 50
 *   Emergency Contact Name  — string max 50
 *   Emergency Contact Number— 10-15 digits
 */

const ROLE_MAP: Record<string, 'traveller' | 'leader' | 'admin'> = {
  traveller: 'traveller',
  guest: 'traveller',
  student: 'traveller',
  leader: 'leader',
  trail_leader: 'leader',
  'trail leader': 'leader',
  admin: 'admin',
  administrator: 'admin',
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

  // DD-MM-YYYY or DD/MM/YYYY or DD.MM.YYYY (4-digit year)
  const dmy4 = clean.match(/^(\d{1,2})[-/. ](\d{1,2})[-/. ](\d{4})$/)
  if (dmy4) {
    const day = dmy4[1].padStart(2, '0')
    const month = dmy4[2].padStart(2, '0')
    const year = dmy4[3]
    return `${year}-${month}-${day}`
  }

  // DD-MM-YY or DD/MM/YY or DD.MM.YY (2-digit year)
  const dmy2 = clean.match(/^(\d{1,2})[-/. ](\d{1,2})[-/. ](\d{2})$/)
  if (dmy2) {
    const day = dmy2[1].padStart(2, '0')
    const month = dmy2[2].padStart(2, '0')
    const rawYy = parseInt(dmy2[3], 10)
    // 00-40 -> 2000-2040, 41-99 -> 1941-1999
    const year = rawYy <= 40 ? 2000 + rawYy : 1900 + rawYy
    return `${year}-${month}-${day}`
  }

  // YYYY-MM-DD or YYYY/MM/DD or YYYY.MM.DD
  const ymd = clean.match(/^(\d{4})[-/. ](\d{1,2})[-/. ](\d{1,2})$/)
  if (ymd) {
    const year = ymd[1]
    const month = ymd[2].padStart(2, '0')
    const day = ymd[3].padStart(2, '0')
    return `${year}-${month}-${day}`
  }

  return null
}

// ─── GET — download CSV template ─────────────────────────────────────────────
export async function GET(req: NextRequest) {
  const guard = await requireAdmin()
  if ('error' in guard) return NextResponse.json({ error: guard.error }, { status: guard.status })

  const type = req.nextUrl.searchParams.get('type')

  if (type === 'details' || type === 'guest_details') {
    // Template matching "Guest Details Table"
    const lines = [
      'Mobile Number,First Name,Last Name,Date of Birth,PAN,Passport No.,Passport Issue Date,Passport Expiry Date,Passport Issued Location,Visa No.,Visa Expiry Date,Country,Travel Insurance No.,Travel Insurance Company,Travel Insurance Expiry Date,Food Preference,Food Allergy,Emergency Contact Name,Emergency Contact Number',
      '9019911700,Arvind,Kamath,18/06/65,AAADK9754A,ZA495775,19/07/20,18/07/30,Bangalore,V123456789,15/08/28,Singapore,7103167389,TATA AIG,10/09/26,Veg,Peanuts and Milk,Anita Kamath,9019911700',
      '9876543210,Sunita,Sharma,12/04/85,,,,,,,,ICICI Lombard,15/08/27,Non Veg,,Ramesh Sharma,9876543211',
    ]
    return new NextResponse(lines.join('\n'), {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': 'attachment; filename="guest_details_import_template.csv"',
      },
    })
  }

  // Template matching User Table: Mobile Number is user id (single column), Active is handled on backend, DD/MM/YY supported, Referral's Name included
  const lines = [
    'Mobile Number,First Name,Last Name,Role,Leader Name,Date of Joining,Location,email id,Referral\'s Name',
    '9019911700,Arvind,Kamath,Guest,Anushree Kini,18/06/25,Bengaluru,arvindakamath@gmail.com,Ramesh Bhat',
    '9000000002,Anushree,Kini,Leader,,01/01/25,Bengaluru,anushree@payana.app,',
    '9876543210,Sunita,Sharma,Guest,Anushree Kini,10/02/25,Mysuru,sunita.sharma@example.com,Anita Rao',
    '9876543211,Rahul,Verma,Guest,Anushree Kini,15/03/25,Delhi,rahul.verma@example.com,',
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
    .select('id, phone, first_name, last_name, role') as { data: { id: string; phone: string; first_name: string; last_name: string; role: string }[] | null }

  const existingPhoneMap = new Map<string, string>()
  const leaderLookupMap = new Map<string, string>()

  for (const p of (existingProfiles ?? [])) {
    const clean = p.phone.replace(/\s+/g, '')
    existingPhoneMap.set(clean, p.id)
    if (clean.startsWith('+91')) {
      existingPhoneMap.set(clean.replace(/^\+91/, ''), p.id)
    } else {
      existingPhoneMap.set(`+91${clean}`, p.id)
    }

    if (['leader', 'admin'].includes(p.role)) {
      leaderLookupMap.set(p.id.toLowerCase(), p.id)
      leaderLookupMap.set(clean, p.id)
      if (clean.startsWith('+91')) {
        leaderLookupMap.set(clean.replace(/^\+91/, ''), p.id)
      } else {
        leaderLookupMap.set(`+91${clean}`, p.id)
      }

      const fullName = `${p.first_name} ${p.last_name}`.trim().toLowerCase()
      if (fullName) leaderLookupMap.set(fullName, p.id)
      const firstName = p.first_name.trim().toLowerCase()
      if (firstName && !leaderLookupMap.has(firstName)) leaderLookupMap.set(firstName, p.id)
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
  const isDetailsOnlyImport = req.nextUrl.searchParams.get('type') === 'details' || req.nextUrl.searchParams.get('type') === 'guest_details'

  for (let i = 0; i < rows.length; i++) {
    const raw = rows[i]
    const rowNum = i + 2

    // Field extraction supporting exact sheet names and common aliases
    const rawPhone = getField(raw, 'Mobile Number', 'MobileNumber', 'User Id', 'UserId', 'phone', 'phone_number').replace(/\s+/g, '')
    const first_name = getField(raw, 'First Name', 'FirstName', 'first_name', 'Guest 1st Name')
    const last_name  = getField(raw, 'Last Name', 'LastName', 'last_name', 'Guest Last Name')
    const rawRole    = getField(raw, 'Role', 'role') || 'Guest'
    const leaderInput = getField(raw, 'Leader Name', 'LeaderName', 'Leader', 'leader_phone', 'leader_id')
    const activeInput = getField(raw, 'Active / Inactive', 'Active/Inactive', 'Active', 'status', 'is_active')
    const location    = getField(raw, 'Location', 'location', 'city') || null
    const rawDoj      = getField(raw, 'Date of Joining', 'DateOfJoining', 'date_of_joining', 'doj')
    const email       = getField(raw, 'email id', 'email_id', 'email', 'e-mail') || null
    const remarks     = getField(raw, 'Remarks', 'remarks', 'notes') || null
    const referral_name = getField(raw, "Referral's Name", 'Referrals Name', 'Referral Name', 'Referral', 'Referred By', 'referral_name', 'referred_by') || null

    // Guest Details fields
    const rawDob         = getField(raw, 'Date of Birth', 'DateOfBirth', 'dob')
    const pan            = getField(raw, 'PAN', 'pan') || null
    const passportNo     = getField(raw, 'Passport No.', 'Passport No', 'Passport Number', 'passport_no') || null
    const rawPassIssue   = getField(raw, 'Passport Issue Date', 'Passport Issued Date', 'Passport Issue', 'passport_issue_date', 'passport_issued_date')
    const rawPassExp     = getField(raw, 'Passport Expiry Date', 'Passport Expiry', 'passport_expiry')
    const passLoc        = getField(raw, 'Passport Issued Location', 'Passport Issue Location', 'passport_issued_location') || null
    const visaNo         = getField(raw, 'Visa No.', 'Visa No', 'Visa Number', 'visa_no', 'visa_number') || null
    const rawVisaExp     = getField(raw, 'Visa Expiry Date', 'Visa Expiry', 'visa_expiry', 'visa_expiry_date')
    const visaCountry    = getField(raw, 'Country', 'Visa Country', 'visa_country', 'Visa Issued Country') || null
    const insNo          = getField(raw, 'Travel Insurance No.', 'Travel Insurance No', 'travel_insurance_no') || null
    const insCo          = getField(raw, 'Travel Insurance Company', 'insurance_company') || null
    const rawInsExp      = getField(raw, 'Travel Insurance Expiry Date', 'insurance_expiry')
    const rawFoodPref    = getField(raw, 'Food Preference', 'FoodPreference', 'food_preference', 'food_pref')
    const foodAllergy    = getField(raw, 'Food Allergy', 'Food Allergies', 'food_allergy') || null
    const emgName        = getField(raw, 'Emergency Contact Name', 'emergency_contact_name', 'emergency_name') || null
    const emgNo          = getField(raw, 'Emergency Contact Number', 'Emergency Contact No', 'emergency_contact_no', 'emergency_phone') || null

    // Field validation
    if (!PHONE_REGEX.test(rawPhone)) {
      results.push({ row: rowNum, phone: rawPhone || 'Row ' + rowNum, status: 'error', error: 'User Id / Mobile Number must be a valid 10-15 digit number' })
      continue
    }
    if (!first_name || first_name.length > 50) {
      results.push({ row: rowNum, phone: rawPhone, status: 'error', error: 'First Name is required (max 50 chars)' })
      continue
    }
    if (!last_name || last_name.length > 50) {
      results.push({ row: rowNum, phone: rawPhone, status: 'error', error: 'Last Name is required (max 50 chars)' })
      continue
    }

    const mappedRole = ROLE_MAP[rawRole.toLowerCase().trim()] || 'traveller'
    // Active is captured directly on the backend (default: active/true)
    const isInactive = activeInput ? (activeInput.toLowerCase() === 'inactive' || activeInput.toLowerCase() === 'no' || activeInput.toLowerCase() === 'off') : false
    const is_active = !isInactive

    if (location && location.length > 50) {
      results.push({ row: rowNum, phone: rawPhone, status: 'error', error: 'Location cannot exceed 50 characters' })
      continue
    }

    const date_of_joining = rawDoj ? parseDateString(rawDoj) : null
    if (rawDoj && !date_of_joining) {
      results.push({ row: rowNum, phone: rawPhone, status: 'error', error: `Date of Joining "${rawDoj}" is invalid. Use DD/MM/YY, DD-MM-YYYY, or YYYY-MM-DD.` })
      continue
    }

    // Optional guest details validation
    const dob = rawDob ? parseDateString(rawDob) : null
    if (rawDob && !dob) {
      results.push({ row: rowNum, phone: rawPhone, status: 'error', error: `Date of Birth "${rawDob}" is invalid. Use DD-MM-YYYY or YYYY-MM-DD.` })
      continue
    }

    let mappedFoodPref: 'veg' | 'non_veg' | null = null
    if (rawFoodPref) {
      const cleanFp = rawFoodPref.trim().toLowerCase()
      if (['veg', 'vegetarian'].includes(cleanFp)) {
        mappedFoodPref = 'veg'
      } else if (['non_veg', 'non-veg', 'nonveg', 'non_vegetarian', 'non-vegetarian', 'non vegetarian'].includes(cleanFp)) {
        mappedFoodPref = 'non_veg'
      } else {
        results.push({ row: rowNum, phone: rawPhone, status: 'error', error: 'food_preference must be veg or non_veg' })
        continue
      }
    }

    if (foodAllergy && foodAllergy.length > 50) {
      results.push({ row: rowNum, phone: rawPhone, status: 'error', error: 'food_allergy cannot exceed 50 characters' })
      continue
    }
    if (emgName && emgName.length > 50) {
      results.push({ row: rowNum, phone: rawPhone, status: 'error', error: 'emergency_contact_name cannot exceed 50 characters' })
      continue
    }
    if (emgNo && !PHONE_REGEX.test(emgNo)) {
      results.push({ row: rowNum, phone: rawPhone, status: 'error', error: 'emergency_contact_no must be a valid 10-15 digit number' })
      continue
    }

    const insurance_expiry = rawInsExp ? parseDateString(rawInsExp) : null

    // Leader lookup
    let leader_id: string | null = null
    if (leaderInput) {
      if (['leader', 'admin'].includes(mappedRole)) {
        results.push({ row: rowNum, phone: rawPhone, status: 'error', error: 'Leaders and admins cannot be assigned a leader' })
        continue
      }
      const cleanInput = leaderInput.trim().toLowerCase()
      leader_id = leaderLookupMap.get(cleanInput) ?? leaderLookupMap.get(cleanInput.replace(/\s+/g, '')) ?? null
      if (!leader_id) {
        results.push({ row: rowNum, phone: rawPhone, status: 'error', error: `Assigned leader "${leaderInput}" not found. Enter leader's full name or phone number.` })
        continue
      }
    }

    // Duplicate detection / handling
    const existingUserId = existingPhoneMap.get(rawPhone)
    if (existingUserId) {
      // Update referral name if present
      if (referral_name) {
        try {
          await (admin.from('profiles') as any).update({ referral_name }).eq('id', existingUserId)
        } catch {
          // Ignore if column not yet added
        }
      }

      // If user already exists and this is details table import or row contains guest details, update details
      const hasExistingGuestDetails = isDetailsOnlyImport || Boolean(
        dob || mappedFoodPref || rawFoodPref || foodAllergy || emgName || emgNo || insNo || insCo || passLoc || passportNo || rawPassIssue || rawPassExp || visaNo || rawVisaExp || visaCountry || pan
      )

      if (hasExistingGuestDetails) {
        try {
          const food_preference = mappedFoodPref ?? (rawFoodPref ? (rawFoodPref.toLowerCase().includes('non') ? 'non_veg' : 'veg') : null)
          const passport_issue_date = rawPassIssue ? parseDateString(rawPassIssue) : null
          const visa_expiry = rawVisaExp ? parseDateString(rawVisaExp) : null
          const cleanVisaNo = visaNo ? visaNo.trim().toUpperCase() : null

          try {
            await (admin.from('traveller_details') as any).upsert({
              user_id: existingUserId,
              dob,
              food_preference,
              food_allergy: foodAllergy,
              emergency_contact_name: emgName,
              emergency_contact_no: emgNo,
              travel_insurance_no: insNo,
              insurance_company: insCo,
              insurance_expiry,
              passport_issued_location: passLoc,
              passport_issue_date,
              visa_no: cleanVisaNo,
              visa_expiry,
              visa_country: visaCountry,
            }, { onConflict: 'user_id' })
          } catch {
            await (admin.from('traveller_details') as any).upsert({
              user_id: existingUserId,
              dob,
              food_preference,
              food_allergy: foodAllergy,
              emergency_contact_name: emgName,
              emergency_contact_no: emgNo,
              travel_insurance_no: insNo,
              insurance_company: insCo,
              insurance_expiry,
              passport_issued_location: passLoc,
            }, { onConflict: 'user_id' })
          }

          if (pan) {
            const enc = encryptDocumentNumber(pan)
            await admin.from('guest_documents').insert({
              user_id: existingUserId,
              doc_type: 'pan',
              ...enc,
            })
          }
          if (passportNo) {
            const enc = encryptDocumentNumber(passportNo)
            const expiry_date = rawPassExp ? parseDateString(rawPassExp) : null
            const issued_date = rawPassIssue ? parseDateString(rawPassIssue) : null
            await admin.from('guest_documents').insert({
              user_id: existingUserId,
              doc_type: 'passport',
              issued_date,
              expiry_date,
              issued_country: passLoc || 'India',
              ...enc,
            })
          }
          if (cleanVisaNo) {
            const enc = encryptDocumentNumber(cleanVisaNo)
            const expiry_date = rawVisaExp ? parseDateString(rawVisaExp) : null
            await admin.from('guest_documents').insert({
              user_id: existingUserId,
              doc_type: 'visa',
              expiry_date,
              issued_country: visaCountry || null,
              ...enc,
            })
          }
          results.push({ row: rowNum, phone: rawPhone, status: 'created', id: existingUserId })
          continue
        } catch (detailErr) {
          results.push({ row: rowNum, phone: rawPhone, status: 'error', error: String(detailErr) })
          continue
        }
      }

      // Standard user import skips existing phones without resetting credentials
      results.push({ row: rowNum, phone: rawPhone, status: 'skipped', error: 'User Id / Mobile Number already registered' })
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

      const insertPayload: Record<string, unknown> = {
        id: authData.user.id,
        phone: rawPhone,
        first_name,
        last_name,
        role: mappedRole,
        leader_id,
        email,
        location,
        date_of_joining,
        referral_name,
        remarks,
        must_change_password: false,
        is_active,
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let { data: profileData, error: profileErr } = await (admin.from('profiles') as any)
        .insert(insertPayload)
        .select('id')
        .single()

      if (profileErr && profileErr.message?.includes('referral_name')) {
        delete insertPayload.referral_name
        const retry = await (admin.from('profiles') as any)
          .insert(insertPayload)
          .select('id')
          .single()
        profileData = retry.data
        profileErr = retry.error
      }

      if (profileErr) {
        await admin.auth.admin.deleteUser(authData.user.id)
        results.push({ row: rowNum, phone: rawPhone, status: 'error', error: profileErr.message })
        continue
      }

      const createdUserId = profileData.id

      // Only write guest-specific details for Guest/traveller users if provided
      const food_preference = mappedFoodPref ?? (rawFoodPref ? (rawFoodPref.toLowerCase().includes('non') ? 'non_veg' : 'veg') : null)
      const passport_issue_date = rawPassIssue ? parseDateString(rawPassIssue) : null
      const visa_expiry = rawVisaExp ? parseDateString(rawVisaExp) : null
      const cleanVisaNo = visaNo ? visaNo.trim().toUpperCase() : null

      const hasGuestDetails = mappedRole === 'traveller' && Boolean(
        dob || food_preference || foodAllergy || emgName || emgNo || insNo || insCo || passLoc || passport_issue_date || cleanVisaNo || visa_expiry || visaCountry
      )

      if (hasGuestDetails) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        let tdErr: any = null
        try {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const res = await (admin.from('traveller_details') as any).upsert({
            user_id: createdUserId,
            dob,
            food_preference,
            food_allergy: foodAllergy,
            emergency_contact_name: emgName,
            emergency_contact_no: emgNo,
            travel_insurance_no: insNo,
            insurance_company: insCo,
            insurance_expiry,
            passport_issued_location: passLoc,
            passport_issue_date,
            visa_no: cleanVisaNo,
            visa_expiry,
            visa_country: visaCountry,
          }, { onConflict: 'user_id' })
          tdErr = res.error
        } catch {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const res = await (admin.from('traveller_details') as any).upsert({
            user_id: createdUserId,
            dob,
            food_preference,
            food_allergy: foodAllergy,
            emergency_contact_name: emgName,
            emergency_contact_no: emgNo,
            travel_insurance_no: insNo,
            insurance_company: insCo,
            insurance_expiry,
            passport_issued_location: passLoc,
          }, { onConflict: 'user_id' })
          tdErr = res.error
        }

        if (tdErr) {
          // Compensating cleanup to prevent orphan auth user and profile
          await admin.from('profiles').delete().eq('id', createdUserId)
          await admin.auth.admin.deleteUser(createdUserId)
          results.push({ row: rowNum, phone: rawPhone, status: 'error', error: `Failed to save guest details: ${tdErr.message}` })
          continue
        }
      }

      if (pan) {
        const enc = encryptDocumentNumber(pan)
        await admin.from('guest_documents').insert({
          user_id: createdUserId,
          doc_type: 'pan',
          ...enc,
        })
      }
      if (passportNo) {
        const enc = encryptDocumentNumber(passportNo)
        const expiry_date = rawPassExp ? parseDateString(rawPassExp) : null
        const issued_date = rawPassIssue ? parseDateString(rawPassIssue) : null
        await admin.from('guest_documents').insert({
          user_id: createdUserId,
          doc_type: 'passport',
          issued_date,
          expiry_date,
          issued_country: passLoc || 'India',
          ...enc,
        })
      }
      if (cleanVisaNo) {
        const enc = encryptDocumentNumber(cleanVisaNo)
        const expiry_date = rawVisaExp ? parseDateString(rawVisaExp) : null
        await admin.from('guest_documents').insert({
          user_id: createdUserId,
          doc_type: 'visa',
          expiry_date,
          issued_country: visaCountry || null,
          ...enc,
        })
      }

      // Record in map to prevent duplicate inserts within the same batch
      existingPhoneMap.set(rawPhone, createdUserId)
      if (rawPhone.startsWith('+91')) {
        existingPhoneMap.set(rawPhone.replace(/^\+91/, ''), createdUserId)
      } else {
        existingPhoneMap.set(`+91${rawPhone}`, createdUserId)
      }
      if (['leader', 'admin'].includes(mappedRole)) {
        leaderLookupMap.set(rawPhone, createdUserId)
        const fullName = `${first_name} ${last_name}`.trim().toLowerCase()
        if (fullName) leaderLookupMap.set(fullName, createdUserId)
      }

      results.push({ row: rowNum, phone: rawPhone, status: 'created', id: createdUserId })
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
