import { defineStore } from 'pinia'
import { useAuthStore } from './auth'
import { useConsortiumStore } from './consortium'
import { useApiClient } from '~/composables/useApiClient'
import type { Product, ConsortiumPlan } from '~~/shared/types/catalog'

export interface CheckoutPersonalData {
  name: string
  cpf: string
  birthDate: string
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
      birthDate: '',
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
        state.personal.birthDate.length >= 10 &&
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

    fillDevBypassData() {
      const authStore = useAuthStore()
      this.personal = {
        name: authStore.user?.name || 'Consorciado Teste Katari',
        cpf: authStore.user?.cpf || '111.444.777-35',
        birthDate: '15/05/1990',
        phone: authStore.user?.phone || '(11) 98765-4321'
      }
      this.address = {
        cep: '01001-000',
        street: 'Praça da Sé',
        number: '100',
        district: 'Sé',
        city: 'São Paulo',
        state: 'SP',
        complement: 'Apto 42'
      }
      const mockDoc = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="200" height="130" viewBox="0 0 200 130"><rect width="200" height="130" fill="%23e0e0e0" rx="8"/><rect x="15" y="15" width="50" height="60" fill="%23bdbdbd" rx="4"/><rect x="75" y="20" width="110" height="10" fill="%23757575" rx="2"/><rect x="75" y="40" width="90" height="8" fill="%239e9e9e" rx="2"/><rect x="75" y="55" width="70" height="8" fill="%239e9e9e" rx="2"/><text x="100" y="105" font-family="sans-serif" font-size="11" font-weight="bold" fill="%23263238" text-anchor="middle">DOCUMENTO TESTE BYPASS</text></svg>'
      const mockSelfie = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200" viewBox="0 0 200 200"><rect width="200" height="200" fill="%23e8f5e9" rx="100"/><circle cx="100" cy="80" r="40" fill="%2381c784"/><path d="M40 170c0-33 27-60 60-60s60 27 60 60" fill="%2381c784"/><text x="100" y="185" font-family="sans-serif" font-size="10" font-weight="bold" fill="%232e7d32" text-anchor="middle">SELFIE VERIFICADA</text></svg>'

      this.documents = {
        front: mockDoc,
        back: mockDoc,
        selfie: mockSelfie
      }
      this.contractAccepted = true
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

    async finalizeCheckout(selectedProduct: Product, selectedPlan: ConsortiumPlan): Promise<{ success: boolean; subscriptionId?: string; message?: string }> {
      this.isLoading = true
      const authStore = useAuthStore()
      const consortiumStore = useConsortiumStore()
      const api = useApiClient()

      const groupClean = (this.groupNumber || '104').replace(/\D/g, '').substring(0, 3) || '104'

      try {
        if (authStore.isDevBypass) {
          const subId = `sub_${Date.now()}`
          this.createdSubscriptionId = subId
          this.paymentData = {
            installmentId: `inst_1_${subId}`,
            idTokenPay: `tok_1_${subId}`,
            amount: selectedPlan.monthlyInstallment,
            method: 'PIX',
            qrCode: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
            copyPaste: '00020126360014BR.GOV.BCB.PIX0114+551199999999520400005303986540510.005802BR5913Katari Consorcios6008BRASILIA62070503***63041D3D',
            expirationDate: new Date(Date.now() + 30 * 60 * 1000).toISOString()
          }

          // Register in consortium store as pending adhesion
          const newContract: any = {
            id: subId,
            userId: authStore.user?.id || 'usr_dev',
            productId: selectedProduct.id,
            product: selectedProduct,
            planId: selectedPlan.id,
            durationMonths: selectedPlan.durationMonths,
            currentInstallment: 1,
            totalInstallments: selectedPlan.durationMonths,
            groupNumber: groupClean,
            quotaNumber: '088',
            creditValue: selectedProduct.price,
            administrationFee: (selectedPlan.adminFeeRate || selectedPlan.adminFeePercentage || 15) / 100,
            status: 'pending_payment',
            isAdesaoPaid: false,
            nextPaymentAmount: selectedPlan.monthlyInstallment,
            dueDate: 'Aguardando Pagamento da Adesão',
            contractDate: new Date().toISOString(),
            progressPercentage: 0,
            paidInstallments: [],
            installmentValues: { 1: selectedPlan.monthlyInstallment },
            installmentIds: { 1: `inst_1_${subId}` },
            installmentTokens: { 1: `tok_1_${subId}` },
            installmentDueDates: { 1: new Date(Date.now() + 30 * 60 * 1000).toISOString() }
          }

          const existingIdx = consortiumStore.activeContracts.findIndex(c => c.id === subId)
          if (existingIdx >= 0) {
            consortiumStore.activeContracts[existingIdx] = newContract
          } else {
            consortiumStore.activeContracts.unshift(newContract)
          }

          return { success: true, subscriptionId: subId }
        }

        const res = await api.subscriptions.create({
          userId: authStore.user?.id || '',
          productId: selectedProduct.id,
          planId: selectedPlan.id,
          termsAccepted: true,
          documentFrontUrl: this.documents.front || undefined,
          documentBackUrl: this.documents.back || undefined,
          selfieUrl: this.documents.selfie || undefined
        })

        if (res.success && res.subscriptionId) {
          this.createdSubscriptionId = res.subscriptionId

          const newContract: any = {
            id: res.subscriptionId,
            userId: authStore.user?.id || '',
            productId: selectedProduct.id,
            product: selectedProduct,
            planId: selectedPlan.id,
            durationMonths: selectedPlan.durationMonths,
            currentInstallment: 1,
            totalInstallments: selectedPlan.durationMonths,
            groupNumber: groupClean,
            quotaNumber: '088',
            creditValue: selectedProduct.price,
            administrationFee: (selectedPlan.adminFeeRate || selectedPlan.adminFeePercentage || 15) / 100,
            status: 'pending_payment',
            isAdesaoPaid: false,
            nextPaymentAmount: selectedPlan.monthlyInstallment,
            dueDate: 'Aguardando Pagamento da Adesão',
            contractDate: new Date().toISOString(),
            progressPercentage: 0,
            paidInstallments: [],
            installmentValues: { 1: selectedPlan.monthlyInstallment },
            installmentIds: { 1: `inst_1_${res.subscriptionId}` },
            installmentTokens: { 1: `tok_1_${res.subscriptionId}` },
            installmentDueDates: { 1: new Date(Date.now() + 30 * 60 * 1000).toISOString() }
          }

          const existingIdx = consortiumStore.activeContracts.findIndex(c => c.id === res.subscriptionId)
          if (existingIdx >= 0) {
            consortiumStore.activeContracts[existingIdx] = newContract
          } else {
            consortiumStore.activeContracts.unshift(newContract)
          }

          return { success: true, subscriptionId: res.subscriptionId }
        }
        return { success: false, message: 'Erro ao criar contratação' }
      } catch (err: any) {
        return { success: false, message: err?.message || 'Erro ao processar contratação' }
      } finally {
        this.isLoading = false
      }
    }
  }
})
