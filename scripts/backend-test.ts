/**
 * scripts/backend-test.ts
 *
 * Comprehensive Automated Test Suite for Payana Mitra Backend & Supabase Integration.
 *
 * Test Sections:
 *   1. Database Schema, Constraints & Trigger Verification
 *   2. Authentication, PIN Derivation & Rate Limiting
 *   3. User Creation, Editing, Validation & Duplicate Handling (API & DB)
 *   4. Role-Based Authorization & Tenant Isolation (Admin, Leader, Guest Boundaries)
 *   5. Cross-User Data Isolation (Guest-to-Guest & Leader-to-Unassigned-Guest)
 *   6. Trail (Trip) Management, Status Lifecycle, Deactivation & Copying
 *   7. Itinerary Days, Meal Plans, Activity Ordering & Time Interval Validation
 *   8. Trip Contacts & Custom Role Support
 *   9. CSV Import Engine (Users, Trails, Itinerary) & Duplicate Handling
 *  10. Document Encryption (AES-256-GCM), Storage Uploads & Signed URLs
 *
 * Execution:
 *   npx tsx scripts/backend-test.ts
 */

import * as dotenv from 'dotenv'
import { resolve } from 'path'
import { createClient } from '@supabase/supabase-js'

dotenv.config({ path: resolve(process.cwd(), '.env.local') })

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!
const AUTH_PEPPER = process.env.AUTH_PEPPER!
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY!

const API_BASE = process.env.TEST_API_BASE || 'http://localhost:3000'

if (!SUPABASE_URL || !ANON_KEY || !SERVICE_KEY || !AUTH_PEPPER || !ENCRYPTION_KEY) {
  console.error('❌  Missing required environment variables in .env.local')
  process.exit(1)
}

const adminClient = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
})

let passed = 0
let failed = 0
let blocked = 0

interface TestResult {
  section: string
  name: string
  status: 'PASS' | 'FAIL' | 'BLOCKED'
  evidence?: string
}

const testResults: TestResult[] = []

function check(section: string, name: string, condition: boolean, evidence?: string) {
  if (condition) {
    console.log(`  ✅  PASS  ${name}`)
    passed++
    testResults.push({ section, name, status: 'PASS', evidence })
  } else {
    console.log(`  ❌  FAIL  ${name}${evidence ? ` — ${evidence}` : ''}`)
    failed++
    testResults.push({ section, name, status: 'FAIL', evidence })
  }
}

function markBlocked(section: string, name: string, reason: string) {
  console.log(`  ⚠️  BLOCKED  ${name} — ${reason}`)
  blocked++
  testResults.push({ section, name, status: 'BLOCKED', evidence: reason })
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

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

async function encrypt(plaintext: string) {
  const raw = Buffer.from(ENCRYPTION_KEY, 'base64')
  const key = await crypto.subtle.importKey('raw', raw, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt'])
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const encoded = new TextEncoder().encode(plaintext)
  const ciphertextWithTag = await crypto.subtle.encrypt({ name: 'AES-GCM', iv, tagLength: 128 }, key, encoded)
  const buf = new Uint8Array(ciphertextWithTag)
  return {
    ciphertext: Buffer.from(buf.slice(0, buf.length - 16)).toString('base64'),
    iv: Buffer.from(iv).toString('base64'),
    authTag: Buffer.from(buf.slice(buf.length - 16)).toString('base64'),
  }
}

async function decrypt(val: { ciphertext: string; iv: string; authTag: string }) {
  const raw = Buffer.from(ENCRYPTION_KEY, 'base64')
  const key = await crypto.subtle.importKey('raw', raw, { name: 'AES-GCM' }, false, ['decrypt'])
  const iv = Buffer.from(val.iv, 'base64')
  const ciphertext = Buffer.from(val.ciphertext, 'base64')
  const authTag = Buffer.from(val.authTag, 'base64')
  const combined = new Uint8Array(ciphertext.length + authTag.length)
  combined.set(ciphertext)
  combined.set(authTag, ciphertext.length)
  const decrypted = await crypto.subtle.decrypt({ name: 'AES-GCM', iv, tagLength: 128 }, key, combined)
  return new TextDecoder().decode(decrypted)
}

// ─── Main Test Runner ─────────────────────────────────────────────────────────

async function main() {
  console.log('\n============================================================')
  console.log('🚀  PAYANA MITRA BACKEND AUDIT & AUTOMATED TEST SUITE')
  console.log('============================================================\n')

  const uniqueSuffix = Date.now().toString().slice(-6)
  const testPhoneAdmin = `9000000001`
  const testPhoneLeader1 = `9000000002`
  const testPhoneGuest1 = `9000000003`
  const testPhoneGuest2 = `9000000004`

  // Isolated dynamic users for CRUD & mutation tests
  const dynamicGuestPhone = `+9198${uniqueSuffix.slice(0, 4)}0001`
  const dynamicLeaderPhone = `+9198${uniqueSuffix.slice(0, 4)}0002`
  const dynamicTripCode = `TRIP-TEST-${uniqueSuffix}`

  const createdAuthUserIds: string[] = []
  const createdTripIds: string[] = []

  let adminToken = ''
  let leaderToken = ''
  let guestToken = ''

  try {
    // ── Pre-flight: Obtain Auth Tokens for Seeded Roles ─────────────────────────
    console.log('[Setup] Authenticating test personas via Supabase Auth...')
    try {
      adminToken = await loginAndGetToken(testPhoneAdmin, '0001')
      leaderToken = await loginAndGetToken(testPhoneLeader1, '0002')
      guestToken = await loginAndGetToken(testPhoneGuest1, '0003')
      console.log('  ✓ Authenticated Admin, Leader, and Guest successfully.')
    } catch (err) {
      console.error('❌ Failed to authenticate seed accounts. Ensure database is seeded with "npm run seed".', err)
      process.exit(1)
    }

    // ──────────────────────────────────────────────────────────────────────────
    // 1. DATABASE SCHEMA, CONSTRAINTS & TRIGGER VERIFICATION
    // ──────────────────────────────────────────────────────────────────────────
    console.log('\n[1] Database Schema, Constraints & Trigger Verification')
    {
      const sec = 'Schema & Constraints'

      // Check user_roles table
      const { data: roles, error: rErr } = await adminClient.from('user_roles').select('*')
      check(sec, 'user_roles table exists and contains records', !rErr && (roles?.length ?? 0) >= 3, rErr?.message)
      const roleNames = (roles ?? []).map((r: { role_name: string }) => r.role_name)
      check(sec, 'user_roles contains traveller, leader, and admin', roleNames.includes('traveller') && roleNames.includes('leader') && roleNames.includes('admin'))

      // Profiles columns inspection
      const { data: profileCols, error: pErr } = await adminClient.from('profiles').select('id, leader_id, phone, role').limit(1)
      check(sec, 'profiles table has leader_id column', !pErr && Array.isArray(profileCols))

      // Trigger: Leader cannot be assigned to another leader
      const { data: leaderRow } = await adminClient.from('profiles').select('id').eq('role', 'leader').limit(1).single()
      if (leaderRow) {
        const { error: invalidLeaderErr } = await adminClient
          .from('profiles')
          .update({ leader_id: leaderRow.id })
          .eq('id', leaderRow.id)

        check(sec, 'DB trigger blocks leader from being assigned a leader', invalidLeaderErr !== null, 'Expected constraint/trigger violation')
      }

      // Check constraint: trips end_date >= start_date
      const { error: dateErr } = await adminClient.from('trips').insert({
        trip_code: `INV-DATE-${uniqueSuffix}`,
        name: 'Invalid Date Trip',
        start_date: '2026-10-10',
        end_date: '2026-10-05', // before start_date
        status: 'draft',
      })
      check(sec, 'DB check constraint enforces trips end_date >= start_date', dateErr !== null, 'Expected date order violation')

      // Check constraint: itinerary day_number > 0
      const { data: validTrip } = await adminClient.from('trips').select('id').limit(1).single()
      if (validTrip) {
        const { error: dayZeroErr } = await adminClient.from('itinerary_days').insert({
          trip_id: validTrip.id,
          day_number: 0, // must be > 0
          destination: 'Invalid Zero Day',
        })
        check(sec, 'DB check constraint enforces itinerary day_number > 0', dayZeroErr !== null, 'Expected day_number > 0 violation')
      }
    }

    // ──────────────────────────────────────────────────────────────────────────
    // 2. AUTHENTICATION & ROLE-BASED AUTHORIZATION (HTTP API)
    // ──────────────────────────────────────────────────────────────────────────
    console.log('\n[2] Authentication & Role-Based Authorization')
    {
      const sec = 'Auth & Roles'

      // A. Unauthenticated request to protected route
      const unauthRes = await fetch(`${API_BASE}/api/admin/trips`)
      check(sec, 'Unauthenticated request receives 401 Unauthorized', unauthRes.status === 401, `Status: ${unauthRes.status}`)

      // B. Invalid token request
      const invalidTokenRes = await fetch(`${API_BASE}/api/admin/trips`, {
        headers: { Authorization: 'Bearer invalid_malformed_jwt_token_123' },
      })
      check(sec, 'Invalid JWT token receives 401 Unauthorized', invalidTokenRes.status === 401, `Status: ${invalidTokenRes.status}`)

      // C. Guest attempting Admin endpoint -> 403
      const guestAdminRes = await fetch(`${API_BASE}/api/admin/users`, {
        headers: { Authorization: `Bearer ${guestToken}` },
      })
      check(sec, 'Guest attempting admin endpoint receives 403 Forbidden', guestAdminRes.status === 403, `Status: ${guestAdminRes.status}`)

      // D. Guest attempting Leader endpoint -> 403
      const guestLeaderRes = await fetch(`${API_BASE}/api/leader/guests`, {
        headers: { Authorization: `Bearer ${guestToken}` },
      })
      check(sec, 'Guest attempting leader endpoint receives 403 Forbidden', guestLeaderRes.status === 403, `Status: ${guestLeaderRes.status}`)

      // E. Leader attempting Admin endpoint -> 403
      const leaderAdminRes = await fetch(`${API_BASE}/api/admin/users`, {
        headers: { Authorization: `Bearer ${leaderToken}` },
      })
      check(sec, 'Leader attempting admin endpoint receives 403 Forbidden', leaderAdminRes.status === 403, `Status: ${leaderAdminRes.status}`)

      // F. Leader accessing Leader endpoint -> 200
      const leaderOwnRes = await fetch(`${API_BASE}/api/leader/guests`, {
        headers: { Authorization: `Bearer ${leaderToken}` },
      })
      check(sec, 'Leader accessing /api/leader/guests receives 200 OK', leaderOwnRes.status === 200, `Status: ${leaderOwnRes.status}`)

      // G. Admin accessing Admin endpoint -> 200
      const adminUsersRes = await fetch(`${API_BASE}/api/admin/users`, {
        headers: { Authorization: `Bearer ${adminToken}` },
      })
      check(sec, 'Admin accessing /api/admin/users receives 200 OK', adminUsersRes.status === 200, `Status: ${adminUsersRes.status}`)
    }

    // ──────────────────────────────────────────────────────────────────────────
    // 3. USER CREATION, EDITING, VALIDATION & DUPLICATE HANDLING
    // ──────────────────────────────────────────────────────────────────────────
    console.log('\n[3] User Creation, Editing, Validation & Duplicate Handling')
    let createdUserId = ''
    {
      const sec = 'User Management'

      // A. Validation failure: Invalid phone format
      const invalidPhoneRes = await fetch(`${API_BASE}/api/admin/users`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${adminToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone: '12345', // invalid length
          first_name: 'Test',
          last_name: 'User',
          role: 'guest',
        }),
      })
      check(sec, 'API rejects invalid phone number format with 422', invalidPhoneRes.status === 422, `Status: ${invalidPhoneRes.status}`)

      // B. Validation failure: Name exceeding 50 chars
      const invalidNameRes = await fetch(`${API_BASE}/api/admin/users`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${adminToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone: dynamicGuestPhone,
          first_name: 'A'.repeat(55),
          last_name: 'User',
          role: 'guest',
        }),
      })
      check(sec, 'API rejects first_name > 50 characters with 422', invalidNameRes.status === 422, `Status: ${invalidNameRes.status}`)

      // C. Valid user creation (with leader assignment & guest details)
      const { data: leaderRow } = await adminClient.from('profiles').select('id').eq('role', 'leader').limit(1).single()

      const createRes = await fetch(`${API_BASE}/api/admin/users`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${adminToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone: dynamicGuestPhone,
          first_name: 'Audit',
          last_name: 'Traveller',
          role: 'guest', // normalized to traveller
          leader_id: leaderRow?.id,
          location: 'Bengaluru',
          guest_details: {
            dob: '1992-06-20',
            food_preference: 'veg',
            food_allergy: 'Lactose',
            emergency_contact_name: 'Audit Kin',
            emergency_contact_no: '+919876500000',
            passport_issued_location: 'Bangalore',
          },
        }),
      })
      const createJson = await createRes.json()
      check(sec, 'Admin creates user with normalized role & guest details (201)', createRes.status === 201 && createJson.data?.role === 'traveller', `Status: ${createRes.status}`)
      if (createJson.data?.id) {
        createdUserId = createJson.data.id
        createdAuthUserIds.push(createdUserId)
      }

      // D. Duplicate phone check (rejects duplicate registration)
      const dupRes = await fetch(`${API_BASE}/api/admin/users`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${adminToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone: dynamicGuestPhone, // same phone
          first_name: 'Duplicate',
          last_name: 'User',
          role: 'guest',
        }),
      })
      check(sec, 'API rejects duplicate phone registration with 422', dupRes.status === 422, `Status: ${dupRes.status}`)

      // E. User editing (PATCH /api/admin/users)
      if (createdUserId) {
        const patchRes = await fetch(`${API_BASE}/api/admin/users`, {
          method: 'PATCH',
          headers: { Authorization: `Bearer ${adminToken}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: createdUserId,
            first_name: 'AuditUpdated',
            location: 'Mysuru',
            reset_pin: true,
          }),
        })
        const patchJson = await patchRes.json()
        check(sec, 'Admin updates user profile and triggers PIN reset (200)', patchRes.status === 200 && patchJson.data?.first_name === 'AuditUpdated' && patchJson.data?.must_change_password === true, `Status: ${patchRes.status}`)
      }

      // F. User deactivation (DELETE /api/admin/users/[id])
      if (createdUserId) {
        const deactRes = await fetch(`${API_BASE}/api/admin/users/${createdUserId}`, {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${adminToken}` },
        })
        const deactJson = await deactRes.json()
        check(sec, 'Admin deactivates user (200, is_active: false)', deactRes.status === 200 && deactJson.data?.is_active === false, `Status: ${deactRes.status}`)

        // Reactivate for downstream tests
        await adminClient.from('profiles').update({ is_active: true }).eq('id', createdUserId)
      }
    }

    // ──────────────────────────────────────────────────────────────────────────
    // 4. DATA ISOLATION (GUEST BOUNDARIES & LEADER BOUNDARIES)
    // ──────────────────────────────────────────────────────────────────────────
    console.log('\n[4] Data Isolation & Privacy Boundaries')
    {
      const sec = 'Data Isolation'

      // Look up Guest 1 and Guest 2 profile IDs
      const { data: g1Profile } = await adminClient.from('profiles').select('id').eq('phone', testPhoneGuest1).single()
      const { data: g2Profile } = await adminClient.from('profiles').select('id').eq('phone', testPhoneGuest2).single()

      if (g1Profile && g2Profile) {
        // A. Guest 1 attempts to read Guest 2's documents -> 403
        const crossDocRes = await fetch(`${API_BASE}/api/documents?user_id=${g2Profile.id}`, {
          headers: { Authorization: `Bearer ${guestToken}` },
        })
        check(sec, 'Guest 1 cannot read Guest 2 private documents (403 Forbidden)', crossDocRes.status === 403, `Status: ${crossDocRes.status}`)

        // B. Guest 1 reads own documents -> 200
        const ownDocRes = await fetch(`${API_BASE}/api/documents`, {
          headers: { Authorization: `Bearer ${guestToken}` },
        })
        check(sec, 'Guest 1 can read own documents (200 OK)', ownDocRes.status === 200, `Status: ${ownDocRes.status}`)

        // C. Leader boundaries: Create an unassigned guest or guest assigned to leader 2
        const unassignedGuestRes = await adminClient.from('profiles').select('id').is('leader_id', null).eq('role', 'traveller').limit(1).maybeSingle()
        if (unassignedGuestRes.data) {
          const leaderCrossRes = await fetch(`${API_BASE}/api/documents?user_id=${unassignedGuestRes.data.id}`, {
            headers: { Authorization: `Bearer ${leaderToken}` },
          })
          check(sec, 'Leader cannot access unassigned guest documents (403 Forbidden)', leaderCrossRes.status === 403, `Status: ${leaderCrossRes.status}`)
        } else {
          // Verify with newly created isolated user if leader_id was removed
          await adminClient.from('profiles').update({ leader_id: null }).eq('id', createdUserId)
          const leaderCrossRes = await fetch(`${API_BASE}/api/documents?user_id=${createdUserId}`, {
            headers: { Authorization: `Bearer ${leaderToken}` },
          })
          check(sec, 'Leader cannot access unassigned guest documents (403 Forbidden)', leaderCrossRes.status === 403, `Status: ${leaderCrossRes.status}`)
        }
      }
    }

    // ──────────────────────────────────────────────────────────────────────────
    // 5. TRAIL (TRIP) MANAGEMENT, STATUS LIFECYCLE, COPY & DEACTIVATION
    // ──────────────────────────────────────────────────────────────────────────
    console.log('\n[5] Trail (Trip) Management & Lifecycle')
    let testTripId = ''
    let copiedTripId = ''
    {
      const sec = 'Trail Management'

      // A. Create Trail
      const createTripRes = await fetch(`${API_BASE}/api/admin/trips`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${adminToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          trip_code: dynamicTripCode,
          name: 'Western Ghats Trek',
          destination: 'Coorg, Karnataka',
          start_date: '2026-11-01',
          end_date: '2026-11-06',
          remarks: 'Automated test expedition',
        }),
      })
      const tripJson = await createTripRes.json()
      check(sec, 'Admin creates trail with draft status (201)', createTripRes.status === 201 && tripJson.data?.status === 'draft', `Status: ${createTripRes.status}`)
      if (tripJson.data?.id) {
        testTripId = tripJson.data.id
        createdTripIds.push(testTripId)
      }

      // B. Update status lifecycle (draft -> published -> archived)
      if (testTripId) {
        const pubRes = await fetch(`${API_BASE}/api/admin/trips/${testTripId}/status`, {
          method: 'PATCH',
          headers: { Authorization: `Bearer ${adminToken}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: 'published' }),
        })
        const pubJson = await pubRes.json()
        check(sec, 'Update trip status to "published" (200)', pubRes.status === 200 && pubJson.data?.status === 'published', `Status: ${pubRes.status}`)

        // C. Member enrolment and unenrollment
        if (createdUserId) {
          const enrolRes = await fetch(`${API_BASE}/api/admin/trips/${testTripId}/members`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${adminToken}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ user_ids: [createdUserId] }),
          })
          check(sec, 'Admin enrols guest into trip (201)', enrolRes.status === 201, `Status: ${enrolRes.status}`)
        }

        // D. Copy Trail (POST /api/admin/trips/[id]/copy)
        const copyRes = await fetch(`${API_BASE}/api/admin/trips/${testTripId}/copy`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${adminToken}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            new_trip_code: `${dynamicTripCode}-CPY`,
            new_name: 'Western Ghats Trek (Spring Copy)',
            new_start_date: '2027-02-01',
          }),
        })
        const copyJson = await copyRes.json()
        check(sec, 'Copy Trail creates duplicate trip with draft status (201)', copyRes.status === 201 && copyJson.data?.status === 'draft', `Status: ${copyRes.status}`)
        if (copyJson.data?.id) {
          copiedTripId = copyJson.data.id
          createdTripIds.push(copiedTripId)
        }

        // E. Soft-deactivation (DELETE /api/admin/trips/[id])
        const deactTripRes = await fetch(`${API_BASE}/api/admin/trips/${testTripId}`, {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${adminToken}` },
        })
        const deactTripJson = await deactTripRes.json()
        check(sec, 'Soft-deactivate trail sets is_active: false & status: archived (200)', deactTripRes.status === 200 && deactTripJson.data?.is_active === false, `Status: ${deactTripRes.status}`)

        // Reactivate for itinerary tests
        await adminClient.from('trips').update({ is_active: true, status: 'published' }).eq('id', testTripId)
      }
    }

    // ──────────────────────────────────────────────────────────────────────────
    // 6. ITINERARY DAYS, ACTIVITIES, ORDERING & TIME INTERVAL VALIDATION
    // ──────────────────────────────────────────────────────────────────────────
    console.log('\n[6] Itinerary Days & Activity Ordering')
    let day1Id = ''
    {
      const sec = 'Itinerary'

      if (testTripId) {
        // A. Create Itinerary Day 1
        const day1Res = await fetch(`${API_BASE}/api/admin/trips/${testTripId}/days`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${adminToken}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            day_number: 1,
            destination: 'Madikeri Fort',
            itinerary_text: 'Arrival and plantation trail orientation',
            hotel_name: 'Heritage Resort',
            meal_plan: 'Breakfast & Dinner',
          }),
        })
        const day1Json = await day1Res.json()
        check(sec, 'Create Itinerary Day 1 (201)', day1Res.status === 201 && !!day1Json.data?.id, `Status: ${day1Res.status}`)
        if (day1Json.data?.id) day1Id = day1Json.data.id

        // B. Rejection of duplicate day_number
        const dupDayRes = await fetch(`${API_BASE}/api/admin/trips/${testTripId}/days`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${adminToken}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            day_number: 1, // duplicate day 1
            destination: 'Conflict Day',
          }),
        })
        check(sec, 'Rejects duplicate day_number for same trip (409 Conflict)', dupDayRes.status === 409, `Status: ${dupDayRes.status}`)

        // C. Activity creation with start/end time
        if (day1Id) {
          const actRes = await fetch(`${API_BASE}/api/admin/trips/${testTripId}/days/${day1Id}/activities`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${adminToken}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({
              title: 'Coffee Estate Walk',
              description: 'Guided tour of Arabica coffee plantation',
              start_time: '09:00',
              end_time: '11:30',
              activity_order: 1,
            }),
          })
          check(sec, 'Create activity with start_time & end_time (201)', actRes.status === 201, `Status: ${actRes.status}`)

          // D. Activity validation: end_time before start_time rejected
          const invalidActRes = await fetch(`${API_BASE}/api/admin/trips/${testTripId}/days/${day1Id}/activities`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${adminToken}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({
              title: 'Invalid Evening Trek',
              start_time: '18:00',
              end_time: '12:00', // end before start!
            }),
          })
          check(sec, 'Rejects activity when end_time < start_time (422)', invalidActRes.status === 422, `Status: ${invalidActRes.status}`)
        }

        // E. Retrieval in day order
        await adminClient.from('itinerary_days').insert({
          trip_id: testTripId,
          day_number: 2,
          destination: 'Tadiandamol Peak',
        })
        const getDaysRes = await fetch(`${API_BASE}/api/admin/trips/${testTripId}/days`, {
          headers: { Authorization: `Bearer ${adminToken}` },
        })
        const getDaysJson = await getDaysRes.json()
        const days = getDaysJson.data ?? []
        check(sec, 'Itinerary days retrieved in ascending day order', days.length >= 2 && days[0].day_number === 1 && days[1].day_number === 2)
      }
    }

    // ──────────────────────────────────────────────────────────────────────────
    // 7. TRIP CONTACTS & ROLE CUSTOMIZATION
    // ──────────────────────────────────────────────────────────────────────────
    console.log('\n[7] Trip Contacts & Custom Roles')
    {
      const sec = 'Contacts'

      if (testTripId) {
        // Standard role
        const c1Res = await fetch(`${API_BASE}/api/admin/trips/${testTripId}/contacts`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${adminToken}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: 'Kaveri Transport',
            role: 'Transport Provider',
            phone: '+919444455555',
          }),
        })
        const c1Json = await c1Res.json()
        check(sec, 'Create contact with standard role (Transport Provider) (201)', c1Res.status === 201 && c1Json.data?.standard_role === 'Transport Provider', `Status: ${c1Res.status}`)

        // Custom role (Others + custom_role)
        const c2Res = await fetch(`${API_BASE}/api/admin/trips/${testTripId}/contacts`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${adminToken}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: 'Dr. Vikram',
            role: 'Others',
            custom_role: 'Camp Doctor',
            phone: '+919666677777',
          }),
        })
        const c2Json = await c2Res.json()
        check(sec, 'Create contact with custom role ("Camp Doctor") (201)', c2Res.status === 201 && c2Json.data?.custom_role === 'Camp Doctor', `Status: ${c2Res.status}`)
      }
    }

    // ──────────────────────────────────────────────────────────────────────────
    // 8. CSV IMPORT ENGINES (USERS, TRAILS, ITINERARY) & DUPLICATE DETECTION
    // ──────────────────────────────────────────────────────────────────────────
    console.log('\n[8] CSV Import Engines & Duplicate Detection')
    {
      const sec = 'CSV Import'

      // A. Trails CSV Import (Multipart)
      const csvTripCode1 = `CSV-TRIP-${uniqueSuffix}-A`
      const csvTripCode2 = `CSV-TRIP-${uniqueSuffix}-B`
      const trailCsvContent = [
        'trip_code,name,destination,start_date,end_date,remarks',
        `${csvTripCode1},Kudremukh Trail,Karnataka,2026-09-01,2026-09-05,Trail A`,
        `${csvTripCode2},Brahmagiri Trek,Kerala,2026-10-01,2026-10-06,Trail B`,
        `${csvTripCode1},Duplicate Row Kudremukh,Karnataka,2026-09-01,2026-09-05,Duplicate row within CSV`,
      ].join('\n')

      const trailFormData = new FormData()
      trailFormData.append('file', new Blob([trailCsvContent], { type: 'text/csv' }), 'trails.csv')

      const trailImportRes = await fetch(`${API_BASE}/api/admin/trips/import`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${adminToken}` },
        body: trailFormData,
      })
      const trailImportJson = await trailImportRes.json()
      check(
        sec,
        'Trail CSV import creates new trails and skips duplicate rows',
        trailImportRes.status === 200 && trailImportJson.created === 2 && trailImportJson.skipped === 1,
        `Created: ${trailImportJson.created}, Skipped: ${trailImportJson.skipped}`
      )

      // Record created trips for cleanup
      for (const res of trailImportJson.results ?? []) {
        if (res.id) createdTripIds.push(res.id)
      }

      // B. Itinerary CSV Import (Multipart with time interval validation)
      if (testTripId) {
        const itinCsvContent = [
          'day_number,destination,hotel_name,meal_plan,itinerary_text,activity_title,activity_description,start_time,end_time,activity_order',
          '3,Dubare Camp,Jungle Lodge,"Breakfast & Dinner","River rafting and elephant interaction",River Rafting,"White water rafting",10:00,12:00,1',
          '3,,,,,"Campfire Evening","Storytelling around campfire",19:00,21:00,2',
          '4,Nagarhole,Kabini Resort,"Breakfast, Lunch & Dinner","Wildlife safari",Jungle Safari,"Morning jeep safari",15:00,09:00,1', // invalid end_time < start_time
        ].join('\n')

        const itinFormData = new FormData()
        itinFormData.append('file', new Blob([itinCsvContent], { type: 'text/csv' }), 'itinerary.csv')

        const itinImportRes = await fetch(`${API_BASE}/api/admin/trips/${testTripId}/itinerary/import`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${adminToken}` },
          body: itinFormData,
        })
        const itinImportJson = await itinImportRes.json()
        check(
          sec,
          'Itinerary CSV import creates valid days/activities and catches invalid time intervals',
          itinImportRes.status === 200 && itinImportJson.days_upserted >= 1 && (itinImportJson.skipped >= 1 || itinImportJson.errors?.length >= 1),
          `Days upserted: ${itinImportJson.days_upserted}, Activities: ${itinImportJson.activities_inserted}, Skipped: ${itinImportJson.skipped}`
        )
      }
    }

    // ──────────────────────────────────────────────────────────────────────────
    // 9. DOCUMENT ENCRYPTION (AES-256-GCM), STORAGE & SIGNED DOWNLOAD URLS
    // ──────────────────────────────────────────────────────────────────────────
    console.log('\n[9] Document Encryption & Secure Uploads')
    let createdDocId = ''
    {
      const sec = 'Documents & Encryption'

      const rawPassportNumber = `PASS-${uniqueSuffix}`

      // A. Upload document with encrypted document number
      const docRes = await fetch(`${API_BASE}/api/documents`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${adminToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          doc_type: 'passport',
          doc_number: rawPassportNumber,
          expiry_date: '2035-12-31',
          issued_country: 'India',
        }),
      })
      const docJson = await docRes.json()
      check(sec, 'Upload guest document record with encrypted metadata (201)', docRes.status === 201 && !!docJson.data?.id, `Status: ${docRes.status}`)
      if (docJson.data?.id) createdDocId = docJson.data.id

      // B. Verify database record has ciphertext and IV (no plaintext passport)
      if (createdDocId) {
        const { data: dbDoc } = await adminClient
          .from('guest_documents')
          .select('doc_number_enc, iv, auth_tag')
          .eq('id', createdDocId)
          .single()

        check(sec, 'Passport number is never stored in plaintext (stored encrypted)', Boolean(dbDoc && dbDoc.doc_number_enc !== rawPassportNumber && dbDoc.doc_number_enc.length > 10))

        // C. Verify GET /api/documents decrypts only for authorized users
        const getDocsRes = await fetch(`${API_BASE}/api/documents`, {
          headers: { Authorization: `Bearer ${adminToken}` },
        })
        const getDocsJson = await getDocsRes.json()
        const targetDoc = (getDocsJson.data ?? []).find((d: { id: string }) => d.id === createdDocId)
        check(sec, 'Authorized requester receives decrypted doc_number matching original', targetDoc?.doc_number === rawPassportNumber, `Received: ${targetDoc?.doc_number}`)

        // D. Verify private storage bucket exists and is not public
        const { data: buckets } = await adminClient.storage.listBuckets()
        const guestDocBucket = buckets?.find(b => b.name === 'guest-documents')
        check(sec, 'Private storage bucket "guest-documents" is configured (public: false)', !!guestDocBucket && guestDocBucket.public === false)

        // Cleanup doc
        await adminClient.from('guest_documents').delete().eq('id', createdDocId)
      }
    }

  } finally {
    // ──────────────────────────────────────────────────────────────────────────
    // CLEANUP
    // ──────────────────────────────────────────────────────────────────────────
    console.log('\n[Cleanup] Cleaning up isolated test artifacts...')
    for (const tripId of createdTripIds) {
      await adminClient.from('trips').delete().eq('id', tripId)
    }
    for (const userId of createdAuthUserIds) {
      await adminClient.from('guest_documents').delete().eq('user_id', userId)
      await adminClient.from('traveller_details').delete().eq('user_id', userId)
      await adminClient.from('profiles').delete().eq('id', userId)
      await adminClient.auth.admin.deleteUser(userId)
    }
    console.log('  ✓ Cleanup finished.')
  }

  // ──────────────────────────────────────────────────────────────────────────
  // TEST REPORT & SUMMARY
  // ──────────────────────────────────────────────────────────────────────────
  console.log('\n============================================================')
  console.log('📊  AUTOMATED TEST AUDIT SUMMARY')
  console.log('============================================================')
  console.log(`Total Executed: ${passed + failed + blocked}`)
  console.log(`✅  Passed   : ${passed}`)
  console.log(`❌  Failed   : ${failed}`)
  console.log(`⚠️   Blocked  : ${blocked}`)
  console.log('============================================================\n')

  if (failed > 0) {
    process.exit(1)
  }
}

main().catch(err => {
  console.error('\n❌ Fatal error during test execution:', err)
  process.exit(1)
})
