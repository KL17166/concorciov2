<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useConsortiumStore } from '~/stores/consortium'
import { useCheckoutStore } from '~/stores/checkout'
import { formatCurrency } from '~~/shared/utils/currency'
import {
  ArrowLeft,
  QrCode,
  FileText,
  Copy,
  Check,
  CheckCircle2,
  Clock,
  AlertTriangle,
  RefreshCw,
  Zap,
  Sparkles,
  ShieldCheck,
  ExternalLink
} from 'lucide-vue-next'

definePageMeta({
  middleware: 'auth',
  hideHeader: true,
  alias: ['/payment', '/checkout/payment']
})

const router = useRouter()
const route = useRoute()
const consortiumStore = useConsortiumStore()
const checkoutStore = useCheckoutStore()

const selectedMethod = ref<'PIX' | 'BOLETO'>('PIX')
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

const product = computed(() => {
  return consortiumStore.selectedProduct || consortiumStore.products[0] || {
    id: 'prod_cg_160',
    name: 'Honda CG 160 Titan',
    imageUrl: 'https://images.unsplash.com/photo-1558981403-c5f9899a28bc?auto=format&fit=crop&w=400&q=80',
    price: 18500
  }
})

const plan = computed(() => {
  return consortiumStore.selectedPlan || {
    id: 'p_80',
    durationMonths: 80,
    monthlyInstallment: 289.90
  }
})

const paymentAmount = computed(() => {
  return checkoutStore.paymentData?.amount || plan.value.monthlyInstallment || 289.90
})

const pixCode = computed(() => {
  return (
    checkoutStore.paymentData?.copyPaste ||
    '00020126360014BR.GOV.BCB.PIX0114+551199999999520400005303986540510.005802BR5913Katari Consorcios6008BRASILIA62070503***63041D3D'
  )
})

const boletoLine = computed(() => {
  return (
    checkoutStore.paymentData?.boletoLine ||
    '34191.09008 61713.957308 71444.640008 2 92900000000000'
  )
})

onMounted(() => {
  // Check method from query if available
  if (route.query.method === 'BOLETO') {
    selectedMethod.value = 'BOLETO'
  }

  // Start 30 min countdown
  timerInterval = setInterval(() => {
    if (totalSeconds.value > 0) {
      totalSeconds.value--
    } else {
      clearInterval(timerInterval)
      isExpired.value = true
    }
  }, 1000)

  // Start payment status polling
  pollInterval = setInterval(async () => {
    if (isPaymentConfirmed.value) return
    isVerifying.value = true
    // Simulate payment check
    setTimeout(() => {
      isVerifying.value = false
    }, 1500)
  }, 12000)
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

function simulatePaymentSuccess() {
  isPaymentConfirmed.value = true
  const subId = checkoutStore.createdSubscriptionId
  const contract = consortiumStore.activeContracts.find(c => c.id === subId)
  if (contract) {
    contract.isAdesaoPaid = true
    contract.status = 'active'
    contract.paidInstallments = [1]
    contract.currentInstallment = 2
    contract.progressPercentage = Math.round((1 / contract.totalInstallments) * 100)
    contract.dueDate = '15/09/2026'
  }
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
          </div>
        </div>
      </section>

      <!-- 2. Method Tabs (PIX vs Boleto) -->
      <section class="method-selector-section">
        <div class="method-pill-tabs">
          <button
            class="method-pill-btn"
            :class="{ active: selectedMethod === 'PIX' }"
            @click="selectedMethod = 'PIX'"
          >
            <QrCode :size="18" />
            <span>PIX (Instantâneo)</span>
          </button>
          <button
            class="method-pill-btn"
            :class="{ active: selectedMethod === 'BOLETO' }"
            @click="selectedMethod = 'BOLETO'"
          >
            <FileText :size="18" />
            <span>Boleto Bancário</span>
          </button>
        </div>
      </section>

      <!-- ── SECTION PIX ──────────────────────────────────────────────────── -->
      <div v-if="selectedMethod === 'PIX'" class="payment-body-box">
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
            <!-- Dynamic SVG QR Code Representation -->
            <svg viewBox="0 0 100 100" class="svg-qr-code">
              <!-- Corner Markers -->
              <rect x="5" y="5" width="25" height="25" fill="#263238" rx="4" />
              <rect x="10" y="10" width="15" height="15" fill="#FFFFFF" rx="2" />
              <rect x="13" y="13" width="9" height="9" fill="#263238" rx="1" />

              <rect x="70" y="5" width="25" height="25" fill="#263238" rx="4" />
              <rect x="75" y="10" width="15" height="15" fill="#FFFFFF" rx="2" />
              <rect x="78" y="13" width="9" height="9" fill="#263238" rx="1" />

              <rect x="5" y="70" width="25" height="25" fill="#263238" rx="4" />
              <rect x="10" y="75" width="15" height="15" fill="#FFFFFF" rx="2" />
              <rect x="13" y="78" width="9" height="9" fill="#263238" rx="1" />

              <!-- Data Pixels Pattern -->
              <rect x="36" y="8" width="6" height="6" fill="#263238" rx="1" />
              <rect x="46" y="8" width="6" height="6" fill="#263238" rx="1" />
              <rect x="56" y="8" width="6" height="6" fill="#263238" rx="1" />

              <rect x="8" y="36" width="6" height="6" fill="#263238" rx="1" />
              <rect x="18" y="36" width="6" height="6" fill="#263238" rx="1" />
              <rect x="28" y="36" width="6" height="6" fill="#263238" rx="1" />

              <rect x="36" y="36" width="12" height="12" fill="#FF6D00" rx="3" />
              <rect x="52" y="36" width="6" height="6" fill="#263238" rx="1" />
              <rect x="62" y="36" width="6" height="6" fill="#263238" rx="1" />
              <rect x="76" y="36" width="8" height="8" fill="#263238" rx="1" />

              <rect x="36" y="52" width="6" height="6" fill="#263238" rx="1" />
              <rect x="46" y="52" width="14" height="6" fill="#263238" rx="1" />
              <rect x="66" y="52" width="6" height="6" fill="#263238" rx="1" />
              <rect x="76" y="52" width="16" height="6" fill="#263238" rx="1" />

              <rect x="36" y="66" width="8" height="8" fill="#263238" rx="1" />
              <rect x="48" y="66" width="6" height="6" fill="#263238" rx="1" />
              <rect x="58" y="66" width="8" height="8" fill="#263238" rx="1" />
              <rect x="70" y="66" width="6" height="6" fill="#263238" rx="1" />
              <rect x="80" y="66" width="12" height="12" fill="#FF6D00" rx="2" />

              <rect x="36" y="80" width="12" height="6" fill="#263238" rx="1" />
              <rect x="52" y="80" width="6" height="6" fill="#263238" rx="1" />
              <rect x="62" y="80" width="14" height="6" fill="#263238" rx="1" />
            </svg>
          </div>
          <span class="qr-instruction">Aponte a câmera do app do seu banco para o QR Code acima</span>
        </div>

        <!-- Copia e Cola Section -->
        <div class="copy-paste-card">
          <div class="copy-paste-header">
            <span class="copy-label">Código Pix Copia e Cola</span>
            <span v-if="isCopied" class="copied-badge">✓ Copiado!</span>
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

        <!-- Dev Mode: Instant Simulation Button -->
        <div class="dev-simulation-wrap">
          <button class="btn-simulate-confirm" @click="simulatePaymentSuccess">
            <Sparkles :size="16" />
            <span>Simular Confirmação Imediata (Ambiente de Testes)</span>
          </button>
        </div>
      </div>

      <!-- ── SECTION BOLETO ───────────────────────────────────────────────── -->
      <div v-else class="payment-body-box">
        <div class="boleto-header-card">
          <FileText :size="32" color="#1565C0" />
          <div class="boleto-header-texts">
            <h3 class="boleto-title">Boleto Bancário</h3>
            <span class="boleto-sub">Compensação em até 3 dias úteis</span>
          </div>
        </div>

        <div class="copy-paste-card">
          <div class="copy-paste-header">
            <span class="copy-label">Linha Digitável</span>
            <span v-if="isCopied" class="copied-badge">✓ Copiado!</span>
          </div>
          <div class="copy-box" @click="copyToClipboard(boletoLine)">
            <p class="pix-raw-text">{{ boletoLine }}</p>
          </div>
          <button class="btn-copy-pix" @click="copyToClipboard(boletoLine)">
            <Copy v-if="!isCopied" :size="18" />
            <Check v-else :size="18" />
            <span>{{ isCopied ? 'LINHA COPIADA!' : 'COPIAR LINHA DIGITÁVEL' }}</span>
          </button>
        </div>

        <div class="dev-simulation-wrap">
          <button class="btn-simulate-confirm" @click="simulatePaymentSuccess">
            <Sparkles :size="16" />
            <span>Simular Pagamento do Boleto (Ambiente de Testes)</span>
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
  width: 180px;
  height: 180px;
  border: 2px solid #E0E0E0;
  border-radius: 16px;
  padding: 12px;
  background-color: #FFFFFF;
  margin-bottom: 14px;
}

.svg-qr-code {
  width: 100%;
  height: 100%;
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
.dev-simulation-wrap {
  margin-top: 24px;
  text-align: center;
}

.btn-simulate-confirm {
  background: transparent;
  border: 1px dashed #B0BEC5;
  border-radius: 10px;
  padding: 10px 16px;
  font-size: 12px;
  font-weight: 600;
  color: #757575;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  transition: all 0.2s ease;
}

.btn-simulate-confirm:hover {
  background-color: #ECEFF1;
  color: #263238;
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
