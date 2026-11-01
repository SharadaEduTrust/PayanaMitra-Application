export type SupportedMimeType =
  | 'application/pdf'
  | 'image/jpeg'
  | 'image/png'
  | 'image/webp'

export interface CompressionResult {
  buffer: Buffer
  compressed: boolean
  originalSize: number
  finalSize: number
  mimeType: SupportedMimeType
  reason?: string
}

export interface DetectedFileType {
  mimeType: SupportedMimeType
  ext: string
}

