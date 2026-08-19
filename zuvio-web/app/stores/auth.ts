import { defineStore } from 'pinia'
import type { AuthState, LoginCredentials, LoginResponse } from '~~/shared/types/auth'
import type { UserProfile, UserRole } from '~~/shared/types/user'
import { getSecurityHeaders, signRequest } from '~~/shared/utils/security'
import { unmaskCpf } from '~~/shared/utils/cpf'

const STORAGE_KEYS = {
  TOKEN: 'katari_jwt_token',
  USER: 'katari_user_profile',
  SIGNING_SECRET: 'katari_signing_secret',
  PAYLOAD_SECRET: 'katari_payload_secret'
}

export const useAuthStore = defineStore('auth', {
  state: (): AuthState => ({
    user: null,
    token: null,
    signingSecret: null,
    payloadSecret: null,
    isAuthenticated: false,
    isLoading: false
  }),

  getters: {
    userName: (state) => state.user?.name || 'Cliente Katari',
    userRole: (state) => state.user?.role || 'CLIENT',
    isAdmin: (state) => state.user?.role === 'ADMIN' || state.user?.role === 'MASTER',
    isKycApproved: (state) => state.user?.kycStatus === 'APPROVED',
    userCpfFormatted: (state) => {
      const cpf = state.user?.cpf || ''
      if (cpf.length === 11) {
        return `${cpf.slice(0, 3)}.${cpf.slice(3, 6)}.${cpf.slice(6, 9)}-${cpf.slice(9)}`
      }
      return cpf
    }
  },

  actions: {
    /**
     * Restore session from localStorage on client load
     */
    initFromStorage() {
      if (typeof window === 'undefined') return

      try {
        const savedToken = localStorage.getItem(STORAGE_KEYS.TOKEN)
        const savedUserStr = localStorage.getItem(STORAGE_KEYS.USER)
        const savedSigningSecret = localStorage.getItem(STORAGE_KEYS.SIGNING_SECRET)
        const savedPayloadSecret = localStorage.getItem(STORAGE_KEYS.PAYLOAD_SECRET)

        if (savedToken && savedUserStr) {
          this.token = savedToken
          this.user = JSON.parse(savedUserStr)
          this.signingSecret = savedSigningSecret
          this.payloadSecret = savedPayloadSecret
          this.isAuthenticated = true
        }
      } catch (err) {
        console.error('Failed to parse saved auth session:', err)
        this.clearSession()
      }
    },

    /**
     * Authenticate against the real Katari backend API
     */
    async login(credentials: LoginCredentials): Promise<{ success: boolean; message?: string }> {
      this.isLoading = true
      const config = useRuntimeConfig()
      const apiBase = config.public.apiBase || 'http://localhost:3000'
      const cleanCpf = unmaskCpf(credentials.cpf)

      try {
        const path = '/api/auth/login'
        const body = JSON.stringify({
          cpf: cleanCpf,
          password: credentials.password
        })

        // Sign request and gather headers
        const securityHeaders = getSecurityHeaders()
        const signHeaders = signRequest('POST', path, body)

        const response = await $fetch<LoginResponse>(`${apiBase}${path}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...securityHeaders,
            ...signHeaders
          },
          body
        })

        if (response && response.token && response.user) {
          this.setSession({
            token: response.token,
            user: response.user,
            signingSecret: response.signingSecret || null,
            payloadSecret: response.payloadSecret || null
          })
          return { success: true }
        }

        return {
          success: false,
          message: response.message || 'Falha ao autenticar com o servidor.'
        }
      } catch (error: any) {
        console.error('Login error:', error)

        let errorMessage = 'Erro de conexão com o servidor'

        if (typeof error?.data?.message === 'string' && error.data.message.trim()) {
          errorMessage = error.data.message
        } else if (typeof error?.data?.error === 'string' && error.data.error.trim()) {
          errorMessage = error.data.error
        } else if (typeof error?.message === 'string' && error.message.trim()) {
          errorMessage = error.message
        }

        if (errorMessage.toLowerCase().includes('invalid credentials') || errorMessage === 'Unauthorized') {
          errorMessage = 'CPF ou senha incorretos'
        }

        return {
          success: false,
          message: errorMessage
        }
      } finally {
        this.isLoading = false
      }
    },

    /**
     * Store session state in memory and localStorage
     */
    setSession(data: {
      token: string
      user: UserProfile
      signingSecret?: string | null
      payloadSecret?: string | null
    }) {
      this.token = data.token
      this.user = data.user
      this.signingSecret = data.signingSecret || null
      this.payloadSecret = data.payloadSecret || null
      this.isAuthenticated = true

      if (typeof window !== 'undefined') {
        localStorage.setItem(STORAGE_KEYS.TOKEN, data.token)
        localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(data.user))
        if (data.signingSecret) localStorage.setItem(STORAGE_KEYS.SIGNING_SECRET, data.signingSecret)
        if (data.payloadSecret) localStorage.setItem(STORAGE_KEYS.PAYLOAD_SECRET, data.payloadSecret)
      }
    },

    /**
     * Clear all session data (Logout)
     */
    async logout() {
      // If we have a real session, attempt to call server logout
      if (this.token) {
        try {
          const config = useRuntimeConfig()
          const apiBase = config.public.apiBase || 'http://localhost:3000'
          const path = '/api/auth/logout'
          const securityHeaders = getSecurityHeaders()
          const signHeaders = signRequest('POST', path, undefined, this.signingSecret)

          await $fetch(`${apiBase}${path}`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${this.token}`,
              ...securityHeaders,
              ...signHeaders
            }
          })
        } catch (e) {
          console.warn('Server logout failed or network unreachable (local session cleared):', e)
        }
      }

      this.clearSession()
      navigateTo('/login')
    },

    clearSession() {
      this.user = null
      this.token = null
      this.signingSecret = null
      this.payloadSecret = null
      this.isAuthenticated = false

      if (typeof window !== 'undefined') {
        localStorage.removeItem(STORAGE_KEYS.TOKEN)
        localStorage.removeItem(STORAGE_KEYS.USER)
        localStorage.removeItem(STORAGE_KEYS.SIGNING_SECRET)
        localStorage.removeItem(STORAGE_KEYS.PAYLOAD_SECRET)
      }
    }
  }
})
