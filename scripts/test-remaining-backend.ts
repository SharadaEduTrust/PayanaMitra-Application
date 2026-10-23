/**
 * scripts/test-remaining-backend.ts
 *
 * Automated verification suite for the three remaining backend items:
 *   1. Survey API authorization (Guest-only, active account, trip membership) and Admin retrieval
 *   2. Document metadata schema (issued_date, issued_place) and legacy compatibility (issued_country)
 *   3. Extended Guest CSV import (dob, food_preference, food_allergy, emergency_contact_name, emergency_contact_no)
 *
 * Execution:
 *   npx tsx scripts/test-remaining-backend.ts
 */

import * as dotenv from 'dotenv'
import { resolve } from 'path'
import { createClient } from '@supabase/supabase-js'

dotenv.config({ path: resolve(process.cwd(), '.env.local') })

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!
const AUTH_PEPPER = process.env.AUTH_PEPPER!
const API_BASE = process.env.TEST_API_BASE || 'http://localhost:3000'

if (!SUPABASE_URL || !ANON_KEY || !SERVICE_KEY || !AUTH_PEPPER) {
  console.error('❌ Missing required environment variables')
  process.exit(1)
}

const adminClient = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
})

let passed = 0
let failed = 0

function check(testName: string, condition: boolean, details?: string) {
  if (condition) {
    console.log(`  ✅ PASS: ${testName}`)
    passed++
  } else {
    console.log(`  ❌ FAIL: ${testName}${details ? ` -> ${details}` : ''}`)
    failed++
  }
}

async function derivePassword(phone: string, pin: string): Promise<string> {
  const enc = new TextEncoder()
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    enc.encode(AUTH_PEPPER),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const message = enc.encode(`${phone}:${pin}`)
  const signature = await crypto.subtle.sign('HMAC', keyMaterial, message)
  return Buffer.from(signature).toString('base64url')
}

async function loginAndGetToken(phone: string, pin: string): Promise<string> {
  const client = createClient(SUPABASE_URL, ANON_KEY, {
    auth: { persistSession: false },
  })
  const email = `${phone.replace(/^\+/, '')}@payana.app`
  const password = await derivePassword(phone, pin)
  const { data, error } = await client.auth.signInWithPassword({ email, password })
  if (error || !data.session) {
    throw new Error(`Login failed for ${phone}: ${error?.message}`)
  }
  return data.session.access_token
}

async function run() {
  console.log('\n============================================================')
  console.log('🧪 REMAINING BACKEND WORK ITEMS VERIFICATION SUITE')
  console.log('============================================================\n')

  const uniqueSuffix = Date.now().toString().slice(-6)
  const testTripCode = `TRIP-VERIFY-${uniqueSuffix}`

  let adminToken = ''
  let leaderToken = ''
  let guestToken = ''

  let createdTripId = ''
  const createdAuthUserIds: string[] = []
  const createdDocIds: string[] = []

  try {
    // ── Setup personas ────────────────────────────────────────────────────────
    console.log('[Setup] Authenticating test personas...')
    adminToken = await loginAndGetToken('9000000001', '0001')
    leaderToken = await loginAndGetToken('9000000002', '0002')
    guestToken = await loginAndGetToken('9000000003', '0003')
    console.log('  ✓ Authenticated Admin, Leader, and Guest successfully.\n')

    // Look up guest profile
    const { data: guestProfile } = await adminClient
      .from('profiles')
      .select('id')
      .eq('phone', '9000000003')
      .single()

    const guestId = guestProfile?.id
    if (!guestId) throw new Error('Guest profile 9000000003 not found')

    // Create a dedicated test trip
    const { data: tripData } = await adminClient
      .from('trips')
      .insert({
        trip_code: testTripCode,
        name: 'Survey & Document Verification Trail',
        status: 'published',
      })
      .select('id')
      .single()

    if (!tripData?.id) throw new Error('Failed to create test trip')
    createdTripId = tripData.id

    // ──────────────────────────────────────────────────────────────────────────
    // TASK 1: SURVEY API AUTHORIZATION & ADMIN RETRIEVAL
    // ──────────────────────────────────────────────────────────────────────────
    console.log('[1] Task 1: Survey Submission Authorization & Admin Retrieval')

    // 1A. Unauthenticated request -> 401
    const unauthSurveyRes = await fetch(`${API_BASE}/api/survey`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        trip_id: createdTripId,
        responses: [{ question: 'How was the trek?', answer: 'Great' }],
      }),
    })
    check('Unauthenticated survey submission returns 401 Unauthorized', unauthSurveyRes.status === 401, `Status: ${unauthSurveyRes.status}`)

    // 1B. Admin attempting survey submission -> 403 (Only Guests/traveller allowed)
    const adminSurveyRes = await fetch(`${API_BASE}/api/survey`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${adminToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        trip_id: createdTripId,
        responses: [{ question: 'How was the trek?', answer: 'Admin response' }],
      }),
    })
    check('Admin survey submission returns 403 Forbidden', adminSurveyRes.status === 403, `Status: ${adminSurveyRes.status}`)

    // 1C. Leader attempting survey submission -> 403
    const leaderSurveyRes = await fetch(`${API_BASE}/api/survey`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${leaderToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        trip_id: createdTripId,
        responses: [{ question: 'How was the trek?', answer: 'Leader response' }],
      }),
    })
    check('Leader survey submission returns 403 Forbidden', leaderSurveyRes.status === 403, `Status: ${leaderSurveyRes.status}`)

    // 1D. Guest submission on trip they are NOT enrolled in -> 403
    const nonMemberSurveyRes = await fetch(`${API_BASE}/api/survey`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${guestToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        trip_id: createdTripId,
        responses: [{ question: 'How was the trek?', answer: 'Not a member yet' }],
      }),
    })
    check('Non-member guest survey submission returns 403 Forbidden', nonMemberSurveyRes.status === 403, `Status: ${nonMemberSurveyRes.status}`)

    // 1E. Enrol guest into trip and test valid submission
    await adminClient.from('trip_members').insert({ trip_id: createdTripId, user_id: guestId })

    const validSurveyRes = await fetch(`${API_BASE}/api/survey`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${guestToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        trip_id: createdTripId,
        responses: [
          { question: 'Pacing quality', answer: 'Smooth and enjoyable' },
          { question: 'Camp arrangements', answer: 'Well organized tents' },
        ],
      }),
    })
    const validSurveyJson = await validSurveyRes.json()
    check('Enrolled guest survey submission returns 201 with 2 responses', validSurveyRes.status === 201 && validSurveyJson.submitted === 2, `Status: ${validSurveyRes.status}, Submitted: ${validSurveyJson.submitted}`)

    // 1F. Invalid empty submission -> 422
    const emptySurveyRes = await fetch(`${API_BASE}/api/survey`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${guestToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        trip_id: createdTripId,
        responses: [],
      }),
    })
    check('Empty survey responses array rejected with 422', emptySurveyRes.status === 422, `Status: ${emptySurveyRes.status}`)

    // 1G. Admin survey retrieval endpoint
    const adminGetSurveysRes = await fetch(`${API_BASE}/api/admin/trips/${createdTripId}/surveys`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    })
    const adminGetSurveysJson = await adminGetSurveysRes.json()
    check(
      'Admin retrieves survey responses for trip (200 OK with formatted rows and user details)',
      adminGetSurveysRes.status === 200 && adminGetSurveysJson.total >= 2 && !!adminGetSurveysJson.data[0]?.user?.phone,
      `Total: ${adminGetSurveysJson.total}`
    )

    // 1H. Guest unauthorized access to Admin survey retrieval -> 403
    const guestGetSurveysRes = await fetch(`${API_BASE}/api/admin/trips/${createdTripId}/surveys`, {
      headers: { Authorization: `Bearer ${guestToken}` },
    })
    check('Guest cannot access admin survey retrieval (403 Forbidden)', guestGetSurveysRes.status === 403, `Status: ${guestGetSurveysRes.status}`)

    // 1I. Nonexistent trip survey retrieval -> 404
    const notFoundSurveysRes = await fetch(`${API_BASE}/api/admin/trips/00000000-0000-0000-0000-000000000000/surveys`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    })
    check('Non-existent trip returns 404 Trip not found', notFoundSurveysRes.status === 404, `Status: ${notFoundSurveysRes.status}`)

    // ──────────────────────────────────────────────────────────────────────────
    // TASK 2: DOCUMENT METADATA SCHEMA & API ALIGNMENT
    // ──────────────────────────────────────────────────────────────────────────
    console.log('\n[2] Task 2: Document Metadata (issued_date & issued_place)')

    // 2A. Create document with issued_date and issued_place
    const docWithPlaceRes = await fetch(`${API_BASE}/api/documents`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${guestToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        doc_type: 'passport',
        doc_number: `PASS-VERIFY-${uniqueSuffix}`,
        issued_date: '2022-04-10',
        issued_place: 'Bangalore RPO',
        expiry_date: '2032-04-09',
        trip_id: createdTripId,
      }),
    })
    const docWithPlaceJson = await docWithPlaceRes.json()
    const doc1Id = docWithPlaceJson.data?.id
    if (doc1Id) createdDocIds.push(doc1Id)

    check(
      'Document creation accepts issued_date and issued_place (201 Created)',
      docWithPlaceRes.status === 201 && docWithPlaceJson.data?.issued_place === 'Bangalore RPO',
      `Status: ${docWithPlaceRes.status}, Place: ${docWithPlaceJson.data?.issued_place}`
    )

    // 2B. Backward compatibility: Create document with legacy issued_country
    const docLegacyRes = await fetch(`${API_BASE}/api/documents`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${guestToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        doc_type: 'visa',
        doc_number: `VISA-VERIFY-${uniqueSuffix}`,
        issued_country: 'India',
        trip_id: createdTripId,
      }),
    })
    const docLegacyJson = await docLegacyRes.json()
    const doc2Id = docLegacyJson.data?.id
    if (doc2Id) createdDocIds.push(doc2Id)

    check(
      'Document creation maps legacy issued_country to issued_place transparently',
      docLegacyRes.status === 201 && (docLegacyJson.data?.issued_place === 'India' || docLegacyJson.data?.issued_country === 'India'),
      `Status: ${docLegacyRes.status}, Place: ${docLegacyJson.data?.issued_place}, Country: ${docLegacyJson.data?.issued_country}`
    )

    // 2C. Update document via PATCH /api/documents/[id] with issued_date and issued_place
    if (doc1Id) {
      const patchDocRes = await fetch(`${API_BASE}/api/documents/${doc1Id}`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${guestToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          issued_place: 'New Delhi RPO',
          issued_date: '2023-01-01',
        }),
      })
      const patchDocJson = await patchDocRes.json()
      check(
        'PATCH /api/documents/[id] updates issued_place and issued_date (200 OK)',
        patchDocRes.status === 200 && patchDocJson.data?.issued_place === 'New Delhi RPO',
        `Status: ${patchDocRes.status}, Place: ${patchDocJson.data?.issued_place}`
      )
    }

    // 2D. Invalid issued_date format rejected with 422
    const invalidDateDocRes = await fetch(`${API_BASE}/api/documents`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${guestToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        doc_type: 'passport',
        doc_number: '12345678',
        issued_date: '10-04-2022', // invalid format (not YYYY-MM-DD)
      }),
    })
    check('Invalid issued_date format rejected with 422', invalidDateDocRes.status === 422, `Status: ${invalidDateDocRes.status}`)

    // ──────────────────────────────────────────────────────────────────────────
    // TASK 3: EXTEND GUEST CSV IMPORT
    // ──────────────────────────────────────────────────────────────────────────
    console.log('\n[3] Task 3: Extended Guest CSV Import')

    // 3A. Template download includes new columns
    const templateRes = await fetch(`${API_BASE}/api/admin/users/import`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    })
    const templateText = await templateRes.text()
    check(
      'Downloadable CSV template contains extended guest detail columns',
      templateRes.status === 200 && templateText.includes('food_preference') && templateText.includes('emergency_contact_name'),
      `Template header line: ${templateText.split('\n')[0]}`
    )

    // 3B. Import CSV with extended guest details for traveller
    const csvPhone1 = `98${uniqueSuffix}01`
    const csvPhone2 = `98${uniqueSuffix}02`
    const csvContent = [
      'phone,first_name,last_name,role,leader_phone,email,location,date_of_joining,remarks,dob,food_preference,food_allergy,emergency_contact_name,emergency_contact_no',
      `${csvPhone1},Rohan,Sharma,guest,,rohan@example.com,Mysuru,2026-01-01,Test Guest,1992-07-15,veg,Peanut allergy,Kavita Sharma,9876543210`,
      `${csvPhone2},Alok,Nath,leader,,alok@example.com,Bengaluru,2026-01-01,Test Leader,1980-01-01,veg,None,Parent,9876543211`,
    ].join('\n')

    const formData = new FormData()
    formData.append('file', new Blob([csvContent], { type: 'text/csv' }), 'guests.csv')

    const importRes = await fetch(`${API_BASE}/api/admin/users/import`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${adminToken}` },
      body: formData,
    })
    const importJson = await importRes.json()

    check(
      'CSV import creates 2 users with 0 errors',
      importRes.status === 200 && importJson.created === 2 && importJson.errorCount === 0,
      `Created: ${importJson.created}, Errors: ${importJson.errorCount}`
    )

    // Verify traveller_details were written for traveller Rohan
    const rohanResult = (importJson.results ?? []).find((r: { phone: string }) => r.phone === csvPhone1)
    if (rohanResult?.id) {
      createdAuthUserIds.push(rohanResult.id)
      const { data: tdRohan } = await adminClient
        .from('traveller_details')
        .select('*')
        .eq('user_id', rohanResult.id)
        .maybeSingle()

      check(
        'Database contains traveller_details with exact DOB, food preference, allergy, and emergency contacts',
        tdRohan !== null &&
          tdRohan.dob === '1992-07-15' &&
          tdRohan.food_preference === 'veg' &&
          tdRohan.food_allergy === 'Peanut allergy' &&
          tdRohan.emergency_contact_name === 'Kavita Sharma' &&
          tdRohan.emergency_contact_no === '9876543210',
        `DB Record: ${JSON.stringify(tdRohan)}`
      )
    }

    // Verify traveller_details were NOT created for leader Alok
    const alokResult = (importJson.results ?? []).find((r: { phone: string }) => r.phone === csvPhone2)
    if (alokResult?.id) {
      createdAuthUserIds.push(alokResult.id)
      const { data: tdAlok } = await adminClient
        .from('traveller_details')
        .select('*')
        .eq('user_id', alokResult.id)
        .maybeSingle()

      check(
        'Leader import creates profile but does NOT populate traveller_details',
        tdAlok === null,
        `Leader td record exists: ${!!tdAlok}`
      )
    }

    // 3C. Invalid food preference row reported as error
    const badCsvPhone = `98${uniqueSuffix}03`
    const badCsvContent = [
      'phone,first_name,last_name,role,leader_phone,email,location,date_of_joining,remarks,dob,food_preference,food_allergy,emergency_contact_name,emergency_contact_no',
      `${badCsvPhone},BadFood,User,guest,,,,,,,pizza,,,`,
    ].join('\n')

    const badFormData = new FormData()
    badFormData.append('file', new Blob([badCsvContent], { type: 'text/csv' }), 'bad_guest.csv')

    const badImportRes = await fetch(`${API_BASE}/api/admin/users/import`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${adminToken}` },
      body: badFormData,
    })
    const badImportJson = await badImportRes.json()
    const badRow = (badImportJson.results ?? []).find((r: { phone: string }) => r.phone === badCsvPhone)

    check(
      'Invalid food_preference ("pizza") reported with row-level error',
      badImportRes.status === 200 && badRow?.status === 'error' && badRow?.error?.includes('food_preference'),
      `Status: ${badRow?.status}, Error: ${badRow?.error}`
    )

    // 3D. Duplicate re-import skips existing phones without resetting credentials
    const dupFormData = new FormData()
    dupFormData.append('file', new Blob([csvContent], { type: 'text/csv' }), 'dup.csv')

    const dupImportRes = await fetch(`${API_BASE}/api/admin/users/import`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${adminToken}` },
      body: dupFormData,
    })
    const dupImportJson = await dupImportRes.json()

    check(
      'Re-import skips existing phones and does not overwrite credentials',
      dupImportRes.status === 200 && dupImportJson.skipped === 2 && dupImportJson.created === 0,
      `Skipped: ${dupImportJson.skipped}, Created: ${dupImportJson.created}`
    )
  } finally {
    // ── Teardown isolated test artifacts ──────────────────────────────────────
    console.log('\n[Teardown] Cleaning up synthetic test artifacts...')

    if (createdTripId) {
      await adminClient.from('survey_responses').delete().eq('trip_id', createdTripId)
      await adminClient.from('trip_members').delete().eq('trip_id', createdTripId)
      await adminClient.from('trips').delete().eq('id', createdTripId)
    }

    for (const docId of createdDocIds) {
      await adminClient.from('guest_documents').delete().eq('id', docId)
    }

    for (const userId of createdAuthUserIds) {
      await adminClient.from('traveller_details').delete().eq('user_id', userId)
      await adminClient.from('profiles').delete().eq('id', userId)
      await adminClient.auth.admin.deleteUser(userId)
    }

    console.log('  ✓ Cleanup complete.\n')
  }

  console.log('============================================================')
  console.log(`📊 TEST RESULTS: ${passed} PASSED, ${failed} FAILED`)
  console.log('============================================================\n')

  if (failed > 0) {
    process.exit(1)
  }
}

run().catch(err => {
  console.error('Fatal test error:', err)
  process.exit(1)
})
