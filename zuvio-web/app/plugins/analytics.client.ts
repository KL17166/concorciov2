/**
 * analytics.client.ts
 *
 * Inicializa pixels externos (GA4, Meta, TikTok) de forma lazy ao montar
 * o app. Sem banner de consentimento — pixels sempre carregam
 * (decisão do operador).
 *
 * Os IDs vêm do painel admin (/admin/tracking, só mestre) via /api/pixel-config;
 * variáveis de ambiente são fallback.
 *
 * Para ativar cada pixel, defina no .env:
 *   NUXT_PUBLIC_GA4_ID=G-XXXXXXXXXX
 *   NUXT_PUBLIC_META_PIXEL_ID=1234567890
 *   NUXT_PUBLIC_TIKTOK_PIXEL_ID=CXXXXXXXXXXXXXXXXX
 *
 * Deixar a variável vazia ou ausente desativa o pixel correspondente — zero código morto em prod.
 */

interface RemotePixelConfig {
  ga4Id?: string
  metaPixelId?: string
  tiktokPixelId?: string
}

export default defineNuxtPlugin(async () => {
  const config = useRuntimeConfig()
  // Painel admin primeiro, env como fallback.
  let remote: RemotePixelConfig | null = null
  try {
    remote = await $fetch<RemotePixelConfig>('/api/pixel-config')
  } catch (_) {
    remote = null
  }
  const ga4Id = remote?.ga4Id || (config.public.ga4Id as string | undefined) || ''
  const metaPixelId = remote?.metaPixelId || (config.public.metaPixelId as string | undefined) || ''
  const ttPixelId = remote?.tiktokPixelId || (config.public.tiktokPixelId as string | undefined) || ''

  // Pixels sem bloqueio de consentimento.
  const consented = true

  // ── Google Analytics 4 ────────────────────────────────────────────────────
  if (consented && ga4Id) {
    // Carrega gtag.js de forma assíncrona
    const s = document.createElement('script')
    s.async = true
    s.src = `https://www.googletagmanager.com/gtag/js?id=${ga4Id}`
    document.head.appendChild(s)

    const w = window as any
    w.dataLayer = w.dataLayer ?? []
    w.gtag = function (...args: any[]) { w.dataLayer.push(args) }
    w.gtag('js', new Date())
    w.gtag('config', ga4Id, {
      // Anonimiza IP por padrão (LGPD/GDPR)
      anonymize_ip: true,
      // Desativa coleta automática de dados de formulário
      send_page_view: false
    })

    console.info('[Analytics] GA4 inicializado:', ga4Id)
  }

  // ── Meta Pixel (Facebook) ─────────────────────────────────────────────────
  if (consented && metaPixelId) {
    const w = window as any
    if (!w.fbq) {
      // Snippet oficial do Meta adaptado — o SDK sobrescreve fbq após carregar
      const f: any = (...args: any[]) => { f.callMethod ? f.callMethod(...args) : f.queue.push(args) }
      f.push = f
      f.loaded = true
      f.version = '2.0'
      f.queue = []
      w.fbq = f
      w._fbq = f

      const s = document.createElement('script')
      s.async = true
      s.src = 'https://connect.facebook.net/en_US/fbevents.js'
      document.head.appendChild(s)
    }
    w.fbq('init', metaPixelId)
    w.fbq('track', 'PageView')

    // Pixel de no-script (acessibilidade / navegadores sem JS)
    const noscript = document.createElement('noscript')
    const img = document.createElement('img')
    img.height = 1
    img.width = 1
    img.style.display = 'none'
    img.src = `https://www.facebook.com/tr?id=${metaPixelId}&ev=PageView&noscript=1`
    noscript.appendChild(img)
    document.head.appendChild(noscript)

    console.info('[Analytics] Meta Pixel inicializado:', metaPixelId)
  }

  // ── TikTok Pixel (snippet oficial) ────────────────────────────────────────
  if (consented && ttPixelId) {
    const w = window as any
    if (!w.ttq) {
      // Snippet oficial TikTok Events API (browser). O SDK real substitui
      // a fila após carregar — eventos disparados antes são preservados.
      ;(function (w: any, d: Document, t: string) {
        w.TiktokAnalyticsObject = t
        const ttq = (w[t] = w[t] || [])
        ttq.methods = [
          'page', 'track', 'identify', 'instances', 'debug', 'on', 'off',
          'once', 'ready', 'alias', 'group', 'enableCookie', 'disableCookie',
          'holdConsent', 'revokeConsent', 'grantConsent'
        ]
        ttq.setAndDefer = function (t: any, e: string) {
          t[e] = function () {
            t.push([e].concat(Array.prototype.slice.call(arguments, 0)))
          }
        }
        for (let i = 0; i < ttq.methods.length; i++) ttq.setAndDefer(ttq, ttq.methods[i])
        ttq.load = function (e: string) {
          const n = 'https://analytics.tiktok.com/i18n/pixel/events.js'
          ;(ttq as any)._i = (ttq as any)._i || {}
          ;(ttq as any)._i[e] = []
          const s = d.createElement('script')
          s.type = 'text/javascript'
          s.async = true
          s.src = n + '?sdkid=' + e + '&lib=' + t
          const x = d.getElementsByTagName('script')[0]
          if (x?.parentNode) x.parentNode.insertBefore(s, x)
        }
        ttq.load(ttPixelId)
        ttq.page()
      })(w, document, 'ttq')
    } else {
      w.ttq.load(ttPixelId)
      w.ttq.page?.()
    }

    console.info('[Analytics] TikTok Pixel inicializado:', ttPixelId)
  }

  // ─── Router hook: dispara page_view em cada navegação SPA ─────────────────
  // (só se o pixel correspondente foi inicializado — i.e., com consentimento)
  const nuxtApp = useNuxtApp()
  nuxtApp.hook('page:finish', () => {
    if (!consented) return
    // GA4
    const w = window as any
    if (ga4Id && typeof w.gtag === 'function') {
      w.gtag('event', 'page_view', {
        page_location: window.location.href,
        page_title: document.title
      })
    }
    // Meta
    if (metaPixelId && typeof w.fbq === 'function') {
      w.fbq('track', 'PageView')
    }
  })
})
