import type { DetectedFileType } from './types'

/**
 * Validates a file buffer's actual header bytes (magic bytes).
 * Defends against MIME-spoofing and fake file extensions (e.g. .exe or .txt renamed to .pdf).
 */
export function detectFileType(buffer: Buffer): DetectedFileType | null {
  if (!buffer || buffer.length < 12) {
    return null
  }

  // 1. PDF: starts with "%PDF-" (0x25, 0x50, 0x44, 0x46, 0x2D)
  if (
    buffer[0] === 0x25 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x44 &&
    buffer[3] === 0x46 &&
    buffer[4] === 0x2d
  ) {
    return { mimeType: 'application/pdf', ext: 'pdf' }
  }

  // 2. JPEG: starts with 0xFF, 0xD8, 0xFF
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return { mimeType: 'image/jpeg', ext: 'jpg' }
  }

  // 3. PNG: starts with 0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A (\x89PNG\r\n\x1a\n)
  if (
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a
  ) {
    return { mimeType: 'image/png', ext: 'png' }
  }

  // 4. WebP: 'RIFF' at 0..3 and 'WEBP' at 8..11
  if (
    buffer[0] === 0x52 && // R
    buffer[1] === 0x49 && // I
    buffer[2] === 0x46 && // F
    buffer[3] === 0x46 && // F
    buffer[8] === 0x57 && // W
    buffer[9] === 0x45 && // E
    buffer[10] === 0x42 && // B
    buffer[11] === 0x50 // P
  ) {
    return { mimeType: 'image/webp', ext: 'webp' }
  }

  return null
}

export function isValidMagicBytes(buffer: Buffer): boolean {
  return detectFileType(buffer) !== null
}
