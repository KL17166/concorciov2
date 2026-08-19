import { defineStore } from 'pinia'
import { useAuthStore } from './auth'
import { useConsortiumStore } from './consortium'
import type { Product, ConsortiumPlan } from '~~/shared/types/catalog'
import type { Installment } from '~~/shared/types/payment'

export interface CheckoutPersonalData {
  name: string
  cpf: string
  phone: string
}

export interface CheckoutAddressData {
  cep: string
  street: string
  number: string
  district: string
  city: string
  state: string
  complement?: string
}

export interface CheckoutDocuments {
  front: string | null
  back: string | null
  selfie: string | null
}

export const useCheckoutStore = defineStore('checkout', {
  state: () => ({
    currentStep: 0,
    personal: {
      name: '',
      cpf: '',
      phone: ''
    } as CheckoutPersonalData,
    address: {
      cep: '',
      street: '',
      number: '',
      district: '',
      city: '',
      state: '',
      complement: ''
    } as CheckoutAddressData,
    documents: {
      front: null,
      back: null,
      selfie: null
    } as CheckoutDocuments,
    contractAccepted: false,
    contractNumber: '',
    groupNumber: '',
    isLoading: false,
    createdSubscriptionId: null as string | null,
    paymentData: null as any | null
  }),

  getters: {
    isPersonalValid: (state) => {
      return (
        state.personal.name.trim().length > 3 &&
        state.personal.cpf.replace(/\D/g, '').length === 11 &&
        state.personal.phone.replace(/\D/g, '').length >= 10
      )
    },
    isAddressValid: (state) => {
      return (
        state.address.cep.replace(/\D/g, '').length === 8 &&
        state.address.street.trim().length > 0 &&
        state.address.number.trim().length > 0 &&
        state.address.district.trim().length > 0 &&
        state.address.city.trim().length > 0 &&
        state.address.state.trim().length === 2
      )
    },
    areDocsValid: (state) => {
      return !!(state.documents.front && state.documents.back && state.documents.selfie)
    }
  },

  actions: {
    initFromAuth() {
      const authStore = useAuthStore()
      if (authStore.user) {
        if (!this.personal.name) this.personal.name = authStore.user.name || ''
        if (!this.personal.cpf) this.personal.cpf = authStore.user.cpf || ''
        if (!this.personal.phone) this.personal.phone = authStore.user.phone || ''
      }
      if (!this.contractNumber) {
        this.contractNumber = `KT${new Date().getFullYear()}${Date.now().toString().substring(7)}`
      }
      if (!this.groupNumber) {
        const month = new Date().getMonth() + 1
        this.groupNumber = `${new Date().getFullYear()}/${String(month * 7 + 123).padStart(4, '0')}`
      }
    },

    setStep(step: number) {
      this.currentStep = step
    },

    updatePersonal(data: Partial<CheckoutPersonalData>) {
      this.personal = { ...this.personal, ...data }
    },

    updateAddress(data: Partial<CheckoutAddressData>) {
      this.address = { ...this.address, ...data }
    },

    updateDocument(type: 'front' | 'back' | 'selfie', pathOrBase64: string) {
      this.documents[type] = pathOrBase64
    },

    async finalizeCheckout(
      selectedProduct: Product,
      selectedPlan: ConsortiumPlan
    ): Promise<{ success: boolean; subscriptionId?: string; message?: string }> {
      this.isLoading = true
      const authStore = useAuthStore()
      const consortiumStore = useConsortiumStore()

      try {
        const res = await $fetch<{
          success: boolean
          subscriptionId: string
          installments: Installment[]
        }>('/api/subscriptions', {
          method: 'POST',
          headers: authStore.token ? { Authorization: `Bearer ${authStore.token}` } : {},
          body: {
            userId: authStore.user?.id || '',
            productId: selectedProduct.id,
            planId: selectedPlan.id,
            termsAccepted: true,
            documentFrontUrl: this.documents.front || undefined,
            documentBackUrl: this.documents.back || undefined,
            selfieUrl: this.documents.selfie || undefined
          }
        })

        if (res.success && res.subscriptionId) {
          this.createdSubscriptionId = res.subscriptionId

          // Auto-generate PIX for the first installment — backend calculates the value
          const firstInst = res.installments?.[0]
          if (firstInst?.id && firstInst?.idTokenPay) {
            try {
              const pixRes = await $fetch<any>(`/api/payments/${firstInst.id}/pix`, {
                method: 'POST',
                headers: authStore.token ? { Authorization: `Bearer ${authStore.token}` } : {},
                body: { idTokenPay: firstInst.idTokenPay }
              })
              if (pixRes?.success) {
                this.paymentData = {
                  amount: pixRes.amount,
                  copyPaste: pixRes.copyPaste,
                  qrCode: pixRes.qrCode,
                  expirationDate: pixRes.expirationDate
                }
              }
            } catch (pixErr) {
              console.warn('Failed to auto-generate PIX:', pixErr)
            }
          }

          await consortiumStore.loadHomeData()
          return { success: true, subscriptionId: res.subscriptionId }
        }

        return { success: false, message: 'Erro ao criar contratação' }
      } catch (err: any) {
        return { success: false, message: err?.data?.error || err?.message || 'Erro ao processar contratação' }
      } finally {
        this.isLoading = false
      }
    }
  }
})
