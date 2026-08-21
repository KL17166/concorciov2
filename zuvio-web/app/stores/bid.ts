import { defineStore } from 'pinia'
import type { Bid, CreateBidPayload } from '~~/shared/types/bid'
import { useAuthStore } from './auth'

export const useBidStore = defineStore('bid', {
  state: () => ({
    bids: [] as Bid[],
    isLoading: false,
    hasDismissedInterstitial: false
  }),

  getters: {
    approvedBid: (state): Bid | undefined => {
      return state.bids.find(b => b.status === 'APPROVED')
    },
    hasApprovedBid(): boolean {
      return !!this.approvedBid
    },
    pendingBid: (state): Bid | undefined => {
      return state.bids.find(b => b.status === 'PENDING')
    },
    hasPendingBid(): boolean {
      return !!this.pendingBid
    }
  },

  actions: {
    async fetchUserBids() {
      const authStore = useAuthStore()
      if (!authStore.user) return

      this.isLoading = true
      try {
        this.bids = await $fetch<Bid[]>(`/api/bids/${authStore.user.id}`, {
          headers: authStore.token ? { Authorization: `Bearer ${authStore.token}` } : {}
        })
      } catch (err) {
        console.error('Failed to fetch bids:', err)
        this.bids = []
      } finally {
        this.isLoading = false
      }
    },

    async createBid(payload: CreateBidPayload): Promise<{ success: boolean; message?: string; bid?: Bid }> {
      this.isLoading = true
      const authStore = useAuthStore()
      try {
        const res = await $fetch<{ success: boolean; message: string; bid: Bid }>('/api/bids', {
          method: 'POST',
          headers: authStore.token ? { Authorization: `Bearer ${authStore.token}` } : {},
          body: payload
        })
        if (res.bid) {
          this.bids.unshift(res.bid)
        }
        return res
      } catch (err: any) {
        console.error('Error creating bid:', err)
        return {
          success: false,
          message: err?.data?.error || err?.message || 'Erro ao registrar lance'
        }
      } finally {
        this.isLoading = false
      }
    },

    async submitBid(payload: CreateBidPayload): Promise<{ success: boolean; message?: string; bid?: Bid }> {
      return this.createBid(payload)
    },

    async cancelBid(bidId: string): Promise<{ success: boolean; message?: string }> {
      this.isLoading = true
      const authStore = useAuthStore()
      try {
        const res = await $fetch<{ success: boolean; message: string }>(`/api/bids/${bidId}/cancel`, {
          method: 'POST',
          headers: authStore.token ? { Authorization: `Bearer ${authStore.token}` } : {}
        })
        const index = this.bids.findIndex(b => b.id === bidId)
        if (index !== -1) {
          this.bids[index].status = 'CANCELLED'
        }
        return res
      } catch (err: any) {
        console.error('Error cancelling bid:', err)
        return {
          success: false,
          message: err?.data?.message || err?.data?.error || 'Erro ao cancelar lance'
        }
      } finally {
        this.isLoading = false
      }
    },

    async generatePix(bidId: string) {
      this.isLoading = true
      const authStore = useAuthStore()
      try {
        const res = await $fetch<any>(`/api/bids/${bidId}/pix`, {
          method: 'POST',
          headers: authStore.token ? { Authorization: `Bearer ${authStore.token}` } : {}
        })
        return res
      } catch (err: any) {
        console.error('Error generating bid PIX:', err)
        throw err
      } finally {
        this.isLoading = false
      }
    },

    dismissInterstitial() {
      this.hasDismissedInterstitial = true
      if (typeof window !== 'undefined') {
        sessionStorage.setItem('dismissed_bid_interstitial', 'true')
      }
    }
  }
})

