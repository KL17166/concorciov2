/**
 * BFF Proxy Utility — Server Side Only
 *
 * This module is the single place responsible for signing requests
 * and forwarding them to server-consorcio. It runs exclusively on
 * the Node.js layer of Nuxt (Nitro), keeping HMAC secrets and
 * Authorization headers completely out of the browser bundle.
 */
import crypto from 'crypto'
import { H3Event, getHeader, setResponseStatus } from 'h3'

// B1: segredo via env server-only (NUXT_HMAC_SECRET), nunca hardcoded.
// Deve ser idêntico ao REQUEST_SIGNING_SECRET do backend.
function hmacSecret(fallbackSession?: string | null): string {
  if (fallbackSession && fallbackSession.length > 0) return fallbackSession
  const config = useRuntimeConfig()
  return (config as any).hmacSecret || ''
}

function buildSignatureHeaders(
  method: string,
  path: string,
  body?: string,
  sessionSecret?: string | null
): Record<string, string> {
  const timestamp = Math.floor(Date.now() / 1000).toString()
  const nonce = crypto.randomBytes(8).toString('hex')
  const secret = hmacSecret(sessionSecret)

  const bodyHash = body
    ? crypto.createHash('sha256').update(body).digest('hex')
    : crypto.createHash('sha256').update('').digest('hex')

  const canonicalString = `${method.toUpperCase()}:${path}:${timestamp}:${nonce}:${bodyHash}`
  const signature = crypto.createHmac('sha256', secret).update(canonicalString).digest('hex')

  return {
    'X-Signature': signature,
    'X-Timestamp': timestamp,
    'X-Nonce': nonce,
    'X-Device-Platform': 'web',
    'X-App-Version': '2.0.0-web',
    'X-App-Build': '2026.1',
    'X-Device-Id': 'server-bff'
  }
}

export interface ProxyOptions {
  method?: string
  body?: unknown
  /** Optionally forward the Authorization Bearer token from the incoming request */
  forwardAuth?: boolean
}

/**
 * Forward a request from Nuxt BFF to server-consorcio.
 *
 * @param event  The H3 event from the Nuxt route handler
 * @param path   The backend path (e.g. '/api/auth/login')
 * @param opts   Method, body, and auth options
 */
export async function proxyToBackend<T>(
  event: H3Event,
  path: string,
  opts: ProxyOptions = {}
): Promise<T> {
  const config = useRuntimeConfig()
  const apiBase = (config as any).backendBase || (config.public as any).apiBase || 'http://localhost:3000'

  const method = (opts.method || 'GET').toUpperCase()
  const bodyStr = opts.body !== undefined ? JSON.stringify(opts.body) : undefined

  const sigHeaders = buildSignatureHeaders(method, path, bodyStr)

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...sigHeaders
  }

  if (opts.forwardAuth !== false) {
    const authHeader = getHeader(event, 'authorization')
    if (authHeader) headers['Authorization'] = authHeader
  }

  try {
    const result = await $fetch(`${apiBase}${path}`, {
      method: method as any,
      headers,
      body: opts.body as any
    })
    return result as T
  } catch (err: any) {
    // Sem `throw`: o h3 em dev serializa `error.stack` em TODA exceção
    // (e os knobs `nitro.debug`/`errorHandler` são ignorados pelo dev server).
    // Respondendo direto, o corpo é exatamente este objeto — sem stack,
    // em dev e em prod. O $fetch do front continua lançando pelo status,
    // com `error.data.message` intacto para as telas.
    const status = err?.status || err?.statusCode || 500
    const message = err?.data?.message || err?.data?.error || err?.message || 'Erro no servidor'
    const rawData = err?.data && typeof err.data === 'object' ? err.data : undefined
    let data: Record<string, unknown> | undefined
    if (rawData) {
      const { stack, stackTrace, trace, ...rest } = rawData as Record<string, unknown>
      data = rest
    }
    setResponseStatus(event, status, 'Server Error')
    return {
      error: true,
      url: event.path,
      statusCode: status,
      statusMessage: 'Server Error',
      message,
      ...(data ? { data } : {})
    } as T
  }
}
