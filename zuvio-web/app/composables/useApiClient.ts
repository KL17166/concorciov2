import { useAuthStore } from '~/stores/auth'
import { getSecurityHeaders, signRequest } from '~~/shared/utils/security'
import type { LoginCredentials, LoginResponse, RegisterData } from '~~/shared/types/auth'
import type { Product, ProductTypeKey, ActiveContract } from '~~/shared/types/catalog'
import type { Installment, PixPaymentResponse, BoletoPaymentResponse } from '~~/shared/types/payment'
import type { Bid, CreateBidPayload } from '~~/shared/types/bid'
import type { KycStatusResponse, KycSubmitPayload } from '~~/shared/types/kyc'
import type { UserProfile } from '~~/shared/types/user'

export function useApiClient() {
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

    const isFormData = typeof FormData !== 'undefined' && options.body instanceof FormData
    const bodyStr = options.body && !isFormData ? JSON.stringify(options.body) : undefined

    const securityHeaders = getSecurityHeaders(authStore.signingSecret)
    const signHeaders = signRequest(method, cleanEndpoint, bodyStr, authStore.signingSecret)

    const defaultHeaders: Record<string, string> = {
      ...(!isFormData ? { 'Content-Type': 'application/json' } : {}),
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
        console.warn('Unauthorized request, clearing auth session...')
        authStore.clearSession()
        navigateTo('/login')
      }
      throw error
    }
  }

  return {
    // ── 1. AUTH ENDPOINTS ──────────────────────────────────────────────────
    auth: {
      login: (credentials: LoginCredentials) =>
        request<LoginResponse>('/api/auth/login', { method: 'POST', body: credentials }),

      register: (data: RegisterData) =>
        request<{ message: string; user: any }>('/api/auth/register', { method: 'POST', body: data }),

      logout: () =>
        request<{ success: boolean; message: string }>('/api/auth/logout', { method: 'POST' }),

      getProfile: () =>
        request<{ user: UserProfile }>('/api/auth/profile', { method: 'GET' }),

      updateProfile: (data: Partial<UserProfile>) =>
        request<{ message: string; user: UserProfile }>('/api/auth/profile', { method: 'PUT', body: data }),

      changePassword: (passwords: { currentPassword: string; newPassword: string }) =>
        request<{ success: boolean; message: string }>('/api/auth/password', { method: 'PUT', body: passwords }),

      uploadDocument: (file: File, type: 'document' | 'document_back' | 'selfie') => {
        const formData = new FormData()
        formData.append('file', file)
        return request<{ message: string; url: string }>(`/api/auth/upload?type=${type}`, {
          method: 'POST',
          body: formData
        })
      }
    },

    // ── 2. CATALOG ENDPOINTS ───────────────────────────────────────────────
    products: {
      getAll: (type?: ProductTypeKey) => {
        const params = type && type !== 'TODOS' ? { type } : undefined
        return request<Product[]>('/api/products', { method: 'GET', params })
      },

      getById: (id: string) =>
        request<Product>(`/api/products/${id}`, { method: 'GET' })
    },

    // ── 3. SUBSCRIPTIONS (CONTRATOS) ───────────────────────────────────────
    subscriptions: {
      getUserSubscriptions: (userId: string) =>
        request<ActiveContract[]>(`/api/subscriptions/${userId}`, { method: 'GET' }),

      getById: (subscriptionId: string) =>
        request<ActiveContract>(`/api/subscription/${subscriptionId}`, { method: 'GET' }),

      create: (data: {
        userId: string
        planId: string
        productId: string
        termsAccepted: boolean
        documentFrontUrl?: string
        documentBackUrl?: string
        selfieUrl?: string
      }) => {
        return request<{
          success: boolean
          subscriptionId: string
          status: string
          plan: any
          installments: Installment[]
        }>('/api/subscriptions', {
          method: 'POST',
          body: {
            ...data,
            token: authStore.token // Backend expects token in body too
          }
        })
      },

      cancel: (subscriptionId: string) =>
        request<{ success: boolean; message: string }>(`/api/subscriptions/${subscriptionId}/cancel`, {
          method: 'POST'
        })
    },

    // ── 4. BIDS (LANCES) ───────────────────────────────────────────────────
    bids: {
      create: (payload: CreateBidPayload) =>
        request<{ success: boolean; message: string; bid: Bid }>('/api/bids', {
          method: 'POST',
          body: payload
        }),

      getUserBids: (userId: string) =>
        request<Bid[]>(`/api/bids/${userId}`, { method: 'GET' })
    },

    // ── 5. PAYMENTS & GATEWAY ──────────────────────────────────────────────
    payments: {
      getInstallments: (subscriptionId: string) =>
        request<Installment[]>(`/api/payments/${subscriptionId}`, { method: 'GET' }),

      generatePix: (installmentId: string, idTokenPay: string) =>
        request<PixPaymentResponse>(`/api/payments/${installmentId}/pix`, {
          method: 'POST',
          body: { idTokenPay }
        }),

      generateBoleto: (installmentId: string, idTokenPay: string) =>
        request<BoletoPaymentResponse>(`/api/payments/${installmentId}/boleto`, {
          method: 'POST',
          body: { idTokenPay }
        })
    },

    // ── 6. KYC VERIFICATION ────────────────────────────────────────────────
    kyc: {
      submit: (payload: KycSubmitPayload) =>
        request<{ success: boolean; message: string; kycStatus: string }>('/api/kyc/submit', {
          method: 'POST',
          body: payload
        }),

      getStatus: () =>
        request<KycStatusResponse>('/api/kyc/status', { method: 'GET' })
    }
  }
}
