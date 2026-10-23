import { type NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getSession } from '@/lib/server/auth'

/**
 * POST /api/admin/trips/[id]/itinerary/import
 *
 * Accepts a multipart/form-data request with a single `file` field that
 * contains a UTF-8 CSV. Parses the CSV server-side and bulk-imports the
 * itinerary (days + activities) for the given trip.
 *
 * Follows exact Field Names from the Payana Mitra App - Table Details sheet ("Trail Table Extension"):
 *   Trail Id             — string (optional for reference)
 *   Trail Name           — string (optional for reference)
 *   Day                  — integer >= 1 (required)
 *   Destination          — string (optional)
 *   Itinerary            — string (optional, description of the day plan)
 *   Hotel Name           — string (optional)
 *
 * Extended activity columns supported:
 *   Meal Plan            — Breakfast | Breakfast & Dinner | Breakfast, Lunch & Dinner (optional)
 *   Activity Title       — string (optional — row creates activity when present)
 *   Activity Description — string (optional)
 *   Start Time           — HH:MM or HH:MM:SS (optional)
 *   End Time             — HH:MM or HH:MM:SS (optional)
 *   Activity Order       — integer >= 1 (optional)
 */

interface Params { params: Promise<{ id: string }> }

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

export async function GET() {
  const guard = await requireAdmin()
  if ('error' in guard) return NextResponse.json({ error: guard.error }, { status: guard.status })

  // Uses Field Names matching "Trail Table Extension" from the Table Details specification
  const lines = [
    'Trail Id,Trail Name,Day,Destination,Itinerary,Hotel Name,Meal Plan,Activity Title,Activity Description,Start Time,End Time',
    'HIHGOK01,Heritage Gems of Karnataka,1,Hampi,"• Arrive at Hospet / Hampi\\n• Check-in to hotel\\n• Sunset view at Hemakuta Hill",Heritage Resort Hampi,Breakfast & Dinner,Sunset Walk,Walk up to Hemakuta Hill for panoramic sunset view,16:30,18:30',
    'HIHGOK01,Heritage Gems of Karnataka,2,Hampi,"• Virupaksha Temple & Bazaar\\n• Vijaya Vittala Temple & Stone Chariot\\n• Tungabhadra River coracle ride",Heritage Resort Hampi,Breakfast, Lunch & Dinner,Temple Tour,Guided exploration of Vijaya Vittala temple complex,08:30,12:00',
    'HIHGOK01,Heritage Gems of Karnataka,3,Badami,"• Transfer to Badami\\n• Rock-cut Cave Temples\\n• Agastya Lake heritage circuit",The Badami Court,Breakfast & Dinner,Cave Temples Exploration,Guided walk through 6th-century cave temples,09:00,13:00',
  ]
  return new NextResponse(lines.join('\n'), {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': 'attachment; filename="itinerary_template.csv"',
    },
  })
}

export async function POST(req: NextRequest, { params }: Params) {
  const guard = await requireAdmin()
  if ('error' in guard) return NextResponse.json({ error: guard.error }, { status: guard.status })

  const { id: trip_id } = await params

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
  if (rows.length > 200) {
    return NextResponse.json({ error: 'Maximum 200 rows per CSV upload' }, { status: 422 })
  }

  const admin = createAdminClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { count: tripCount } = await (admin.from('trips') as any)
    .select('id', { count: 'exact', head: true })
    .eq('id', trip_id)

  if ((tripCount ?? 0) === 0) {
    return NextResponse.json({ error: 'Trail not found' }, { status: 404 })
  }

  type RowError = { row: number; error: string }
  const errors: RowError[] = []
  let skipped = 0

  const dayData = new Map<number, {
    day_number: number
    destination: string | null
    hotel_name: string | null
    meal_plan?: string | null
    itinerary_text: string | null
  }>()

  type ActivityInput = {
    title: string
    description: string | null
    start_time: string | null
    end_time: string | null
    activity_order: number | null
    row: number
  }
  const activitiesByDay = new Map<number, ActivityInput[]>()

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]
    const rowNum = i + 2

    // Field names matching "Trail Table Extension"
    const dayRaw = getField(row, 'Day', 'day', 'day_number', 'Day Number')
    const dayNum = parseInt(dayRaw, 10)
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

    if (!dayData.has(dayNum)) {
      dayData.set(dayNum, {
        day_number: dayNum,
        destination,
        hotel_name,
        meal_plan: mealPlan,
        itinerary_text,
      })
    }

    const actTitle = getField(row, 'Activity Title', 'ActivityTitle', 'activity_title', 'activity')
    if (!actTitle) continue

    const startTime = getField(row, 'Start Time', 'StartTime', 'start_time') || null
    const endTime   = getField(row, 'End Time', 'EndTime', 'end_time') || null

    if (startTime && !TIME_RE.test(startTime)) {
      errors.push({ row: rowNum, error: 'Start Time must be HH:MM or HH:MM:SS' })
      skipped++
      continue
    }
    if (endTime && !TIME_RE.test(endTime)) {
      errors.push({ row: rowNum, error: 'End Time must be HH:MM or HH:MM:SS' })
      skipped++
      continue
    }
    if (startTime && endTime && endTime < startTime) {
      errors.push({ row: rowNum, error: 'End Time must be after or equal to Start Time' })
      skipped++
      continue
    }

    const orderRaw = getField(row, 'Activity Order', 'activity_order')
    const actOrder = orderRaw ? parseInt(orderRaw, 10) : null

    const existing = activitiesByDay.get(dayNum) ?? []
    existing.push({
      title: actTitle,
      description: getField(row, 'Activity Description', 'activity_description', 'description') || null,
      start_time: startTime,
      end_time: endTime,
      activity_order: actOrder ?? (existing.length + 1),
      row: rowNum,
    })
    activitiesByDay.set(dayNum, existing)
  }

  // Upsert days
  const dayIdMap = new Map<number, string>()
  let daysUpserted = 0

  for (const [dayNum, d] of dayData.entries()) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: upserted, error: dayErr } = await (admin.from('itinerary_days') as any)
        .upsert(
          {
            trip_id,
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
        errors.push({ row: 0, error: `Day ${dayNum}: ${dayErr?.message ?? 'upsert failed'}` })
        skipped++
      } else {
        dayIdMap.set(dayNum, upserted.id)
        daysUpserted++
      }
    } catch (err) {
      errors.push({ row: 0, error: `Day ${dayNum}: ${String(err)}` })
      skipped++
    }
  }

  // Insert activities
  let activitiesInserted = 0

  for (const [dayNum, acts] of activitiesByDay.entries()) {
    const dayId = dayIdMap.get(dayNum)
    if (!dayId) {
      acts.forEach(a => {
        errors.push({ row: a.row, error: `Day ${dayNum} failed to save; activity "${a.title}" skipped` })
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
    days_upserted:       daysUpserted,
    activities_inserted: activitiesInserted,
    skipped,
    errors,
  })
}
