/**
 * safeRedirect — anti open-redirect (M7).
 *
 * Só aceita path interno: começa com `/`, sem `//`, sem esquema (`:`),
 * sem backslash. Qualquer outra coisa cai para `fallback` ('/').
 */
export function safeRedirect(raw: unknown, fallback = '/'): string {
  if (typeof raw !== 'string' || !raw) return fallback
  const v = raw.trim()
  if (!v.startsWith('/')) return fallback
  if (v.startsWith('//')) return fallback
  if (v.includes(':') || v.includes('\\')) return fallback
  return v
}
