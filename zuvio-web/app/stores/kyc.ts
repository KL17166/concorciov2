import { defineStore } from 'pinia'
import type { KycStatusType, KycStatusResponse } from '~~/shared/types/kyc'
import { useApiClient } from '~/composables/useApiClient'
import { useAuthStore } from './auth'

export const useKycStore = defineStore('kyc', {
  state: () => ({
    status: 'NOT_SUBMITTED' as KycStatusType,
    rejectReason: null as string | null,
    documentsUploaded: false,
    documentFrontUrl: null as string | null,
    documentBackUrl: null as string | null,
    selfieUrl: null as string | null,
    isLoading: false
  }),

  actions: {
    async fetchStatus() {
      const authStore = useAuthStore()
      if (!authStore.user) return

      this.isLoading = true
      const api = useApiClient()

      try {
        if (authStore.isDevBypass) {
          this.status = authStore.user.kycStatus || 'APPROVED'
          this.documentsUploaded = true
          return
        }

        const res = await api.kyc.getStatus()
        this.status = res.kycStatus
        this.rejectReason = res.rejectReason || null
        this.documentsUploaded = res.documentsUploaded
      } catch (err) {
        console.error('Failed to fetch KYC status:', err)
      } finally {
        this.isLoading = false
      }
    },

    async uploadDocument(file: File, type: 'document' | 'document_back' | 'selfie'): Promise<string | null> {
      this.isLoading = true
      const api = useApiClient()
      const authStore = useAuthStore()

      try {
        if (authStore.isDevBypass) {
          const fakeUrl = `/uploads/mock_${type}_${Date.now()}.jpg`
          if (type === 'document') this.documentFrontUrl = fakeUrl
          if (type === 'document_back') this.documentBackUrl = fakeUrl
          if (type === 'selfie') this.selfieUrl = fakeUrl
          return fakeUrl
        }

        const res = await api.auth.uploadDocument(file, type)
        if (res.url) {
          if (type === 'document') this.documentFrontUrl = res.url
          if (type === 'document_back') this.documentBackUrl = res.url
          if (type === 'selfie') this.selfieUrl = res.url
        }
        return res.url
      } catch (err) {
        console.error(`Failed to upload ${type}:`, err)
        return null
      } finally {
        this.isLoading = false
      }
    },

    async submitAll(): Promise<{ success: boolean; message?: string }> {
      if (!this.documentFrontUrl || !this.documentBackUrl || !this.selfieUrl) {
        return { success: false, message: 'Envie todos os 3 documentos antes de submeter.' }
      }

      this.isLoading = true
      const api = useApiClient()
      const authStore = useAuthStore()

      try {
        if (authStore.isDevBypass) {
          this.status = 'SUBMITTED'
          if (authStore.user) authStore.user.kycStatus = 'SUBMITTED'
          return { success: true, message: 'Documentos enviados com sucesso no modo Dev!' }
        }

        const res = await api.kyc.submit({
          documentFrontUrl: this.documentFrontUrl,
          documentBackUrl: this.documentBackUrl,
          selfieUrl: this.selfieUrl
        })

        if (res.success) {
          this.status = 'SUBMITTED'
          if (authStore.user) authStore.user.kycStatus = 'SUBMITTED'
        }

        return res
      } catch (err: any) {
        console.error('Error submitting KYC:', err)
        return {
          success: false,
          message: err?.data?.error || err?.message || 'Erro ao enviar documentos de KYC'
        }
      } finally {
        this.isLoading = false
      }
    }
  }
})
