import { useAuthStore } from '~/stores/auth'

export default defineNuxtRouteMiddleware((to, from) => {
  if (import.meta.server) return

  const authStore = useAuthStore()

  if (authStore.isAuthenticated) {
    return navigateTo('/')
  }
})
