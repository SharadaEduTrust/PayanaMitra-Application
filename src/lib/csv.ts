/**
 * Robust RFC 4180 CSV parser and field extractor.
 * Handles:
 * - UTF-8 Byte Order Marks (\ufeff)
 * - Multi-line fields enclosed in quotes
 * - Escaped quotes ("")
 * - Flexible header aliases and case/whitespace/punctuation normalization
 * - Flexible day number formats (e.g. 1, "01", "Day 1", "Day 01", "Day-1")
 */

export function parseCSV(text: string): Record<string, string>[] {
  const cleanText = text.replace(/^\uFEFF/, '')
  const rows: string[][] = []
  let currentRow: string[] = []
  let currentField = ''
  let inQuotes = false

  for (let i = 0; i < cleanText.length; i++) {
    const ch = cleanText[i]
    if (inQuotes) {
      if (ch === '"') {
        if (cleanText[i + 1] === '"') {
          currentField += '"'
          i++
        } else {
          inQuotes = false
        }
      } else {
        currentField += ch
      }
    } else {
      if (ch === '"') {
        inQuotes = true
      } else if (ch === ',') {
        currentRow.push(currentField)
        currentField = ''
      } else if (ch === '\r') {
        if (cleanText[i + 1] === '\n') {
          i++
        }
        currentRow.push(currentField)
        currentField = ''
        if (currentRow.some(col => col.trim() !== '')) {
          rows.push(currentRow)
        }
        currentRow = []
      } else if (ch === '\n') {
        currentRow.push(currentField)
        currentField = ''
        if (currentRow.some(col => col.trim() !== '')) {
          rows.push(currentRow)
        }
        currentRow = []
      } else {
        currentField += ch
      }
    }
  }

  if (currentField.length > 0 || currentRow.length > 0) {
    currentRow.push(currentField)
    if (currentRow.some(col => col.trim() !== '')) {
      rows.push(currentRow)
    }
  }

  if (rows.length === 0) return []
  const headerRow = rows[0]
  const headers = headerRow.map(h => h.trim().replace(/^\uFEFF/, ''))
  const result: Record<string, string>[] = []

  for (let r = 1; r < rows.length; r++) {
    const row = rows[r]
    const obj: Record<string, string> = {}
    headers.forEach((h, idx) => {
      obj[h] = (row[idx] ?? '').trim()
    })
    result.push(obj)
  }

  return result
}

export function getField(row: Record<string, string>, ...aliases: string[]): string {
  for (const a of aliases) {
    if (row[a] !== undefined && row[a].trim() !== '') return row[a].trim()
    const normTarget = a.toLowerCase().replace(/[\ufeff\s_/.-]/g, '')
    for (const [k, v] of Object.entries(row)) {
      if (k.toLowerCase().replace(/[\ufeff\s_/.-]/g, '') === normTarget && v.trim() !== '') {
        return v.trim()
      }
    }
  }
  return ''
}

export function parseDayNumber(raw: string): number {
  if (!raw) return NaN
  const cleaned = raw.trim()
  if (/^\d+$/.test(cleaned)) return parseInt(cleaned, 10)
  const match = cleaned.match(/(?:day\s*[-:#]?\s*)?(\d+)/i)
  if (match) {
    return parseInt(match[1], 10)
  }
  return parseInt(cleaned, 10)
}

export interface ExtractedActivity {
  title: string
  description: string | null
  start_time: string | null
  end_time: string | null
  activity_order: number
}

/**
 * Extracts activities from a CSV row supporting:
 * 1. Column-wise extended format:
 *    "Activity Description 1", "Activity Description 2", ... "Activity Description 5"
 *    (as well as optional companion columns "Activity Title N", "Start Time N", "End Time N")
 * 2. Row-wise legacy format:
 *    "Activity Title", "Activity Description", "Start Time", "End Time", "Activity Order"
 */
export function extractActivitiesFromRow(
  row: Record<string, string>,
  existingCount = 0
): ExtractedActivity[] {
  const TIME_RE = /^\d{2}:\d{2}(:\d{2})?$/
  const activities: ExtractedActivity[] = []

  // Collect any numbered activity indices present in row keys
  const indices = new Set<number>()
  for (const k of Object.keys(row)) {
    const match = k.match(/act(?:i)?vity.*?(\d+)/i) || k.match(/description.*?(\d+)/i)
    if (match) {
      const parsedIdx = parseInt(match[1], 10)
      if (!isNaN(parsedIdx) && parsedIdx > 0 && parsedIdx <= 50) {
        indices.add(parsedIdx)
      }
    }
  }

  // Always ensure columns 1..5 are checked
  for (let i = 1; i <= 5; i++) {
    indices.add(i)
  }

  const sortedIndices = Array.from(indices).sort((a, b) => a - b)

  for (const n of sortedIndices) {
    const desc = getField(
      row,
      `Activity Description ${n}`,
      `Activity Description${n}`,
      `Actvity Description ${n}`,
      `Actvity Description${n}`,
      `Activity ${n} Description`,
      `Activity ${n}`,
      `Activity${n}`,
      `Actvity ${n}`,
      `Actvity${n}`,
      `activity_description_${n}`,
      `activity_description${n}`,
      `activity_${n}`,
      `activity${n}`,
      `Description ${n}`,
      `Description${n}`
    )

    const title = getField(
      row,
      `Activity Title ${n}`,
      `Activity Title${n}`,
      `Actvity Title ${n}`,
      `Activity ${n} Title`,
      `activity_title_${n}`,
      `activity_title${n}`,
      `Title ${n}`,
      `Title${n}`
    )

    const startRaw = getField(
      row,
      `Start Time ${n}`,
      `Start Time${n}`,
      `StartTime ${n}`,
      `StartTime${n}`,
      `start_time_${n}`,
      `start_time${n}`
    )

    const endRaw = getField(
      row,
      `End Time ${n}`,
      `End Time${n}`,
      `EndTime ${n}`,
      `EndTime${n}`,
      `end_time_${n}`,
      `end_time${n}`
    )

    if (desc || title || startRaw || endRaw) {
      const actTitle = title || (desc ? (desc.length <= 100 ? desc : `${desc.slice(0, 97)}...`) : `Activity ${n}`)
      const actDesc = desc || title || null
      const startTime = startRaw && TIME_RE.test(startRaw) ? (startRaw.length === 5 ? `${startRaw}:00` : startRaw) : null
      const endTime = endRaw && TIME_RE.test(endRaw) ? (endRaw.length === 5 ? `${endRaw}:00` : endRaw) : null

      activities.push({
        title: actTitle,
        description: actDesc,
        start_time: startTime,
        end_time: endTime,
        activity_order: existingCount + activities.length + 1,
      })
    }
  }

  // If no numbered activities found, fallback to single activity columns (row-wise format)
  if (activities.length === 0) {
    const singleTitle = getField(row, 'Activity Title', 'ActivityTitle', 'activity_title', 'activity')
    const singleDesc = getField(row, 'Activity Description', 'ActivityDescription', 'activity_description', 'description')
    const startRaw = getField(row, 'Start Time', 'StartTime', 'start_time', 'Start', 'start')
    const endRaw = getField(row, 'End Time', 'EndTime', 'end_time', 'End', 'end')

    if (singleTitle || singleDesc || startRaw || endRaw) {
      const actTitle = singleTitle || (singleDesc ? (singleDesc.length <= 100 ? singleDesc : `${singleDesc.slice(0, 97)}...`) : 'Activity 1')
      const startTime = startRaw && TIME_RE.test(startRaw) ? (startRaw.length === 5 ? `${startRaw}:00` : startRaw) : null
      const endTime = endRaw && TIME_RE.test(endRaw) ? (endRaw.length === 5 ? `${endRaw}:00` : endRaw) : null

      const orderRaw = getField(row, 'Activity Order', 'activity_order')
      const actOrder = orderRaw ? parseInt(orderRaw, 10) : (existingCount + 1)

      activities.push({
        title: actTitle,
        description: singleDesc || singleTitle || null,
        start_time: startTime,
        end_time: endTime,
        activity_order: isNaN(actOrder) ? existingCount + 1 : actOrder,
      })
    }
  }

  return activities
}

