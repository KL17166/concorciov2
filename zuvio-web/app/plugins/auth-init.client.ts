import { useAuthStore } from '~/stores/auth'

export default defineNuxtPlugin((nuxtApp) => {
  const authStore = useAuthStore(nuxtApp.$pinia)
  authStore.initFromStorage()

  // Sessão expirada (JWT 15min): qualquer 401 da API desloga 1x e volta p/ entrada,
  // em vez de repetir requests falhando para sempre.
  let handling401 = false
  const originalFetch = window.fetch.bind(window)
  window.fetch = (async (...args: Parameters<typeof fetch>) => {
    const res = await originalFetch(...args)
    try {
      const rawUrl = args[0]
      const url = typeof rawUrl === 'string' ? rawUrl : (rawUrl as Request).url
      const isApi = url.includes('/api/')
      const isAuthCall = url.includes('/api/auth/')
      if (res.status === 401 && isApi && !isAuthCall && !handling401 && authStore.isAuthenticated) {
        handling401 = true
        await authStore.logout().catch(() => {})
        handling401 = false
      }
    } catch {
      // nunca quebra o fetch por causa do guarda
    }
    return res
  }) as typeof fetch
})
