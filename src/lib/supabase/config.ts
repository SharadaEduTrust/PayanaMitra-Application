/**
 * Supabase configuration check.
 *
 * Safe to import from both server and client code: it only reads public env
 * vars and never throws, so a missing key produces a helpful message instead of
 * an opaque crash from inside the Supabase SDK.
 */
export function isSupabaseConfigured() {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY &&
      !isPlaceholder(process.env.NEXT_PUBLIC_SUPABASE_URL) &&
      !isPlaceholder(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
  );
}

function isPlaceholder(value?: string) {
  if (!value) return true;
  return /your-project-ref|your-anon-key|placeholder/i.test(value);
}

export const MISSING_CONFIG_MESSAGE =
  "Supabase is not configured, so sign-in is unavailable.";