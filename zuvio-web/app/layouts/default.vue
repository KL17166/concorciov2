<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { useAuthStore } from '~/stores/auth'
import { LogOut, User, ShieldCheck, Zap } from 'lucide-vue-next'

const route = useRoute()
const authStore = useAuthStore()

const showHeader = computed(() => {
  if (route.meta.hideHeader) return false
  if (route.path.startsWith('/products/')) return false
  return true
})

function handleLogout() {
  authStore.logout()
}
</script>

<template>
  <div class="default-layout">
    <!-- Navbar Header (Hidden on details screen and immersive screens) -->
    <header v-if="showHeader" class="app-header">
      <div class="header-container">
        <!-- Logo -->
        <NuxtLink to="/" class="brand-link">
          <div class="brand-logo-circle">
            <span class="brand-letter">K</span>
          </div>
          <div class="brand-texts">
            <span class="brand-name">KATARI</span>
            <span class="brand-sub">Consórcios</span>
          </div>
        </NuxtLink>

        <!-- Right User Actions -->
        <div class="header-actions">
          <!-- Dev Mode Indicator if active -->
          <div v-if="authStore.isDevBypass" class="dev-badge" title="Sessão iniciada via Dev Bypass">
            <Zap :size="12" />
            <span>DEV MOCK</span>
          </div>

          <div class="user-chip">
            <div class="user-avatar">
              <User :size="16" />
            </div>
            <div class="user-details">
              <span class="user-name">{{ authStore.userName }}</span>
              <span class="user-role-badge" :class="`role-${authStore.userRole.toLowerCase()}`">
                {{ authStore.userRole }}
              </span>
            </div>
          </div>

          <button
            type="button"
            class="btn-logout"
            title="Sair da conta"
            @click="handleLogout"
          >
            <LogOut :size="18" />
          </button>
        </div>
      </div>
    </header>

    <!-- Main View Content -->
    <main class="main-viewport" :class="{ 'full-viewport': !showHeader }">
      <slot />
    </main>
  </div>
</template>

<style scoped>
.default-layout {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  background-color: var(--color-bg);
}

.app-header {
  position: sticky;
  top: 0;
  z-index: 100;
  background: rgba(255, 255, 255, 0.9);
  backdrop-filter: blur(16px);
  border-bottom: 1px solid var(--color-border);
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.03);
}

.header-container {
  max-width: 1200px;
  margin: 0 auto;
  padding: 12px 20px;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.brand-link {
  display: flex;
  align-items: center;
  gap: 10px;
}

.brand-logo-circle {
  width: 38px;
  height: 38px;
  background: linear-gradient(135deg, var(--color-primary), #E65100);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 4px 12px var(--color-primary-glow);
}

.brand-letter {
  color: white;
  font-size: 20px;
  font-weight: 900;
  line-height: 1;
}

.brand-texts {
  display: flex;
  flex-direction: column;
}

.brand-name {
  font-size: 18px;
  font-weight: 800;
  letter-spacing: 1px;
  color: var(--color-secondary);
  line-height: 1.1;
}

.brand-sub {
  font-size: 11px;
  font-weight: 600;
  color: var(--color-text-muted);
  letter-spacing: 0.5px;
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 12px;
}

.user-chip {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 6px 12px;
  background: var(--color-surface-variant);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-full);
}

.user-avatar {
  width: 28px;
  height: 28px;
  background: var(--color-secondary);
  color: white;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
}

.user-details {
  display: flex;
  flex-direction: column;
  gap: 1px;
}

.user-name {
  font-size: 12px;
  font-weight: 700;
  color: var(--color-text-main);
  max-width: 140px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.user-role-badge {
  font-size: 9px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: var(--color-text-muted);
}

.role-master, .role-admin {
  color: #9C27B0;
}

.btn-logout {
  width: 38px;
  height: 38px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  border: 1px solid var(--color-border);
  color: var(--color-text-muted);
  border-radius: 50%;
  cursor: pointer;
  transition: all var(--transition-fast);
}

.btn-logout:hover {
  background: var(--color-error-subtle);
  border-color: var(--color-error-border);
  color: var(--color-error);
}

.main-viewport {
  flex: 1;
  max-width: 1200px;
  width: 100%;
  margin: 0 auto;
}

.main-viewport.full-viewport {
  max-width: 100%;
}
</style>
