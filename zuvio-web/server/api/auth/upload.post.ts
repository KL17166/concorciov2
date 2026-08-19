// POST /api/auth/upload?type=...
import { defineEventHandler, getQuery, readMultipartFormData, createError } from 'h3'
import { getHeader } from 'h3'
import crypto from 'crypto'

/**
 * File upload proxy — cannot use the generic JSON proxy since it's multipart.
 * We forward the raw FormData to server-consorcio with HMAC headers.
 */
export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig()
  const apiBase = (config as any).backendBase || (config.public as any).apiBase || 'http://localhost:3000'
  const query = getQuery(event)
  const type = query.type as string

  if (!type) throw createError({ statusCode: 400, statusMessage: 'Query param "type" is required' })

  const parts = await readMultipartFormData(event)
  if (!parts || parts.length === 0) throw createError({ statusCode: 400, statusMessage: 'Arquivo ausente' })

  const filePart = parts[0]
  if (!filePart || !filePart.data) throw createError({ statusCode: 400, statusMessage: 'Arquivo inválido' })

  // Re-create FormData with the file
  // Convert Node Buffer → Uint8Array for standard Blob compatibility
  const formData = new FormData()
  const blob = new Blob([new Uint8Array(filePart.data)], { type: filePart.type || 'application/octet-stream' })
  formData.append('file', blob, filePart.filename || 'upload')

  // HMAC signature (body undefined for multipart — header marks no body)
  const STATIC_HMAC_SECRET = 'd8f9a2b3c4e5f60718293a4b5c6d7e8f90123456789abcdef0123456789abcde'
  const timestamp = Math.floor(Date.now() / 1000).toString()
  const nonce = crypto.randomBytes(8).toString('hex')
  const bodyHash = crypto.createHash('sha256').update('').digest('hex')
  const canonical = `POST:/api/auth/upload:${timestamp}:${nonce}:${bodyHash}`
  const signature = crypto.createHmac('sha256', STATIC_HMAC_SECRET).update(canonical).digest('hex')

  const authHeader = getHeader(event, 'authorization')
  const headers: Record<string, string> = {
    'X-Signature': signature,
    'X-Timestamp': timestamp,
    'X-Nonce': nonce,
    'X-Device-Platform': 'web',
    'X-App-Version': '2.0.0-web',
    'X-App-Build': '2026.1',
    'X-Device-Id': 'server-bff'
  }
  if (authHeader) headers['Authorization'] = authHeader

  try {
    return await $fetch<{ message: string; url: string }>(
      `${apiBase}/api/auth/upload?type=${type}`,
      { method: 'POST', headers, body: formData }
    )
  } catch (err: any) {
    const status = err?.status || 500
    const message = err?.data?.error || err?.message || 'Erro ao fazer upload'
    throw createError({ statusCode: status, statusMessage: message })
  }
})
