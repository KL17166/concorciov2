import { useAuthStore } from '~/stores/auth'

export default defineNuxtPlugin((nuxtApp) => {
  const authStore = useAuthStore(nuxtApp.$pinia)
  authStore.initFromStorage()
})
