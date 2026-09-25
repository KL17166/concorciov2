<script setup lang="ts">
import WelcomeOnboarding from '~/components/onboarding/WelcomeOnboarding.vue'

definePageMeta({
  layout: false,
  middleware: 'guest',
  alias: ['/intro', '/onboarding']
})

useHead({
  title: 'Bem-vindo | Katari Consórcios',
  meta: [
    {
      name: 'description',
      content: 'Conquiste seu carro ou moto 0km sem juros abusivos. Planejamento inteligente, parcelas reduzidas e atendimento 100% digital.'
    }
  ]
})
</script>

<template>
  <div class="welcome-page">
    <WelcomeOnboarding />
  </div>
</template>

<style scoped>
.welcome-page {
  min-height: 100vh;
  width: 100%;
  display: flex;
  justify-content: center;
  align-items: stretch;
  background-color: #FAFAFA;
}
</style>
