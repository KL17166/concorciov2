<script setup lang="ts">
import { ref } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useAuthStore } from '~/stores/auth'
import { useConsortiumStore } from '~/stores/consortium'
import { useCheckoutStore } from '~/stores/checkout'
import { useToast } from '~/composables/useToast'
import {
  Zap,
  Clock,
  CheckCircle2,
  Layers,
  Trash2,
  ChevronUp,
  ChevronDown,
  X,
  CreditCard,
  FileText,
  RotateCcw,
  Sparkles,
  UserCheck,
  Shield,
  LogOut
} from 'lucide-vue-next'

const router = useRouter()
const route = useRoute()
const authStore = useAuthStore()
const consortiumStore = useConsortiumStore()
const checkoutStore = useCheckoutStore()
const toast = useToast()

const isOpen = ref(false)

function fillPreset(cpf: string, pass: string = '123456') {
  if (route.path !== '/login' && route.path !== '/auth/login') {
    router.push('/login').then(() => {
      setTimeout(() => {
        window.dispatchEvent(new CustomEvent('dev-fill-credentials', { detail: { cpf, pass } }))
      }, 150)
    })
  } else {
    window.dispatchEvent(new CustomEvent('dev-fill-credentials', { detail: { cpf, pass } }))
  }
  toast.info(`Credenciais preenchidas no formulário: ${cpf}`, 'Dev Helper')
  isOpen.value = false
}

function directBypass(preset: 'client_approved' | 'client_pending' | 'admin_master') {
  const user = authStore.devBypassLogin(
    preset === 'admin_master' ? 'MASTER' : 'CLIENT',
    preset
  )

  // Seed the corresponding scenario based on preset
  if (preset === 'client_pending') {
    consortiumStore.seedScenario('pending_adhesion')
  } else if (preset === 'client_approved') {
    consortiumStore.seedScenario('active_12')
  }

  toast.success(`Logado instantaneamente como ${user.name}!`, 'Dev Bypass')
  isOpen.value = false
  router.push('/')
}

function handleLogout() {
  authStore.logout()
  isOpen.value = false
  router.push('/login')
}

function applyScenario(type: 'pending_adhesion' | 'active_12' | 'multiple' | 'empty') {
  if (!authStore.isAuthenticated) {
    authStore.devBypassLogin('CLIENT', type === 'pending_adhesion' ? 'client_pending' : 'client_approved')
  }

  consortiumStore.seedScenario(type)

  const messages: Record<string, string> = {
    pending_adhesion: 'Cenário aplicado: Contrato com Adesão Pendente (R$ 289,90)!',
    active_12: 'Cenário aplicado: Contrato Ativo (12 parcelas pagas)!',
    multiple: 'Cenário aplicado: Múltiplos Contratos (1 Ativo + 1 Pendente)!',
    empty: 'Cenário aplicado: Cliente Novo (Sem contratos ativos)!'
  }

  toast.success(messages[type] || 'Cenário alterado com sucesso!', 'Dev Scenario')
  isOpen.value = false

  if (route.path !== '/') {
    router.push('/')
  }
}

function quickCheckout() {
  if (!authStore.isAuthenticated) {
    authStore.devBypassLogin('CLIENT', 'client_approved')
  }
  checkoutStore.fillDevBypassData()
  isOpen.value = false
  router.push('/checkout')
  toast.info('Checkout iniciado com dados de teste preenchidos!')
}

function quickPayment() {
  if (!authStore.isAuthenticated) {
    authStore.devBypassLogin('CLIENT', 'client_pending')
  }
  const contract = consortiumStore.activeContracts[0]
  if (contract && !contract.isAdesaoPaid) {
    isOpen.value = false
    router.push('/consortium/adhesion')
    return
  }
  if (contract) {
    checkoutStore.createdSubscriptionId = contract.id
    checkoutStore.paymentData = {
      installmentId: contract.installmentIds?.[1] || `inst_1_${contract.id}`,
      idTokenPay: contract.installmentTokens?.[1] || `tok_1_${contract.id}`,
      amount: contract.nextPaymentAmount || 289.90,
      method: 'PIX',
      qrCode: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
      copyPaste: '00020126360014BR.GOV.BCB.PIX0114+551199999999520400005303986540510.005802BR5913Katari Consorcios6008BRASILIA62070503***63041D3D',
      expirationDate: new Date(Date.now() + 30 * 60 * 1000).toISOString()
    }
  }
  isOpen.value = false
  router.push('/checkout/payment')
}
</script>

<template>
  <div class="dev-floating-tool-root">
    <!-- Floating Trigger Pill Button -->
    <button
      type="button"
      class="dev-pill-trigger"
      :class="{ 'is-open': isOpen }"
      title="Painel de Cenários de Teste (Dev Bypass)"
      @click="isOpen = !isOpen"
    >
      <div class="pill-pulse-dot"></div>
      <Zap :size="15" class="zap-icon" />
      <span class="pill-title">DEV BYPASS</span>
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
              <h3 class="drawer-title">Ferramentas de Desenvolvimento</h3>
              <p class="drawer-sub">
                {{ authStore.isAuthenticated ? `Logado como ${authStore.userName}` : 'Preencha os campos ou entre instantaneamente' }}
              </p>
            </div>
          </div>
          <button type="button" class="btn-close-drawer" @click="isOpen = false">
            <X :size="18" />
          </button>
        </div>

        <!-- Section: If Not Authenticated (Login Presets with Fill + Enter) -->
        <div v-if="!authStore.isAuthenticated" class="dev-scenarios-grid">
          <!-- Preset 1: Carlos Alberto (Approved + Active Contract) -->
          <div class="preset-card-row">
            <div class="card-icon-circle active-bg">
              <UserCheck :size="18" color="#2E7D32" />
            </div>
            <div class="card-meta">
              <div class="meta-title-row">
                <span class="meta-title">Carlos Alberto</span>
                <span class="tag-status status-active">Contrato Ativo</span>
              </div>
              <span class="preset-cpf-sub">CPF: 111.444.777-35</span>
            </div>
            <div class="preset-btn-actions">
              <button
                type="button"
                class="btn-action-fill"
                title="Preencher campos para você clicar em Entrar"
                @click="fillPreset('111.444.777-35', '123456')"
              >
                Preencher
              </button>
              <button
                type="button"
                class="btn-action-bypass"
                title="Entrar direto"
                @click="directBypass('client_approved')"
              >
                <Zap :size="12" /> Entrar
              </button>
            </div>
          </div>

          <!-- Preset 2: Mariana Oliveira (Pending + Adesão Pendente) -->
          <div class="preset-card-row">
            <div class="card-icon-circle pending-bg">
              <Clock :size="18" color="#F57C00" />
            </div>
            <div class="card-meta">
              <div class="meta-title-row">
                <span class="meta-title">Mariana Oliveira</span>
                <span class="tag-status status-pending">Adesão Pendente</span>
              </div>
              <span class="preset-cpf-sub">CPF: 222.333.444-05</span>
            </div>
            <div class="preset-btn-actions">
              <button
                type="button"
                class="btn-action-fill"
                title="Preencher campos para você clicar em Entrar"
                @click="fillPreset('222.333.444-05', '123456')"
              >
                Preencher
              </button>
              <button
                type="button"
                class="btn-action-bypass"
                title="Entrar direto"
                @click="directBypass('client_pending')"
              >
                <Zap :size="12" /> Entrar
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
                <span class="tag-status status-multi">Administrador</span>
              </div>
              <span class="preset-cpf-sub">CPF: 529.982.247-25</span>
            </div>
            <div class="preset-btn-actions">
              <button
                type="button"
                class="btn-action-fill"
                title="Preencher campos para você clicar em Entrar"
                @click="fillPreset('529.982.247-25', '123456')"
              >
                Preencher
              </button>
              <button
                type="button"
                class="btn-action-bypass"
                title="Entrar direto"
                @click="directBypass('admin_master')"
              >
                <Zap :size="12" /> Entrar
              </button>
            </div>
          </div>
        </div>

        <!-- Section: If Authenticated (Contract Scenarios) -->
        <div v-else class="dev-scenarios-grid">
          <!-- 1. Adesão Pendente -->
          <div class="scenario-card card-pending" @click="applyScenario('pending_adhesion')">
            <div class="card-icon-circle pending-bg">
              <Clock :size="18" color="#F57C00" />
            </div>
            <div class="card-meta">
              <div class="meta-title-row">
                <span class="meta-title">Adesão Pendente</span>
                <span class="tag-status status-pending">Aguardando Pagamento</span>
              </div>
              <p class="meta-desc">
                Contrato assinado aguardando 1ª parcela (R$ 289,90). Testa aviso e bloqueios na Home.
              </p>
            </div>
          </div>

          <!-- 2. Contrato Ativo -->
          <div class="scenario-card card-active" @click="applyScenario('active_12')">
            <div class="card-icon-circle active-bg">
              <CheckCircle2 :size="18" color="#2E7D32" />
            </div>
            <div class="card-meta">
              <div class="meta-title-row">
                <span class="meta-title">Contrato Ativo (Normal)</span>
                <span class="tag-status status-active">12 Parcelas Pagas</span>
              </div>
              <p class="meta-desc">
                Contrato ativo e adimplente. Libera Extrato, Lances e pagamentos normais.
              </p>
            </div>
          </div>

          <!-- 3. Múltiplos Contratos -->
          <div class="scenario-card card-multi" @click="applyScenario('multiple')">
            <div class="card-icon-circle multi-bg">
              <Layers :size="18" color="#1565C0" />
            </div>
            <div class="card-meta">
              <div class="meta-title-row">
                <span class="meta-title">Múltiplos Contratos</span>
                <span class="tag-status status-multi">2 Cotas</span>
              </div>
              <p class="meta-desc">
                1 Moto Ativa + 1 Carro Pendente. Testa carrossel de cotas na Home.
              </p>
            </div>
          </div>

          <!-- 4. Cliente Novo (Sem Contratos) -->
          <div class="scenario-card card-empty" @click="applyScenario('empty')">
            <div class="card-icon-circle empty-bg">
              <Trash2 :size="18" color="#757575" />
            </div>
            <div class="card-meta">
              <div class="meta-title-row">
                <span class="meta-title">Cliente Novo (Zerado)</span>
                <span class="tag-status status-empty">0 Contratos</span>
              </div>
              <p class="meta-desc">
                Sem consórcios ativos. Exibe banners promocionais e catálogo inicial.
              </p>
            </div>
          </div>
        </div>

        <!-- Quick Route Shortcuts -->
        <div class="dev-quick-actions">
          <button type="button" class="btn-quick-nav" @click="quickCheckout">
            <FileText :size="14" />
            <span>Checkout</span>
          </button>
          <button type="button" class="btn-quick-nav" @click="quickPayment">
            <CreditCard :size="14" />
            <span>PIX/Boleto</span>
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
  width: 380px;
  max-width: calc(100vw - 32px);
  background-color: #FFFFFF;
  border: 1px solid #E0E0E0;
  border-radius: 20px;
  box-shadow: 0 16px 40px rgba(0, 0, 0, 0.22);
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 16px;
  animation: scale-in 0.25s cubic-bezier(0.4, 0, 0.2, 1);
}

.dev-drawer-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  border-bottom: 1px solid #F0F0F0;
  padding-bottom: 12px;
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
  font-size: 15px;
  font-weight: 800;
  color: #263238;
  margin: 0;
}

.drawer-sub {
  font-size: 11.5px;
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

/* ── Scenarios Grid ─────────────────────────────────────────────────────── */
.dev-scenarios-grid {
  display: flex;
  flex-direction: column;
  gap: 10px;
  max-height: 380px;
  overflow-y: auto;
  padding-right: 2px;
}

.preset-card-row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  background-color: #FAFAFA;
  border: 1.5px solid #EEEEEE;
  border-radius: 14px;
  transition: all 0.2s ease;
}

.preset-card-row:hover {
  background-color: #FFFFFF;
  border-color: #CFD8DC;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);
}

.preset-cpf-sub {
  font-size: 11px;
  color: #757575;
  font-family: monospace;
}

.preset-btn-actions {
  display: flex;
  align-items: center;
  gap: 6px;
}

.btn-action-fill {
  padding: 6px 10px;
  border-radius: 8px;
  border: 1px solid #CFD8DC;
  background-color: #FFFFFF;
  color: #37474F;
  font-size: 11px;
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
  padding: 6px 10px;
  border-radius: 8px;
  border: none;
  background: linear-gradient(135deg, #FF6D00 0%, #FF8F00 100%);
  color: #FFFFFF;
  font-size: 11px;
  font-weight: 800;
  cursor: pointer;
  transition: all 0.15s ease;
}

.btn-action-bypass:hover {
  transform: translateY(-1px);
  box-shadow: 0 3px 8px rgba(255, 109, 0, 0.35);
}

.scenario-card {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 12px;
  background-color: #FAFAFA;
  border: 1.5px solid #EEEEEE;
  border-radius: 14px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.scenario-card:hover {
  transform: translateX(3px);
  background-color: #FFFFFF;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.06);
}

.card-pending:hover { border-color: #FFB74D; }
.card-active:hover { border-color: #81C784; }
.card-multi:hover { border-color: #64B5F6; }
.card-empty:hover { border-color: #BDBDBD; }

.card-icon-circle {
  width: 36px;
  height: 36px;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.pending-bg { background-color: #FFF3E0; }
.active-bg { background-color: #E8F5E9; }
.multi-bg { background-color: #E3F2FD; }
.empty-bg { background-color: #F5F5F5; }

.card-meta {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.meta-title-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 6px;
}

.meta-title {
  font-size: 13px;
  font-weight: 800;
  color: #263238;
}

.tag-status {
  font-size: 10px;
  font-weight: 800;
  padding: 2px 6px;
  border-radius: 6px;
  white-space: nowrap;
}

.status-pending { background-color: #FFE082; color: #E65100; }
.status-active { background-color: #C8E6C9; color: #1B5E20; }
.status-multi { background-color: #BBDEFB; color: #0D47A1; }
.status-empty { background-color: #EEEEEE; color: #616161; }

.meta-desc {
  font-size: 11px;
  color: #757575;
  line-height: 1.35;
  margin: 0;
}

/* ── Quick Route Shortcuts ──────────────────────────────────────────────── */
.dev-quick-actions {
  display: flex;
  gap: 8px;
  border-top: 1px solid #F0F0F0;
  padding-top: 12px;
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
  font-size: 11.5px;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.15s ease;
}

.btn-quick-nav:hover {
  background-color: #ECEFF1;
  border-color: #CFD8DC;
  color: #263238;
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
