/**
 * Small in-memory throttle for privileged actions such as bulk account
 * creation. Per-sign-in rate limiting lives in Supabase Auth, and the
 * `login_attempts` table from migration 002 is reserved for phone-based
 * checks should that flow return.
 *
 * In-memory means it resets on deploy and is not shared across serverless
 * instances. Move this into the database before a public launch.
 */
const buckets = new Map<string, { count: number; resetAt: number }>();

const WINDOW_MS = 10 * 60 * 1000;
const MAX = Number(process.env.ADMIN_RATE_LIMIT ?? 20);

export function checkRateLimit(key: string) {
  const now = Date.now();
  const bucket = buckets.get(key);

  if (!bucket || bucket.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + WINDOW_MS });
    return { allowed: true, remaining: MAX - 1, retryAfterSeconds: 0 };
  }

  bucket.count += 1;
  if (bucket.count > MAX) {
    return {
      allowed: false,
      remaining: 0,
      retryAfterSeconds: Math.ceil((bucket.resetAt - now) / 1000),
    };
  }
  return { allowed: true, remaining: MAX - bucket.count, retryAfterSeconds: 0 };
}
