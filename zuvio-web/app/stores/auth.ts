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
    userName: (state) => state.user?.name || '',
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
     * Restore session from cookie or localStorage
     */
    initFromStorage() {
      // 1. Check cookies (works on both Server and Client)
      try {
        const tokenCookie = useCookie<string | null>(STORAGE_KEYS.TOKEN, { maxAge: 60 * 60 * 24 * 7, sameSite: 'lax' })
        const userCookie = useCookie<UserProfile | string | null>(STORAGE_KEYS.USER, { maxAge: 60 * 60 * 24 * 7, sameSite: 'lax' })

        if (tokenCookie.value && userCookie.value) {
          this.token = tokenCookie.value
          this.user = typeof userCookie.value === 'string' ? JSON.parse(userCookie.value) : userCookie.value
          this.isAuthenticated = true
          return
        }
      } catch (e) {
        // Continue to localStorage fallback
      }

      // 2. Client-only localStorage fallback
      if (typeof window !== 'undefined') {
        try {
          const savedToken = localStorage.getItem(STORAGE_KEYS.TOKEN)
          const savedUserStr = localStorage.getItem(STORAGE_KEYS.USER)

          if (savedToken && savedUserStr) {
            this.token = savedToken
            this.user = JSON.parse(savedUserStr)
            this.isAuthenticated = true

            // Sync to cookies
            const tokenCookie = useCookie<string | null>(STORAGE_KEYS.TOKEN, { maxAge: 60 * 60 * 24 * 7, sameSite: 'lax' })
            const userCookie = useCookie<UserProfile | null>(STORAGE_KEYS.USER, { maxAge: 60 * 60 * 24 * 7, sameSite: 'lax' })
            tokenCookie.value = savedToken
            userCookie.value = this.user
          }
        } catch (err) {
          console.error('Failed to parse saved auth session:', err)
          this.clearSession()
        }
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
     * Register new client via Nuxt BFF → server-consorcio
     */
    async register(data: { name: string; email: string; cpf: string; phone?: string; password: string }): Promise<{ success: boolean; message?: string }> {
      this.isLoading = true

      try {
        const response = await $fetch<{ success: boolean; message: string; user?: UserProfile; token?: string }>('/api/auth/register', {
          method: 'POST',
          body: {
            name: data.name,
            email: data.email,
            cpf: unmaskCpf(data.cpf),
            phone: data.phone,
            password: data.password
          }
        })

        if (response?.token && response?.user) {
          this.setSession({ token: response.token, user: response.user })
          return { success: true, message: response.message }
        }

        return { success: response?.success ?? true, message: response?.message || 'Conta criada com sucesso!' }
      } catch (error: any) {
        const errorMessage = error?.data?.message || error?.data?.error || error?.message || 'Erro ao criar conta.'
        return { success: false, message: errorMessage }
      } finally {
        this.isLoading = false
      }
    },

    /**
     * Store session state in memory, cookies, and localStorage
     */
    setSession(data: { token: string; user: UserProfile }) {      this.token = data.token
      this.user = data.user
      this.signingSecret = null
      this.payloadSecret = null
      this.isAuthenticated = true

      try {
        const tokenCookie = useCookie<string | null>(STORAGE_KEYS.TOKEN, { maxAge: 60 * 60 * 24 * 7, sameSite: 'lax' })
        const userCookie = useCookie<UserProfile | null>(STORAGE_KEYS.USER, { maxAge: 60 * 60 * 24 * 7, sameSite: 'lax' })
        tokenCookie.value = data.token
        userCookie.value = data.user
      } catch (e) {}

      if (typeof window !== 'undefined') {
        localStorage.setItem(STORAGE_KEYS.TOKEN, data.token)
        localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(data.user))
      }
    },

    /**
     * Atualiza e-mail/telefone do próprio cadastro via BFF → server-consorcio
     */
    async updateProfile(data: { email?: string; phone?: string }): Promise<{ success: boolean; message?: string }> {
      if (!this.token) return { success: false, message: 'Sessão expirada. Entre novamente.' }
      try {
        const res = await $fetch<{ success: boolean; message?: string; user?: UserProfile }>('/api/profile', {
          method: 'PATCH',
          headers: { Authorization: `Bearer ${this.token}` },
          body: data
        })
        if (res?.success && res.user && this.user) {
          this.setSession({ token: this.token, user: { ...this.user, ...res.user } })
          return { success: true }
        }
        return { success: false, message: res?.message || 'Não foi possível salvar.' }
      } catch (err: any) {
        return { success: false, message: err?.data?.message || err?.message || 'Erro ao salvar. Tente novamente.' }
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
      navigateTo('/welcome')
    },

    clearSession() {
      this.user = null
      this.token = null
      this.signingSecret = null
      this.payloadSecret = null
      this.isAuthenticated = false

      try {
        const tokenCookie = useCookie<string | null>(STORAGE_KEYS.TOKEN)
        const userCookie = useCookie<UserProfile | null>(STORAGE_KEYS.USER)
        tokenCookie.value = null
        userCookie.value = null
      } catch (e) {}

      if (typeof window !== 'undefined') {
        localStorage.removeItem(STORAGE_KEYS.TOKEN)
        localStorage.removeItem(STORAGE_KEYS.USER)
      }
    }
  }
})
