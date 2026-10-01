// https://nuxt.com/docs/api/configuration/nuxt-config
import { defineNuxtConfig } from 'nuxt/config'
import process from 'node:process'

export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  // Devtools só em dev: em prod exporia internals + peso no bundle.
  devtools: { enabled: process.env.NODE_ENV !== 'production' },

  modules: [
    '@pinia/nuxt',
    '@vite-pwa/nuxt'
  ],

  vite: {
    server: {
      allowedHosts: true
    }
  },

  pwa: {
    manifest: {
      name: 'Katari Consórcios',
      short_name: 'Katari',
      description: 'Plataforma digital de consórcios de motos e veículos',
      theme_color: '#263238',
      background_color: '#1e282d',
      display: 'standalone',
      orientation: 'portrait',
      scope: '/',
      start_url: '/',
      icons: [
        {
          src: '/favicon.svg',
          sizes: 'any',
          type: 'image/svg+xml',
          purpose: 'any'
        },
        {
          src: '/logo.png',
          sizes: '512x512',
          type: 'image/png',
          purpose: 'any maskable'
        }
      ]
    },
    workbox: {
      navigateFallback: '/'
    },
    client: {
      installPrompt: true
    },
    devOptions: {
      enabled: false
    }
  },

  css: [
    '~/assets/css/main.css'
  ],

  runtimeConfig: {
    // Server-only (not exposed to browser)
    backendBase: process.env.NUXT_BACKEND_BASE || process.env.NUXT_PUBLIC_API_BASE || 'http://localhost:3000',
    // HMAC p/ assinar chamadas BFF→backend (B1: nunca hardcoded).
    // Idêntico ao REQUEST_SIGNING_SECRET do backend.
    hmacSecret: process.env.NUXT_HMAC_SECRET || '',
    public: {
      appName: 'Katari Consórcios',
      appSubtitle: 'Seu sonho em duas rodas',
      // ── Pixels externos — deixe vazio para desativar ────────────────────
      // Defina no .env ou nas variáveis de ambiente do servidor:
      // NUXT_PUBLIC_GA4_ID=G-XXXXXXXXXX
      // NUXT_PUBLIC_META_PIXEL_ID=1234567890
      // NUXT_PUBLIC_TIKTOK_PIXEL_ID=CXXXXXXXXXXXXXXXXX
      ga4Id: process.env.NUXT_PUBLIC_GA4_ID ?? '',
      metaPixelId: process.env.NUXT_PUBLIC_META_PIXEL_ID ?? '',
      tiktokPixelId: process.env.NUXT_PUBLIC_TIKTOK_PIXEL_ID ?? ''
    }
  },

  app: {
    head: {
      title: 'Katari - Seu sonho em duas rodas',
      titleTemplate: '%s | Katari Consórcios',
      htmlAttrs: {
        lang: 'pt-BR'
      },
      meta: [
        { charset: 'utf-8' },
        { name: 'viewport', content: 'width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no' },
        { name: 'description', content: 'Plataforma digital de consórcios de motos e veículos. Conquiste sua liberdade em duas rodas com taxas justas e lances transparentes.' },
        { name: 'theme-color', content: '#263238' },
        { name: 'apple-mobile-web-app-capable', content: 'yes' },
        { name: 'apple-mobile-web-app-status-bar-style', content: 'black-translucent' }
      ],
      link: [
        { rel: 'preconnect', href: 'https://fonts.googleapis.com' },
        { rel: 'preconnect', href: 'https://fonts.gstatic.com', crossorigin: '' },
        { rel: 'stylesheet', href: 'https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800;900&display=swap' },
        { rel: 'icon', type: 'image/svg+xml', href: '/favicon.svg' }
      ]
    }
  },

  typescript: {
    strict: true
  },

  nitro: {
    // Handler próprio: nunca serializa stack nas respostas de erro
    // (nem em dev — o front roda `nuxt dev` como servidor vivo).
    // `~~` = raiz do projeto (o `~` aponta para app/).
    errorHandler: '~~/server/error',
    // h3 só inclui `stack` no JSON de erro com debug ligado — mantém
    // desligado sempre (logs de terminal continuam completos).
    debug: false
  }
})
