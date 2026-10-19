import { type NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getSession } from '@/lib/server/auth'

/**
 * POST /api/admin/trips/[id]/itinerary/import
 *
 * Accepts a multipart/form-data request with a single `file` field that
 * contains a UTF-8 CSV.  Parses the CSV server-side and bulk-imports the
 * itinerary (days + activities) for the given trip.
 *
 * CSV columns (header row required, order does not matter):
 *   day_number           — integer >= 1 (required)
 *   destination          — string  (optional)
 *   hotel_name           — string  (optional)
 *   itinerary_text       — string  (optional)
 *   activity_title       — string  (optional — row becomes activity when present)
 *   activity_description — string  (optional)
 *   start_time           — HH:MM or HH:MM:SS (optional)
 *   end_time             — HH:MM or HH:MM:SS (optional)
 *   activity_order       — integer >= 1 (optional)
 *
 * Behaviour:
 *   - Days are UPSERTED on (trip_id, day_number). Day-level columns from
 *     the FIRST row for each day_number win; subsequent rows for the same
 *     day are treated as additional activities only.
 *   - Activities are APPENDed (no deduplication).
 *   - A row with no activity_title only creates/updates the day record.
 *   - Max 200 rows per CSV.
 *
 * Returns:
 *   { days_upserted, activities_inserted, skipped, errors: [{ row, error }] }
 *
 * GET /api/admin/trips/[id]/itinerary/import
 *   Returns a plain-text CSV template the admin can download.
 */

interface Params { params: Promise<{ id: string }> }

const TIME_RE = /^\d{2}:\d{2}(:\d{2})?$/

const VALID_MEAL_PLANS = new Set([
  'Breakfast',
  'Breakfast & Dinner',
  'Breakfast, Lunch & Dinner',
])

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

export async function GET() {
  const guard = await requireAdmin()
  if ('error' in guard) return NextResponse.json({ error: guard.error }, { status: guard.status })

  const lines = [
    'day_number,destination,hotel_name,meal_plan,itinerary_text,activity_title,activity_description,start_time,end_time,activity_order',
    '1,Srinagar,Hotel Grand Palace,"Breakfast & Dinner","Drive from Delhi to Srinagar, check-in",Airport Transfer,Pick-up from Srinagar airport,10:00,12:00,1',
    '1,,,,,"Shikara Ride","Evening shikara ride on Dal Lake",16:00,18:00,2',
    '2,Gulmarg,Snow Peak Resort,"Breakfast, Lunch & Dinner","Full day excursion to Gulmarg",Gondola Ride,"Cable car ride to Apharwat Peak",09:00,13:00,1',
    '2,,,,,"Skiing",Skiing on the slopes,14:00,17:00,2',
    '3,Pahalgam,Pine View Hotel,"Breakfast","Scenic drive to Pahalgam valley",,,,,',
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
    return NextResponse.json({ error: 'Trip not found' }, { status: 404 })
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

    const dayRaw = row['day_number'] ?? ''
    const dayNum = parseInt(dayRaw, 10)
    if (!dayRaw || isNaN(dayNum) || dayNum < 1) {
      errors.push({ row: rowNum, error: 'day_number must be an integer >= 1' })
      skipped++
      continue
    }

    const rawMealPlan = (row['meal_plan'] ?? '').trim()
    let mealPlan: string | null = null
    if (rawMealPlan) {
      if (!VALID_MEAL_PLANS.has(rawMealPlan)) {
        errors.push({
          row: rowNum,
          error: `Invalid meal_plan: "${rawMealPlan}". Supported values are: "Breakfast", "Breakfast & Dinner", "Breakfast, Lunch & Dinner"`,
        })
        skipped++
        continue
      }
      mealPlan = rawMealPlan
    }

    if (!dayData.has(dayNum)) {
      dayData.set(dayNum, {
        day_number:     dayNum,
        destination:    row['destination']     || null,
        hotel_name:     row['hotel_name']      || null,
        meal_plan:      mealPlan,
        itinerary_text: row['itinerary_text']  || null,
      })
    }

    const actTitle = (row['activity_title'] ?? '').trim()
    if (!actTitle) continue

    const startTime = (row['start_time'] ?? '').trim() || null
    const endTime   = (row['end_time']   ?? '').trim() || null

    if (startTime && !TIME_RE.test(startTime)) {
      errors.push({ row: rowNum, error: 'start_time must be HH:MM or HH:MM:SS' })
      skipped++
      continue
    }
    if (endTime && !TIME_RE.test(endTime)) {
      errors.push({ row: rowNum, error: 'end_time must be HH:MM or HH:MM:SS' })
      skipped++
      continue
    }
    if (startTime && endTime && endTime < startTime) {
      errors.push({ row: rowNum, error: 'end_time must be after or equal to start_time' })
      skipped++
      continue
    }

    const orderRaw = (row['activity_order'] ?? '').trim()
    const actOrder = orderRaw ? parseInt(orderRaw, 10) : null
    if (orderRaw && (isNaN(actOrder!) || actOrder! < 1)) {
      errors.push({ row: rowNum, error: 'activity_order must be an integer >= 1' })
      skipped++
      continue
    }

    if (!activitiesByDay.has(dayNum)) activitiesByDay.set(dayNum, [])
    activitiesByDay.get(dayNum)!.push({
      title:          actTitle,
      description:    (row['activity_description'] ?? '').trim() || null,
      start_time:     startTime,
      end_time:       endTime,
      activity_order: actOrder,
      row:            rowNum,
    })
  }

  if (dayData.size === 0) {
    return NextResponse.json(
      { error: 'No valid days found in CSV', days_upserted: 0, activities_inserted: 0, skipped, errors, message: 'No valid days found in CSV' },
      { status: 422 },
    )
  }

  const dayInserts = Array.from(dayData.values()).map(d => ({ ...d, trip_id }))

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: upsertedDays, error: daysError } = await (admin.from('itinerary_days') as any)
    .upsert(dayInserts, { onConflict: 'trip_id,day_number', ignoreDuplicates: false })
    .select('id, day_number')

  if (daysError) {
    return NextResponse.json({ error: 'Failed to upsert days: ' + daysError.message }, { status: 500 })
  }

  const days_upserted: number = upsertedDays?.length ?? 0

  const dayIdMap = new Map<number, string>()
  for (const d of (upsertedDays ?? [])) { dayIdMap.set(d.day_number, d.id) }

  const activityInserts: {
    itinerary_day_id: string
    title: string
    description: string | null
    start_time: string | null
    end_time: string | null
    activity_order: number | null
  }[] = []

  for (const [dayNum, acts] of activitiesByDay.entries()) {
    const dayId = dayIdMap.get(dayNum)
    if (!dayId) {
      acts.forEach(a => errors.push({ row: a.row, error: 'Could not resolve day_id for day ' + dayNum }))
      skipped += acts.length
      continue
    }
    for (const a of acts) {
      activityInserts.push({
        itinerary_day_id: dayId,
        title:            a.title,
        description:      a.description,
        start_time:       a.start_time,
        end_time:         a.end_time,
        activity_order:   a.activity_order,
      })
    }
  }

  let activities_inserted = 0
  if (activityInserts.length > 0) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: insertedActs, error: actsError } = await (admin.from('activities') as any)
      .insert(activityInserts)
      .select('id')

    if (actsError) {
      return NextResponse.json({ error: 'Failed to insert activities: ' + actsError.message }, { status: 500 })
    }
    activities_inserted = insertedActs?.length ?? 0
  }

  return NextResponse.json({ days_upserted, activities_inserted, skipped, errors })
}
