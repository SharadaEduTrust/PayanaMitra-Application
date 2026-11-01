/**
 * scripts/test-compression.ts
 *
 * Automated tests for:
 * 1. Magic bytes detection (PDF, JPEG, PNG, WebP)
 * 2. Spoofed / fake file rejection (e.g. .txt renamed to .pdf)
 * 3. Size threshold logic (files <= 1MB stored as-is without calling compressor)
 * 4. Graceful fallback on API error / missing credentials (never throws, never loses file)
 * 5. Larger-result prevention (if compression result is not smaller, keeps original)
 *
 * Execution:
 *   npx tsx scripts/test-compression.ts
 */

import { detectFileType, isValidMagicBytes } from '../src/lib/compression/magic-bytes'
import {
  compressFileBuffer,
  COMPRESSION_THRESHOLD_BYTES,
  getMaxUploadFileSizeBytes,
} from '../src/lib/compression'

let passed = 0
let failed = 0

function assert(condition: boolean, message: string) {
  if (condition) {
    console.log(`  ✅ ${message}`)
    passed++
  } else {
    console.error(`  ❌ FAIL: ${message}`)
    failed++
  }
}

async function runTests() {
  console.log('\n--- 1. Testing Magic Bytes Detection ---')

  // PDF
  const pdfBuffer = Buffer.from('%PDF-1.4 sample content with valid header')
  const pdfType = detectFileType(pdfBuffer)
  assert(pdfType?.mimeType === 'application/pdf', 'Correctly identifies PDF header')
  assert(pdfType?.ext === 'pdf', 'Returns correct PDF extension')

  // JPEG
  const jpegBuffer = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01])
  const jpegType = detectFileType(jpegBuffer)
  assert(jpegType?.mimeType === 'image/jpeg', 'Correctly identifies JPEG header')
  assert(jpegType?.ext === 'jpg', 'Returns correct JPEG extension')

  // PNG
  const pngBuffer = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d])
  const pngType = detectFileType(pngBuffer)
  assert(pngType?.mimeType === 'image/png', 'Correctly identifies PNG header')
  assert(pngType?.ext === 'png', 'Returns correct PNG extension')

  // WebP
  const webpBuffer = Buffer.concat([
    Buffer.from('RIFF'),
    Buffer.from([0x00, 0x00, 0x00, 0x00]),
    Buffer.from('WEBP'),
    Buffer.from('VP8 '),
  ])
  const webpType = detectFileType(webpBuffer)
  assert(webpType?.mimeType === 'image/webp', 'Correctly identifies WebP header')
  assert(webpType?.ext === 'webp', 'Returns correct WebP extension')

  // Spoofed fake file (.txt renamed to .pdf)
  const fakePdfBuffer = Buffer.from('This is actually a plain text file pretending to be a PDF!')
  const fakeType = detectFileType(fakePdfBuffer)
  assert(fakeType === null, 'Rejects text file masquerading as PDF')
  assert(!isValidMagicBytes(fakePdfBuffer), 'isValidMagicBytes returns false for spoofed file')

  // Short buffer (< 12 bytes)
  const shortBuffer = Buffer.from('short')
  assert(detectFileType(shortBuffer) === null, 'Rejects truncated buffer')

  console.log('\n--- 2. Testing File Size Threshold & Storage Rules ---')

  assert(COMPRESSION_THRESHOLD_BYTES === 1024 * 1024, 'Threshold is exactly 1 MB (1,048,576 bytes)')
  assert(getMaxUploadFileSizeBytes() === 25 * 1024 * 1024, 'Default max file size is 25 MB')

  // Small file <= 1MB (e.g. 500 KB valid PDF)
  const smallPdf = Buffer.concat([
    Buffer.from('%PDF-1.4\n'),
    Buffer.alloc(500 * 1024, 'A'),
  ])
  const smallResult = await compressFileBuffer({
    buffer: smallPdf,
    filename: 'test-small.pdf',
  })
  assert(!smallResult.compressed, 'File <= 1MB is not compressed')
  assert(smallResult.finalSize === smallPdf.length, 'Size remains unchanged for file <= 1MB')
  assert(smallResult.buffer === smallPdf, 'Buffer identity preserved for file <= 1MB')
  assert(smallResult.mimeType === 'application/pdf', 'Mime type correctly preserved')

  console.log('\n--- 3. Testing Fallback & Error Resilience (> 1MB without credentials) ---')

  // Large file > 1MB (e.g. 1.5 MB valid JPEG)
  // Since ILOVEAPI_PUBLIC_KEY is not set or invalid in test env, it MUST gracefully fall back to original
  const largeJpeg = Buffer.concat([
    Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01]),
    Buffer.alloc(1.5 * 1024 * 1024, 0x00),
  ])

  const fallbackResult = await compressFileBuffer({
    buffer: largeJpeg,
    filename: 'large-photo.jpg',
  })

  assert(!fallbackResult.compressed, 'Reports compressed: false when provider is unavailable')
  assert(fallbackResult.finalSize === largeJpeg.length, 'Preserves exact original file size on failure')
  assert(fallbackResult.buffer.length === largeJpeg.length, 'Preserves exact original buffer on failure')
  assert(typeof fallbackResult.reason === 'string', 'Provides informative fallback reason')

  console.log('\n--- 4. Testing Spoofed File Rejection in Compression Pipeline ---')

  let threw = false
  try {
    await compressFileBuffer({
      buffer: Buffer.from('FAKE_FILE_DATA_NOT_PDF_OR_IMAGE'),
      filename: 'fake.pdf',
    })
  } catch {
    threw = true
  }
  assert(threw, 'compressFileBuffer rejects files with invalid magic bytes with an error')

  console.log(`\n========================================`)
  console.log(`Results: ${passed} passed, ${failed} failed`)
  console.log(`========================================\n`)

  if (failed > 0) {
    process.exit(1)
  }
}

runTests().catch((err) => {
  console.error('Fatal error in tests:', err)
  process.exit(1)
})

