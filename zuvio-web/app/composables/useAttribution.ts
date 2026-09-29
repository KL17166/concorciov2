/**
 * useAttribution.ts
 *
 * Atribuição first-touch: na primeira visita captura UTM + click IDs
 * (fbclid, gclid, ttclid) + landing/referrer e persiste em cookie
 * first-party `kat_attrib` (90 dias). Todo evento do pixel carrega
 * esses parâmetros achatados no metadata — é o que permite dizer
 * "esta compra veio da campanha X / criativo Y".
 *
 * Sem PII: só parâmetros de campanha, nunca nome/CPF/email.
 */

export interface Attribution {
  utm_source?: string
  utm_medium?: string
  utm_campaign?: string
  utm_content?: string
  utm_term?: string
  fbclid?: string
  gclid?: string
  gbraid?: string
  wbraid?: string
  ttclid?: string
  landing?: string
  referrer?: string
}

const COOKIE_NAME = 'kat_attrib'
const MAX_AGE = 90 * 24 * 60 * 60 // 90 dias
const PARAM_KEYS = [
  'utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term',
  'fbclid', 'gclid', 'gbraid', 'wbraid', 'ttclid'
] as const

function readCookie(): Attribution {
  if (!import.meta.client) return {}
  try {
    const m = document.cookie.match(new RegExp(`(?:^|; )${COOKIE_NAME}=([^;]*)`))
    if (!m) return {}
    const parsed = JSON.parse(decodeURIComponent(m[1]!))
    return typeof parsed === 'object' && parsed !== null ? parsed : {}
  } catch (_) {
    return {}
  }
}

function writeCookie(a: Attribution) {
  try {
    document.cookie =
      `${COOKIE_NAME}=${encodeURIComponent(JSON.stringify(a))}` +
      `; Max-Age=${MAX_AGE}; Path=/; SameSite=Lax`
  } catch (_) {}
}

function clean(v: string | null, max = 160): string | undefined {
  if (!v) return undefined
  const t = v.trim().slice(0, max)
  return t ? t : undefined
}

/**
 * Captura atribuição da visita atual e mescla com a salva.
 * Regra: first-touch vence para UTM (origem original preservada);
 * click IDs novos preenchem lacunas (ex: usuário voltou por outro anúncio).
 * Chamar no plugin de analytics (mount) — barato e idempotente.
 */
export function captureAttribution(): Attribution {
  if (!import.meta.client) return {}
  const stored = readCookie()
  const params = new URLSearchParams(window.location.search)
  const next: Attribution = { ...stored }
  let changed = false

  for (const k of PARAM_KEYS) {
    const v = clean(params.get(k))
    if (v && !next[k]) {
      next[k] = v
      changed = true
    }
  }
  if (!stored.landing) {
    const landing = clean(window.location.pathname, 200)
    if (landing) {
      next.landing = landing
      changed = true
    }
  }
  if (!stored.referrer) {
    const ref = clean(document.referrer, 200)
    // Ignora autorreferência (navegação interna)
    if (ref && !ref.includes(window.location.hostname)) {
      next.referrer = ref
      changed = true
    }
  }

  if (changed || Object.keys(stored).length === 0) writeCookie(next)
  return next
}

/** Lê a atribuição salva (sem tocar na URL). */
export function getAttribution(): Attribution {
  return readCookie()
}

/** Achata a atribuição em pares string — pronto para `metadata` do track. */
export function getAttributionParams(): Record<string, string> {
  const a = getAttribution()
  const out: Record<string, string> = {}
  for (const [k, v] of Object.entries(a)) {
    if (typeof v === 'string' && v) out[k] = v
  }
  return out
}
