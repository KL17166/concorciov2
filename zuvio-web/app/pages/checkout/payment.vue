<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useConsortiumStore } from '~/stores/consortium'
import { useCheckoutStore } from '~/stores/checkout'
import { useAuthStore } from '~/stores/auth'
import { formatCurrency } from '~~/shared/utils/currency'
import QRCode from 'qrcode'
import {
  ArrowLeft,
  Copy,
  Check,
  CheckCircle2,
  Clock,
  RefreshCw,
  Zap,
  Sparkles,
  ShieldCheck,
  Loader2
} from 'lucide-vue-next'

import { DEFAULT_PRODUCTS } from '~~/shared/utils/catalogData'
import type { Product, ConsortiumPlan } from '~~/shared/types/catalog'

definePageMeta({
  middleware: 'auth',
  hideHeader: true,
  alias: ['/payment', '/checkout/payment']
})

const router = useRouter()
const route = useRoute()
const consortiumStore = useConsortiumStore()
const checkoutStore = useCheckoutStore()
const authStore = useAuthStore()

const isCopied = ref(false)
const isPaymentConfirmed = ref(false)
const isExpired = ref(false)
const isVerifying = ref(false)

// 30 minute countdown timer
const totalSeconds = ref(30 * 60)
let timerInterval: any = null
let pollInterval: any = null

const formattedTimer = computed(() => {
  const m = Math.floor(totalSeconds.value / 60)
  const s = totalSeconds.value % 60
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
})

const timerProgressPct = computed(() => {
  return `${(totalSeconds.value / (30 * 60)) * 100}%`
})

const defaultProduct: Product = DEFAULT_PRODUCTS[0]!

const product = computed<Product>(() => {
  const queryProdId = route.query.productId ? String(route.query.productId) : null
  if (queryProdId) {
    const fromStore = consortiumStore.products.find(p => p.id === queryProdId)
    if (fromStore) return fromStore
    const fromDefault = DEFAULT_PRODUCTS.find(p => p.id === queryProdId)
    if (fromDefault) return fromDefault
  }
  return consortiumStore.selectedProduct || consortiumStore.products[0] || defaultProduct
})

const plan = computed<ConsortiumPlan>(() => {
  const queryPlanId = route.query.planId ? String(route.query.planId) : null
  if (queryPlanId && product.value?.plans) {
    const fromProd = product.value.plans.find(p => p.id === queryPlanId)
    if (fromProd) return fromProd
  }
  return consortiumStore.selectedPlan || (product.value?.plans ? product.value.plans[0] : null) || {
    id: 'p_80',
    durationMonths: 80,
    monthlyInstallment: 289.90,
    adminFeeRate: 15,
    fundRate: 3
  }
})

const paymentAmount = computed(() => {
  return checkoutStore.paymentData?.amount || plan.value.monthlyInstallment || 289.90
})

// A Eldorado raramente gera o valor cheio — a diferença vira "desconto" p/ o cliente
const desconto = computed(() => {
  const req = checkoutStore.paymentData?.requestedAmount
  const act = checkoutStore.paymentData?.amount
  if (typeof req === 'number' && typeof act === 'number' && req - act > 0.005) {
    return req - act
  }
  return 0
})

const pixCode = computed(() => {
  return checkoutStore.paymentData?.copyPaste || ''
})

const qrCodeImage = ref<string>('')
const isGeneratingQr = ref(false)

async function generateQrCode(code: string) {
  if (!code) return
  isGeneratingQr.value = true
  try {
    qrCodeImage.value = await QRCode.toDataURL(code, {
      width: 320,
      margin: 2,
      color: {
        dark: '#1E293B',
        light: '#FFFFFF'
      },
      errorCorrectionLevel: 'M'
    })
  } catch (err) {
    console.error('Erro ao gerar imagem do QR Code:', err)
  } finally {
    isGeneratingQr.value = false
  }
}

watch(
  [pixCode, () => checkoutStore.paymentData?.qrCode],
  async ([code, qr]) => {
    if (qr && (qr.startsWith('data:') || qr.startsWith('http'))) {
      qrCodeImage.value = qr
    } else if (code) {
      await generateQrCode(code)
    }
  },
  { immediate: true }
)

onMounted(async () => {
  // Garante o catálogo real para o computed `product` não cair no fallback errado
  await consortiumStore.ensureProductsLoaded()

  // Start 30 min countdown
  timerInterval = setInterval(() => {
    if (totalSeconds.value > 0) {
      totalSeconds.value--
    } else {
      clearInterval(timerInterval)
      isExpired.value = true
    }
  }, 1000)

  // Real payment status polling against backend
  pollInterval = setInterval(async () => {
    if (isPaymentConfirmed.value) return
    isVerifying.value = true
    try {
      await consortiumStore.loadHomeData()
      const subId = checkoutStore.createdSubscriptionId
      const contract = consortiumStore.activeContracts.find(c => c.id === subId)
      if (contract && (contract.isAdesaoPaid || contract.status === 'active')) {
        isPaymentConfirmed.value = true
      }
    } catch (_) {}
    isVerifying.value = false
  }, 8000)
})

onUnmounted(() => {
  if (timerInterval) clearInterval(timerInterval)
  if (pollInterval) clearInterval(pollInterval)
})

async function copyToClipboard(text: string) {
  try {
    await navigator.clipboard.writeText(text)
    isCopied.value = true
    setTimeout(() => {
      isCopied.value = false
    }, 3000)
  } catch (_) {
    // Fallback
  }
}

async function checkPaymentStatus() {
  isVerifying.value = true
  try {
    await consortiumStore.loadHomeData()
    const subId = checkoutStore.createdSubscriptionId
    const contract = consortiumStore.activeContracts.find(c => c.id === subId)
    if (contract && (contract.isAdesaoPaid || contract.status === 'active')) {
      isPaymentConfirmed.value = true
    }
    // Avisa o dev que o cliente afirma ter pago (baixa manual no admin)
    if (subId) {
      $fetch(`/api/subscription/${subId}/payment-check`, {
        method: 'POST',
        headers: authStore.token ? { Authorization: `Bearer ${authStore.token}` } : {}
      }).catch(() => {})
    }
  } catch (_) {}
  isVerifying.value = false
}

function handleFinish() {
  router.push('/')
}
</script>

<template>
  <div class="payment-screen-wrapper">
    <!-- Top App Bar -->
    <header class="appbar-header">
      <button class="appbar-back-btn" aria-label="Voltar" @click="router.back()">
        <ArrowLeft :size="22" color="#263238" />
      </button>
      <h1 class="appbar-title">Pagamento da Adesão</h1>
      <div class="appbar-spacer"></div>
    </header>

    <main class="payment-main-container">
      <!-- 1. Order Summary Card -->
      <section class="order-summary-card">
        <div class="summary-top-row">
          <div class="product-thumb-box">
            <img
              v-if="product.imageUrl"
              :src="product.imageUrl"
              :alt="product.name"
              class="product-thumb-img"
            />
            <div v-else class="product-thumb-placeholder">
              <Sparkles :size="24" color="#FF6D00" />
            </div>
          </div>
          <div class="product-meta-col">
            <h2 class="product-title">{{ product.name }}</h2>
            <div class="plan-badge">Plano {{ plan.durationMonths }} meses</div>
          </div>
          <div class="amount-col">
            <span class="amount-label">Valor da Adesão</span>
            <span class="amount-val">{{ formatCurrency(paymentAmount) }}</span>
            <span v-if="desconto > 0" class="discount-pill">Desconto de {{ formatCurrency(desconto) }}</span>
          </div>
        </div>
      </section>

      <!-- ── SECTION PIX ──────────────────────────────────────────────────── -->
      <div class="payment-body-box">
        <!-- Countdown Timer Banner -->
        <div class="countdown-banner">
          <div class="countdown-left">
            <Clock :size="18" color="#FF6D00" />
            <span class="countdown-text">Código expira em: <strong>{{ formattedTimer }}</strong></span>
          </div>
          <div class="countdown-live-badge">
            <span class="pulse-dot"></span>
            <span>Aguardando PIX</span>
          </div>
        </div>

        <!-- QR Code Display Box -->
        <div class="qr-code-box">
          <div class="qr-frame">
            <img
              v-if="qrCodeImage"
              :src="qrCodeImage"
              alt="QR Code Pix"
              class="real-qr-code-img"
            />
            <div v-else class="qr-loading-placeholder">
              <Loader2 :size="32" class="spin-icon" color="#FF6D00" />
              <span class="qr-loading-text">Gerando QR Code...</span>
            </div>
          </div>
          <span class="qr-instruction">Aponte a câmera do app do seu banco para o QR Code acima</span>
        </div>

        <!-- Copia e Cola Section -->
        <div class="copy-paste-card">
          <div class="copy-paste-header">
            <span class="copy-label">Código Pix Copia e Cola</span>
            <span v-if="isCopied" class="copied-badge"><Check :size="12" /> Copiado!</span>
          </div>
          <div class="copy-box" @click="copyToClipboard(pixCode)">
            <p class="pix-raw-text">{{ pixCode }}</p>
          </div>
          <button class="btn-copy-pix" @click="copyToClipboard(pixCode)">
            <Copy v-if="!isCopied" :size="18" />
            <Check v-else :size="18" />
            <span>{{ isCopied ? 'CÓDIGO COPIADO!' : 'COPIAR CÓDIGO PIX' }}</span>
          </button>
        </div>

        <!-- Instructions Accordion / Sanduíche -->
        <div class="sandwich-accordion-card">
          <div class="sandwich-header">
            <div class="sandwich-header-left">
              <div class="sandwich-icon-wrap orange">
                <Zap :size="20" color="#FF6D00" />
              </div>
              <div class="sandwich-header-texts">
                <h3 class="sandwich-title">Como pagar com o Pix?</h3>
                <span class="sandwich-subtitle">Passo a passo rápido para confirmação instantânea</span>
              </div>
            </div>
          </div>
          <div class="sandwich-content-body">
            <ol class="pix-steps-list">
              <li>Abra o aplicativo do seu banco ou carteira digital.</li>
              <li>Acesse a área <strong>Pix</strong> e escolha <strong>Pix Copia e Cola</strong> ou <strong>Ler QR Code</strong>.</li>
              <li>Cole o código copiado ou aponte a câmera para o QR Code.</li>
              <li>Confirme os dados e finalize o pagamento. A liberação é imediata!</li>
            </ol>
          </div>
        </div>

        <!-- Real status check action -->
        <div class="dev-simulation-wrap">
          <button class="btn-check-status" :disabled="isVerifying" @click="checkPaymentStatus">
            <RefreshCw :size="16" :class="{ 'spin-icon': isVerifying }" />
            <span>{{ isVerifying ? 'Consultando confirmação no servidor...' : 'Verificar Pagamento no Servidor' }}</span>
          </button>
        </div>
      </div>
    </main>

    <!-- ── Payment Confirmed Modal Dialog ─────────────────────────────────── -->
    <div v-if="isPaymentConfirmed" class="modal-overlay">
      <div class="confirmed-modal-card">
        <div class="confirmed-icon-circle">
          <CheckCircle2 :size="64" color="#4CAF50" />
        </div>
        <h2 class="confirmed-title">Pagamento Confirmado!</h2>
        <p class="confirmed-text">
          Parabéns! Sua adesão foi compensada com sucesso e sua cota do consórcio <strong>{{ product.name }}</strong> já está ativa!
        </p>

        <div class="contract-confirmed-pill">
          <ShieldCheck :size="18" color="#2E7D32" />
          <span>Cota Ativa no Grupo {{ checkoutStore.groupNumber }}</span>
        </div>

        <button class="btn-goto-dashboard" @click="handleFinish">
          ACESSAR MEU CONSÓRCIO
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.payment-screen-wrapper {
  min-height: 100vh;
  background-color: var(--color-bg, #FAFAFA);
  font-family: 'Outfit', sans-serif;
  color: var(--color-secondary, #263238);
}

.payment-main-container {
  max-width: 600px;
  margin: 0 auto;
  padding: 20px 20px 80px 20px;
}

/* ── Order Summary Card ─────────────────────────────────────────────────── */
.order-summary-card {
  background-color: #FFFFFF;
  border: 1px solid var(--color-border, #E0E0E0);
  border-radius: 16px;
  padding: 16px 20px;
  margin-bottom: 20px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.03);
}

.summary-top-row {
  display: flex;
  align-items: center;
  gap: 14px;
}

.product-thumb-box {
  width: 54px;
  height: 54px;
  border-radius: 12px;
  background-color: #F5F5F5;
  border: 1px solid #E0E0E0;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  flex-shrink: 0;
}

.product-thumb-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.product-meta-col {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.product-title {
  font-size: 15px;
  font-weight: 700;
  color: var(--color-secondary, #263238);
  margin: 0;
}

.plan-badge {
  font-size: 11px;
  font-weight: 600;
  color: #616161;
}

.amount-col {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 2px;
}

.amount-label {
  font-size: 11px;
  color: #757575;
}

.amount-val {
  font-size: 18px;
  font-weight: 800;
  color: var(--color-primary, #FF6D00);
}

.discount-pill {
  display: inline-block;
  margin-top: 4px;
  padding: 2px 10px;
  border-radius: 20px;
  background-color: #E8F5E9;
  color: #2E7D32;
  font-size: 11.5px;
  font-weight: 800;
}

/* ── Method Selector Tabs ───────────────────────────────────────────────── */
.method-selector-section {
  margin-bottom: 20px;
}

.method-pill-tabs {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
}

.method-pill-btn {
  height: 48px;
  border-radius: 12px;
  border: 1.5px solid var(--color-border, #E0E0E0);
  background-color: #FFFFFF;
  color: var(--color-secondary, #263238);
  font-size: 14px;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.method-pill-btn.active {
  border-color: var(--color-primary, #FF6D00);
  background-color: rgba(255, 109, 0, 0.08);
  color: var(--color-primary, #FF6D00);
}

/* ── Countdown Banner ───────────────────────────────────────────────────── */
.countdown-banner {
  background-color: #FFF3E0;
  border: 1px solid #FFE0B2;
  border-radius: 12px;
  padding: 10px 16px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}

.countdown-left {
  display: flex;
  align-items: center;
  gap: 8px;
}

.countdown-text {
  font-size: 13px;
  color: #E65100;
}

.countdown-live-badge {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 11.5px;
  font-weight: 700;
  color: #E65100;
}

.pulse-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background-color: #FF6D00;
  animation: pulse 1.5s infinite;
}

@keyframes pulse {
  0% { transform: scale(0.9); opacity: 0.7; }
  50% { transform: scale(1.3); opacity: 1; }
  100% { transform: scale(0.9); opacity: 0.7; }
}

/* ── QR Code Box ────────────────────────────────────────────────────────── */
.qr-code-box {
  background-color: #FFFFFF;
  border: 1px solid var(--color-border, #E0E0E0);
  border-radius: 20px;
  padding: 24px;
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.03);
  margin-bottom: 20px;
}

.qr-frame {
  width: 200px;
  height: 200px;
  border: 2px solid #E0E0E0;
  border-radius: 16px;
  padding: 8px;
  background-color: #FFFFFF;
  margin-bottom: 14px;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.04);
}

.real-qr-code-img {
  width: 100%;
  height: 100%;
  object-fit: contain;
  border-radius: 8px;
}

.qr-loading-placeholder {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 10px;
  color: #757575;
  height: 100%;
  width: 100%;
}

.qr-loading-text {
  font-size: 12px;
  color: #757575;
  font-weight: 500;
}

.spin-icon {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

.qr-instruction {
  font-size: 13px;
  color: var(--color-text-muted, #616161);
  max-width: 280px;
}

/* ── Copia e Cola Card ──────────────────────────────────────────────────── */
.copy-paste-card {
  background-color: #FFFFFF;
  border: 1px solid var(--color-border, #E0E0E0);
  border-radius: 16px;
  padding: 18px;
  margin-bottom: 20px;
}

.copy-paste-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.copy-label {
  font-size: 13px;
  font-weight: 700;
  color: var(--color-secondary, #263238);
}

.copied-badge {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 11px;
  font-weight: 800;
  color: #2E7D32;
  background-color: #E8F5E9;
  padding: 2px 8px;
  border-radius: 6px;
}

.copy-box {
  background-color: #FAFAFA;
  border: 1px dashed var(--color-border, #E0E0E0);
  border-radius: 10px;
  padding: 10px 14px;
  margin-bottom: 12px;
  cursor: pointer;
}

.pix-raw-text {
  font-size: 11.5px;
  font-family: monospace;
  color: #616161;
  word-break: break-all;
  margin: 0;
  line-height: 1.4;
}

.btn-copy-pix {
  width: 100%;
  height: 48px;
  border-radius: 12px;
  border: none;
  background-color: var(--color-primary, #FF6D00);
  color: #FFFFFF;
  font-size: 14px;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  cursor: pointer;
  transition: background 0.15s ease;
}

.btn-copy-pix:hover {
  background-color: #E65100;
}

/* ── Pix Steps List ─────────────────────────────────────────────────────── */
.pix-steps-list {
  padding-left: 20px;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
  font-size: 13px;
  color: #616161;
  line-height: 1.4;
}

/* ── Boleto Box ─────────────────────────────────────────────────────────── */
.boleto-header-card {
  background-color: #E3F2FD;
  border: 1px solid #BBDEFB;
  border-radius: 16px;
  padding: 18px;
  display: flex;
  align-items: center;
  gap: 16px;
  margin-bottom: 20px;
}

.boleto-title {
  font-size: 16px;
  font-weight: 800;
  color: #0D47A1;
  margin: 0;
}

.boleto-sub {
  font-size: 12.5px;
  color: #1976D2;
}

/* ── Dev Simulation ─────────────────────────────────────────────────────── */
/* ── Real Status Check Action ────────────────────────────────────────────── */
.dev-simulation-wrap {
  margin-top: 20px;
  margin-bottom: 24px;
  display: flex;
  justify-content: center;
}

.btn-check-status {
  background-color: #FFFFFF;
  border: 1.5px solid #E2E8F0;
  border-radius: 14px;
  padding: 13px 22px;
  font-size: 13.5px;
  font-weight: 700;
  font-family: inherit;
  color: #475569;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  gap: 9px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
}

.btn-check-status:hover:not(:disabled) {
  background-color: #F8FAFC;
  border-color: #CBD5E1;
  color: #0F172A;
  transform: translateY(-1px);
  box-shadow: 0 4px 14px rgba(0, 0, 0, 0.08);
}

.btn-check-status:active:not(:disabled) {
  transform: translateY(0);
}

.btn-check-status:disabled {
  opacity: 0.7;
  cursor: not-allowed;
  background-color: #F1F5F9;
  border-color: #E2E8F0;
}

.spin-icon {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}

/* ── Confirmed Modal ────────────────────────────────────────────────────── */
.confirmed-modal-card {
  background-color: #FFFFFF;
  border-radius: 24px;
  padding: 32px 24px;
  max-width: 440px;
  width: 90%;
  margin: auto;
  text-align: center;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.2);
  display: flex;
  flex-direction: column;
  align-items: center;
}

.confirmed-icon-circle {
  width: 96px;
  height: 96px;
  border-radius: 50%;
  background-color: #E8F5E9;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 20px;
}

.confirmed-title {
  font-size: 22px;
  font-weight: 900;
  color: var(--color-secondary, #263238);
  margin: 0 0 10px 0;
}

.confirmed-text {
  font-size: 14px;
  color: var(--color-text-muted, #616161);
  line-height: 1.5;
  margin: 0 0 20px 0;
}

.contract-confirmed-pill {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 8px 16px;
  border-radius: 20px;
  background-color: #E8F5E9;
  color: #2E7D32;
  font-size: 13px;
  font-weight: 700;
  margin-bottom: 24px;
}

.btn-goto-dashboard {
  width: 100%;
  height: 52px;
  border-radius: 14px;
  border: none;
  background-color: #4CAF50;
  color: #FFFFFF;
  font-size: 15px;
  font-weight: 700;
  letter-spacing: 0.5px;
  cursor: pointer;
  box-shadow: 0 4px 14px rgba(76, 175, 80, 0.35);
  transition: background 0.15s ease;
}

.btn-goto-dashboard:hover {
  background-color: #388E3C;
}
</style>
