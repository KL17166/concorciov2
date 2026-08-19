import { defineStore } from 'pinia'
import type { Bid, CreateBidPayload } from '~~/shared/types/bid'
import { useAuthStore } from './auth'

export const useBidStore = defineStore('bid', {
  state: () => ({
    bids: [] as Bid[],
    isLoading: false
  }),

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
    }
  }
})
