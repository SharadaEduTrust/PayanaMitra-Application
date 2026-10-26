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
