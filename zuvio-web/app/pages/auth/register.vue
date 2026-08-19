<script setup lang="ts">
import AppButton from '~/components/ui/AppButton.vue'
import { UserPlus, ArrowLeft } from 'lucide-vue-next'

definePageMeta({
  layout: 'auth',
  middleware: 'guest',
  alias: ['/register']
})
</script>

<template>
  <div class="register-placeholder animate-fade-in glass-panel">
    <div class="header-icon">
      <UserPlus :size="32" />
    </div>
    <h2 class="title">Criar Conta Katari</h2>
    <p class="desc">
      A tela de cadastro é a próxima da fila de transcrição!
    </p>

    <div class="action-box">
      <NuxtLink to="/auth/login">
        <AppButton variant="outline" size="md">
          <template #icon>
            <ArrowLeft :size="16" />
          </template>
          Voltar para o Login
        </AppButton>
      </NuxtLink>
    </div>
  </div>
</template>

<style scoped>
.register-placeholder {
  width: 100%;
  padding: 36px 24px;
  text-align: center;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.header-icon {
  width: 60px;
  height: 60px;
  background: var(--color-primary-subtle);
  color: var(--color-primary);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 16px;
}

.title {
  font-size: 24px;
  font-weight: 800;
  color: var(--color-secondary);
  margin-bottom: 8px;
}

.desc {
  font-size: 14px;
  color: var(--color-text-muted);
  margin-bottom: 24px;
}

.action-box {
  width: 100%;
}
</style>
