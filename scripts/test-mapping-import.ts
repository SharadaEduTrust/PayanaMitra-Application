/**
 * scripts/test-mapping-import.ts
 *
 * Automated verification of Trail-to-Guest CSV Mapping Utility:
 *   1. GET /api/admin/trips/mapping/import (template download)
 *   2. POST /api/admin/trips/mapping/import (bulk mapping upload)
 *   3. Idempotency & duplicate skipping
 *   4. Invalid inputs / non-existent guest / trail error handling
 *   5. Automatic cleanup of test users, trails, and memberships
 */

import * as dotenv from 'dotenv'
import { resolve } from 'path'
import { createClient } from '@supabase/supabase-js'

dotenv.config({ path: resolve(process.cwd(), '.env.local') })

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!
const AUTH_PEPPER = process.env.AUTH_PEPPER!
const API_BASE = process.env.TEST_API_BASE || 'http://localhost:3005'

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

async function runTests() {
  console.log(`\n=== Testing Trail to Guest Mapping CSV Utility on ${API_BASE} ===\n`)

  const unique = Date.now().toString().slice(-6)
  const adminPhone = `98990${unique}`
  const guestPhone = `98991${unique}`
  const testTripCode = `TRIP-MAP-${unique}`

  // 1. Create Dynamic Admin User
  console.log('[Setup] Creating test personas...')
  const adminPassword = await derivePassword(adminPhone, adminPhone.slice(-4))
  const { data: adminAuth, error: adminAuthErr } = await adminClient.auth.admin.createUser({
    email: `${adminPhone}@payana.app`,
    password: adminPassword,
    email_confirm: true,
  })
  if (adminAuthErr) throw adminAuthErr

  await adminClient.from('profiles').insert({
    id: adminAuth.user.id,
    phone: adminPhone,
    first_name: 'TestAdmin',
    last_name: 'Runner',
    role: 'admin',
    is_active: true,
  })

  // 2. Create Dynamic Guest User
  const guestPassword = await derivePassword(guestPhone, guestPhone.slice(-4))
  const { data: guestAuth, error: guestAuthErr } = await adminClient.auth.admin.createUser({
    email: `${guestPhone}@payana.app`,
    password: guestPassword,
    email_confirm: true,
  })
  if (guestAuthErr) throw guestAuthErr

  await adminClient.from('profiles').insert({
    id: guestAuth.user.id,
    phone: guestPhone,
    first_name: 'Ananya',
    last_name: 'Sharma',
    role: 'traveller',
    is_active: true,
  })

  // 3. Create Dynamic Trail
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: testTrip, error: tripErr } = await (adminClient.from('trips') as any)
    .insert({
      trip_code: testTripCode,
      name: `Kudremukh Trail ${unique}`,
      destination: 'Chikmagalur',
      status: 'published',
      is_active: true,
    })
    .select('id')
    .single()
  if (tripErr) throw tripErr

  console.log(`  ✓ Setup: Admin (${adminPhone}), Guest (${guestPhone}), Trail (${testTripCode})`)

  const adminToken = await loginAndGetToken(adminPhone, adminPhone.slice(-4))

  try {
    // 4. Template Download Test
    console.log('\n[1] Testing CSV Template Download (GET)')
    const templateRes = await fetch(`${API_BASE}/api/admin/trips/mapping/import`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    })
    const templateText = await templateRes.text()
    console.log('GET status:', templateRes.status, templateText)
    check('GET template returns 200 OK', templateRes.status === 200, `Got ${templateRes.status}: ${templateText}`)
    const contentType = templateRes.headers.get('content-type') || ''
    check('Content-Type is text/csv', contentType.includes('text/csv'))
    check('Template includes "Mobile Number of the Guest,Trail Id" header', templateText.includes('Mobile Number of the Guest,Trail Id'))

    // 5. Test Valid CSV Upload
    console.log('\n[2] Testing Valid CSV Upload')
    const csvContent = [
      'Mobile Number of the Guest,Trail Id',
      `${guestPhone},${testTripCode}`,
    ].join('\n')

    const formData = new FormData()
    formData.append('file', new Blob([csvContent], { type: 'text/csv' }), 'mapping.csv')

    const importRes = await fetch(`${API_BASE}/api/admin/trips/mapping/import`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${adminToken}` },
      body: formData,
    })

    const importJson = await importRes.json()
    check('POST returns status 200', importRes.status === 200)
    check('Created count is 1', importJson.created === 1)
    check('Skipped count is 0', importJson.skipped === 0)
    check('Error count is 0', importJson.errorCount === 0)
    check('Result guest_name is returned', importJson.results?.[0]?.guest_name === 'Ananya Sharma')
    check('Result trip_name is returned', importJson.results?.[0]?.trip_name?.includes('Kudremukh Trail'))

    // Verify database record
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: memberRecord } = await (adminClient.from('trip_members') as any)
      .select('id')
      .eq('trip_id', testTrip.id)
      .eq('user_id', guestAuth.user.id)
      .single()

    check('trip_members row exists in database', Boolean(memberRecord?.id))

    // 6. Test Duplicate / Idempotency
    console.log('\n[3] Testing Duplicate / Idempotency Handling')
    const dupFormData = new FormData()
    dupFormData.append('file', new Blob([csvContent], { type: 'text/csv' }), 'mapping_dup.csv')

    const dupRes = await fetch(`${API_BASE}/api/admin/trips/mapping/import`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${adminToken}` },
      body: dupFormData,
    })
    const dupJson = await dupRes.json()
    check('Duplicate upload returns status 200', dupRes.status === 200)
    check('Created count is 0', dupJson.created === 0)
    check('Skipped count is 1', dupJson.skipped === 1)
    check('Error count is 0', dupJson.errorCount === 0)
    check('Skipped reason notes guest already mapped', dupJson.results?.[0]?.status === 'skipped')

    // 7. Test Error Handling (Invalid phone, Unknown Trail, Unregistered Guest)
    console.log('\n[4] Testing Error Handling')
    const errContent = [
      'Mobile Number,Trail Id',
      `123,${testTripCode}`, // invalid phone
      `${guestPhone},NON_EXISTENT_TRAIL_99999`, // nonexistent trail
      `9898989898,${testTripCode}`, // unregistered guest
    ].join('\n')

    const errFormData = new FormData()
    errFormData.append('file', new Blob([errContent], { type: 'text/csv' }), 'mapping_err.csv')

    const errRes = await fetch(`${API_BASE}/api/admin/trips/mapping/import`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${adminToken}` },
      body: errFormData,
    })
    const errJson = await errRes.json()
    check('Error batch returns 200 with row errors', errRes.status === 200)
    check('Error count is 3', errJson.errorCount === 3)
    check('Results array contains 3 error rows', errJson.results?.length === 3)

  } finally {
    // 8. Cleanup
    console.log('\n[Cleanup] Removing temporary test records...')
    await adminClient.from('trip_members').delete().eq('trip_id', testTrip.id)
    await adminClient.from('trips').delete().eq('id', testTrip.id)
    await adminClient.auth.admin.deleteUser(adminAuth.user.id)
    await adminClient.auth.admin.deleteUser(guestAuth.user.id)
    console.log('  ✓ Cleanup complete.')
  }

  console.log(`\n========================================`)
  console.log(`Tests finished: ${passed} PASSED, ${failed} FAILED`)
  console.log(`========================================\n`)

  if (failed > 0) process.exit(1)
}

runTests().catch((err) => {
  console.error('Fatal test error:', err)
  process.exit(1)
})
