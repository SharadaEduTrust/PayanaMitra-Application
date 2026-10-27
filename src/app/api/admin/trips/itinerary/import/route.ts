import { type NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getSession } from '@/lib/server/auth'
import { parseCSV, getField, parseDayNumber, extractActivitiesFromRow } from '@/lib/csv'

const TIME_RE = /^\d{2}:\d{2}(:\d{2})?$/

const VALID_MEAL_PLANS = new Set([
  'Breakfast',
  'Breakfast & Dinner',
  'Breakfast, Lunch & Dinner',
])

function normalizeMealPlan(val: string): string {
  const trimmed = val.trim()
  if (/^breakfast$/i.test(trimmed)) return 'Breakfast'
  if (/^breakfast\s*(&|and)\s*dinner$/i.test(trimmed)) return 'Breakfast & Dinner'
  if (/^breakfast,?\s*lunch\s*(&|and)\s*dinner$/i.test(trimmed)) return 'Breakfast, Lunch & Dinner'
  return trimmed
}

async function requireAdmin() {
  const profile = await getSession()
  if (!profile) return { error: 'Unauthorized', status: 401 } as const
  if (profile.role !== 'admin') return { error: 'Forbidden', status: 403 } as const
  return { profile }
}

type TripRecord = {
  id: string
  trip_code: string
  name: string
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

export async function GET() {
  const guard = await requireAdmin()
  if ('error' in guard) return NextResponse.json({ error: guard.error }, { status: guard.status })

  const lines = [
    'Trail Id,Trail Name,Day,Destination,Itinerary,Hotel Name,Meal Plan,Activity Description 1,Activity Description 2,Activity Description 3,Activity Description 4,Activity Description 5',
    'HIHGOK01,Heritage Gems of Karnataka,1,Hampi,"• Arrive at Hospet / Hampi\\n• Check-in to hotel\\n• Sunset view at Hemakuta Hill",Heritage Resort Hampi,Breakfast & Dinner,"Arrive at Hospet station and transfer to hotel","Check-in and refresh at resort","Sunset walk to Hemakuta Hill for panoramic sunset view","Virupaksha temple evening Aarti","Traditional dinner at resort"',
    'HIHGOK01,Heritage Gems of Karnataka,2,Hampi,"• Virupaksha Temple & Bazaar\\n• Vijaya Vittala Temple & Stone Chariot\\n• Tungabhadra River coracle ride",Heritage Resort Hampi,"Breakfast, Lunch & Dinner","Guided morning walk through Virupaksha bazaar","Exploration of Vijaya Vittala temple complex and stone chariot","Scenic coracle ride on the Tungabhadra River","Visit to Lotus Mahal and Queen\'s Bath","Cultural music performance and dinner"',
    'HIHGOK01,Heritage Gems of Karnataka,3,Badami,"• Transfer to Badami\\n• Rock-cut Cave Temples\\n• Agastya Lake heritage circuit",The Badami Court,Breakfast & Dinner,"Scenic morning drive to Badami","Guided exploration of 6th-century rock-cut cave temples","Walk around holy Agastya Lake and Bhutanatha Temples","Visit Badami Archaeological Museum","Sunset view and dinner at hotel"',
  ]
  return new NextResponse(lines.join('\n'), {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': 'attachment; filename="trail_itinerary_template.csv"',
    },
  })
}

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

  const defaultTripId = (formData.get('trip_id') || formData.get('trail_id') || '') as string

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
    return NextResponse.json({ error: 'Maximum 500 rows per CSV upload' }, { status: 422 })
  }

  const admin = createAdminClient()

  // Preload all trips for code and name resolution
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: trips, error: tripsErr } = await (admin.from('trips') as any)
    .select('id, trip_code, name') as { data: TripRecord[] | null; error: Error | null }

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

  let fallbackTrip: TripRecord | null = null
  if (defaultTripId) {
    fallbackTrip = resolveTrip(defaultTripId, tripMap)
  }

  type RowError = { row: number; error: string }
  const errors: RowError[] = []
  let skipped = 0

  type DayData = {
    trip_id: string
    day_number: number
    destination: string | null
    hotel_name: string | null
    meal_plan?: string | null
    itinerary_text: string | null
  }

  type ActivityInput = {
    title: string
    description: string | null
    start_time: string | null
    end_time: string | null
    activity_order: number | null
    row: number
  }

  // Keyed by `${trip_id}:${dayNum}`
  const daysByKey = new Map<string, DayData>()
  const activitiesByKey = new Map<string, ActivityInput[]>()

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]
    const rowNum = i + 2

    const rawTrailId = getField(row, 'Trail Id', 'TrailId', 'Trail Code', 'trip_code', 'code')
    let resolvedTrip: TripRecord | null = null

    if (rawTrailId) {
      resolvedTrip = resolveTrip(rawTrailId, tripMap)
      if (!resolvedTrip) {
        errors.push({ row: rowNum, error: `Trail "${rawTrailId}" not found. Verify Trail Id exists.` })
        skipped++
        continue
      }
    } else if (fallbackTrip) {
      resolvedTrip = fallbackTrip
    } else {
      errors.push({ row: rowNum, error: 'Trail Id is missing. Please provide Trail Id in CSV or select a Trail.' })
      skipped++
      continue
    }

    const dayRaw = getField(row, 'Day', 'day', 'day_number', 'Day Number')
    const dayNum = parseDayNumber(dayRaw)
    if (!dayRaw || isNaN(dayNum) || dayNum < 1) {
      errors.push({ row: rowNum, error: 'Day must be an integer >= 1' })
      skipped++
      continue
    }

    const rawMealPlan = getField(row, 'Meal Details', 'Meal details', 'meal_details', 'Meal Plan', 'meal_plan', 'MealPlan', 'Meals')
    let mealPlan: string | null = null
    if (rawMealPlan) {
      const normalized = normalizeMealPlan(rawMealPlan)
      if (!VALID_MEAL_PLANS.has(normalized)) {
        errors.push({
          row: rowNum,
          error: `Invalid Meal Plan: "${rawMealPlan}". Supported values: "Breakfast", "Breakfast & Dinner", "Breakfast, Lunch & Dinner"`,
        })
        skipped++
        continue
      }
      mealPlan = normalized
    }

    const destination = getField(row, 'Destination', 'destination', 'place') || null
    const hotel_name = getField(row, 'Hotel Name', 'HotelName', 'hotel_name', 'hotel') || null
    const itinerary_text = getField(row, 'Itinerary', 'itinerary', 'itinerary_text', 'Day Plan') || null

    const key = `${resolvedTrip.id}:${dayNum}`
    if (!daysByKey.has(key)) {
      daysByKey.set(key, {
        trip_id: resolvedTrip.id,
        day_number: dayNum,
        destination,
        hotel_name,
        meal_plan: mealPlan,
        itinerary_text,
      })
    }

    const existingActs = activitiesByKey.get(key) ?? []
    const newActs = extractActivitiesFromRow(row, existingActs.length)
    for (const a of newActs) {
      if (a.start_time && a.end_time && a.end_time < a.start_time) {
        errors.push({ row: rowNum, error: `Activity "${a.title}": End Time "${a.end_time}" must be on or after Start Time "${a.start_time}"` })
      }
      existingActs.push({
        title: a.title,
        description: a.description,
        start_time: a.start_time,
        end_time: a.end_time,
        activity_order: a.activity_order,
        row: rowNum,
      })
    }
    activitiesByKey.set(key, existingActs)
  }

  // Upsert days
  const dayIdMap = new Map<string, string>()
  let daysUpserted = 0

  for (const [key, d] of daysByKey.entries()) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: upserted, error: dayErr } = await (admin.from('itinerary_days') as any)
        .upsert(
          {
            trip_id:        d.trip_id,
            day_number:     d.day_number,
            destination:    d.destination,
            hotel_name:     d.hotel_name,
            meal_plan:      d.meal_plan,
            itinerary_text: d.itinerary_text,
          },
          { onConflict: 'trip_id,day_number' },
        )
        .select('id')
        .single()

      if (dayErr || !upserted) {
        errors.push({ row: 0, error: `Trip Day ${d.day_number}: ${dayErr?.message ?? 'upsert failed'}` })
        skipped++
      } else {
        dayIdMap.set(key, upserted.id)
        daysUpserted++
      }
    } catch (err) {
      errors.push({ row: 0, error: `Trip Day ${d.day_number}: ${String(err)}` })
      skipped++
    }
  }

  // Insert activities
  let activitiesInserted = 0

  for (const [key, acts] of activitiesByKey.entries()) {
    const dayId = dayIdMap.get(key)
    if (!dayId) {
      acts.forEach(a => {
        errors.push({ row: a.row, error: `Day failed to save; activity "${a.title}" skipped` })
        skipped++
      })
      continue
    }

    for (const a of acts) {
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { error: actErr } = await (admin.from('activities') as any)
          .insert({
            itinerary_day_id: dayId,
            title:            a.title,
            description:      a.description,
            start_time:       a.start_time,
            end_time:         a.end_time,
            activity_order:   a.activity_order,
          })

        if (actErr) {
          errors.push({ row: a.row, error: `Activity "${a.title}": ${actErr.message}` })
          skipped++
        } else {
          activitiesInserted++
        }
      } catch (err) {
        errors.push({ row: a.row, error: `Activity "${a.title}": ${String(err)}` })
        skipped++
      }
    }
  }

  return NextResponse.json({
    createdDays:         daysUpserted,
    createdActivities:   activitiesInserted,
    skipped,
    errorCount:          errors.length,
    errors,
  })
}
