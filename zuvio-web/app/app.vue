<script setup lang="ts">
import { computed } from 'vue'
import DevFloatingTool from '~/components/dev/DevFloatingTool.vue'
import AppToast from '~/components/ui/AppToast.vue'

// Only show dev tools in development mode
const isDev = computed(() => import.meta.dev)
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

