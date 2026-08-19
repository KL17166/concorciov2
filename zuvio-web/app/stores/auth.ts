import { defineStore } from 'pinia'
import type { AuthState, LoginCredentials, LoginResponse } from '~~/shared/types/auth'
import type { UserProfile } from '~~/shared/types/user'
import { unmaskCpf } from '~~/shared/utils/cpf'

const STORAGE_KEYS = {
  TOKEN: 'katari_jwt_token',
  USER: 'katari_user_profile'
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

        if (savedToken && savedUserStr) {
          this.token = savedToken
          this.user = JSON.parse(savedUserStr)
          this.isAuthenticated = true
        }
      } catch (err) {
        console.error('Failed to parse saved auth session:', err)
        this.clearSession()
      }
    },

    /**
     * Authenticate via Nuxt BFF → server-consorcio
     */
    async login(credentials: LoginCredentials): Promise<{ success: boolean; message?: string }> {
      this.isLoading = true

      try {
        const response = await $fetch<LoginResponse>('/api/auth/login', {
          method: 'POST',
          body: {
            cpf: unmaskCpf(credentials.cpf),
            password: credentials.password
          }
        })

        if (response?.token && response?.user) {
          this.setSession({ token: response.token, user: response.user })
          return { success: true }
        }

        return { success: false, message: response.message || 'Falha ao autenticar com o servidor.' }
      } catch (error: any) {
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

        return { success: false, message: errorMessage }
      } finally {
        this.isLoading = false
      }
    },

    /**
     * Store session state in memory and localStorage
     */
    setSession(data: { token: string; user: UserProfile }) {
      this.token = data.token
      this.user = data.user
      this.signingSecret = null
      this.payloadSecret = null
      this.isAuthenticated = true

      if (typeof window !== 'undefined') {
        localStorage.setItem(STORAGE_KEYS.TOKEN, data.token)
        localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(data.user))
      }
    },

    /**
     * Clear all session data (Logout)
     */
    async logout() {
      if (this.token) {
        try {
          await $fetch('/api/auth/logout', {
            method: 'POST',
            headers: { Authorization: `Bearer ${this.token}` }
          })
        } catch (e) {
          console.warn('Server logout failed (local session cleared):', e)
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
      }
    }
  }
})
