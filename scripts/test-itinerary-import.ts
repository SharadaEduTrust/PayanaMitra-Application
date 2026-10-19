/**
 * scripts/test-itinerary-import.ts
 *
 * Dedicated End-to-End Automated Test Suite for Itinerary CSV Import & Meal-Plan Validation.
 * Tests against running server (TEST_API_BASE or http://localhost:3000) and Supabase database.
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
  console.log('============================================================')
  console.log('🧪 ITINERARY CSV IMPORT END-TO-END AUTOMATED TEST SUITE')
  console.log('============================================================\n')

  const testPhoneAdmin = '9000000001'
  const testPhoneGuest = '9000000003'
  let adminToken = ''
  let guestToken = ''

  console.log('[Setup] Authenticating test personas...')
  adminToken = await loginAndGetToken(testPhoneAdmin, '0001')
  guestToken = await loginAndGetToken(testPhoneGuest, '0003')
  console.log('  ✓ Admin and Guest authenticated successfully.\n')

  const testTripCode = `TRIP-CSV-${Date.now().toString().slice(-6)}`
  let testTripId = ''

  try {
    // ──────────────────────────────────────────────────────────────────────────
    // 1. CREATE DEDICATED TEST TRIP
    // ──────────────────────────────────────────────────────────────────────────
    console.log('[1] Setting Up Dedicated Test Trip (Synthetic Data Isolation)')
    const tripRes = await fetch(`${API_BASE}/api/admin/trips`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${adminToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        trip_code: testTripCode,
        name: 'CSV Itinerary Validation Expedition',
        destination: 'Kodagu, Karnataka',
        start_date: '2026-12-01',
        end_date: '2026-12-10',
        remarks: 'Dedicated isolated synthetic test trip',
      }),
    })
    const tripJson = await tripRes.json()
    testTripId = tripJson.data?.id
    check('Dedicated test trip created with 201', tripRes.status === 201 && !!testTripId, `Status: ${tripRes.status}, ID: ${testTripId}`)

    if (!testTripId) {
      throw new Error('Failed to create test trip; aborting suite.')
    }

    // ──────────────────────────────────────────────────────────────────────────
    // 2. TEST VALID MEAL PLANS
    // ──────────────────────────────────────────────────────────────────────────
    console.log('\n[2] Test Valid Meal Plans')
    const validCsv = [
      'day_number,destination,hotel_name,meal_plan,itinerary_text,activity_title,activity_description,start_time,end_time,activity_order',
      '1,Madikeri,Heritage Resort,"Breakfast","Arrival and orientation",Welcome Briefing,"Orientation meeting",14:00,15:00,1',
      '2,Madikeri,Heritage Resort,"Breakfast & Dinner","Plantation trek",Estate Walk,"Guided nature walk",09:00,11:30,1',
      '3,Kushalnagar,River Camp,"Breakfast, Lunch & Dinner","Full day river expedition",Bamboo Rafting,"River rafting",09:30,14:00,1',
      '4,Kushalnagar,River Camp,"","Leisure day at camp",Campfire Evening,"Evening social",18:00,20:00,1',
    ].join('\n')

    const validFormData = new FormData()
    validFormData.append('file', new Blob([validCsv], { type: 'text/csv' }), 'valid_itinerary.csv')

    const validRes = await fetch(`${API_BASE}/api/admin/trips/${testTripId}/itinerary/import`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${adminToken}` },
      body: validFormData,
    })
    const validJson = await validRes.json()
    console.log('  -> API Response:', JSON.stringify(validJson))

    check(
      'Valid meal plans import returns 200 with 4 days upserted and 0 skipped',
      validRes.status === 200 && validJson.days_upserted === 4 && validJson.skipped === 0 && validJson.errors?.length === 0,
      `Status: ${validRes.status}, Upserted: ${validJson.days_upserted}, Skipped: ${validJson.skipped}`
    )

    // Database verification for valid meal plans
    const { data: dbDaysValid } = await adminClient
      .from('itinerary_days')
      .select('day_number, meal_plan, destination')
      .eq('trip_id', testTripId)
      .in('day_number', [1, 2, 3, 4])
      .order('day_number', { ascending: true })

    console.log('  -> Database Records:', JSON.stringify(dbDaysValid))

    const day1 = dbDaysValid?.find(d => d.day_number === 1)
    const day2 = dbDaysValid?.find(d => d.day_number === 2)
    const day3 = dbDaysValid?.find(d => d.day_number === 3)
    const day4 = dbDaysValid?.find(d => d.day_number === 4)

    check('Day 1 meal_plan matches "Breakfast"', day1?.meal_plan === 'Breakfast', `Actual: ${day1?.meal_plan}`)
    check('Day 2 meal_plan matches "Breakfast & Dinner"', day2?.meal_plan === 'Breakfast & Dinner', `Actual: ${day2?.meal_plan}`)
    check('Day 3 meal_plan matches "Breakfast, Lunch & Dinner"', day3?.meal_plan === 'Breakfast, Lunch & Dinner', `Actual: ${day3?.meal_plan}`)
    check('Day 4 empty meal_plan stored as null', day4?.meal_plan === null, `Actual: ${day4?.meal_plan}`)

    // ──────────────────────────────────────────────────────────────────────────
    // 3. TEST INVALID MEAL PLANS
    // ──────────────────────────────────────────────────────────────────────────
    console.log('\n[3] Test Invalid Meal Plans (Skipping, Row Reporting, No Silent Conversion)')
    const invalidCsv = [
      'day_number,destination,hotel_name,meal_plan,itinerary_text,activity_title,activity_description,start_time,end_time,activity_order',
      '10,Somwarpet,Hilltop Stay,"All Inclusive","Invalid meal plan",Coffee Tasting,"Taste regional blends",10:00,11:00,1',
      '11,Somwarpet,Hilltop Stay,"Invalid Plan Pizza","Unsupported plan",Sunset Point,"Watch sunset",17:00,18:30,1',
      '12,Somwarpet,Hilltop Stay,"breakfast","Wrong case/spelling",Morning Yoga,"Yoga session",06:30,07:30,1',
    ].join('\n')

    const invalidFormData = new FormData()
    invalidFormData.append('file', new Blob([invalidCsv], { type: 'text/csv' }), 'invalid_plans.csv')

    const invalidRes = await fetch(`${API_BASE}/api/admin/trips/${testTripId}/itinerary/import`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${adminToken}` },
      body: invalidFormData,
    })
    const invalidJson = await invalidRes.json()
    console.log('  -> API Response:', JSON.stringify(invalidJson))

    check(
      'All invalid meal plan rows rejected with status 422 and skipped=3',
      invalidRes.status === 422 && invalidJson.skipped === 3 && invalidJson.errors?.length === 3,
      `Status: ${invalidRes.status}, Skipped: ${invalidJson.skipped}, Errors: ${invalidJson.errors?.length}`
    )

    const errRow2 = invalidJson.errors?.find((e: { row: number }) => e.row === 2)
    const errRow3 = invalidJson.errors?.find((e: { row: number }) => e.row === 3)
    const errRow4 = invalidJson.errors?.find((e: { row: number }) => e.row === 4)

    check(
      'Error for row 2 mentions "All Inclusive" and supported values',
      errRow2?.error.includes('All Inclusive') && errRow2?.error.includes('Breakfast, Lunch & Dinner'),
      `Row 2 error: ${errRow2?.error}`
    )
    check(
      'Error for row 3 mentions "Invalid Plan Pizza"',
      errRow3?.error.includes('Invalid Plan Pizza'),
      `Row 3 error: ${errRow3?.error}`
    )
    check(
      'Error for row 4 mentions unsupported case "breakfast"',
      errRow4?.error.includes('breakfast'),
      `Row 4 error: ${errRow4?.error}`
    )

    // Verify DB does not contain rows 10, 11, 12
    const { data: dbDaysInvalid } = await adminClient
      .from('itinerary_days')
      .select('id, day_number, meal_plan')
      .eq('trip_id', testTripId)
      .in('day_number', [10, 11, 12])

    check(
      'Database contains zero records for rejected days 10, 11, 12 (no silent conversion/persistence)',
      (dbDaysInvalid?.length ?? 0) === 0,
      `Count: ${dbDaysInvalid?.length}`
    )

    // ──────────────────────────────────────────────────────────────────────────
    // 4. TEST PARTIAL IMPORTS
    // ──────────────────────────────────────────────────────────────────────────
    console.log('\n[4] Test Partial Imports (Valid Saved, Invalid Skipped, No Duplicate Retries)')
    const partialCsv = [
      'day_number,destination,hotel_name,meal_plan,itinerary_text,activity_title,activity_description,start_time,end_time,activity_order',
      '20,Virajpet,Coffee Grove,"Breakfast","Valid first day",Morning Birdwatching,"Birding walk",06:30,08:30,1',
      '21,Virajpet,Coffee Grove,"All Inclusive","Invalid middle day",Offroad Jeep Trek,"4x4 drive",10:00,12:00,1',
      '22,Virajpet,Coffee Grove,"Breakfast & Dinner","Valid third day",Spice Plantation Tour,"Walk",14:00,16:00,1',
    ].join('\n')

    const partialFormData = new FormData()
    partialFormData.append('file', new Blob([partialCsv], { type: 'text/csv' }), 'partial_itinerary.csv')

    const partialRes = await fetch(`${API_BASE}/api/admin/trips/${testTripId}/itinerary/import`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${adminToken}` },
      body: partialFormData,
    })
    const partialJson = await partialRes.json()
    console.log('  -> API Response:', JSON.stringify(partialJson))

    check(
      'Partial import returns 200 with days_upserted=2, skipped=1',
      partialRes.status === 200 && partialJson.days_upserted === 2 && partialJson.skipped === 1,
      `Status: ${partialRes.status}, Upserted: ${partialJson.days_upserted}, Skipped: ${partialJson.skipped}`
    )

    const partialError = partialJson.errors?.find((e: { row: number }) => e.row === 3)
    check(
      'Partial import error identifies row 3 as invalid meal_plan',
      partialError && partialError.error.includes('All Inclusive'),
      `Row 3 error: ${partialError?.error}`
    )

    // Verify database state for partial import
    const { data: dbPartialDays } = await adminClient
      .from('itinerary_days')
      .select('day_number, meal_plan')
      .eq('trip_id', testTripId)
      .in('day_number', [20, 21, 22])
      .order('day_number', { ascending: true })

    console.log('  -> Database Partial Records:', JSON.stringify(dbPartialDays))

    const day20 = dbPartialDays?.find(d => d.day_number === 20)
    const day21 = dbPartialDays?.find(d => d.day_number === 21)
    const day22 = dbPartialDays?.find(d => d.day_number === 22)

    check('Valid Day 20 inserted with Breakfast', day20?.meal_plan === 'Breakfast', `Actual: ${day20?.meal_plan}`)
    check('Invalid Day 21 NOT inserted in database', day21 === undefined, `Day 21 found: ${!!day21}`)
    check('Valid Day 22 inserted with Breakfast & Dinner', day22?.meal_plan === 'Breakfast & Dinner', `Actual: ${day22?.meal_plan}`)

    // Test Idempotence / No Duplicates on re-upload
    const reuploadRes = await fetch(`${API_BASE}/api/admin/trips/${testTripId}/itinerary/import`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${adminToken}` },
      body: partialFormData,
    })
    const reuploadJson = await reuploadRes.json()
    check('Re-upload completes successfully (200)', reuploadRes.status === 200 && reuploadJson.days_upserted === 2)

    const { data: dbCountDay20 } = await adminClient
      .from('itinerary_days')
      .select('id')
      .eq('trip_id', testTripId)
      .eq('day_number', 20)

    check('No duplicate itinerary day records created on upsert', dbCountDay20?.length === 1, `Count: ${dbCountDay20?.length}`)

    // ──────────────────────────────────────────────────────────────────────────
    // 5. TEST FAILURE HANDLING & AUTHORIZATION BOUNDARIES
    // ──────────────────────────────────────────────────────────────────────────
    console.log('\n[5] Test Failure Handling & Authorization Boundaries')

    // A. Empty CSV
    const emptyFormData = new FormData()
    emptyFormData.append('file', new Blob(['   \n\n'], { type: 'text/csv' }), 'empty.csv')
    const emptyRes = await fetch(`${API_BASE}/api/admin/trips/${testTripId}/itinerary/import`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${adminToken}` },
      body: emptyFormData,
    })
    const emptyJson = await emptyRes.json()
    console.log('  -> Empty CSV Response (422):', JSON.stringify(emptyJson))
    check('Empty CSV returns 422 with clear error message', emptyRes.status === 422 && emptyJson.error.includes('empty'), `Status: ${emptyRes.status}`)

    // B. Missing Required Column (day_number)
    const missingColCsv = [
      'destination,hotel_name,meal_plan,itinerary_text',
      'Ooty,Hill Resort,"Breakfast","Missing day_number column"',
    ].join('\n')
    const missingFormData = new FormData()
    missingFormData.append('file', new Blob([missingColCsv], { type: 'text/csv' }), 'missing_col.csv')
    const missingRes = await fetch(`${API_BASE}/api/admin/trips/${testTripId}/itinerary/import`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${adminToken}` },
      body: missingFormData,
    })
    const missingJson = await missingRes.json()
    console.log('  -> Missing day_number Response (422):', JSON.stringify(missingJson))
    check(
      'Missing required day_number column returns 422 with row error',
      missingRes.status === 422 && missingJson.errors?.[0]?.error.includes('day_number'),
      `Status: ${missingRes.status}, Error: ${missingJson.errors?.[0]?.error}`
    )

    // C. Non-existent Trip ID
    const nonExistentTripId = '00000000-0000-0000-0000-000000000000'
    const nonExistentRes = await fetch(`${API_BASE}/api/admin/trips/${nonExistentTripId}/itinerary/import`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${adminToken}` },
      body: validFormData,
    })
    const nonExistentJson = await nonExistentRes.json()
    console.log('  -> Non-existent Trip Response (404):', JSON.stringify(nonExistentJson))
    check('Non-existent trip ID returns 404 Trip not found', nonExistentRes.status === 404 && nonExistentJson.error === 'Trip not found', `Status: ${nonExistentRes.status}`)

    // D. Unauthorized Request (No token)
    const unauthRes = await fetch(`${API_BASE}/api/admin/trips/${testTripId}/itinerary/import`, {
      method: 'POST',
      body: validFormData,
    })
    const unauthJson = await unauthRes.json()
    check('Unauthenticated request returns 401 Unauthorized', unauthRes.status === 401 && unauthJson.error === 'Unauthorized', `Status: ${unauthRes.status}`)

    // E. Forbidden Request (Guest persona attempting admin endpoint)
    const guestRes = await fetch(`${API_BASE}/api/admin/trips/${testTripId}/itinerary/import`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${guestToken}` },
      body: validFormData,
    })
    const guestJson = await guestRes.json()
    check('Guest user attempting itinerary import returns 403 Forbidden', guestRes.status === 403 && guestJson.error === 'Forbidden', `Status: ${guestRes.status}`)

    // F. Non-CSV File format rejection
    const nonCsvFormData = new FormData()
    nonCsvFormData.append('file', new Blob(['test content'], { type: 'application/pdf' }), 'itinerary.pdf')
    const nonCsvRes = await fetch(`${API_BASE}/api/admin/trips/${testTripId}/itinerary/import`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${adminToken}` },
      body: nonCsvFormData,
    })
    const nonCsvJson = await nonCsvRes.json()
    check('Non-CSV upload returns 400 File must be a CSV (.csv)', nonCsvRes.status === 400 && nonCsvJson.error.includes('must be a CSV'), `Status: ${nonCsvRes.status}`)

    // G. Invalid Time interval handling
    const badTimeCsv = [
      'day_number,destination,hotel_name,meal_plan,itinerary_text,activity_title,activity_description,start_time,end_time,activity_order',
      '30,Wayanad,Resort,"Breakfast","Time test",Safari,"Evening Safari",18:00,16:00,1',
    ].join('\n')
    const badTimeFormData = new FormData()
    badTimeFormData.append('file', new Blob([badTimeCsv], { type: 'text/csv' }), 'bad_time.csv')
    const badTimeRes = await fetch(`${API_BASE}/api/admin/trips/${testTripId}/itinerary/import`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${adminToken}` },
      body: badTimeFormData,
    })
    const badTimeJson = await badTimeRes.json()
    check(
      'Invalid activity time interval (end_time < start_time) flagged in errors',
      badTimeJson.errors?.some((e: { error: string }) => e.error.includes('end_time must be after or equal to start_time')),
      `Errors: ${JSON.stringify(badTimeJson.errors)}`
    )

  } finally {
    // ──────────────────────────────────────────────────────────────────────────
    // 6. TEARDOWN & SYNTHETIC DATA CLEANUP
    // ──────────────────────────────────────────────────────────────────────────
    console.log('\n[Cleanup] Cleaning up dedicated synthetic test records...')
    if (testTripId) {
      // Delete itinerary days first
      await adminClient.from('itinerary_days').delete().eq('trip_id', testTripId)
      // Delete trip
      await adminClient.from('trips').delete().eq('id', testTripId)
      console.log(`  ✓ Deleted test trip ${testTripId} and associated itinerary data.`)
    }
  }

  // ──────────────────────────────────────────────────────────────────────────
  // 7. SUMMARY
  // ──────────────────────────────────────────────────────────────────────────
  console.log('\n============================================================')
  console.log('📊 TEST EXECUTION SUMMARY')
  console.log('============================================================')
  console.log(`Total Checks Executed : ${passed + failed}`)
  console.log(`✅ Passed              : ${passed}`)
  console.log(`❌ Failed              : ${failed}`)
  console.log('============================================================\n')

  if (failed > 0) {
    process.exit(1)
  }
}

run().catch(err => {
  console.error('Fatal execution error:', err)
  process.exit(1)
})
