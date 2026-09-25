import { useAuthStore } from '~/stores/auth'
import { trackScreenView, type TrackScreen } from '~/composables/useTrack'

// Pixel global: TODA navegação gera SCREEN_VIEW (presente e futuro).
// Roda depois do auth/guest — só registra logado (o /api/track exige JWT).
const PATH_TO_SCREEN: Array<[RegExp, TrackScreen]> = [
  [/^\/$/, 'home'],
  [/^\/welcome/, 'welcome'],
  [/^\/auth\//, 'auth'],
  [/^\/consortium\/bids/, 'bids'],
  [/^\/checkout\/payment/, 'payment'],
  [/^\/checkout\/contract/, 'contract'],
  [/^\/checkout(\/|$)/, 'checkout'],
  [/^\/consortium\/adhesion/, 'adhesion'],
  [/^\/consortium\/contracts/, 'contracts'],
  [/^\/consortium\/payments/, 'payments'],
  [/^\/consortium\/statement/, 'statement'],
  [/^\/profile\/kyc/, 'kyc'],
  [/^\/profile(\/|$)/, 'profile']
  // /products/:id fora daqui de propósito: a página emite o próprio
  // SCREEN_VIEW já com metadata.productId (sem duplicar).
]

export default defineNuxtRouteMiddleware((to) => {
  const authStore = useAuthStore()
  if (!authStore.isAuthenticated) return
  for (const [re, screen] of PATH_TO_SCREEN) {
    if (re.test(to.path)) {
      trackScreenView(screen)
      return
    }
  }
})
