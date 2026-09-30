/**
 * AES-256-GCM encryption for sensitive fields (PAN, passport numbers).
 *
 * Key source: ENCRYPTION_KEY env var (base64-encoded 32 bytes).
 * Never log, return in list endpoints, or expose this key.
 *
 * SERVER ONLY — never import in client components.
 */

const ALGORITHM = 'AES-GCM'
const IV_LENGTH = 12  // bytes — GCM standard
const TAG_LENGTH = 128 // bits

function getKey(): Promise<CryptoKey> {
  const raw = process.env.ENCRYPTION_KEY
  if (!raw) throw new Error('ENCRYPTION_KEY is not set')
  const bytes = Buffer.from(raw, 'base64')
  if (bytes.length !== 32) {
    throw new Error('ENCRYPTION_KEY must be exactly 32 bytes (base64-encoded)')
  }
  return crypto.subtle.importKey(
    'raw',
    bytes,
    { name: ALGORITHM },
    false,
    ['encrypt', 'decrypt'],
  )
}

export interface EncryptedValue {
  ciphertext: string  // base64
  iv: string          // base64
  authTag: string     // base64
}

/**
 * Encrypt a plaintext string.
 * Returns separate ciphertext, IV, and auth-tag — store all three in the DB.
 */
export async function encrypt(plaintext: string): Promise<EncryptedValue> {
  const key = await getKey()
  const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH))

  // SubtleCrypto AES-GCM appends the auth tag to the ciphertext buffer
  const encoded = new TextEncoder().encode(plaintext)
  const ciphertextWithTag = await crypto.subtle.encrypt(
    { name: ALGORITHM, iv, tagLength: TAG_LENGTH },
    key,
    encoded,
  )

  // Split: last 16 bytes are the auth tag
  const buf = new Uint8Array(ciphertextWithTag)
  const ciphertext = buf.slice(0, buf.length - 16)
  const authTag = buf.slice(buf.length - 16)

  return {
    ciphertext: Buffer.from(ciphertext).toString('base64'),
    iv: Buffer.from(iv).toString('base64'),
    authTag: Buffer.from(authTag).toString('base64'),
  }
}

/**
 * Decrypt a value encrypted by `encrypt()`.
 */
export async function decrypt(value: EncryptedValue): Promise<string> {
  const key = await getKey()
  const iv = Buffer.from(value.iv, 'base64')
  const ciphertext = Buffer.from(value.ciphertext, 'base64')
  const authTag = Buffer.from(value.authTag, 'base64')

  // Reassemble ciphertext+authTag for SubtleCrypto
  const combined = new Uint8Array(ciphertext.length + authTag.length)
  combined.set(ciphertext)
  combined.set(authTag, ciphertext.length)

  const decrypted = await crypto.subtle.decrypt(
    { name: ALGORITHM, iv, tagLength: TAG_LENGTH },
    key,
    combined,
  )

  return new TextDecoder().decode(decrypted)
}
