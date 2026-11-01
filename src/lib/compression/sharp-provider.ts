import type { SupportedMimeType } from './types'
import type SharpInstance from 'sharp'

/**
 * Optional image compression provider using `sharp`.
 * Dynamically loaded so that if `sharp` is not installed or available, it fails gracefully.
 */
export async function compressWithSharp(
  buffer: Buffer,
  mimeType: SupportedMimeType,
): Promise<Buffer> {
  let sharpFn: typeof SharpInstance
  try {
    const mod = await import('sharp')
    sharpFn = (mod.default ?? mod) as unknown as typeof SharpInstance
  } catch {
    throw new Error('sharp is not available in the current environment')
  }

  const pipeline = sharpFn(buffer)

  switch (mimeType) {
    case 'image/jpeg':
      return pipeline.jpeg({ quality: 80, mozjpeg: true }).toBuffer()
    case 'image/png':
      return pipeline.png({ compressionLevel: 8 }).toBuffer()
    case 'image/webp':
      return pipeline.webp({ quality: 80 }).toBuffer()
    default:
      throw new Error(`sharp does not support MIME type: ${mimeType}`)
  }
}
