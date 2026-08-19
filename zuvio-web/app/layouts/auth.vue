<script setup lang="ts">
import AppToast from '~/components/ui/AppToast.vue'
</script>

<template>
  <div class="auth-layout">
    <!-- Ambient glowing backdrop -->
    <div class="ambient-glow glow-1"></div>
    <div class="ambient-glow glow-2"></div>
    <div class="ambient-grid"></div>

    <!-- Main Content Container -->
    <main class="auth-content">
      <slot />
    </main>

    <!-- Global Toast Notifications -->
    <AppToast />
  </div>
</template>

<style scoped>
.auth-layout {
  position: relative;
  min-height: 100vh;
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: radial-gradient(circle at 50% 20%, #1e333d 0%, #102027 45%, #050b0e 100%);
  overflow-x: hidden;
  padding: 24px 16px;
}

/* ── Ambient background effects ─────────────────────────────────────────── */
.ambient-glow {
  position: absolute;
  border-radius: 50%;
  filter: blur(100px);
  pointer-events: none;
  opacity: 0.45;
  z-index: 1;
}

.glow-1 {
  width: 450px;
  height: 450px;
  background: var(--color-primary);
  top: -120px;
  right: -100px;
  animation: floatSlow 10s ease-in-out infinite alternate;
}

.glow-2 {
  width: 400px;
  height: 400px;
  background: #00B0FF;
  bottom: -100px;
  left: -80px;
  opacity: 0.2;
  animation: floatSlow 12s ease-in-out infinite alternate-reverse;
}

.ambient-grid {
  position: absolute;
  inset: 0;
  background-image: radial-gradient(rgba(255, 255, 255, 0.08) 1px, transparent 1px);
  background-size: 32px 32px;
  opacity: 0.35;
  pointer-events: none;
  z-index: 1;
}

.auth-content {
  position: relative;
  z-index: 10;
  width: 100%;
  max-width: 440px;
  display: flex;
  flex-direction: column;
  align-items: center;
}
</style>
