<script setup lang="ts">
import DevFloatingTool from '~/components/dev/DevFloatingTool.vue'
import AppToast from '~/components/ui/AppToast.vue'
</script>

<template>
  <NuxtLayout>
    <NuxtPage />
  </NuxtLayout>

  <!-- Global Toast Notifications on all screens -->
  <AppToast />

  <!-- Global Dev Bypass & Scenarios Tool on all screens (even with layout: false) -->
  <DevFloatingTool />
</template>

