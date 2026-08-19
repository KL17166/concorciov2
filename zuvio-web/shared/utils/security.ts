import CryptoJS from 'crypto-js'

const STATIC_HMAC_SECRET = 'd8f9a2b3c4e5f60718293a4b5c6d7e8f90123456789abcdef0123456789abcde'

/**
 * Get or generate a persistent unique Device ID for Web
 */
export function getOrCreateDeviceId(): string {
  if (typeof window === 'undefined') return 'ssr-device-node'
  
  let deviceId = localStorage.getItem('katari_device_id')
  if (!deviceId) {
    deviceId = 'web_' + Math.random().toString(36).substring(2, 15) + '_' + Date.now()
    localStorage.setItem('katari_device_id', deviceId)
  }
  return deviceId
}

/**
 * Generate standard Katari security and audit headers
 */
export function getSecurityHeaders(sessionSecret?: string | null): Record<string, string> {
  const deviceId = getOrCreateDeviceId()
  return {
    'X-Device-Id': deviceId,
    'X-Device-Platform': 'web',
    'X-App-Version': '2.0.0-web',
    'X-App-Build': '2026.1'
  }
}

/**
 * HMAC-SHA256 Request Signing for Anti-Tampering & Anti-Replay
 */
export function signRequest(
  method: string,
  path: string,
  bodyStr?: string,
  sessionSecret?: string | null
): Record<string, string> {
  const timestamp = Math.floor(Date.now() / 1000).toString()
  const nonce = Math.random().toString(36).substring(2, 15)
  const secret = sessionSecret && sessionSecret.length > 0 ? sessionSecret : STATIC_HMAC_SECRET

  // Payload hash: SHA256 of the raw body string (or empty SHA256 if no body)
  const bodyHash = bodyStr ? CryptoJS.SHA256(bodyStr).toString(CryptoJS.enc.Hex) : CryptoJS.SHA256('').toString(CryptoJS.enc.Hex)

  // Canonical string: METHOD:PATH:TIMESTAMP:NONCE:BODY_HASH
  const canonicalString = `${method.toUpperCase()}:${path}:${timestamp}:${nonce}:${bodyHash}`
  const signature = CryptoJS.HmacSHA256(canonicalString, secret).toString(CryptoJS.enc.Hex)

  return {
    'X-Signature': signature,
    'X-Timestamp': timestamp,
    'X-Nonce': nonce
  }
}
