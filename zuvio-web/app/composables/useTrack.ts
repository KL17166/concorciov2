import { useAuthStore } from '~/stores/auth'
import { captureAttribution, getAttributionParams } from './useAttribution'
import { getGuestId } from './useGuestId'

// ─── Event Catalog ──────────────────────────────────────────────────────────
export type TrackEvent =
  // Navigation
  | 'SCREEN_VIEW'
  // Product discovery
  | 'VIEW_ITEM_LIST'
  | 'VIEW_ITEM'
  | 'SEARCH'
  | 'FILTER_CATEGORY'
  // Checkout funnel
  | 'ADD_TO_CART'
  | 'BEGIN_CHECKOUT'
  | 'CHECKOUT_STEP'
  | 'CHECKOUT_COMPLETE'
  // Payment
  | 'GENERATE_QR_CLICK'
  | 'QR_SHOWN'
  | 'COPY_PIX_CLICK'
  | 'VERIFY_PAYMENT_CLICK'
  | 'PAYMENT_CONFIRMED_VIEW'
  // Bids / Lances
  | 'BID_CREATED'
  | 'BID_VIEWED'
  // Auth
  | 'LOGIN'
  | 'LOGOUT'
  | 'REGISTER'
  // KYC
  | 'KYC_STARTED'
  | 'KYC_SUBMITTED'
  | 'KYC_APPROVED'
  | 'KYC_REJECTED'
  // Engagement
  | 'ONBOARDING_STARTED'
  | 'ONBOARDING_COMPLETE'
  | 'SHARE'
  | 'NOTIFICATION_CLICK'

export type TrackScreen =
  | 'home'
  | 'welcome'
  | 'auth'
  | 'bids'
  | 'payment'
  | 'checkout'
  | 'contract'
  | 'adhesion'
  | 'contracts'
  | 'payments'
  | 'statement'
  | 'kyc'
  | 'products'
  | 'product_detail'
  | 'profile'

export type TrackEntityType =
  | 'bid'
  | 'installment'
  | 'subscription'
  | 'batch'
  | 'product'
  | 'user'

export interface TrackPayload {
  event: TrackEvent
  screen?: TrackScreen
  entityType?: TrackEntityType
  entityId?: string
  /** Dados adicionais livres — evite PII (nome/CPF/email) aqui */
  metadata?: Record<string, string | number | boolean>
}

// ─── Pixel Bridge Types ──────────────────────────────────────────────────────
// Mapeamento canônico: evento interno → parâmetros para cada plataforma

interface PixelBridgeMap {
  ga4Event?: string
  ga4Params?: Record<string, string | number>
  metaEvent?: string
  metaParams?: Record<string, string | number | string[]>
  ttEvent?: string
}

function buildPixelBridge(payload: TrackPayload): PixelBridgeMap {
  const meta = payload.metadata ?? {}
  const price = typeof meta.price === 'number' ? meta.price : undefined

  switch (payload.event) {
    case 'VIEW_ITEM':
      return {
        ga4Event: 'view_item',
        ga4Params: { item_id: payload.entityId ?? '', item_name: String(meta.productName ?? '') },
        metaEvent: 'ViewContent',
        metaParams: { content_ids: payload.entityId ?? '', content_type: 'product', value: price ?? 0 },
        ttEvent: 'ViewContent'
      }
    case 'VIEW_ITEM_LIST':
      return {
        ga4Event: 'view_item_list',
        ga4Params: { item_list_id: String(meta.category ?? 'all') },
        metaEvent: 'ViewContent',
        metaParams: { content_type: 'product_group' }
      }
    case 'ADD_TO_CART':
      return {
        ga4Event: 'add_to_cart',
        ga4Params: { item_id: payload.entityId ?? '', currency: 'BRL', value: price ?? 0 },
        metaEvent: 'AddToCart',
        metaParams: { content_ids: payload.entityId ?? '', currency: 'BRL', value: price ?? 0 },
        ttEvent: 'AddToCart'
      }
    case 'BEGIN_CHECKOUT':
      return {
        ga4Event: 'begin_checkout',
        ga4Params: { currency: 'BRL', value: price ?? 0 },
        metaEvent: 'InitiateCheckout',
        metaParams: { currency: 'BRL', value: price ?? 0 },
        ttEvent: 'InitiateCheckout'
      }
    case 'PAYMENT_CONFIRMED_VIEW':
      return {
        ga4Event: 'purchase',
        ga4Params: {
          transaction_id: payload.entityId ?? '',
          currency: 'BRL',
          value: price ?? 0
        },
        // content_ids abre a porta para DPA/catálogo na Meta.
        // content_ids abre a porta para DPA/catálogo na Meta.
        metaEvent: 'Purchase',
        metaParams: {
          content_ids: payload.entityId ? [payload.entityId] : [],
          content_type: 'product',
          currency: 'BRL',
          value: price ?? 0
        },
        ttEvent: 'CompletePayment'
      }
    case 'REGISTER':
      return {
        ga4Event: 'sign_up',
        metaEvent: 'CompleteRegistration',
        ttEvent: 'CompleteRegistration'
      }
    case 'LOGIN':
      return { ga4Event: 'login' }
    case 'SEARCH':
      return {
        ga4Event: 'search',
        ga4Params: { search_term: String(meta.query ?? '') },
        metaEvent: 'Search',
        metaParams: { search_string: String(meta.query ?? '') }
      }
    case 'KYC_SUBMITTED':
      return { ga4Event: 'kyc_submitted', metaEvent: 'SubmitApplication' }
    case 'BID_CREATED':
      return {
        ga4Event: 'bid_created',
        ga4Params: { value: price ?? 0, currency: 'BRL' }
      }
    default:
      return {}
  }
}

// ─── Pixel Forwarders ────────────────────────────────────────────────────────

function fireGA4(eventName: string, params: Record<string, string | number> = {}) {
  try {
    const w = window as any
    if (typeof w.gtag === 'function') {
      w.gtag('event', eventName, params)
    }
  } catch (_) {}
}

function fireMeta(eventName: string, params: Record<string, string | number | string[]> = {}, eventID?: string) {
  try {
    const w = window as any
    if (typeof w.fbq === 'function') {
      // eventID = deduplicação com o espelho server-side (CAPI).
      w.fbq('track', eventName, params, eventID ? { eventID } : undefined)
    }
  } catch (_) {}
}

function fireTikTok(eventName: string, params: Record<string, string | number> = {}) {
  try {
    const w = window as any
    if (typeof w.ttq?.track === 'function') {
      w.ttq.track(eventName, params)
    }
  } catch (_) {}
}

function dispatchToPixels(payload: TrackPayload, metadata?: Record<string, string | number | boolean>) {
  const bridge = buildPixelBridge(payload)
  const eid = typeof metadata?.eid === 'string' ? metadata.eid : undefined
  if (bridge.ga4Event) fireGA4(bridge.ga4Event, bridge.ga4Params)
  if (bridge.metaEvent) fireMeta(bridge.metaEvent, bridge.metaParams as any, eid)
  if (bridge.ttEvent) fireTikTok(bridge.ttEvent, bridge.ga4Params as any)
}

// Eventos que valem dinheiro/cadastro: ganham eid (deduplicação CAPI)
// + IDs de browser (fbp/fbc/ga_client_id) para match quality server-side.
const EID_EVENTS = new Set([
  'PAYMENT_CONFIRMED_VIEW',
  'REGISTER',
  'BEGIN_CHECKOUT',
  'ADD_TO_CART',
  'VIEW_ITEM'
])

function readCookieValue(name: string): string | undefined {
  try {
    const m = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`))
    const v = m?.[1] ? decodeURIComponent(m[1]!) : ''
    return v || undefined
  } catch (_) {
    return undefined
  }
}

function getBrowserMatchIds(): Record<string, string> {
  const out: Record<string, string> = {}
  const fbp = readCookieValue('_fbp')
  const fbc = readCookieValue('_fbc')
  // _ga = GA1.1.<clientIdHigh>.<clientIdLow> → client_id = "high.low"
  const ga = readCookieValue('_ga')
  if (fbp) out.fbp = fbp
  if (fbc) out.fbc = fbc
  if (ga) {
    const parts = ga.split('.')
    if (parts.length >= 4) out.ga_client_id = parts.slice(2).join('.')
  }
  return out
}

// ─── Core trackEvent ─────────────────────────────────────────────────────────

/**
 * Pixel próprio + bridge para GA4, Meta, TikTok.
 * Fire-and-forget: nunca quebra a UI.
 * O userId é derivado do JWT no backend (sem spoof de atribuição).
 */
export function trackEvent(payload: TrackPayload) {
  try {
    // 0. Garante atribuição capturada (first-touch) e anexa ao metadata.
    //    Chaves achatadas (utm_campaign, fbclid...) — o schema do backend
    //    só aceita string | number | boolean no metadata.
    let metadata: Record<string, string | number | boolean> | undefined = payload.metadata
    if (import.meta.client) {
      captureAttribution()
      const attrib = getAttributionParams()
      if (Object.keys(attrib).length > 0) {
        const merged = { ...attrib, ...(metadata ?? {}) }
        // Guarda do limite de 2KB do backend: se estourar, mantém só o
        // essencial da atribuição (campanha/origem/meio) + metadata original.
        if (JSON.stringify(merged).length > 1900) {
          const { utm_campaign, utm_source, utm_medium } = attrib
          metadata = {
            ...(utm_campaign ? { utm_campaign } : {}),
            ...(utm_source ? { utm_source } : {}),
            ...(utm_medium ? { utm_medium } : {}),
            ...(metadata ?? {})
          }
        } else {
          metadata = merged
        }
      }
      // Eventos de dinheiro/cadastro: eid único (deduplicação browser↔CAPI)
      // + IDs de browser (match quality server-side) — ANTES do fetch.
      if (EID_EVENTS.has(payload.event)) {
        metadata = {
          ...(metadata ?? {}),
          eid: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`,
          ...getBrowserMatchIds()
        }
      }
    }
    // 1. Pixel próprio → backend (analytics internos)
    const authStore = useAuthStore()
    const guestId = import.meta.client ? getGuestId() : ''
    fetch('/api/track', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(authStore.token ? { Authorization: `Bearer ${authStore.token}` } : {})
      },
      body: JSON.stringify({ ...payload, metadata, ...(guestId ? { guestId } : {}) }),
      keepalive: true
    }).catch(() => {})

    // 2. Pixels externos (GA4, Meta, TikTok) — client-side only
    if (import.meta.client) {
      dispatchToPixels(payload, metadata)
    }
  } catch (_) {}
}

export function trackScreenView(screen: TrackScreen) {
  trackEvent({ event: 'SCREEN_VIEW', screen })
  // GA4: page_view é disparado automaticamente via gtag config,
  // mas disparamos também para garantir SPAs com roteamento client-side
  if (import.meta.client) {
    fireGA4('page_view', { page_title: screen, page_location: window.location.href })
  }
}
