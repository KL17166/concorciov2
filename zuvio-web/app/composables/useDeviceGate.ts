// useDeviceGate — sinais anti-evasão do porteiro mobile-first.
//
// O que detecta (tudo best-effort, sem bloquear a experiência):
// - Desktop com cursor preciso (pointer:fine) ou sem touch
// - DevTools aberto (diferencial de janela + timing de `debugger`)
// - Resize-spoof: viewport estreita de "celular" num UA de desktop
// - Bypass do redirect via navegação SPA (coberto pelo enforcer no app.vue)
//
// Tudo é reportado ao backend (IP capturado lá, não no body) em
// POST /api/device-gate. Sinais de cliente são indício, não prova:
// é alarme, não cadeado — um usuário determinado sempre pode forjar.

const MOBILE_UA = /android|iphone|ipad|ipod|mobile|windows phone|blackberry|opera mini/i

export interface DeviceSignals {
  mobileUA: boolean
  touchPoints: number
  pointerFine: boolean
  pointerCoarse: boolean
  vw: number
  vh: number
  screenW: number
  screenH: number
  colorDepth: number
  dpr: number
  tz: string
  lang: string
  hwConcurrency: number
  deviceMemory: number
  webdriver: boolean
  cookies: boolean
}

export function collectSignals(): DeviceSignals {
  const nav = navigator
  return {
    mobileUA: MOBILE_UA.test(nav.userAgent || ''),
    touchPoints: nav.maxTouchPoints ?? 0,
    pointerFine: window.matchMedia?.('(pointer: fine)').matches ?? false,
    pointerCoarse: window.matchMedia?.('(pointer: coarse)').matches ?? false,
    vw: window.innerWidth,
    vh: window.innerHeight,
    screenW: window.screen?.width ?? 0,
    screenH: window.screen?.height ?? 0,
    colorDepth: window.screen?.colorDepth ?? 0,
    dpr: window.devicePixelRatio ?? 1,
    tz: Intl.DateTimeFormat().resolvedOptions().timeZone || 'unknown',
    lang: nav.language || 'unknown',
    hwConcurrency: nav.hardwareConcurrency ?? 0,
    deviceMemory: (nav as any).deviceMemory ?? 0,
    webdriver: (nav as any).webdriver === true,
    cookies: nav.cookieEnabled
  }
}

/** Desktop = UA não-mobile E (cursor preciso OU zero touch). */
export function isDesktopClient(sig?: DeviceSignals): boolean {
  const s = sig ?? collectSignals()
  return !s.mobileUA && (s.pointerFine || s.touchPoints === 0)
}

/**
 * Heurística de DevTools aberto. Duas técnicas combinadas:
 * 1. Diferencial de janela: DevTools dockado infla outerWidth/Height.
 * 2. Timing de `debugger`: com DevTools aberto a pausa estoura o relógio.
 */
export function detectDevtools(): boolean {
  try {
    const dw = window.outerWidth - window.innerWidth
    const dh = window.outerHeight - window.innerHeight
    // Telas com dock/sidebar nativos dão ~até 100px; DevTools dockado passa de 160.
    if (dw > 160 || dh > 160) return true

    const t0 = performance.now()
    // eslint-disable-next-line no-debugger
    debugger
    const dt = performance.now() - t0
    if (dt > 120) return true
  } catch {
    // matchMedia/performance indisponível: sem veredito
  }
  return false
}

/** Envia evento ao backend (IP capturado no servidor). Falha em silêncio. */
export async function reportGateEvent(
  type: 'gate.view' | 'gate.bypass' | 'gate.devtools' | 'gate.resize-spoof' | 'gate.client-enforce',
  extra?: Record<string, string | number | boolean>
): Promise<void> {
  try {
    const signals = { ...collectSignals(), ...extra }
    await fetch('/api/device-gate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type, signals })
    })
  } catch {
    // best-effort: telemetria nunca quebra a página
  }
}

/**
 * Vigia DevTools em intervalo. Chama onDetect uma vez (até reset).
 * Retorna função de parada.
 */
export function startDevtoolsWatch(onDetect: () => void, intervalMs = 4000): () => void {
  let fired = false
  const id = window.setInterval(() => {
    if (fired) return
    if (detectDevtools()) {
      fired = true
      onDetect()
    }
  }, intervalMs)
  return () => window.clearInterval(id)
}

/**
 * Vigia resize-spoof: UA de desktop + viewport de celular.
 * Exige persistência (1.5s) para não disparar em redimensionamento normal.
 */
export function startResizeSpoofWatch(onDetect: (vw: number) => void): () => void {
  let timer: number | null = null
  const onResize = () => {
    const vw = window.innerWidth
    const s = collectSignals()
    // Só é suspeito se o UA diz desktop mas a janela finge celular
    if (!s.mobileUA && vw < 700) {
      if (timer === null) {
        timer = window.setTimeout(() => {
          timer = null
          if (window.innerWidth < 700 && !collectSignals().mobileUA) {
            onDetect(window.innerWidth)
          }
        }, 1500)
      }
    } else if (timer !== null) {
      window.clearTimeout(timer)
      timer = null
    }
  }
  window.addEventListener('resize', onResize)
  return () => {
    window.removeEventListener('resize', onResize)
    if (timer !== null) window.clearTimeout(timer)
  }
}
