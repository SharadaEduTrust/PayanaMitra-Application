/**
 * @file whatsapp.ts
 * WhatsApp Cloud API helper.
 *
 * Environment variables required (set in .env.local):
 *   WHATSAPP_PHONE_NUMBER_ID   — The numeric phone number ID from Meta Business Manager
 *   WHATSAPP_ACCESS_TOKEN      — Permanent (or long-lived) system-user access token
 *
 * API reference:
 *   https://developers.facebook.com/docs/whatsapp/cloud-api/messages/text-messages
 */

const WA_BASE_URL = 'https://graph.facebook.com/v22.0'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface WaSendResult {
  /** Whether the API call itself succeeded (HTTP 200). */
  ok: boolean
  /** The recipient's phone number (E.164, e.g. "+919000000001"). */
  to: string
  /** Meta message ID when successful. */
  messageId?: string
  /** Error description when not ok. */
  error?: string
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Normalise a 10-digit Indian mobile number stored in `profiles.phone`
 * to E.164 format expected by the WhatsApp Cloud API.
 *
 * Examples:
 *   "9000000001" → "919000000001"  (drop leading zero, prepend country code)
 *   "+919000000001" → "919000000001"  (strip leading +)
 *   "09000000001" → "919000000001"
 */
export function normalisePhone(raw: string): string {
  // Strip whitespace and dashes
  let phone = raw.replace(/[\s\-]/g, '')
  // Strip leading +
  if (phone.startsWith('+')) phone = phone.slice(1)
  // Already has country code (91 prefix + 10 digits = 12 chars)
  if (phone.length === 12 && phone.startsWith('91')) return phone
  // Leading 0 — strip it
  if (phone.startsWith('0')) phone = phone.slice(1)
  // 10-digit Indian number — prepend 91
  if (phone.length === 10) return `91${phone}`
  // Return as-is and let the API reject it if malformed
  return phone
}

// ─── Core sender ─────────────────────────────────────────────────────────────

/**
 * Send a plain-text WhatsApp message to a single recipient.
 *
 * @param rawPhone   Phone number as stored in `profiles.phone`
 * @param text       Message body (max ~4096 chars)
 */
export async function sendWhatsAppText(
  rawPhone: string,
  text: string,
): Promise<WaSendResult> {
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID
  const accessToken   = process.env.WHATSAPP_ACCESS_TOKEN

  if (!phoneNumberId || !accessToken) {
    return {
      ok: false,
      to: rawPhone,
      error: 'WHATSAPP_PHONE_NUMBER_ID and WHATSAPP_ACCESS_TOKEN must be set',
    }
  }

  const to = normalisePhone(rawPhone)

  const payload = {
    messaging_product: 'whatsapp',
    recipient_type:    'individual',
    to,
    type: 'text',
    text: { preview_url: false, body: text },
  }

  try {
    const res = await fetch(
      `${WA_BASE_URL}/${phoneNumberId}/messages`,
      {
        method:  'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type':  'application/json',
        },
        body: JSON.stringify(payload),
      },
    )

    if (!res.ok) {
      const errBody = await res.text()
      return { ok: false, to, error: `WhatsApp API ${res.status}: ${errBody}` }
    }

    const json = await res.json() as { messages?: { id: string }[] }
    const messageId = json.messages?.[0]?.id
    return { ok: true, to, messageId }
  } catch (err) {
    return { ok: false, to, error: String(err) }
  }
}

// ─── Fan-out helper ───────────────────────────────────────────────────────────

/**
 * Send the same text message to multiple phone numbers concurrently.
 * Returns per-recipient results so callers can count sent/failed.
 */
export async function sendWhatsAppBulk(
  phones: string[],
  text: string,
): Promise<WaSendResult[]> {
  return Promise.all(phones.map(p => sendWhatsAppText(p, text)))
}
