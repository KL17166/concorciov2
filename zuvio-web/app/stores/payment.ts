import { defineStore } from 'pinia'
import type { Installment, PixPaymentResponse, BoletoPaymentResponse } from '~~/shared/types/payment'
import type { ActiveContract } from '~~/shared/types/catalog'
import { useAuthStore } from './auth'

export const usePaymentStore = defineStore('payment', {
  state: () => ({
    installments: [] as Installment[],
    activePix: null as PixPaymentResponse | null,
    activeBoleto: null as BoletoPaymentResponse | null,
    isLoading: false,
    selectedInstallment: null as Installment | null,
    activeSubscription: null as ActiveContract | null
  }),

  actions: {
    /**
     * Fetch a single subscription by ID from the backend.
     * The backend recalculates all monetary values (installment amounts, valueToPay, etc.)
     * so the frontend never relies on cached or client-computed prices.
     */
    async fetchSubscription(subscriptionId: string): Promise<ActiveContract | null> {
      this.isLoading = true
      const authStore = useAuthStore()
      try {
        const sub = await $fetch<ActiveContract>(`/api/subscription/${subscriptionId}`, {
          headers: authStore.token ? { Authorization: `Bearer ${authStore.token}` } : {}
        })
        this.activeSubscription = sub
        // Sync installments list from the subscription detail
        if (Array.isArray((sub as any).installments)) {
          this.installments = (sub as any).installments
        }
        return sub
      } catch (err) {
        console.error('Failed to fetch subscription:', err)
        return null
      } finally {
        this.isLoading = false
      }
    },

    async fetchInstallments(subscriptionId: string) {
      this.isLoading = true
      const authStore = useAuthStore()
      try {
        this.installments = await $fetch<Installment[]>(`/api/payments/${subscriptionId}`, {
          headers: authStore.token ? { Authorization: `Bearer ${authStore.token}` } : {}
        })
      } catch (err) {
        console.error('Failed to fetch installments:', err)
      } finally {
        this.isLoading = false
      }
    },

    async generatePix(
      installmentOrId: Installment | string,
      maybeToken?: string
    ): Promise<PixPaymentResponse | null> {
      this.isLoading = true
      const authStore = useAuthStore()

      const id = typeof installmentOrId === 'string' ? installmentOrId : installmentOrId.id
      const token = typeof installmentOrId === 'string'
        ? (maybeToken || '')
        : installmentOrId.idTokenPay

      if (typeof installmentOrId !== 'string') {
        this.selectedInstallment = installmentOrId
      }

      try {
        const res = await $fetch<PixPaymentResponse>(`/api/payments/${id}/pix`, {
          method: 'POST',
          headers: authStore.token ? { Authorization: `Bearer ${authStore.token}` } : {},
          body: { idTokenPay: token }
        })
        this.activePix = res
        return res
      } catch (err) {
        console.error('Failed to generate PIX:', err)
        return null
      } finally {
        this.isLoading = false
      }
    },

    async generateBoleto(
      installmentOrId: Installment | string,
      maybeToken?: string
    ): Promise<BoletoPaymentResponse | null> {
      this.isLoading = true
      const authStore = useAuthStore()

      const id = typeof installmentOrId === 'string' ? installmentOrId : installmentOrId.id
      const token = typeof installmentOrId === 'string'
        ? (maybeToken || '')
        : installmentOrId.idTokenPay

      if (typeof installmentOrId !== 'string') {
        this.selectedInstallment = installmentOrId
      }

      try {
        const res = await $fetch<BoletoPaymentResponse>(`/api/payments/${id}/boleto`, {
          method: 'POST',
          headers: authStore.token ? { Authorization: `Bearer ${authStore.token}` } : {},
          body: { idTokenPay: token }
        })
        this.activeBoleto = res
        return res
      } catch (err) {
        console.error('Failed to generate Boleto:', err)
        return null
      } finally {
        this.isLoading = false
      }
    },

    clearActivePayment() {
      this.activePix = null
      this.activeBoleto = null
      this.selectedInstallment = null
    }
  }
})
