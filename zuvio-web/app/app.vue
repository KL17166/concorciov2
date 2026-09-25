<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import DevFloatingTool from '~/components/dev/DevFloatingTool.vue'
import AppToast from '~/components/ui/AppToast.vue'
import { useConsortiumStore } from '~/stores/consortium'
import { useBidStore } from '~/stores/bid'
import { useAuthStore } from '~/stores/auth'
import { useNotificationsStore } from '~/stores/notifications'

// Only show dev tools in development mode
const isDev = computed(() => import.meta.dev)

const route = useRoute()
const router = useRouter()
const consortiumStore = useConsortiumStore()
const bidStore = useBidStore()
const authStore = useAuthStore()
const notificationsStore = useNotificationsStore()

// Banner global: KYC recusado → pede reenvio em qualquer tela (menos na do KYC)
const showKycRejectedBanner = computed(() => {
  return !!notificationsStore.unreadKycRejected && route.path !== '/profile/kyc'
})

function goResubmitKyc() {
  const n = notificationsStore.unreadKycRejected
  if (n) notificationsStore.markRead(n.id)
  router.push('/profile/kyc')
}

function dismissKycBanner() {
  const n = notificationsStore.unreadKycRejected
  if (n) notificationsStore.markRead(n.id)
}

onMounted(() => {
  const syncData = () => {
    if (authStore.isAuthenticated) {
      consortiumStore.loadHomeData()
      bidStore.fetchUserBids()
      notificationsStore.fetch()
    }
  }

  // Busca notificações na entrada (avisa recusas mesmo sem abrir a tela do KYC)
  if (authStore.isAuthenticated) {
    notificationsStore.fetch()
  }

  window.addEventListener('focus', syncData)
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      syncData()
    }
  })
})
</script>

<template>
  <NuxtLayout>
    <NuxtPage />
  </NuxtLayout>

  <!-- Banner global de notificação (ex: KYC recusado → reenviar) -->
  <div v-if="showKycRejectedBanner" class="global-notice-banner">
    <div class="global-notice-text">
      <strong>Documentos recusados.</strong>
      <span>{{ notificationsStore.unreadKycRejected?.message }}</span>
    </div>
    <div class="global-notice-actions">
      <button type="button" class="global-notice-cta" @click="goResubmitKyc">Reenviar documentos</button>
      <button type="button" class="global-notice-dismiss" @click="dismissKycBanner" aria-label="Dispensar">✕</button>
    </div>
  </div>

  <!-- Global Toast Notifications on all screens -->
  <AppToast />

  <!-- Global Dev Bypass & Scenarios Tool on all screens (even with layout: false) -->
  <DevFloatingTool v-if="isDev" />
</template>

<style>
.global-notice-banner {
  position: fixed;
  left: 12px;
  right: 12px;
  bottom: 12px;
  z-index: 9999;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  background: #FEF2F2;
  border: 1px solid #FECACA;
  border-radius: 14px;
  padding: 12px 14px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.12);
}
.global-notice-text {
  font-size: 13px;
  color: #7F1D1D;
  line-height: 1.4;
}
.global-notice-text strong {
  display: block;
  margin-bottom: 2px;
}
.global-notice-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}
.global-notice-cta {
  background: #DC2626;
  color: #fff;
  border: none;
  border-radius: 10px;
  padding: 10px 14px;
  font-size: 13px;
  font-weight: 700;
  cursor: pointer;
}
.global-notice-dismiss {
  background: transparent;
  border: none;
  color: #991B1B;
  font-size: 16px;
  cursor: pointer;
  padding: 6px;
}
</style>

