/**
 * Server-only iLoveAPI Client (iLovePDF for PDFs, iLoveIMG for images).
 * Follows the official 4-step REST API flow:
 * 1. POST /v1/auth -> Bearer Token
 * 2. POST /v1/start/{tool} -> Assigned Server & Task ID
 * 3. POST https://{server}/v1/upload -> Server Filename
 * 4. POST https://{server}/v1/process -> Trigger Compression
 * 5. GET https://{server}/v1/download/{task} -> Compressed Output Buffer
 */

interface CachedToken {
  token: string
  expiresAt: number
}

const tokenCache: Record<string, CachedToken> = {}

async function getAuthToken(baseUrl: string, publicKey: string): Promise<string> {
  const cached = tokenCache[baseUrl]
  if (cached && Date.now() < cached.expiresAt) {
    return cached.token
  }

  const res = await fetch(`${baseUrl}/v1/auth`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ public_key: publicKey }),
    signal: AbortSignal.timeout(15000),
  })

  if (!res.ok) {
    const errorText = await res.text().catch(() => '')
    throw new Error(`iLoveAPI auth failed (status ${res.status}): ${errorText.slice(0, 200)}`)
  }

  const data = (await res.json()) as { token?: string }
  if (!data?.token) {
    throw new Error('iLoveAPI auth did not return a token')
  }

  // Token is valid for 1 hour; cache for 50 minutes
  tokenCache[baseUrl] = {
    token: data.token,
    expiresAt: Date.now() + 50 * 60 * 1000,
  }

  return data.token
}

interface StartTaskResponse {
  server: string
  task: string
  status?: string
}

interface UploadResponse {
  server_filename: string
}

export async function compressWithILoveApi(
  buffer: Buffer,
  filename: string,
  isPdf: boolean,
): Promise<Buffer> {
  const publicKey = process.env.ILOVEAPI_PUBLIC_KEY?.trim()
  if (!publicKey) {
    throw new Error('ILOVEAPI_PUBLIC_KEY is not configured')
  }

  const baseUrl = isPdf ? 'https://api.ilovepdf.com' : 'https://api.iloveimg.com'
  const tool = isPdf ? 'compress' : 'compressimage'

  // Step 1: Authenticate
  const token = await getAuthToken(baseUrl, publicKey)

  // Step 2: Start Task (iLoveAPI start endpoint requires GET)
  const startRes = await fetch(`${baseUrl}/v1/start/${tool}`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
    },
    signal: AbortSignal.timeout(15000),
  })

  if (!startRes.ok) {
    const errText = await startRes.text().catch(() => '')
    throw new Error(`iLoveAPI start task failed (${startRes.status}): ${errText.slice(0, 200)}`)
  }

  const { server, task } = (await startRes.json()) as StartTaskResponse
  if (!server || !task) {
    throw new Error('iLoveAPI start task did not return server or task ID')
  }

  const serverUrl = `https://${server}`

  // Step 3: Upload source file
  const formData = new FormData()
  formData.append('task', task)
  const blob = new Blob([new Uint8Array(buffer)])
  formData.append('file', blob, filename)

  const uploadRes = await fetch(`${serverUrl}/v1/upload`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
    },
    body: formData,
    signal: AbortSignal.timeout(30000),
  })

  if (!uploadRes.ok) {
    const errText = await uploadRes.text().catch(() => '')
    throw new Error(`iLoveAPI upload failed (${uploadRes.status}): ${errText.slice(0, 200)}`)
  }

  const { server_filename } = (await uploadRes.json()) as UploadResponse
  if (!server_filename) {
    throw new Error('iLoveAPI upload response missing server_filename')
  }

  // Step 4: Process Task
  const processPayload = {
    task,
    tool,
    compression_level: 'recommended',
    files: [
      {
        server_filename,
        filename,
      },
    ],
  }

  const processRes = await fetch(`${serverUrl}/v1/process`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(processPayload),
    signal: AbortSignal.timeout(30000),
  })

  if (!processRes.ok) {
    const errText = await processRes.text().catch(() => '')
    throw new Error(`iLoveAPI process failed (${processRes.status}): ${errText.slice(0, 200)}`)
  }

  // Step 5: Download output
  const downloadRes = await fetch(`${serverUrl}/v1/download/${task}`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
    },
    signal: AbortSignal.timeout(30000),
  })

  if (!downloadRes.ok) {
    const errText = await downloadRes.text().catch(() => '')
    throw new Error(`iLoveAPI download failed (${downloadRes.status}): ${errText.slice(0, 200)}`)
  }

  const arrayBuffer = await downloadRes.arrayBuffer()
  return Buffer.from(arrayBuffer)
}

