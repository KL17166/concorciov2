import { useAuthStore } from '~/stores/auth'
import { getSecurityHeaders, signRequest } from '~~/shared/utils/security'

export function useApi() {
  const config = useRuntimeConfig()
  const authStore = useAuthStore()
  const apiBase = config.public.apiBase || 'http://localhost:3000'

  async function request<T>(
    endpoint: string,
    options: {
      method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
      body?: any
      params?: Record<string, any>
      headers?: Record<string, string>
    } = {}
  ): Promise<T> {
    const method = options.method || 'GET'
    const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`
    const fullUrl = `${apiBase}${cleanEndpoint}`

    const bodyStr = options.body ? JSON.stringify(options.body) : undefined

    const securityHeaders = getSecurityHeaders(authStore.signingSecret)
    const signHeaders = signRequest(method, cleanEndpoint, bodyStr, authStore.signingSecret)

    const defaultHeaders: Record<string, string> = {
      'Content-Type': 'application/json',
      ...securityHeaders,
      ...signHeaders,
      ...(authStore.token ? { Authorization: `Bearer ${authStore.token}` } : {}),
      ...options.headers
    }

    try {
      return await $fetch<T>(fullUrl, {
        method,
        headers: defaultHeaders,
        body: options.body,
        params: options.params
      })
    } catch (error: any) {
      if (error?.status === 401) {
        console.warn('Unauthorized request, clearing session...')
        authStore.clearSession()
        navigateTo('/login')
      }
      throw error
    }
  }

  return {
    get: <T>(url: string, params?: Record<string, any>) => request<T>(url, { method: 'GET', params }),
    post: <T>(url: string, body?: any) => request<T>(url, { method: 'POST', body }),
    put: <T>(url: string, body?: any) => request<T>(url, { method: 'PUT', body }),
    patch: <T>(url: string, body?: any) => request<T>(url, { method: 'PATCH', body }),
    delete: <T>(url: string) => request<T>(url, { method: 'DELETE' })
  }
}
