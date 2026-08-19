<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '~/stores/auth'
import { useConsortiumStore } from '~/stores/consortium'
import {
  ArrowLeft,
  User,
  FileText,
  CreditCard,
  TrendingUp,
  ShieldCheck,
  Bell,
  HelpCircle,
  Settings,
  LogOut,
  ChevronRight,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Sparkles
} from 'lucide-vue-next'

definePageMeta({
  middleware: 'auth',
  hideHeader: true,
  alias: ['/profile']
})

const router = useRouter()
const authStore = useAuthStore()
const consortiumStore = useConsortiumStore()

const isLogoutDialogOpen = ref(false)

const user = computed(() => authStore.user || {
  id: 'dev_user',
  name: 'Usuário Katari',
  email: 'usuario@katari.com.br',
  phone: '(11) 98765-4321',
  kycStatus: 'APPROVED'
})

const kycBadge = computed(() => {
  const status = user.value.kycStatus || 'NOT_SUBMITTED'
  switch (status) {
    case 'APPROVED':
      return { label: 'Verificado', class: 'green', icon: CheckCircle2 }
    case 'SUBMITTED':
      return { label: 'Em Análise', class: 'blue', icon: Clock }
    case 'REJECTED':
      return { label: 'Recusado', class: 'red', icon: AlertTriangle }
    default:
      return { label: 'Pendente', class: 'orange', icon: AlertTriangle }
  }
})

onMounted(async () => {
  if (consortiumStore.activeContracts.length === 0) {
    await consortiumStore.loadHomeData()
  }
})

function handleLogout() {
  authStore.logout()
  isLogoutDialogOpen.value = false
  router.push('/auth/login')
}
</script>

<template>
  <div class="profile-screen-wrapper">
    <!-- Top App Bar -->
    <header class="appbar-header">
      <button class="appbar-back-btn" aria-label="Voltar" @click="router.back()">
        <ArrowLeft :size="22" color="#263238" />
      </button>
      <h1 class="appbar-title">Meu Perfil</h1>
      <div class="appbar-spacer"></div>
    </header>

    <main class="profile-main-container">
      <!-- 1. Profile Header Hero -->
      <section class="profile-hero-card">
        <div class="avatar-ring">
          <div class="avatar-inner">
            <User :size="44" color="#FF6D00" />
          </div>
        </div>
        <h2 class="user-display-name">{{ user.name }}</h2>
        <span class="user-email">{{ user.email }}</span>

        <!-- KYC Status Pill -->
        <div
          class="kyc-status-pill"
          :class="kycBadge.class"
          @click="router.push('/profile/kyc')"
        >
          <component :is="kycBadge.icon" :size="14" />
          <span>Status KYC: {{ kycBadge.label }}</span>
        </div>
      </section>

      <!-- 2. Active Contracts Card -->
      <section
        v-if="consortiumStore.hasActiveContracts"
        class="contracts-summary-card"
        @click="router.push('/consortium/statement')"
      >
        <div class="contract-card-left">
          <div class="contract-icon-circle">
            <CheckCircle2 :size="24" color="#4CAF50" />
          </div>
          <div class="contract-card-texts">
            <h3 class="contract-title">
              {{ consortiumStore.activeContracts.length === 1 ? '1 Contrato Ativo' : `${consortiumStore.activeContracts.length} Contratos Ativos` }}
            </h3>
            <span class="contract-subtitle">
              {{ consortiumStore.activeContracts[0]?.product?.name || 'Consórcio Moto' }}
            </span>
          </div>
        </div>
        <ChevronRight :size="20" color="#9E9E9E" />
      </section>

      <!-- 3. Menu Navigation List -->
      <section class="profile-menu-section">
        <div class="menu-items-list">
          <!-- Meus Contratos / Extrato -->
          <div class="profile-menu-card" @click="router.push('/consortium/statement')">
            <div class="menu-icon-circle blue">
              <FileText :size="20" color="#2196F3" />
            </div>
            <div class="menu-texts">
              <span class="menu-title">Extrato e Contratos</span>
              <span class="menu-subtitle">Acompanhe evolução da cota e saldo</span>
            </div>
            <ChevronRight :size="18" color="#B0BEC5" />
          </div>

          <!-- Pagamentos -->
          <div class="profile-menu-card" @click="router.push('/consortium/payments')">
            <div class="menu-icon-circle green">
              <CreditCard :size="20" color="#4CAF50" />
            </div>
            <div class="menu-texts">
              <span class="menu-title">Pagamentos e Parcelas</span>
              <span class="menu-subtitle">2ª via PIX, boletos e antecipação</span>
            </div>
            <ChevronRight :size="18" color="#B0BEC5" />
          </div>

          <!-- Ofertar Lance -->
          <div class="profile-menu-card" @click="router.push('/consortium/bids')">
            <div class="menu-icon-circle orange">
              <TrendingUp :size="20" color="#FF6D00" />
            </div>
            <div class="menu-texts">
              <span class="menu-title">Ofertar Lance</span>
              <span class="menu-subtitle">Simule lances e antecipe sua moto</span>
            </div>
            <ChevronRight :size="18" color="#B0BEC5" />
          </div>

          <!-- Validação de Documentos / KYC -->
          <div class="profile-menu-card" @click="router.push('/profile/kyc')">
            <div class="menu-icon-circle purple">
              <ShieldCheck :size="20" color="#9C27B0" />
            </div>
            <div class="menu-texts">
              <span class="menu-title">Documentos e Identidade</span>
              <span class="menu-subtitle">Status de validação KYC e reenvio</span>
            </div>
            <ChevronRight :size="18" color="#B0BEC5" />
          </div>

          <!-- Sair -->
          <div class="profile-menu-card logout" @click="isLogoutDialogOpen = true">
            <div class="menu-icon-circle red">
              <LogOut :size="20" color="#D32F2F" />
            </div>
            <div class="menu-texts">
              <span class="menu-title red">Sair da Conta</span>
              <span class="menu-subtitle">Desconectar deste dispositivo</span>
            </div>
            <ChevronRight :size="18" color="#FFCDD2" />
          </div>
        </div>
      </section>

      <!-- Version -->
      <div class="app-version-footer">
        <span>Katari Consórcios v2.4.0 (Web/PWA)</span>
      </div>
    </main>

    <!-- ── Logout Confirmation Dialog ────────────────────────────────────── -->
    <div v-if="isLogoutDialogOpen" class="modal-overlay" @click.self="isLogoutDialogOpen = false">
      <div class="logout-dialog-box">
        <div class="logout-icon-circle">
          <LogOut :size="32" color="#D32F2F" />
        </div>
        <h3 class="logout-title">Sair da Conta</h3>
        <p class="logout-msg">Tem certeza de que deseja desconectar da sua conta?</p>
        <div class="dialog-actions-row">
          <button class="btn-dialog-cancel" @click="isLogoutDialogOpen = false">CANCELAR</button>
          <button class="btn-dialog-logout" @click="handleLogout">SAIR</button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.profile-screen-wrapper {
  min-height: 100vh;
  background-color: var(--color-bg, #FAFAFA);
  font-family: 'Outfit', sans-serif;
  color: var(--color-secondary, #263238);
}

.profile-main-container {
  max-width: 600px;
  margin: 0 auto;
  padding-bottom: 60px;
}

/* ── Hero Profile Card ─────────────────────────────────────────────────── */
.profile-hero-card {
  background-color: #FFFFFF;
  border-bottom: 1px solid var(--color-border, #E0E0E0);
  border-radius: 0 0 24px 24px;
  padding: 32px 20px 24px 20px;
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.03);
  margin-bottom: 20px;
}

.avatar-ring {
  width: 88px;
  height: 88px;
  border-radius: 50%;
  border: 3px solid var(--color-primary, #FF6D00);
  padding: 3px;
  margin-bottom: 14px;
}

.avatar-inner {
  width: 100%;
  height: 100%;
  border-radius: 50%;
  background-color: rgba(255, 109, 0, 0.1);
  display: flex;
  align-items: center;
  justify-content: center;
}

.user-display-name {
  font-size: 20px;
  font-weight: 800;
  color: var(--color-secondary, #263238);
  margin: 0 0 4px 0;
}

.user-email {
  font-size: 13.5px;
  color: var(--color-text-muted, #757575);
  margin-bottom: 12px;
}

.kyc-status-pill {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 14px;
  border-radius: 20px;
  font-size: 12px;
  font-weight: 700;
  cursor: pointer;
  transition: opacity 0.2s ease;
}

.kyc-status-pill.green {
  background-color: #E8F5E9;
  color: #2E7D32;
}

.kyc-status-pill.blue {
  background-color: #E3F2FD;
  color: #1565C0;
}

.kyc-status-pill.red {
  background-color: #FFEBEE;
  color: #D32F2F;
}

.kyc-status-pill.orange {
  background-color: #FFF3E0;
  color: #E65100;
}

/* ── Active Contracts Card ─────────────────────────────────────────────── */
.contracts-summary-card {
  margin: 0 20px 20px 20px;
  background-color: #FFFFFF;
  border: 1px solid var(--color-border, #E0E0E0);
  border-radius: 16px;
  padding: 16px 18px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  cursor: pointer;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.03);
  transition: all 0.2s ease;
}

.contracts-summary-card:hover {
  transform: translateY(-1px);
}

.contract-card-left {
  display: flex;
  align-items: center;
  gap: 14px;
}

.contract-icon-circle {
  width: 44px;
  height: 44px;
  border-radius: 12px;
  background-color: #E8F5E9;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.contract-card-texts {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.contract-title {
  font-size: 15px;
  font-weight: 700;
  color: var(--color-secondary, #263238);
  margin: 0;
}

.contract-subtitle {
  font-size: 12.5px;
  color: var(--color-text-muted, #757575);
}

/* ── Menu Section ───────────────────────────────────────────────────────── */
.profile-menu-section {
  padding: 0 20px;
}

.menu-items-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.profile-menu-card {
  background-color: #FFFFFF;
  border: 1px solid var(--color-border, #E0E0E0);
  border-radius: 16px;
  padding: 14px 16px;
  display: flex;
  align-items: center;
  gap: 14px;
  cursor: pointer;
  transition: all 0.2s ease;
  user-select: none;
}

.profile-menu-card:hover {
  background-color: #FAFAFA;
  border-color: #CFD8DC;
}

.profile-menu-card.logout:hover {
  background-color: #FFEBEE;
  border-color: #FFCDD2;
}

.menu-icon-circle {
  width: 40px;
  height: 40px;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.menu-icon-circle.blue { background-color: rgba(33, 150, 243, 0.1); }
.menu-icon-circle.green { background-color: rgba(76, 175, 80, 0.1); }
.menu-icon-circle.orange { background-color: rgba(255, 109, 0, 0.1); }
.menu-icon-circle.purple { background-color: rgba(156, 39, 176, 0.1); }
.menu-icon-circle.red { background-color: rgba(244, 67, 54, 0.1); }

.menu-texts {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.menu-title {
  font-size: 14.5px;
  font-weight: 700;
  color: var(--color-secondary, #263238);
}

.menu-title.red {
  color: #D32F2F;
}

.menu-subtitle {
  font-size: 12px;
  color: var(--color-text-muted, #757575);
}

.app-version-footer {
  text-align: center;
  margin-top: 32px;
  font-size: 12px;
  color: #9E9E9E;
}

/* ── Logout Modal Dialog ────────────────────────────────────────────────── */
.logout-dialog-box {
  background-color: #FFFFFF;
  border-radius: 20px;
  padding: 24px;
  max-width: 400px;
  width: 90%;
  margin: auto;
  text-align: center;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.2);
  display: flex;
  flex-direction: column;
  align-items: center;
}

.logout-icon-circle {
  width: 64px;
  height: 64px;
  border-radius: 50%;
  background-color: #FFEBEE;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 16px;
}

.logout-title {
  font-size: 18px;
  font-weight: 800;
  color: var(--color-secondary, #263238);
  margin: 0 0 6px 0;
}

.logout-msg {
  font-size: 13.5px;
  color: var(--color-text-muted, #757575);
  margin: 0 0 20px 0;
}

.dialog-actions-row {
  display: flex;
  gap: 12px;
  width: 100%;
}

.btn-dialog-cancel {
  flex: 1;
  height: 46px;
  border-radius: 12px;
  border: 1px solid var(--color-border, #E0E0E0);
  background-color: #FFFFFF;
  color: #616161;
  font-weight: 700;
  cursor: pointer;
}

.btn-dialog-logout {
  flex: 1;
  height: 46px;
  border-radius: 12px;
  border: none;
  background-color: #D32F2F;
  color: #FFFFFF;
  font-weight: 700;
  cursor: pointer;
}
</style>
