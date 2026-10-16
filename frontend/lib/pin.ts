import "server-only";
import { timingSafeEqual } from "node:crypto";

/**
 * The traveller PIN is the last four digits of their registered phone number.
 *
 * This means no PIN column is needed: the expected value is derived from the
 * phone already stored in `profiles`, so nothing extra is persisted.
 */
export function expectedPin(phone: string) {
  const digits = phone.replace(/\D/g, "");
  return digits.slice(-4);
}

/** Constant-time comparison so a PIN cannot be guessed by timing the response. */
export function pinMatches(phone: string, candidate: string) {
  const expected = Buffer.from(expectedPin(phone));
  const given = Buffer.from(candidate.replace(/\D/g, ""));

  if (expected.length !== 4 || given.length !== 4) return false;
  return timingSafeEqual(expected, given);
}

export function normalisePhone(raw: string) {
  const hasPlus = raw.trim().startsWith("+");
  let digits = raw.replace(/\D/g, "");
  if (!digits) return null;

  if (!hasPlus) {
    digits = digits.replace(/^0+/, "");
    if (digits.startsWith("91") && (digits.length === 11 || digits.length === 12)) {
      digits = digits.slice(2);
    }
    return digits.length === 10 ? `+91${digits}` : null;
  }

  return digits.length >= 8 && digits.length <= 15 ? `+${digits}` : null;
}

/**
 * The seeded database stores phones as bare 10-digit national numbers, while
 * the app normalises new entries to E.164. Both forms must resolve to the same
 * account, so every lookup tries each of them.
 */
export function phoneCandidates(raw: string) {
  const bare = raw.replace(/\D/g, "").replace(/^0+/, "").slice(-10);
  const e164 = normalisePhone(raw);
  const forms = new Set<string>();

  if (bare.length === 10) {
    forms.add(bare);
    forms.add(`+91${bare}`);
  }
  if (e164) forms.add(e164);

  return [...forms];
}