import { useAuthStore } from '~/stores/auth'

export type TrackEvent =
  | 'SCREEN_VIEW'
  | 'GENERATE_QR_CLICK'
  | 'QR_SHOWN'
  | 'COPY_PIX_CLICK'
  | 'VERIFY_PAYMENT_CLICK'
  | 'PAYMENT_CONFIRMED_VIEW'
  | 'BID_CREATED'

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
  | 'profile'

export type TrackEntityType = 'bid' | 'installment' | 'subscription'

export interface TrackPayload {
  event: TrackEvent
  screen?: TrackScreen
  entityType?: TrackEntityType
  entityId?: string
  metadata?: Record<string, string | number | boolean>
}

/**
 * Pixel próprio — fire-and-forget, nunca quebra a UI.
 * O userId é derivado do JWT no backend (sem spoof de atribuição).
 */
export function trackEvent(payload: TrackPayload) {
  try {
    const authStore = useAuthStore()
    fetch('/api/track', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(authStore.token ? { Authorization: `Bearer ${authStore.token}` } : {})
      },
      body: JSON.stringify(payload),
      keepalive: true
    }).catch(() => {})
  } catch (_) {}
}

export function trackScreenView(screen: TrackScreen) {
  trackEvent({ event: 'SCREEN_VIEW', screen })
}
