import { useAuthStore } from '~/stores/auth'

export default defineNuxtRouteMiddleware((to) => {
  const authStore = useAuthStore()
  authStore.initFromStorage()

  if (!authStore.isAuthenticated) {
    // Plano tela-inicial: visitante sempre cai no onboarding (/welcome),
    // que oferece "Cadastre-se" (/auth/register) e "Já sou cliente" (/auth/login).
    // Preserva o destino original em ?redirect= para retorno pós-login/cadastro.
    if (to.path === '/welcome' || to.path.startsWith('/auth/')) {
      return
    }
    return navigateTo({
      path: '/welcome',
      query: { redirect: to.fullPath }
    })
  }
})
