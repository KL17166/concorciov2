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

    async generatePix(installment: Installment): Promise<PixPaymentResponse | null> {
      this.isLoading = true
      this.selectedInstallment = installment
      const api = useApiClient()
      const authStore = useAuthStore()

      try {
        if (authStore.isDevBypass) {
          // Instant mock PIX response for seamless offline testing
          const mockPix: PixPaymentResponse = {
            success: true,
            provider: 'pixgo-sandbox',
            paymentId: 'pix_mock_' + Date.now(),
            qrCode: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
            copyPaste: '00020126360014BR.GOV.BCB.PIX0114+551199999999520400005303986540510.005802BR5913Katari Consorcios6008BRASILIA62070503***63041D3D',
            amount: installment.valueToPay || installment.amount,
            expirationDate: new Date(Date.now() + 30 * 60 * 1000).toISOString()
          }
          this.activePix = mockPix
          return mockPix
        }

        const res = await api.payments.generatePix(installment.id, installment.idTokenPay)
        this.activePix = res
        return res
      } catch (err) {
        console.error('Failed to generate PIX:', err)
        return null
      } finally {
        this.isLoading = false
      }
    },

    async generateBoleto(installment: Installment): Promise<BoletoPaymentResponse | null> {
      this.isLoading = true
      this.selectedInstallment = installment
      const api = useApiClient()
      const authStore = useAuthStore()

      try {
        if (authStore.isDevBypass) {
          const mockBoleto: BoletoPaymentResponse = {
            success: true,
            provider: 'sigilopay-sandbox',
            paymentId: 'boleto_mock_' + Date.now(),
            copyPaste: '34191.09008 61713.957308 71444.640008 2 92900000000000',
            amount: installment.valueToPay || installment.amount,
            expirationDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString()
          }
          this.activeBoleto = mockBoleto
          return mockBoleto
        }

        const res = await api.payments.generateBoleto(installment.id, installment.idTokenPay)
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
