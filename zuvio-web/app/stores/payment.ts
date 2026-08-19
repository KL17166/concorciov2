import { defineStore } from 'pinia'
import type { Installment, PixPaymentResponse, BoletoPaymentResponse } from '~~/shared/types/payment'
import { useApiClient } from '~/composables/useApiClient'
import { useAuthStore } from './auth'

export const usePaymentStore = defineStore('payment', {
  state: () => ({
    installments: [] as Installment[],
    activePix: null as PixPaymentResponse | null,
    activeBoleto: null as BoletoPaymentResponse | null,
    isLoading: false,
    selectedInstallment: null as Installment | null
  }),

  actions: {
    async fetchInstallments(subscriptionId: string) {
      this.isLoading = true
      const api = useApiClient()
      try {
        this.installments = await api.payments.getInstallments(subscriptionId)
      } catch (err) {
        console.error('Failed to fetch installments:', err)
      } finally {
        this.isLoading = false
      }
    },

    async generatePix(installmentOrId: Installment | string, maybeToken?: string): Promise<PixPaymentResponse | null> {
      this.isLoading = true
      const api = useApiClient()

      const id = typeof installmentOrId === 'string' ? installmentOrId : installmentOrId.id
      const token = typeof installmentOrId === 'string' ? (maybeToken || '') : installmentOrId.idTokenPay
      if (typeof installmentOrId !== 'string') {
        this.selectedInstallment = installmentOrId
      }

      try {
        const res = await api.payments.generatePix(id, token)
        this.activePix = res
        return res
      } catch (err) {
        console.error('Failed to generate PIX:', err)
        return null
      } finally {
        this.isLoading = false
      }
    },

    async generateBoleto(installmentOrId: Installment | string, maybeToken?: string): Promise<BoletoPaymentResponse | null> {
      this.isLoading = true
      const api = useApiClient()

      const id = typeof installmentOrId === 'string' ? installmentOrId : installmentOrId.id
      const token = typeof installmentOrId === 'string' ? (maybeToken || '') : installmentOrId.idTokenPay
      if (typeof installmentOrId !== 'string') {
        this.selectedInstallment = installmentOrId
      }

      try {
        const res = await api.payments.generateBoleto(id, token)
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
