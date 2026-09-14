import { useAuthStore } from '~/stores/auth'

export default defineNuxtRouteMiddleware((to) => {
  const authStore = useAuthStore()
  authStore.initFromStorage()

  if (authStore.isAuthenticated) {
    return navigateTo('/')
  }
})
