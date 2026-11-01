import { detectFileType } from './magic-bytes'
import { compressWithILoveApi } from './iloveapi'
import { compressWithSharp } from './sharp-provider'
import type { CompressionResult } from './types'

export const COMPRESSION_THRESHOLD_BYTES = 1 * 1024 * 1024 // 1 MB
export const DEFAULT_MAX_FILE_SIZE_BYTES = 25 * 1024 * 1024 // 25 MB

export function getMaxUploadFileSizeBytes(): number {
  const envVal = process.env.MAX_UPLOAD_FILE_SIZE_BYTES
  if (envVal) {
    const parsed = parseInt(envVal, 10)
    if (!isNaN(parsed) && parsed > 0) {
      return parsed
    }
  }
  return DEFAULT_MAX_FILE_SIZE_BYTES
}

export interface CompressFileOptions {
  buffer: Buffer
  filename: string
  mimeTypeHint?: string
}

/**
 * Main compression entrypoint.
 *
 * Rules:
 * 1. Validates magic bytes to ensure the buffer matches supported types (PDF, JPEG, PNG, WebP).
 * 2. If buffer <= 1 MB: stored as-is without compression.
 * 3. If buffer > 1 MB: compresses via configured provider (default: iLoveAPI).
 * 4. If compressed output >= original size: keeps the original.
 * 5. If compression fails for any reason (network, credits, timeout, missing keys):
 *    logs a structured server-side error, preserves the original file, and returns compressed: false.
 *    Never throws; never loses user data.
 */
export async function compressFileBuffer(options: CompressFileOptions): Promise<CompressionResult> {
  const { buffer, filename } = options
  const originalSize = buffer.length

  const detected = detectFileType(buffer)
  if (!detected) {
    throw new Error('Unsupported or spoofed file format. Allowed types: PDF, JPEG, PNG, WebP.')
  }

  const mimeType = detected.mimeType

  // If file is 1MB or less, store unchanged
  if (originalSize <= COMPRESSION_THRESHOLD_BYTES) {
    return {
      buffer,
      compressed: false,
      originalSize,
      finalSize: originalSize,
      mimeType,
      reason: 'File size is 1 MB or less; stored without compression.',
    }
  }

  // Attempt compression
  const isPdf = mimeType === 'application/pdf'
  const imageProvider = (process.env.IMAGE_COMPRESSION_PROVIDER || 'iloveapi').toLowerCase().trim()

  try {
    let compressedBuffer: Buffer

    if (!isPdf && imageProvider === 'sharp') {
      try {
        compressedBuffer = await compressWithSharp(buffer, mimeType)
      } catch (sharpErr) {
        console.warn(
          '[Compression] sharp failed or unavailable, falling back to iLoveAPI:',
          sharpErr instanceof Error ? sharpErr.message : String(sharpErr),
        )
        compressedBuffer = await compressWithILoveApi(buffer, filename, false)
      }
    } else {
      compressedBuffer = await compressWithILoveApi(buffer, filename, isPdf)
    }

    const finalSize = compressedBuffer.length

    // If compressed result is not smaller than original, keep original
    if (finalSize >= originalSize) {
      return {
        buffer,
        compressed: false,
        originalSize,
        finalSize: originalSize,
        mimeType,
        reason: 'Compressed output was not smaller than the original file; original retained.',
      }
    }

    return {
      buffer: compressedBuffer,
      compressed: true,
      originalSize,
      finalSize,
      mimeType,
    }
  } catch (err) {
    // Structured server-side logging without leaking secrets or credentials
    const errorMessage = err instanceof Error ? err.message : String(err)
    console.error('[Compression Provider Error]', {
      filename,
      mimeType,
      originalSize,
      error: errorMessage,
    })

    return {
      buffer,
      compressed: false,
      originalSize,
      finalSize: originalSize,
      mimeType,
      reason: `Compression failed (${errorMessage}). Original file was retained safely.`,
    }
  }
}

export * from './types'
export * from './magic-bytes'
