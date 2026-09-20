<script setup lang="ts">
import { computed, ref, onMounted, onUnmounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '~/stores/auth'
import { useConsortiumStore } from '~/stores/consortium'
import { LogOut, User, FileCheck, Package, ChevronDown, ShieldCheck, AlertTriangle, Clock } from 'lucide-vue-next'

const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()
const consortiumStore = useConsortiumStore()

const menuOpen = ref(false)
const contractsOpen = ref(false)

const showHeader = computed(() => {
  if (route.meta.hideHeader) return false
  if (route.path.startsWith('/products/')) return false
  if (route.path === '/' && !authStore.isAuthenticated) return false
  if (route.path === '/welcome') return false
  return true
})

const kycBadge = computed(() => {
  const s = authStore.user?.kycStatus || 'PENDING'
  if (s === 'APPROVED') return { label: 'Verificado', cls: 'kyc-ok', icon: 'check' }
  if (s === 'SUBMITTED') return { label: 'Em análise', cls: 'kyc-pending', icon: 'clock' }
  if (s === 'REJECTED') return { label: 'Recusado', cls: 'kyc-bad', icon: 'alert' }
  return { label: 'Pendente', cls: 'kyc-pending', icon: 'clock' }
})

function toggleMenu() {
  menuOpen.value = !menuOpen.value
  if (menuOpen.value) {
    contractsOpen.value = false
    if (authStore.isAuthenticated && consortiumStore.activeContracts.length === 0) {
      consortiumStore.loadHomeData().catch(() => {})
    }
  }
}

function toggleContracts() {
  contractsOpen.value = !contractsOpen.value
  if (contractsOpen.value && authStore.isAuthenticated && consortiumStore.activeContracts.length === 0) {
    consortiumStore.loadHomeData().catch(() => {})
  }
}

function contractStatusLabel(status: string): string {
  if (status === 'active') return 'Ativo'
  if (status === 'pending') return 'Em adesão'
  if (status === 'finished') return 'Concluído'
  if (status === 'canceled') return 'Cancelado'
  return status || '—'
}

function closeMenu() {
  menuOpen.value = false
}

function go(path: string) {
  closeMenu()
  router.push(path)
}

function handleLogout() {
  closeMenu()
  authStore.logout()
  consortiumStore.activeContracts = []
  router.push('/login')
}

function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape') closeMenu()
}

onMounted(() => {
  window.addEventListener('keydown', onKeydown)
})

onUnmounted(() => {
  window.removeEventListener('keydown', onKeydown)
})
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
          <template v-if="authStore.isAuthenticated">
            <div class="user-menu-wrap">
              <button
                type="button"
                class="user-chip user-chip-btn"
                :class="{ open: menuOpen }"
                title="Minha conta"
                @click="toggleMenu"
              >
                <div class="user-avatar">
                  <User :size="16" />
                </div>
                <div class="user-details">
                  <span class="user-name">{{ authStore.userName }}</span>
                  <span class="user-role-badge" :class="`role-${authStore.userRole.toLowerCase()}`">
                    {{ authStore.userRole }}
                  </span>
                </div>
                <ChevronDown :size="14" class="chip-chevron" :class="{ open: menuOpen }" />
              </button>

              <Transition name="menu-drop">
                <div v-if="menuOpen" class="user-dropdown">
                  <div class="dropdown-user-block">
                    <div class="dropdown-avatar">
                      <User :size="20" />
                    </div>
                    <div class="dropdown-user-meta">
                      <span class="dropdown-user-name">{{ authStore.userName }}</span>
                      <span class="dropdown-user-cpf">{{ authStore.userCpfFormatted || 'CPF não informado' }}</span>
                      <span class="kyc-badge" :class="kycBadge.cls">
                        <ShieldCheck v-if="kycBadge.icon === 'check'" :size="11" />
                        <Clock v-else-if="kycBadge.icon === 'clock'" :size="11" />
                        <AlertTriangle v-else :size="11" />
                        {{ kycBadge.label }}
                      </span>
                    </div>
                  </div>

                  <div class="dropdown-divider"></div>

                  <button type="button" class="dropdown-item" @click="go('/profile')">
                    <User :size="16" />
                    <span>Meu Perfil</span>
                  </button>
                  <button type="button" class="dropdown-item" @click="toggleContracts">
                    <Package :size="16" />
                    <span>Meus contratos</span>
                    <span v-if="consortiumStore.activeContracts.length > 0" class="count-badge">
                      {{ consortiumStore.activeContracts.length }}
                    </span>
                    <ChevronDown :size="13" class="mini-chevron" :class="{ open: contractsOpen }" />
                  </button>
                  <div v-if="contractsOpen" class="contracts-preview">
                    <div
                      v-for="c in consortiumStore.activeContracts.slice(0, 4)"
                      :key="c.id"
                      class="contract-preview-row"
                      @click="go('/consortium/contracts')"
                    >
                      <div class="contract-preview-meta">
                        <span class="contract-preview-name">{{ c.product?.name || 'Consórcio' }}</span>
                        <span class="contract-preview-sub">Grupo {{ c.groupNumber }} • Cota {{ c.quotaNumber }}</span>
                      </div>
                      <span class="mini-status-pill" :class="`st-${c.status}`">
                        {{ contractStatusLabel(c.status) }}
                      </span>
                    </div>
                    <div v-if="consortiumStore.activeContracts.length === 0" class="contracts-empty">
                      Nenhum contrato encontrado.
                    </div>
                    <button type="button" class="contracts-see-all" @click="go('/consortium/contracts')">
                      Ver todos
                    </button>
                  </div>
                </div>
              </Transition>
            </div>

            <button
              type="button"
              class="btn-logout"
              title="Sair da conta"
              @click="handleLogout"
            >
              <LogOut :size="18" />
            </button>
            <div v-if="menuOpen" class="menu-overlay" @click="closeMenu"></div>
          </template>

          <template v-else>
            <NuxtLink to="/auth/login" class="btn-login-nav">
              Entrar
            </NuxtLink>
          </template>
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
  padding: 10px 12px;
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

.user-chip-btn {
  cursor: pointer;
  font-family: inherit;
  transition: border-color 0.15s ease, box-shadow 0.15s ease;
}

.user-chip-btn:hover,
.user-chip-btn.open {
  border-color: var(--color-primary, #FF6D00);
  box-shadow: 0 2px 8px rgba(255, 109, 0, 0.15);
}

.chip-chevron {
  color: var(--color-text-muted);
  transition: transform 0.2s ease;
}

.chip-chevron.open {
  transform: rotate(180deg);
}

.user-menu-wrap {
  position: relative;
}

.menu-overlay {
  position: fixed;
  inset: 0;
  z-index: 150;
  background: transparent;
}

.user-dropdown {
  position: absolute;
  top: calc(100% + 10px);
  right: 0;
  width: 251px;
  max-width: calc(100vw - 24px);
  background: #FFFFFF;
  border: 1px solid var(--color-border, #ECEFF1);
  border-radius: 16px;
  box-shadow: 0 16px 40px rgba(0, 0, 0, 0.14);
  padding: 8px;
  z-index: 200;
}

.dropdown-user-block {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px;
  background: #F8F9FA;
  border-radius: 12px;
  margin-bottom: 4px;
}

.dropdown-avatar {
  width: 44px;
  height: 44px;
  border-radius: 50%;
  background: var(--color-secondary, #263238);
  color: #FFFFFF;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.dropdown-user-meta {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.dropdown-user-name {
  font-size: 14px;
  font-weight: 800;
  color: var(--color-secondary, #263238);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.dropdown-user-cpf {
  font-size: 11.5px;
  color: #757575;
  font-family: monospace;
}

.kyc-badge {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  margin-top: 4px;
  padding: 2px 8px;
  border-radius: 20px;
  font-size: 10.5px;
  font-weight: 800;
  align-self: flex-start;
}

.kyc-badge.kyc-ok {
  background: #E8F5E9;
  color: #2E7D32;
}

.kyc-badge.kyc-pending {
  background: #FFF3E0;
  color: #E65100;
}

.kyc-badge.kyc-bad {
  background: #FFEBEE;
  color: #C62828;
}

.dropdown-divider {
  height: 1px;
  background: #F0F0F0;
  margin: 6px 4px;
}

.dropdown-item {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  border: none;
  border-radius: 10px;
  background: transparent;
  color: var(--color-secondary, #263238);
  font-size: 13.5px;
  font-weight: 600;
  font-family: inherit;
  cursor: pointer;
  text-align: left;
  transition: background 0.15s ease;
}

.dropdown-item:hover {
  background: #F5F5F5;
}

.kyc-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  margin-left: auto;
}

.kyc-dot.kyc-ok {
  background: #4CAF50;
}

.kyc-dot.kyc-pending {
  background: #FF9800;
}

.kyc-dot.kyc-bad {
  background: #F44336;
}

.count-badge {
  margin-left: auto;
  min-width: 22px;
  height: 22px;
  padding: 0 6px;
  border-radius: 11px;
  background: rgba(255, 109, 0, 0.12);
  color: var(--color-primary, #FF6D00);
  font-size: 11.5px;
  font-weight: 800;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.mini-chevron {
  color: var(--color-text-muted);
  transition: transform 0.2s ease;
  margin-left: 2px;
}

.mini-chevron.open {
  transform: rotate(180deg);
}

.contracts-preview {
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin: 2px 4px 4px 4px;
  padding: 8px;
  background: #F8F9FA;
  border-radius: 10px;
}

.contract-preview-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px;
  border-radius: 8px;
  cursor: pointer;
  transition: background 0.15s ease;
}

.contract-preview-row:hover {
  background: #FFFFFF;
}

.contract-preview-meta {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.contract-preview-name {
  font-size: 12.5px;
  font-weight: 700;
  color: var(--color-secondary, #263238);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.contract-preview-sub {
  font-size: 11px;
  color: #757575;
}

.mini-status-pill {
  font-size: 9.5px;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.3px;
  padding: 3px 8px;
  border-radius: 20px;
  flex-shrink: 0;
}

.mini-status-pill.st-pending {
  background: #FFF3E0;
  color: #E65100;
}

.mini-status-pill.st-active {
  background: #E8F5E9;
  color: #2E7D32;
}

.mini-status-pill.st-canceled {
  background: #FFEBEE;
  color: #C62828;
}

.mini-status-pill.st-finished {
  background: #E3F2FD;
  color: #1565C0;
}

.contracts-empty {
  font-size: 12px;
  color: #9E9E9E;
  text-align: center;
  padding: 8px 0;
}

.contracts-see-all {
  border: none;
  background: transparent;
  color: var(--color-primary, #FF6D00);
  font-size: 12px;
  font-weight: 800;
  font-family: inherit;
  cursor: pointer;
  padding: 6px 0 2px 0;
}

.menu-drop-enter-active,
.menu-drop-leave-active {
  transition: all 0.18s ease;
}

.menu-drop-enter-from,
.menu-drop-leave-to {
  opacity: 0;
  transform: translateY(-6px);
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

.btn-login-nav {
  padding: 8px 16px;
  background: linear-gradient(135deg, var(--color-primary), #E65100);
  color: #FFFFFF;
  border-radius: var(--radius-full);
  font-size: 13px;
  font-weight: 700;
  text-decoration: none;
  transition: transform var(--transition-fast), box-shadow var(--transition-fast);
}

.btn-login-nav:hover {
  transform: translateY(-1px);
  box-shadow: 0 4px 12px var(--color-primary-glow);
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
