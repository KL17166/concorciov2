import { defineStore } from 'pinia'
import { useAuthStore } from './auth'

export interface AppNotification {
  id: string
  type: string
  title: string
  message: string
  read: boolean
  createdAt: string
}

export const useNotificationsStore = defineStore('notifications', {
  state: () => ({
    items: [] as AppNotification[],
    unreadCount: 0,
    isLoading: false
  }),

  getters: {
    unreadKycRejected: (state): AppNotification | undefined => {
      return state.items.find(n => !n.read && n.type === 'KYC_REJECTED')
    }
  },

  actions: {
    async fetch() {
      const authStore = useAuthStore()
      if (!authStore.isAuthenticated) return
      this.isLoading = true
      try {
        const res = await $fetch<{
          success: boolean
          unreadCount: number
          notifications: AppNotification[]
        }>('/api/notifications', {
          headers: authStore.token ? { Authorization: `Bearer ${authStore.token}` } : {}
        })
        this.items = res.notifications || []
        this.unreadCount = res.unreadCount || 0
      } catch (_) {
        // best-effort: sem notificação não quebra o app
      } finally {
        this.isLoading = false
      }
    },

    async markRead(id: string) {
      const authStore = useAuthStore()
      try {
        await $fetch(`/api/notifications/${id}/read`, {
          method: 'PATCH',
          headers: authStore.token ? { Authorization: `Bearer ${authStore.token}` } : {}
        })
        const item = this.items.find(n => n.id === id)
        if (item) {
          item.read = true
          this.unreadCount = Math.max(0, this.unreadCount - 1)
        }
      } catch (_) {}
    },

    async markKycRejectedRead() {
      const pending = this.items.filter(n => !n.read && n.type === 'KYC_REJECTED')
      for (const n of pending) {
        await this.markRead(n.id)
      }
    }
  }
})
