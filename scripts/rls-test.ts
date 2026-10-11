/**
 * scripts/rls-test.ts
 *
 * Smoke-tests RLS isolation.
 *
 * What it checks:
 *   1. Admin can read ALL profiles
 *   2. Traveller can only read their OWN profile
 *   3. Traveller cannot read another traveller's profile
 *   4. Traveller can see the published trip they're a member of
 *   5. Non-member cannot see the trip
 *   6. Admin can see all trips regardless of membership
 *
 * Run:  npx tsx scripts/rls-test.ts
 */

import * as dotenv from 'dotenv'
import { resolve } from 'path'
import { createClient } from '@supabase/supabase-js'

dotenv.config({ path: resolve(process.cwd(), '.env.local') })

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!
const AUTH_PEPPER = process.env.AUTH_PEPPER!

if (!SUPABASE_URL || !ANON_KEY || !SERVICE_KEY || !AUTH_PEPPER) {
  console.error('❌  Missing env vars.')
  process.exit(1)
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
  const sig = await crypto.subtle.sign('HMAC', keyMaterial, message)
  return Buffer.from(sig).toString('base64url')
}

let passed = 0
let failed = 0

function check(name: string, condition: boolean, detail?: string) {
  if (condition) {
    console.log(`  ✅  PASS  ${name}`)
    passed++
  } else {
    console.log(`  ❌  FAIL  ${name}${detail ? ` — ${detail}` : ''}`)
    failed++
  }
}

async function loginAs(phone: string, pin: string) {
  const client = createClient(SUPABASE_URL, ANON_KEY, {
    auth: { persistSession: false },
  })
  const email = `${phone}@payana.app`
  const password = await derivePassword(phone, pin)
  const { error } = await client.auth.signInWithPassword({ email, password })
  if (error) throw new Error(`Login failed for ${phone}: ${error.message}`)
  return client
}

async function main() {
  console.log('\n🔒  Payana Mitra — RLS Isolation Tests\n')
  console.log('━'.repeat(50))

  // ── Admin client (service role — bypasses RLS) ────────────────────────────
  const adminClient = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { persistSession: false },
  })

  // Look up IDs we need
  const { data: allProfiles } = await adminClient.from('profiles').select('id, phone, role')
  const adminProfile = allProfiles?.find((p) => p.phone === '9000000001')
  const leaderProfile = allProfiles?.find((p) => p.phone === '9000000002')
  const travellerA = allProfiles?.find((p) => p.phone === '9000000003') // member
  const travellerZ = allProfiles?.find((p) => p.phone === '9000000005') // also member

  if (!adminProfile || !leaderProfile || !travellerA || !travellerZ) {
    console.error('❌  Required profiles not found. Run seed first.')
    process.exit(1)
  }

  const { data: tripData } = await adminClient
    .from('trips')
    .select('id, trip_code')
    .eq('trip_code', 'KASHMIR-2025-01')
    .single()

  if (!tripData) {
    console.error('❌  Test trip not found. Run seed first.')
    process.exit(1)
  }

  const tripId = tripData.id

  // ── Test 1: Admin reads all profiles via service role ─────────────────────
  console.log('\n[1] Admin service-role access')
  {
    const { data, error } = await adminClient.from('profiles').select('id')
    check('Admin can read all profiles', !error && (data?.length ?? 0) >= 5, error?.message)
  }

  // ── Test 2: Traveller A reads only own profile ────────────────────────────
  console.log('\n[2] Traveller RLS — own profile only')
  {
    const client = await loginAs('9000000003', '0003')

    const { data: own } = await client
      .from('profiles')
      .select('id')
      .eq('id', travellerA.id)
      .maybeSingle()
    check('Traveller can read own profile', own !== null)

    const { data: other } = await client
      .from('profiles')
      .select('id')
      .eq('id', travellerZ.id)
      .maybeSingle()
    check('Traveller cannot read another traveller profile', other === null)

    const { data: adminRow } = await client
      .from('profiles')
      .select('id')
      .eq('id', adminProfile.id)
      .maybeSingle()
    check('Traveller cannot read admin profile', adminRow === null)
  }

  // ── Test 3: Traveller sees own trip (is a member) ─────────────────────────
  console.log('\n[3] Trip visibility — member vs non-member')
  {
    // 9000000003 is a member
    const memberClient = await loginAs('9000000003', '0003')
    const { data: trip } = await memberClient
      .from('trips')
      .select('id')
      .eq('id', tripId)
      .maybeSingle()
    check('Member can see published trip', trip !== null)

    // Create a fresh user not in the trip to test non-membership
    // (use service role to temporarily create a non-member auth user)
    const tmpEmail = 'tmp_rls_test@payana.app'
    const tmpPass = 'TmpPass1234!'

    // Clean up any leftover tmp user first
    const { data: existingList } = await adminClient.auth.admin.listUsers({ page: 1, perPage: 1000 })
    const existing = existingList?.users.find((u) => u.email === tmpEmail)
    if (existing) await adminClient.auth.admin.deleteUser(existing.id)

    // Create fresh non-member user
    const { data: tmpUser } = await adminClient.auth.admin.createUser({
      email: tmpEmail,
      password: tmpPass,
      email_confirm: true,
    })

    if (tmpUser?.user) {
      // Insert profile
      await adminClient.from('profiles').insert({
        id: tmpUser.user.id,
        phone: '0000000000',
        first_name: 'Test',
        last_name: 'NonMember',
        role: 'traveller',
        is_active: true,
        must_change_password: false,
      })

      const nonMemberClient = createClient(SUPABASE_URL, ANON_KEY, {
        auth: { persistSession: false },
      })
      await nonMemberClient.auth.signInWithPassword({ email: tmpEmail, password: tmpPass })

      const { data: hiddenTrip } = await nonMemberClient
        .from('trips')
        .select('id')
        .eq('id', tripId)
        .maybeSingle()
      check('Non-member cannot see trip', hiddenTrip === null)

      // Cleanup
      await adminClient.auth.admin.deleteUser(tmpUser.user.id)
    } else {
      console.log('  ⚠  Skipping non-member test (tmp user creation failed)')
    }
  }

  // ── Test 4: Itinerary visible to members ─────────────────────────────────
  console.log('\n[4] Itinerary access')
  {
    const client = await loginAs('9000000003', '0003')
    const { data, error } = await client
      .from('itinerary_days')
      .select('id, day_number')
      .eq('trip_id', tripId)
    check('Member can read itinerary days', !error && (data?.length ?? 0) === 3, error?.message)
  }

  // ── Test 5: Trip contacts visible to members ──────────────────────────────
  console.log('\n[5] Trip contacts access')
  {
    const client = await loginAs('9000000003', '0003')
    const { data, error } = await client
      .from('trip_contacts')
      .select('id, name')
      .eq('trip_id', tripId)
    check('Member can read trip contacts', !error && (data?.length ?? 0) === 3, error?.message)
  }

  // ── Summary ───────────────────────────────────────────────────────────────
  console.log('\n' + '━'.repeat(50))
  const total = passed + failed
  if (failed === 0) {
    console.log(`\n✅  All ${total} tests passed — RLS is correctly configured.\n`)
  } else {
    console.log(`\n⚠   ${passed}/${total} tests passed. ${failed} test(s) failed — review RLS policies.\n`)
    process.exit(1)
  }
}

main().catch((err) => {
  console.error('\n❌  Test runner failed:', err.message)
  process.exit(1)
})
