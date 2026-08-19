<script setup lang="ts">
import { ref } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useAuthStore } from '~/stores/auth'
import { useConsortiumStore } from '~/stores/consortium'
import { useCheckoutStore } from '~/stores/checkout'
import { useToast } from '~/composables/useToast'
import {
  Zap,
  CheckCircle2,
  ChevronUp,
  ChevronDown,
  X,
  CreditCard,
  FileText,
  RotateCcw,
  UserCheck,
  Shield,
  LogOut,
  Send,
  TrendingUp,
  UserPlus,
  Home,
  FileCheck
} from 'lucide-vue-next'

const router = useRouter()
const route = useRoute()
const authStore = useAuthStore()
const consortiumStore = useConsortiumStore()
const checkoutStore = useCheckoutStore()
const toast = useToast()

const isOpen = ref(false)
const isLoggingIn = ref(false)

/**
 * Preenche os campos de login na tela com as credenciais do preset
 */
function fillLoginPreset(cpf: string, pass: string = '123456') {
  if (route.path !== '/login' && route.path !== '/auth/login') {
    router.push('/login').then(() => {
      setTimeout(() => {
        window.dispatchEvent(new CustomEvent('dev-fill-credentials', { detail: { cpf, pass } }))
      }, 150)
    })
  } else {
    window.dispatchEvent(new CustomEvent('dev-fill-credentials', { detail: { cpf, pass } }))
  }
  toast.info(`Credenciais preenchidas no formulário: ${cpf}`, 'Preenchimento Automático')
  isOpen.value = false
}

/**
 * Preenche e submete a autenticação diretamente para o servidor backend
 */
async function directLoginPreset(cpf: string, pass: string = '123456') {
  isLoggingIn.value = true
  fillLoginPreset(cpf, pass)

  try {
    const result = await authStore.login({ cpf, password: pass })
    if (result.success) {
      toast.success(`Autenticado com sucesso no servidor!`, 'Backend Auth')
      await consortiumStore.loadHomeData()
      isOpen.value = false
      router.push('/')
    } else {
      toast.error(result.message || 'Falha ao autenticar no servidor', 'Erro de Login')
    }
  } catch (err: any) {
    toast.error(err?.message || 'Erro de conexão com o backend', 'Erro')
  } finally {
    isLoggingIn.value = false
  }
}

/**
 * Preenche os dados do funil de checkout (Dados Pessoais + Endereço) como um cliente real
 */
function fillCheckoutForm() {
  checkoutStore.fillDevBypassData()
  isOpen.value = false
  if (route.path !== '/checkout') {
    router.push('/checkout')
  }
  toast.success('Formulário de Checkout preenchido com dados realistas!', 'Cliente Preenchido')
}

/**
 * Navega e preenche dados para envio de lances
 */
function fillBidForm() {
  isOpen.value = false
  if (route.path !== '/consortium/bids') {
    router.push('/consortium/bids')
  }
  toast.info('Tela de lances aberta. Escolha a modalidade e submeta para o servidor!', 'Lances')
}

/**
 * Navega e preenche dados para envio de KYC
 */
function fillKycForm() {
  isOpen.value = false
  if (route.path !== '/profile/kyc') {
    router.push('/profile/kyc')
  }
  toast.info('Tela de KYC aberta para envio direto de documentos ao servidor.', 'KYC')
}

/**
 * Atualiza todos os dados vindos do backend
 */
async function refreshServerData() {
  toast.info('Sincronizando com o servidor...', 'Backend')
  await consortiumStore.loadHomeData()
  toast.success('Dados atualizados diretamente do servidor!', 'Sucesso')
}

function handleLogout() {
  authStore.logout()
  consortiumStore.activeContracts = []
  isOpen.value = false
  router.push('/login')
  toast.info('Sessão encerrada com sucesso.')
}
</script>

<template>
  <div class="dev-floating-tool-root">
    <!-- Floating Trigger Pill Button -->
    <button
      type="button"
      class="dev-pill-trigger"
      :class="{ 'is-open': isOpen }"
      title="Assistente de Preenchimento de Formulários (Dev Helper)"
      @click="isOpen = !isOpen"
    >
      <div class="pill-pulse-dot"></div>
      <Zap :size="15" class="zap-icon" />
      <span class="pill-title">DEV AUTOFILL</span>
      <component :is="isOpen ? ChevronDown : ChevronUp" :size="14" />
    </button>

    <!-- Floating Drawer / Modal -->
    <Transition name="dev-slide">
      <div v-if="isOpen" class="dev-floating-drawer">
        <!-- Header -->
        <div class="dev-drawer-header">
          <div class="header-left">
            <div class="dev-zap-box">
              <Zap :size="16" color="#FF6D00" />
            </div>
            <div>
              <h3 class="drawer-title">Assistente de Testes (Cliente Real)</h3>
              <p class="drawer-sub">
                {{ authStore.isAuthenticated ? `Conectado como ${authStore.userName}` : 'Preencha os campos e envie ao servidor' }}
              </p>
            </div>
          </div>
          <button type="button" class="btn-close-drawer" @click="isOpen = false">
            <X :size="18" />
          </button>
        </div>

        <!-- Section 1: Presets de Login (Form Autofill & Real Submit) -->
        <div class="section-container">
          <div class="section-label">
            <span>PRESETS DE LOGIN (AUTOFILTRADOS)</span>
          </div>

          <div class="dev-scenarios-grid">
            <!-- Preset 1: Carlos Alberto -->
            <div class="preset-card-row">
              <div class="card-icon-circle active-bg">
                <UserCheck :size="18" color="#2E7D32" />
              </div>
              <div class="card-meta">
                <div class="meta-title-row">
                  <span class="meta-title">Carlos Alberto</span>
                </div>
                <span class="preset-cpf-sub">CPF: 111.444.777-35</span>
              </div>
              <div class="preset-btn-actions">
                <button
                  type="button"
                  class="btn-action-fill"
                  title="Preencher campos no formulário de login"
                  @click="fillLoginPreset('111.444.777-35', '123456')"
                >
                  Preencher
                </button>
                <button
                  type="button"
                  class="btn-action-bypass"
                  title="Preencher e enviar requisição real de login ao servidor"
                  :disabled="isLoggingIn"
                  @click="directLoginPreset('111.444.777-35', '123456')"
                >
                  <Send :size="12" /> Entrar
                </button>
              </div>
            </div>

            <!-- Preset 2: Mariana Oliveira -->
            <div class="preset-card-row">
              <div class="card-icon-circle pending-bg">
                <UserCheck :size="18" color="#F57C00" />
              </div>
              <div class="card-meta">
                <div class="meta-title-row">
                  <span class="meta-title">Mariana Oliveira</span>
                </div>
                <span class="preset-cpf-sub">CPF: 222.333.444-05</span>
              </div>
              <div class="preset-btn-actions">
                <button
                  type="button"
                  class="btn-action-fill"
                  title="Preencher campos no formulário de login"
                  @click="fillLoginPreset('222.333.444-05', '123456')"
                >
                  Preencher
                </button>
                <button
                  type="button"
                  class="btn-action-bypass"
                  title="Preencher e enviar requisição real de login ao servidor"
                  :disabled="isLoggingIn"
                  @click="directLoginPreset('222.333.444-05', '123456')"
                >
                  <Send :size="12" /> Entrar
                </button>
              </div>
            </div>

            <!-- Preset 3: Admin Master -->
            <div class="preset-card-row">
              <div class="card-icon-circle multi-bg">
                <Shield :size="18" color="#1565C0" />
              </div>
              <div class="card-meta">
                <div class="meta-title-row">
                  <span class="meta-title">Admin Master</span>
                </div>
                <span class="preset-cpf-sub">CPF: 529.982.247-25</span>
              </div>
              <div class="preset-btn-actions">
                <button
                  type="button"
                  class="btn-action-fill"
                  title="Preencher campos no formulário de login"
                  @click="fillLoginPreset('529.982.247-25', '123456')"
                >
                  Preencher
                </button>
                <button
                  type="button"
                  class="btn-action-bypass"
                  title="Preencher e enviar requisição real de login ao servidor"
                  :disabled="isLoggingIn"
                  @click="directLoginPreset('529.982.247-25', '123456')"
                >
                  <Send :size="12" /> Entrar
                </button>
              </div>
            </div>
          </div>
        </div>

        <!-- Section 2: Preenchedores de Formulários (Autofill de Cliente) -->
        <div class="section-container">
          <div class="section-label">
            <span>PREENCHEDORES DE FORMULÁRIO (CLIENT AUTOFILL)</span>
          </div>
          <div class="form-fillers-grid">
            <button type="button" class="btn-form-fill" @click="fillCheckoutForm">
              <FileText :size="15" color="#FF6D00" />
              <div class="fill-meta">
                <span class="fill-title">Preencher Checkout</span>
                <span class="fill-sub">Nome, CPF, CEP, Endereço e Docs</span>
              </div>
            </button>
            <button type="button" class="btn-form-fill" @click="fillBidForm">
              <TrendingUp :size="15" color="#1976D2" />
              <div class="fill-meta">
                <span class="fill-title">Ir para Lances</span>
                <span class="fill-sub">Ofertar lance real no grupo</span>
              </div>
            </button>
            <button type="button" class="btn-form-fill" @click="fillKycForm">
              <FileCheck :size="15" color="#388E3C" />
              <div class="fill-meta">
                <span class="fill-title">Ir para KYC</span>
                <span class="fill-sub">Submissão de documentos</span>
              </div>
            </button>
          </div>
        </div>

        <!-- Section 3: Status da Sessão Real no Backend -->
        <div v-if="authStore.isAuthenticated" class="session-info-box">
          <div class="session-info-header">
            <span class="session-badge">SESSÃO AUTENTICADA NO SERVIDOR</span>
            <button type="button" class="btn-refresh-server" title="Recarregar dados do servidor" @click="refreshServerData">
              <RotateCcw :size="13" />
            </button>
          </div>
          <div class="session-details">
            <p><strong>Usuário:</strong> {{ authStore.userName }}</p>
            <p><strong>Perfil:</strong> {{ authStore.userRole }}</p>
            <p><strong>CPF:</strong> {{ authStore.userCpfFormatted }}</p>
            <p><strong>Contratos Ativos:</strong> {{ consortiumStore.activeContracts.length }} no backend</p>
          </div>
        </div>

        <!-- Quick Route Shortcuts -->
        <div class="dev-quick-actions">
          <button type="button" class="btn-quick-nav" @click="router.push('/'); isOpen = false">
            <Home :size="14" />
            <span>Home</span>
          </button>
          <button type="button" class="btn-quick-nav" @click="router.push('/consortium/payments'); isOpen = false">
            <CreditCard :size="14" />
            <span>Parcelas</span>
          </button>
          <button v-if="authStore.isAuthenticated" type="button" class="btn-quick-nav btn-quick-logout" @click="handleLogout">
            <LogOut :size="14" />
            <span>Sair</span>
          </button>
        </div>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
.dev-floating-tool-root {
  position: fixed;
  bottom: 24px;
  right: 24px;
  z-index: 9999;
  font-family: 'Outfit', sans-serif;
}

/* ── Floating Pill Trigger ──────────────────────────────────────────────── */
.dev-pill-trigger {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 16px;
  background: linear-gradient(135deg, #263238 0%, #1A2327 100%);
  border: 1.5px solid #FF6D00;
  border-radius: 30px;
  color: #FFFFFF;
  font-size: 12px;
  font-weight: 800;
  letter-spacing: 0.5px;
  cursor: pointer;
  box-shadow: 0 6px 20px rgba(0, 0, 0, 0.35);
  transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
  user-select: none;
}

.dev-pill-trigger:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 24px rgba(255, 109, 0, 0.35);
  border-color: #FF9100;
}

.dev-pill-trigger.is-open {
  background: #FF6D00;
  border-color: #FFFFFF;
}

.pill-pulse-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background-color: #00E676;
  box-shadow: 0 0 8px #00E676;
  animation: pulse-glow 2s infinite;
}

@keyframes pulse-glow {
  0%, 100% { opacity: 1; transform: scale(1); }
  50% { opacity: 0.5; transform: scale(1.2); }
}

.zap-icon {
  color: #FF6D00;
}

.dev-pill-trigger.is-open .zap-icon {
  color: #FFFFFF;
}

/* ── Floating Drawer Panel ──────────────────────────────────────────────── */
.dev-floating-drawer {
  position: absolute;
  bottom: 50px;
  right: 0;
  width: 390px;
  max-width: calc(100vw - 32px);
  background-color: #FFFFFF;
  border: 1px solid #E0E0E0;
  border-radius: 20px;
  box-shadow: 0 16px 40px rgba(0, 0, 0, 0.22);
  padding: 18px;
  display: flex;
  flex-direction: column;
  gap: 14px;
  animation: scale-in 0.25s cubic-bezier(0.4, 0, 0.2, 1);
  max-height: 85vh;
  overflow-y: auto;
}

.dev-drawer-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  border-bottom: 1px solid #F0F0F0;
  padding-bottom: 10px;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 10px;
}

.dev-zap-box {
  width: 34px;
  height: 34px;
  border-radius: 10px;
  background-color: #FFF3E0;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.drawer-title {
  font-size: 14px;
  font-weight: 800;
  color: #263238;
  margin: 0;
}

.drawer-sub {
  font-size: 11px;
  color: #757575;
  margin: 2px 0 0 0;
}

.btn-close-drawer {
  background: none;
  border: none;
  color: #9E9E9E;
  cursor: pointer;
  padding: 4px;
  border-radius: 6px;
  transition: all 0.15s ease;
}

.btn-close-drawer:hover {
  background-color: #F5F5F5;
  color: #263238;
}

.section-container {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.section-label {
  font-size: 10.5px;
  font-weight: 800;
  color: #9E9E9E;
  letter-spacing: 0.6px;
}

/* ── Presets Grid ────────────────────────────────────────────────────────── */
.dev-scenarios-grid {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.preset-card-row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 12px;
  background-color: #FAFAFA;
  border: 1.5px solid #EEEEEE;
  border-radius: 12px;
  transition: all 0.2s ease;
}

.preset-card-row:hover {
  background-color: #FFFFFF;
  border-color: #CFD8DC;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);
}

.card-icon-circle {
  width: 32px;
  height: 32px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.pending-bg { background-color: #FFF3E0; }
.active-bg { background-color: #E8F5E9; }
.multi-bg { background-color: #E3F2FD; }

.card-meta {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.meta-title {
  font-size: 12.5px;
  font-weight: 800;
  color: #263238;
}

.preset-cpf-sub {
  font-size: 10.5px;
  color: #757575;
  font-family: monospace;
}

.preset-btn-actions {
  display: flex;
  align-items: center;
  gap: 6px;
}

.btn-action-fill {
  padding: 5px 8px;
  border-radius: 6px;
  border: 1px solid #CFD8DC;
  background-color: #FFFFFF;
  color: #37474F;
  font-size: 10.5px;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.15s ease;
}

.btn-action-fill:hover {
  background-color: #ECEFF1;
  border-color: #B0BEC5;
  color: #263238;
}

.btn-action-bypass {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 5px 8px;
  border-radius: 6px;
  border: none;
  background: linear-gradient(135deg, #FF6D00 0%, #FF8F00 100%);
  color: #FFFFFF;
  font-size: 10.5px;
  font-weight: 800;
  cursor: pointer;
  transition: all 0.15s ease;
}

.btn-action-bypass:hover {
  transform: translateY(-1px);
  box-shadow: 0 3px 8px rgba(255, 109, 0, 0.35);
}

.btn-action-bypass:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

/* ── Form Fillers ────────────────────────────────────────────────────────── */
.form-fillers-grid {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.btn-form-fill {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 9px 12px;
  background-color: #FAFAFA;
  border: 1px solid #E0E0E0;
  border-radius: 10px;
  cursor: pointer;
  text-align: left;
  transition: all 0.15s ease;
}

.btn-form-fill:hover {
  background-color: #FFFFFF;
  border-color: #FFB74D;
  transform: translateX(2px);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
}

.fill-meta {
  display: flex;
  flex-direction: column;
}

.fill-title {
  font-size: 12px;
  font-weight: 800;
  color: #263238;
}

.fill-sub {
  font-size: 10.5px;
  color: #757575;
}

/* ── Session Box ────────────────────────────────────────────────────────── */
.session-info-box {
  background-color: #F1F8E9;
  border: 1px solid #C8E6C9;
  border-radius: 12px;
  padding: 10px 12px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.session-info-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.session-badge {
  font-size: 10px;
  font-weight: 800;
  color: #2E7D32;
}

.btn-refresh-server {
  background: none;
  border: none;
  color: #2E7D32;
  cursor: pointer;
  padding: 2px;
  display: flex;
  align-items: center;
  transition: transform 0.2s ease;
}

.btn-refresh-server:hover {
  transform: rotate(180deg);
}

.session-details {
  font-size: 11px;
  color: #33691E;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.session-details p {
  margin: 0;
}

/* ── Quick Route Shortcuts ──────────────────────────────────────────────── */
.dev-quick-actions {
  display: flex;
  gap: 8px;
  border-top: 1px solid #F0F0F0;
  padding-top: 10px;
}

.btn-quick-nav {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 8px 10px;
  border-radius: 10px;
  border: 1px solid #E0E0E0;
  background-color: #FAFAFA;
  color: #37474F;
  font-size: 11px;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.15s ease;
}

.btn-quick-nav:hover {
  background-color: #ECEFF1;
  border-color: #CFD8DC;
  color: #263238;
}

.btn-quick-logout {
  color: #D32F2F;
  border-color: #FFCDD2;
  background-color: #FFEBEE;
}

.btn-quick-logout:hover {
  background-color: #FFCDD2;
  border-color: #EF5350;
  color: #B71C1C;
}

/* ── Transitions ────────────────────────────────────────────────────────── */
.dev-slide-enter-active,
.dev-slide-leave-active {
  transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
}

.dev-slide-enter-from,
.dev-slide-leave-to {
  opacity: 0;
  transform: translateY(10px) scale(0.95);
}

@keyframes scale-in {
  0% { opacity: 0; transform: translateY(10px) scale(0.95); }
  100% { opacity: 1; transform: translateY(0) scale(1); }
}
</style>
