import "server-only";
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { env } from "@/lib/env";

const ALGORITHM = "aes-256-gcm";
const IV_BYTES = 12; // 96-bit IV, the recommended size for GCM
const TAG_BYTES = 16; // 128-bit authentication tag

function key() {
  const raw = env.documentEncryptionKey;
  const decoded = Buffer.from(raw, "base64");
  if (decoded.length !== 32) {
    throw new Error("DOCUMENT_ENCRYPTION_KEY must be 32 bytes, base64 encoded. Generate with: openssl rand -base64 32");
  }
  return decoded;
}

export type Encrypted = { doc_number_enc: string; iv: string; auth_tag: string };

/**
 * Encrypts a document number before it is stored. guest_documents holds
 * ciphertext only, so the plaintext must never be written to the database,
 * logged, or returned to the browser after saving.
 */
export function encryptDocumentNumber(plaintext: string): Encrypted {
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALGORITHM, key(), iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return {
    doc_number_enc: ciphertext.toString("base64"),
    iv: iv.toString("base64"),
    auth_tag: authTag.toString("base64"),
  };
}

/**
 * Decrypts a stored document number. Only call this where the plaintext is
 * genuinely needed, such as an admin export. Never return it to the client.
 */
export function decryptDocumentNumber(stored: Encrypted) {
  const decipher = createDecipheriv(ALGORITHM, key(), Buffer.from(stored.iv, "base64"));
  decipher.setAuthTag(Buffer.from(stored.auth_tag, "base64"));
  return Buffer.concat([
    decipher.update(Buffer.from(stored.doc_number_enc, "base64")),
    decipher.final(),
  ]).toString("utf8");
}