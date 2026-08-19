import { defineStore } from 'pinia'
import type { Bid, CreateBidPayload } from '~~/shared/types/bid'
import { useApiClient } from '~/composables/useApiClient'
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
      const api = useApiClient()

      try {
        if (authStore.isDevBypass) {
          this.bids = [
            {
              id: 'bid_mock_1',
              type: 'FREE',
              percentage: 25,
              amount: 4625,
              status: 'PENDING',
              createdAt: new Date().toISOString(),
              groupNumber: '104',
              quotaNumber: '042',
              product: {
                id: 'prod_1',
                name: 'Honda CG 160 Titan',
                imageUrl: 'https://images.unsplash.com/photo-1558981852-426c6c22a060?w=800'
              }
            }
          ]
          return
        }

        this.bids = await api.bids.getUserBids(authStore.user.id)
      } catch (err) {
        console.error('Failed to fetch bids:', err)
      } finally {
        this.isLoading = false
      }
    },

    async createBid(payload: CreateBidPayload): Promise<{ success: boolean; message?: string; bid?: Bid }> {
      this.isLoading = true
      const api = useApiClient()
      const authStore = useAuthStore()

      try {
        if (authStore.isDevBypass) {
          const newBid: Bid = {
            id: 'bid_mock_' + Date.now(),
            type: payload.type,
            percentage: payload.percentage,
            amount: payload.amount,
            status: 'PENDING',
            createdAt: new Date().toISOString()
          }
          this.bids.unshift(newBid)
          return { success: true, message: 'Lance registrado com sucesso no modo Dev!', bid: newBid }
        }

        const res = await api.bids.create(payload)
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
    }
  }
})
