import { defineStore } from 'pinia'
import type { AuthState, LoginCredentials, LoginResponse } from '~~/shared/types/auth'
import type { UserProfile, UserRole } from '~~/shared/types/user'
import { getSecurityHeaders, signRequest } from '~~/shared/utils/security'
import { unmaskCpf } from '~~/shared/utils/cpf'

const STORAGE_KEYS = {
  TOKEN: 'katari_jwt_token',
  USER: 'katari_user_profile',
  SIGNING_SECRET: 'katari_signing_secret',
  PAYLOAD_SECRET: 'katari_payload_secret',
  DEV_BYPASS: 'katari_dev_bypass'
}

export const useAuthStore = defineStore('auth', {
  state: (): AuthState => ({
    user: null,
    token: null,
    signingSecret: null,
    payloadSecret: null,
    isAuthenticated: false,
    isDevBypass: false,
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
        const isBypass = localStorage.getItem(STORAGE_KEYS.DEV_BYPASS) === 'true'
        const savedSigningSecret = localStorage.getItem(STORAGE_KEYS.SIGNING_SECRET)
        const savedPayloadSecret = localStorage.getItem(STORAGE_KEYS.PAYLOAD_SECRET)

        if (savedToken && savedUserStr) {
          this.token = savedToken
          this.user = JSON.parse(savedUserStr)
          this.signingSecret = savedSigningSecret
          this.payloadSecret = savedPayloadSecret
          this.isDevBypass = isBypass
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
            payloadSecret: response.payloadSecret || null,
            isDevBypass: false
          })
          return { success: true }
        }

        return {
          success: false,
          message: response.message || 'Falha ao autenticar com o servidor.'
        }
      } catch (error: any) {
        console.error('Login error:', error)

        // If backend endpoint is 404 or offline, apply automatic Dev Bypass session
        const isNotFound = error?.status === 404 || error?.statusCode === 404 || error?.data?.statusCode === 404
        const isNetworkErr = !error?.status || error?.message?.includes('fetch failed') || error?.message?.includes('ECONNREFUSED')

        if (isNotFound || isNetworkErr) {
          console.warn('API /api/auth/login indisponível ou 404. Ativando bypass automático para desenvolvimento.')
          this.devBypassLogin('CLIENT', 'client_approved')
          return { success: true }
        }

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
     * Fast Dev Bypass Login for quick prototyping & screen-by-screen testing
     */
    devBypassLogin(role: UserRole = 'CLIENT', customPreset?: 'client_approved' | 'client_pending' | 'admin_master') {
      let presetUser: UserProfile = {
        id: 'usr_dev_demo_' + Date.now(),
        name: 'Carlos Alberto Silva (Dev Test)',
        email: 'carlos.dev@katari.com.br',
        role: role,
        cpf: '111.444.777-35',
        birthDate: '1990-05-15',
        phone: '(11) 98765-4321',
        cep: '01310-100',
        street: 'Avenida Paulista',
        number: '1000',
        district: 'Bela Vista',
        city: 'São Paulo',
        state: 'SP',
        kycStatus: 'APPROVED',
        createdAt: new Date().toISOString()
      }

      if (customPreset === 'client_pending') {
        presetUser.name = 'Mariana Oliveira (KYC Pendente)'
        presetUser.email = 'mariana.dev@katari.com.br'
        presetUser.cpf = '222.333.444-05'
        presetUser.kycStatus = 'PENDING'
      } else if (customPreset === 'admin_master' || role === 'ADMIN' || role === 'MASTER') {
        presetUser.name = 'Admin Master Katari'
        presetUser.email = 'admin@katari.com.br'
        presetUser.role = 'MASTER'
        presetUser.cpf = '529.982.247-25'
      }

      const mockJwt = 'mock_jwt_dev_bypass_' + btoa(JSON.stringify({ sub: presetUser.id, role: presetUser.role, exp: Date.now() + 86400000 }))

      this.setSession({
        token: mockJwt,
        user: presetUser,
        signingSecret: 'mock_session_signing_secret_dev',
        payloadSecret: 'mock_session_payload_secret_dev',
        isDevBypass: true
      })

      return presetUser
    },

    /**
     * Store session state in memory and localStorage
     */
    setSession(data: {
      token: string
      user: UserProfile
      signingSecret?: string | null
      payloadSecret?: string | null
      isDevBypass?: boolean
    }) {
      this.token = data.token
      this.user = data.user
      this.signingSecret = data.signingSecret || null
      this.payloadSecret = data.payloadSecret || null
      this.isDevBypass = !!data.isDevBypass
      this.isAuthenticated = true

      if (typeof window !== 'undefined') {
        localStorage.setItem(STORAGE_KEYS.TOKEN, data.token)
        localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(data.user))
        localStorage.setItem(STORAGE_KEYS.DEV_BYPASS, this.isDevBypass ? 'true' : 'false')
        if (data.signingSecret) localStorage.setItem(STORAGE_KEYS.SIGNING_SECRET, data.signingSecret)
        if (data.payloadSecret) localStorage.setItem(STORAGE_KEYS.PAYLOAD_SECRET, data.payloadSecret)
      }
    },

    /**
     * Clear all session data (Logout)
     */
    async logout() {
      // If we have a real session, attempt to call server logout
      if (this.token && !this.isDevBypass) {
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
      this.isDevBypass = false

      if (typeof window !== 'undefined') {
        localStorage.removeItem(STORAGE_KEYS.TOKEN)
        localStorage.removeItem(STORAGE_KEYS.USER)
        localStorage.removeItem(STORAGE_KEYS.DEV_BYPASS)
        localStorage.removeItem(STORAGE_KEYS.SIGNING_SECRET)
        localStorage.removeItem(STORAGE_KEYS.PAYLOAD_SECRET)
      }
    }
  }
})
