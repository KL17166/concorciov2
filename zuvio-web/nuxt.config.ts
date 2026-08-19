// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },

  modules: [
    '@pinia/nuxt',
    '@vite-pwa/nuxt'
  ],

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
    public: {
      apiBase: process.env.NUXT_PUBLIC_API_BASE || 'http://localhost:3000',
      appName: 'Katari Consórcios',
      appSubtitle: 'Seu sonho em duas rodas',
      enableDevBypass: process.env.NODE_ENV !== 'production' || process.env.NUXT_PUBLIC_ENABLE_DEV_BYPASS === 'true'
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
  }
})
