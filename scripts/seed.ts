/**
 * scripts/seed.ts
 *
 * Seeds the Payana Mitra Supabase project with:
 *   • 1 admin user        (phone: 9000000001, PIN: 0001)
 *   • 1 leader user       (phone: 9000000002, PIN: 0002)
 *   • 3 traveller guests  (phones: 9000000003-5, PINs: 0003-0005)
 *   • 1 trip (Kashmir Expedition, draft → published)
 *   • 3 itinerary days + activities
 *   • Trip contacts
 *   • All 5 users assigned to the trip
 *
 * Run:  npx tsx scripts/seed.ts
 *
 * Requires .env.local to be present and the 4 migrations to be applied.
 */

import * as dotenv from 'dotenv'
import { resolve } from 'path'
import { createClient } from '@supabase/supabase-js'

// Load .env.local from project root
dotenv.config({ path: resolve(process.cwd(), '.env.local') })

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!
const AUTH_PEPPER = process.env.AUTH_PEPPER!

if (!SUPABASE_URL || !SERVICE_KEY || !AUTH_PEPPER) {
  console.error('❌  Missing env vars. Ensure .env.local is present and complete.')
  process.exit(1)
}

const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
})

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

function phoneToEmail(phone: string): string {
  return `${phone}@payana.app`
}

interface UserSpec {
  phone: string
  pin: string
  firstName: string
  lastName: string
  role: 'admin' | 'traveller'
  isLeader?: boolean
  location?: string
}

async function upsertAuthUser(spec: UserSpec): Promise<string> {
  const email = phoneToEmail(spec.phone)
  const password = await derivePassword(spec.phone, spec.pin)

  const { data: existingList } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 })
  const existing = existingList?.users.find((u) => u.email === email)

  let userId: string

  if (existing) {
    console.log(`  ↻  Auth user already exists: ${email}`)
    await admin.auth.admin.updateUserById(existing.id, { password })
    userId = existing.id
  } else {
    const { data, error } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    })
    if (error || !data.user) {
      throw new Error(`Failed to create auth user ${email}: ${error?.message}`)
    }
    userId = data.user.id
    console.log(`  ✓  Created auth user: ${email}`)
  }

  return userId
}

async function upsertProfile(userId: string, spec: UserSpec) {
  const { error } = await admin.from('profiles').upsert(
    {
      id: userId,
      phone: spec.phone,
      first_name: spec.firstName,
      last_name: spec.lastName,
      role: spec.role,
      is_active: true,
      must_change_password: false,
      location: spec.location ?? 'Mumbai',
      date_of_joining: '2024-01-01',
    },
    { onConflict: 'id' },
  )
  if (error) throw new Error(`Profile upsert failed for ${spec.phone}: ${error.message}`)
  console.log(`  ✓  Profile: ${spec.firstName} ${spec.lastName} (${spec.role})`)
}

// ─── Seed data ────────────────────────────────────────────────────────────────

const USERS: UserSpec[] = [
  { phone: '9000000001', pin: '0001', firstName: 'Arjun', lastName: 'Sharma', role: 'admin', location: 'Mumbai' },
  { phone: '9000000002', pin: '0002', firstName: 'Priya', lastName: 'Patel', role: 'traveller', isLeader: true, location: 'Pune' },
  { phone: '9000000003', pin: '0003', firstName: 'Rahul', lastName: 'Mehta', role: 'traveller', location: 'Delhi' },
  { phone: '9000000004', pin: '0004', firstName: 'Sunita', lastName: 'Kapoor', role: 'traveller', location: 'Bangalore' },
  { phone: '9000000005', pin: '0005', firstName: 'Vikram', lastName: 'Singh', role: 'traveller', location: 'Jaipur' },
]

const TRIP = {
  trip_code: 'KASHMIR-2025-01',
  name: 'Kashmir Valley Expedition',
  destination: 'Srinagar, Jammu & Kashmir',
  start_date: '2025-03-15',
  end_date: '2025-03-22',
  status: 'published' as const,
  is_active: true,
  remarks: 'Annual group tour — spring edition',
}

const ITINERARY = [
  {
    day_number: 1,
    destination: 'Srinagar',
    itinerary_text: 'Arrival at Sheikh ul-Alam International Airport. Transfer to houseboat on Dal Lake. Evening Shikara ride.',
    hotel_name: 'Houseboat New Young Star',
    activities: [
      { title: 'Airport Transfer', description: 'Pick up from airport, drive to Dal Lake', start_time: '14:00', end_time: '16:00', activity_order: 1 },
      { title: 'Dal Lake Shikara Ride', description: 'Scenic row-boat ride on Dal Lake', start_time: '17:00', end_time: '18:30', activity_order: 2 },
      { title: 'Welcome Dinner', description: 'Traditional Wazwan cuisine', start_time: '20:00', end_time: '21:30', activity_order: 3 },
    ],
  },
  {
    day_number: 2,
    destination: 'Gulmarg',
    itinerary_text: 'Day trip to Gulmarg. Gondola ride to Apharwat Peak (4,390m). Snow activities.',
    hotel_name: 'Houseboat New Young Star',
    activities: [
      { title: 'Drive to Gulmarg', description: '51 km drive through pine forests', start_time: '08:00', end_time: '09:30', activity_order: 1 },
      { title: 'Gondola Phase 1', description: 'Gondola from Gulmarg to Kongdori', start_time: '10:00', end_time: '11:00', activity_order: 2 },
      { title: 'Snow Activities', description: 'Skiing, snow sledging', start_time: '11:00', end_time: '14:00', activity_order: 3 },
      { title: 'Return to Srinagar', description: 'Drive back', start_time: '16:00', end_time: '17:30', activity_order: 4 },
    ],
  },
  {
    day_number: 3,
    destination: 'Pahalgam',
    itinerary_text: 'Full-day excursion to Pahalgam, the Valley of Shepherds. Visit Betaab Valley and Aru Valley.',
    hotel_name: 'Houseboat New Young Star',
    activities: [
      { title: 'Drive to Pahalgam', description: '95 km drive', start_time: '07:30', end_time: '09:30', activity_order: 1 },
      { title: 'Betaab Valley', description: 'Scenic valley named after Bollywood film', start_time: '10:00', end_time: '12:00', activity_order: 2 },
      { title: 'Aru Valley Trek', description: 'Short 3 km trek', start_time: '13:30', end_time: '15:30', activity_order: 3 },
    ],
  },
]

const CONTACTS = [
  { name: 'Priya Patel', role: 'Tour Leader', phone: '9000000002', email: '9000000002@payana.app' },
  { name: 'Ravi Kumar', role: 'Local Guide', phone: '9876543210', email: 'ravi@kashmir-guides.com' },
  { name: 'Payana Support', role: 'Emergency', phone: '18001234567', email: 'support@payana.app' },
]

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log('\n🌄  Payana Mitra — Seed Script\n')
  console.log('━'.repeat(50))

  // 1. Create auth users + profiles
  console.log('\n[1/5] Creating users...')
  const userIds: Record<string, string> = {}

  for (const spec of USERS) {
    const userId = await upsertAuthUser(spec)
    await upsertProfile(userId, spec)
    userIds[spec.phone] = userId
  }

  const leaderId = userIds['9000000002']

  // 2. Create or update the trip
  console.log('\n[2/5] Creating trip...')

  let tripId: string
  const { data: existingTrip } = await admin
    .from('trips')
    .select('id')
    .eq('trip_code', TRIP.trip_code)
    .maybeSingle()

  if (existingTrip) {
    tripId = existingTrip.id
    await admin.from('trips').update({ ...TRIP, leader_id: leaderId }).eq('id', tripId)
    console.log(`  ↻  Trip already exists: ${TRIP.name}`)
  } else {
    const { data, error } = await admin
      .from('trips')
      .insert({ ...TRIP, leader_id: leaderId })
      .select('id')
      .single()
    if (error || !data) throw new Error(`Trip insert failed: ${error?.message}`)
    tripId = data.id
    console.log(`  ✓  Created trip: ${TRIP.name} (${tripId})`)
  }

  // 3. Itinerary days + activities
  console.log('\n[3/5] Creating itinerary...')

  for (const day of ITINERARY) {
    const { data: dayData, error: dayError } = await admin
      .from('itinerary_days')
      .upsert(
        {
          trip_id: tripId,
          day_number: day.day_number,
          destination: day.destination,
          itinerary_text: day.itinerary_text,
          hotel_name: day.hotel_name,
        },
        { onConflict: 'trip_id,day_number' },
      )
      .select('id')
      .single()

    if (dayError || !dayData) throw new Error(`Itinerary day ${day.day_number} failed: ${dayError?.message}`)

    await admin.from('activities').delete().eq('itinerary_day_id', dayData.id)

    for (const act of day.activities) {
      await admin.from('activities').insert({ itinerary_day_id: dayData.id, ...act })
    }

    console.log(`  ✓  Day ${day.day_number}: ${day.destination} (${day.activities.length} activities)`)
  }

  // 4. Trip contacts
  console.log('\n[4/5] Creating trip contacts...')
  await admin.from('trip_contacts').delete().eq('trip_id', tripId)

  for (const contact of CONTACTS) {
    await admin.from('trip_contacts').insert({ trip_id: tripId, ...contact })
    console.log(`  ✓  Contact: ${contact.name} (${contact.role})`)
  }

  // 5. Trip members
  console.log('\n[5/5] Assigning trip members...')

  for (const phone of Object.keys(userIds)) {
    const { error } = await admin
      .from('trip_members')
      .upsert({ trip_id: tripId, user_id: userIds[phone] }, { onConflict: 'trip_id,user_id' })
    if (error) console.warn(`  ⚠  trip_members upsert for ${phone}: ${error.message}`)
    else console.log(`  ✓  Added member: ${phone}`)
  }

  console.log('\n' + '━'.repeat(50))
  console.log('✅  Seed complete!\n')
  console.log('Test credentials:')
  console.log('┌─────────────────┬──────┬──────────────────┬──────────┐')
  console.log('│ Phone           │ PIN  │ Name             │ Role     │')
  console.log('├─────────────────┼──────┼──────────────────┼──────────┤')
  for (const u of USERS) {
    const name = `${u.firstName} ${u.lastName}`.padEnd(16)
    const role = u.isLeader ? 'leader  ' : u.role.padEnd(8)
    console.log(`│ ${u.phone}   │ ${u.pin} │ ${name} │ ${role} │`)
  }
  console.log('└─────────────────┴──────┴──────────────────┴──────────┘\n')
}

main().catch((err) => {
  console.error('\n❌  Seed failed:', err.message)
  process.exit(1)
})
