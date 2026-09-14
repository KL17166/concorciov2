<script setup lang="ts">
import { computed, onMounted } from 'vue'
import DevFloatingTool from '~/components/dev/DevFloatingTool.vue'
import AppToast from '~/components/ui/AppToast.vue'
import { useConsortiumStore } from '~/stores/consortium'
import { useBidStore } from '~/stores/bid'
import { useAuthStore } from '~/stores/auth'

// Only show dev tools in development mode
const isDev = computed(() => import.meta.dev)

const consortiumStore = useConsortiumStore()
const bidStore = useBidStore()
const authStore = useAuthStore()

onMounted(() => {
  const syncData = () => {
    if (authStore.isAuthenticated) {
      consortiumStore.loadHomeData()
      bidStore.fetchUserBids()
    }
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

  <!-- Global Toast Notifications on all screens -->
  <AppToast />

  <!-- Global Dev Bypass & Scenarios Tool on all screens (even with layout: false) -->
  <DevFloatingTool v-if="isDev" />
</template>

