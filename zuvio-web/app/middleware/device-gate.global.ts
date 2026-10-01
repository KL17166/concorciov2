/**
 * device-gate.global — porteiro mobile-first (estilo "app com QR no desktop").
 *
 * - Desktop (PC sem touch) em qualquer rota pública → /baixar-app
 *   (tela elegante pedindo para continuar no celular com QR do APK).
 * - Celular em /baixar-app → volta para '/' (fluxo normal).
 * - Exceções (nunca intercepta): /admin/** (gestão no PC), a própria
 *   /baixar-app no desktop, e quem clicou "Continuar no computador"
 *   (cookie `kat_desktop_ok=1`, 1 ano).
 *
 * Detecção: User-Agent no SSR (primeira carga, sem flash de conteúdo) +
 * `pointer: coarse` no cliente (navegação SPA). Tablets com touch contam
 * como mobile.
 */
const MOBILE_UA = /android|iphone|ipad|ipod|mobile|windows phone|blackberry|opera mini/i
const BYPASS_COOKIE = 'kat_desktop_ok'
const GATE_PATH = '/baixar-app'

function isMobileUA(ua: string): boolean {
  return MOBILE_UA.test(ua || '')
}

export default defineNuxtRouteMiddleware((to) => {
  // Em dev o porteiro dorme: redirect e alarmes só valem em produção.
  if (import.meta.dev) return

  // 1. Rotas que o porteiro nunca toca
  if (to.path.startsWith('/admin')) return
  if (to.path.startsWith('/api')) return

  // 2. Bypass explícito ("Continuar no computador")
  const bypass = useCookie(BYPASS_COOKIE).value
  if (bypass === '1') return

  // 3. Detecta mobile (SSR via header, cliente via UA + touch)
  let isMobile = false
  if (import.meta.server) {
    const ua = useRequestHeaders()['user-agent'] || ''
    isMobile = isMobileUA(ua)
  } else {
    const ua = navigator.userAgent || ''
    const coarsePointer = window.matchMedia?.('(pointer: coarse)').matches ?? false
    isMobile = isMobileUA(ua) || coarsePointer
  }

  // 4. Aplica a regra
  if (!isMobile && to.path !== GATE_PATH) {
    return navigateTo(GATE_PATH)
  }
  if (isMobile && to.path === GATE_PATH) {
    return navigateTo('/')
  }
})
