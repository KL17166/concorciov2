/**
 * useGuestId.ts
 *
 * Identidade anônima first-party para costurar a jornada pré-login.
 * UUID v4 persistido em localStorage (`kat_gid`) — sem PII, sem cookie
 * de terceiro, sobrevive a reloads. Enviado como `guestId` em todo
 * evento do pixel; após o login, o evento LOGIN carrega o mesmo
 * guestId junto ao userId do JWT (costura guest → user).
 */

const KEY = 'kat_gid'
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function newId(): string {
  try {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return crypto.randomUUID()
    }
  } catch (_) {}
  // Fallback UUID v4 manual
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16)
  })
}

/** Retorna o guestId persistido (string vazia fora do client). */
export function getGuestId(): string {
  if (!import.meta.client) return ''
  try {
    const stored = window.localStorage.getItem(KEY)
    if (stored && UUID_RE.test(stored)) return stored
    const id = newId()
    window.localStorage.setItem(KEY, id)
    return id
  } catch (_) {
    return ''
  }
}
