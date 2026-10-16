import "server-only";

function required(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not set. Add it to .env.local`);
  return value;
}

export const env = {
  get supabaseUrl() {
    return required("NEXT_PUBLIC_SUPABASE_URL");
  },
  get supabaseAnonKey() {
    return required("NEXT_PUBLIC_SUPABASE_ANON_KEY");
  },
  get supabaseServiceRoleKey() {
    return required("SUPABASE_SERVICE_ROLE_KEY");
  },
  /**
   * 32-byte key, base64 encoded, for AES-256-GCM document encryption.
   *
   * The backend names this ENCRYPTION_KEY, so it is read first.
   * DOCUMENT_ENCRYPTION_KEY is kept as a fallback for older setups.
   */
  get documentEncryptionKey() {
    return process.env.ENCRYPTION_KEY || process.env.DOCUMENT_ENCRYPTION_KEY || required("ENCRYPTION_KEY");
  },
};