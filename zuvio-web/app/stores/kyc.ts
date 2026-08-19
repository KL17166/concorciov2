import { defineStore } from 'pinia'
import type { KycStatusType, KycStatusResponse } from '~~/shared/types/kyc'
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
      try {
        const res = await $fetch<KycStatusResponse>('/api/kyc/status', {
          headers: authStore.token ? { Authorization: `Bearer ${authStore.token}` } : {}
        })
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
      const authStore = useAuthStore()
      try {
        const formData = new FormData()
        formData.append('file', file)

        const res = await $fetch<{ message: string; url: string }>(`/api/auth/upload?type=${type}`, {
          method: 'POST',
          headers: authStore.token ? { Authorization: `Bearer ${authStore.token}` } : {},
          body: formData
        })

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
      const authStore = useAuthStore()

      try {
        const res = await $fetch<{ success: boolean; message: string; kycStatus: string }>(
          '/api/kyc/submit',
          {
            method: 'POST',
            headers: authStore.token ? { Authorization: `Bearer ${authStore.token}` } : {},
            body: {
              documentFrontUrl: this.documentFrontUrl,
              documentBackUrl: this.documentBackUrl,
              selfieUrl: this.selfieUrl
            }
          }
        )

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
