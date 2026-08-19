<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useConsortiumStore } from '~/stores/consortium'
import { useAuthStore } from '~/stores/auth'
import { useCheckoutStore } from '~/stores/checkout'
import { useToast } from '~/composables/useToast'
import { formatCurrency } from '~~/shared/utils/currency'
import type { ActiveContract } from '~~/shared/types/catalog'
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
  ExternalLink,
  Hourglass,
  Package
} from 'lucide-vue-next'

definePageMeta({
  middleware: 'auth',
  hideHeader: true,
  alias: ['/adhesion-payment', '/consortium/adhesion-payment']
})

const router = useRouter()
const route = useRoute()
const consortiumStore = useConsortiumStore()
const authStore = useAuthStore()
const checkoutStore = useCheckoutStore()
const toast = useToast()

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

const contract = computed<ActiveContract | null>(() => {
  return consortiumStore.activeContracts[0] || null
})

const product = computed(() => {
  if (contract.value?.product) return contract.value.product
  return consortiumStore.selectedProduct || consortiumStore.products[0] || {
    id: 'prod_cg_160',
    name: 'Honda CG 160 Titan',
    imageUrl: 'https://images.unsplash.com/photo-1558981403-c5f9899a28bc?auto=format&fit=crop&w=400&q=80',
    price: 18500
  }
})

const adhesionAmount = computed(() => {
  if (contract.value) {
    return contract.value.installmentValues?.[1] || contract.value.nextPaymentAmount || 289.90
  }
  return checkoutStore.paymentData?.amount || 289.90
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

onMounted(async () => {
  if (consortiumStore.activeContracts.length === 0) {
    await consortiumStore.loadHomeData()
  }

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
    toast.success('Código copiado para a área de transferência!')
    setTimeout(() => {
      isCopied.value = false
    }, 3000)
  } catch (_) {
    toast.info('Código selecionado.')
  }
}

const isChecking = ref(false)

async function checkPaymentStatus() {
  isChecking.value = true
  toast.info('Verificando confirmação do pagamento no servidor...', 'Status')
  
  await consortiumStore.loadHomeData()
  
  if (contract.value && (contract.value.isAdesaoPaid || contract.value.status === 'active')) {
    isPaymentConfirmed.value = true
    toast.success('Pagamento da adesão confirmado com sucesso no servidor!', 'Parabéns!')
  } else {
    toast.info('Aguardando compensação do banco ou aprovação do gateway.', 'Pendente')
  }

  isChecking.value = false
}

function handleFinish() {
  router.push('/')
}
</script>

<template>
  <div class="payment-screen-wrapper">
    <!-- Top App Bar -->
    <header class="appbar-header">
      <button class="appbar-back-btn" aria-label="Voltar" @click="router.push('/')">
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
            <div class="plan-badge-row">
              <span class="plan-badge">Plano {{ contract?.totalInstallments || 80 }} meses</span>
              <span v-if="contract" class="quota-badge">Grupo {{ contract.groupNumber }} • Cota {{ contract.quotaNumber }}</span>
            </div>
          </div>
          <div class="amount-col">
            <span class="amount-label">Valor da Adesão</span>
            <span class="amount-val">{{ formatCurrency(adhesionAmount) }}</span>
          </div>
        </div>
      </section>

      <!-- 2. Method Tabs (PIX vs Boleto) -->
      <section class="method-selector-section">
        <div class="method-pill-tabs">
          <button
            type="button"
            class="method-pill-btn"
            :class="{ active: selectedMethod === 'PIX' }"
            @click="selectedMethod = 'PIX'"
          >
            <QrCode :size="18" />
            <span>PIX (Instantâneo)</span>
          </button>
          <button
            type="button"
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

              <rect x="8" y="52" width="6" height="6" fill="#263238" rx="1" />
              <rect x="18" y="52" width="12" height="6" fill="#263238" rx="1" />

              <rect x="36" y="66" width="8" height="8" fill="#263238" rx="1" />
              <rect x="48" y="66" width="6" height="6" fill="#263238" rx="1" />
              <rect x="58" y="66" width="8" height="8" fill="#263238" rx="1" />
              <rect x="70" y="66" width="6" height="6" fill="#263238" rx="1" />

              <rect x="36" y="78" width="14" height="6" fill="#263238" rx="1" />
              <rect x="54" y="78" width="10" height="6" fill="#263238" rx="1" />
              <rect x="68" y="78" width="8" height="8" fill="#263238" rx="1" />
              <rect x="80" y="78" width="12" height="6" fill="#263238" rx="1" />

              <rect x="76" y="48" width="6" height="12" fill="#263238" rx="1" />
              <rect x="86" y="48" width="6" height="6" fill="#263238" rx="1" />
              <rect x="86" y="58" width="6" height="6" fill="#263238" rx="1" />
            </svg>
          </div>
          <p class="qr-subtext">Aponte a câmera do seu aplicativo de banco para escanear</p>
        </div>

        <!-- Copy-Paste Section -->
        <div class="copy-paste-card">
          <label class="copy-paste-label">Ou copie o código PIX Copia e Cola:</label>
          <div class="copy-paste-input-row">
            <input
              type="text"
              readonly
              :value="pixCode"
              class="copy-paste-input"
              @focus="($event.target as HTMLInputElement).select()"
            />
            <button
              type="button"
              class="btn-copy"
              :class="{ 'btn-copied': isCopied }"
              @click="copyToClipboard(pixCode)"
            >
              <component :is="isCopied ? Check : Copy" :size="16" />
              <span>{{ isCopied ? 'Copiado!' : 'Copiar Código' }}</span>
            </button>
          </div>
        </div>

        <!-- Instructions Box -->
        <div class="instructions-box">
          <h3 class="instructions-title">Como pagar com PIX:</h3>
          <ol class="instructions-list">
            <li>Abra o aplicativo do seu banco no celular</li>
            <li>Selecione a opção <strong>PIX</strong> e depois <strong>PIX Copia e Cola</strong></li>
            <li>Cole o código copiado acima e confirme as informações</li>
            <li>Conclua o pagamento e aguarde a aprovação instantânea!</li>
          </ol>
        </div>
      </div>

      <!-- ── SECTION BOLETO ───────────────────────────────────────────────── -->
      <div v-else class="payment-body-box">
        <div class="boleto-banner">
          <div class="boleto-left">
            <FileText :size="24" color="#1976D2" />
            <div>
              <h3 class="boleto-title">Boleto Bancário Gerado</h3>
              <p class="boleto-sub">Vencimento em 3 dias úteis</p>
            </div>
          </div>
          <span class="boleto-pill">Aguardando Compensação</span>
        </div>

        <div class="barcode-graphic-card">
          <div class="barcode-bars">
            <div v-for="n in 36" :key="n" class="bar-line" :style="{ width: (n % 3 === 0 ? '3px' : n % 2 === 0 ? '2px' : '1px') }"></div>
          </div>
          <div class="barcode-number">{{ boletoLine }}</div>
        </div>

        <div class="copy-paste-card">
          <label class="copy-paste-label">Linha digitável do boleto:</label>
          <div class="copy-paste-input-row">
            <input
              type="text"
              readonly
              :value="boletoLine"
              class="copy-paste-input"
              @focus="($event.target as HTMLInputElement).select()"
            />
            <button
              type="button"
              class="btn-copy"
              :class="{ 'btn-copied': isCopied }"
              @click="copyToClipboard(boletoLine)"
            >
              <component :is="isCopied ? Check : Copy" :size="16" />
              <span>{{ isCopied ? 'Copiado!' : 'Copiar Linha' }}</span>
            </button>
          </div>
        </div>

        <div class="instructions-box">
          <h3 class="instructions-title">Como pagar o boleto:</h3>
          <ol class="instructions-list">
            <li>Copie a linha digitável acima ou utilize o código de barras</li>
            <li>Abra o app do seu banco e escolha <strong>Pagamentos > Boleto</strong></li>
            <li>Cole o código e confirme os dados</li>
            <li>A compensação bancária ocorre em até 3 dias úteis</li>
          </ol>
        </div>
      </div>

      <!-- ── Ações de Verificação / Conclusão ─────────────────────────────────── -->
      <div class="payment-actions-card">
        <button
          type="button"
          class="btn-simulate-success"
          :disabled="isChecking"
          @click="checkPaymentStatus"
        >
          <RefreshCw :size="18" :class="{ 'spin-icon': isChecking }" />
          <span>{{ isChecking ? 'VERIFICANDO NO SERVIDOR...' : 'VERIFICAR STATUS DO PAGAMENTO' }}</span>
        </button>

        <div class="security-guarantee">
          <ShieldCheck :size="16" color="#4CAF50" />
          <span>Ambiente 100% Criptografado e Seguro • Katari Consórcios</span>
        </div>
      </div>
    </main>

    <!-- ── Modal de Sucesso / Confirmação ─────────────────────────────────── -->
    <Transition name="success-modal">
      <div v-if="isPaymentConfirmed" class="success-overlay">
        <div class="success-modal-card">
          <div class="success-icon-circle">
            <CheckCircle2 :size="48" color="#FFFFFF" />
          </div>

          <h2 class="success-modal-title">
            <span>Adesão Confirmada!</span>
            <Sparkles :size="24" color="#FF6D00" />
          </h2>
          <p class="success-modal-desc">
            Parabéns! O pagamento da 1ª parcela (adesão) foi compensado. Sua cota está 100% ativa e todas as funcionalidades foram desbloqueadas.
          </p>

          <div class="success-contract-badge">
            <span>Grupo {{ contract?.groupNumber || '104' }}</span>
            <span>•</span>
            <span>Cota {{ contract?.quotaNumber || '042' }}</span>
          </div>

          <button type="button" class="btn-finish-flow" @click="handleFinish">
            ACESSAR MEU CONSÓRCIO
          </button>
        </div>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
.payment-screen-wrapper {
  min-height: 100vh;
  background-color: #F8F9FA;
  display: flex;
  flex-direction: column;
  font-family: 'Outfit', sans-serif;
}

/* ── App Bar ─────────────────────────────────────────────────────────────── */
.appbar-header {
  position: sticky;
  top: 0;
  z-index: 100;
  height: 60px;
  background-color: #FFFFFF;
  border-bottom: 1px solid #EEEEEE;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 16px;
}

.appbar-back-btn {
  background: none;
  border: none;
  cursor: pointer;
  padding: 8px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background-color 0.15s ease;
}

.appbar-back-btn:hover {
  background-color: #F5F5F5;
}

.appbar-title {
  font-size: 17px;
  font-weight: 700;
  color: #263238;
  margin: 0;
}

.appbar-spacer {
  width: 38px;
}

/* ── Main Container ──────────────────────────────────────────────────────── */
.payment-main-container {
  flex: 1;
  max-width: 680px;
  width: 100%;
  margin: 0 auto;
  padding: 24px 20px 60px 20px;
  display: flex;
  flex-direction: column;
  gap: 20px;
}

/* ── 1. Order Summary Card ───────────────────────────────────────────────── */
.order-summary-card {
  background-color: #FFFFFF;
  border: 1px solid #E0E0E0;
  border-radius: 18px;
  padding: 18px 20px;
  box-shadow: 0 4px 14px rgba(0, 0, 0, 0.04);
}

.summary-top-row {
  display: flex;
  align-items: center;
  gap: 16px;
}

.product-thumb-box {
  width: 64px;
  height: 52px;
  border-radius: 12px;
  background-color: #FAFAFA;
  overflow: hidden;
  border: 1px solid #EEEEEE;
  display: flex;
  align-items: center;
  justify-content: center;
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
  font-size: 16px;
  font-weight: 800;
  color: #263238;
  margin: 0;
}

.plan-badge-row {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.plan-badge {
  align-self: flex-start;
  background-color: #FFF3E0;
  color: #FF6D00;
  font-size: 11px;
  font-weight: 700;
  padding: 2px 8px;
  border-radius: 6px;
}

.quota-badge {
  font-size: 11px;
  color: #757575;
  font-weight: 600;
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
  font-size: 19px;
  font-weight: 900;
  color: #FF6D00;
}

/* ── 2. Method Selector Tabs ─────────────────────────────────────────────── */
.method-selector-section {
  display: flex;
}

.method-pill-tabs {
  width: 100%;
  display: flex;
  background-color: #EEEEEE;
  padding: 4px;
  border-radius: 14px;
  gap: 6px;
}

.method-pill-btn {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 12px;
  border: none;
  background: none;
  border-radius: 10px;
  font-size: 13.5px;
  font-weight: 700;
  color: #546E7A;
  cursor: pointer;
  transition: all 0.2s ease;
}

.method-pill-btn.active {
  background-color: #FFFFFF;
  color: #263238;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
}

/* ── 3. Payment Body Box ─────────────────────────────────────────────────── */
.payment-body-box {
  background-color: #FFFFFF;
  border: 1px solid #E0E0E0;
  border-radius: 20px;
  padding: 24px;
  box-shadow: 0 6px 18px rgba(0, 0, 0, 0.04);
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.countdown-banner {
  display: flex;
  justify-content: space-between;
  align-items: center;
  background-color: #FFF8E1;
  border: 1px solid #FFE082;
  border-radius: 12px;
  padding: 10px 16px;
}

.countdown-left {
  display: flex;
  align-items: center;
  gap: 8px;
}

.countdown-text {
  font-size: 13px;
  color: #5D4037;
}

.countdown-live-badge {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  font-weight: 700;
  color: #2E7D32;
}

.pulse-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background-color: #4CAF50;
  box-shadow: 0 0 6px #4CAF50;
  animation: pulse-live 1.5s infinite;
}

@keyframes pulse-live {
  0%, 100% { opacity: 1; transform: scale(1); }
  50% { opacity: 0.4; transform: scale(1.3); }
}

/* QR Code Box */
.qr-code-box {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  padding: 10px 0;
}

.qr-frame {
  width: 220px;
  height: 220px;
  padding: 14px;
  background-color: #FFFFFF;
  border: 2px dashed #CFD8DC;
  border-radius: 18px;
  box-shadow: 0 8px 20px rgba(0, 0, 0, 0.06);
}

.svg-qr-code {
  width: 100%;
  height: 100%;
}

.qr-subtext {
  font-size: 12.5px;
  color: #757575;
  margin: 0;
}

/* Copy-Paste Card */
.copy-paste-card {
  background-color: #F8F9FA;
  border: 1px solid #EEEEEE;
  border-radius: 14px;
  padding: 14px 16px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.copy-paste-label {
  font-size: 12px;
  font-weight: 700;
  color: #455A64;
}

.copy-paste-input-row {
  display: flex;
  gap: 8px;
}

.copy-paste-input {
  flex: 1;
  height: 42px;
  background-color: #FFFFFF;
  border: 1.5px solid #CFD8DC;
  border-radius: 10px;
  padding: 0 12px;
  font-size: 12px;
  color: #263238;
  font-family: monospace;
}

.btn-copy {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 0 16px;
  height: 42px;
  background: linear-gradient(135deg, #FF6D00 0%, #FF8F00 100%);
  border: none;
  border-radius: 10px;
  color: #FFFFFF;
  font-size: 12.5px;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.15s ease;
  white-space: nowrap;
}

.btn-copy:hover {
  transform: translateY(-1px);
  box-shadow: 0 3px 10px rgba(255, 109, 0, 0.3);
}

.btn-copy.btn-copied {
  background: #2E7D32;
}

/* Instructions */
.instructions-box {
  background-color: #FAFAFA;
  border-radius: 14px;
  padding: 16px 20px;
}

.instructions-title {
  font-size: 13.5px;
  font-weight: 800;
  color: #263238;
  margin: 0 0 10px 0;
}

.instructions-list {
  margin: 0;
  padding-left: 20px;
  font-size: 12.5px;
  color: #546E7A;
  line-height: 1.6;
}

/* Boleto Specific */
.boleto-banner {
  display: flex;
  justify-content: space-between;
  align-items: center;
  background-color: #E3F2FD;
  border: 1px solid #BBDEFB;
  border-radius: 12px;
  padding: 12px 16px;
}

.boleto-left {
  display: flex;
  align-items: center;
  gap: 12px;
}

.boleto-title {
  font-size: 14px;
  font-weight: 800;
  color: #0D47A1;
  margin: 0;
}

.boleto-sub {
  font-size: 12px;
  color: #1976D2;
  margin: 0;
}

.boleto-pill {
  font-size: 11px;
  font-weight: 700;
  background-color: #FFFFFF;
  color: #1565C0;
  padding: 4px 8px;
  border-radius: 6px;
}

.barcode-graphic-card {
  background-color: #FFFFFF;
  border: 1.5px solid #EEEEEE;
  border-radius: 14px;
  padding: 20px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
}

.barcode-bars {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  height: 48px;
}

.bar-line {
  height: 100%;
  background-color: #263238;
}

.barcode-number {
  font-size: 12px;
  font-family: monospace;
  letter-spacing: 1px;
  color: #546E7A;
}

/* Actions Card */
.payment-actions-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 14px;
}

.btn-simulate-success {
  width: 100%;
  height: 52px;
  background: linear-gradient(135deg, #2E7D32 0%, #388E3C 100%);
  border: none;
  border-radius: 14px;
  color: #FFFFFF;
  font-size: 14px;
  font-weight: 800;
  letter-spacing: 0.5px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  box-shadow: 0 6px 18px rgba(46, 125, 50, 0.28);
  transition: all 0.2s ease;
}

.btn-simulate-success:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 22px rgba(46, 125, 50, 0.38);
}

.security-guarantee {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: #757575;
}

/* Success Modal */
.success-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.7);
  backdrop-filter: blur(4px);
  z-index: 1000;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
}

.success-modal-card {
  background-color: #FFFFFF;
  border-radius: 24px;
  padding: 32px 24px;
  max-width: 440px;
  width: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  gap: 16px;
  box-shadow: 0 24px 48px rgba(0, 0, 0, 0.3);
  animation: scale-up 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.success-icon-circle {
  width: 76px;
  height: 76px;
  border-radius: 50%;
  background: linear-gradient(135deg, #2E7D32 0%, #4CAF50 100%);
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 10px 24px rgba(46, 125, 50, 0.35);
}

.success-modal-title {
  font-size: 22px;
  font-weight: 900;
  color: #263238;
  margin: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
}

.success-modal-desc {
  font-size: 14px;
  color: #546E7A;
  line-height: 1.5;
  margin: 0;
}

.success-contract-badge {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  background-color: #E8F5E9;
  color: #2E7D32;
  font-size: 13px;
  font-weight: 800;
  padding: 6px 14px;
  border-radius: 20px;
}

.btn-finish-flow {
  width: 100%;
  height: 52px;
  background: linear-gradient(135deg, #FF6D00 0%, #FF8F00 100%);
  border: none;
  border-radius: 14px;
  color: #FFFFFF;
  font-size: 15px;
  font-weight: 800;
  cursor: pointer;
  transition: all 0.2s ease;
  margin-top: 8px;
}

.btn-finish-flow:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 20px rgba(255, 109, 0, 0.35);
}

.success-modal-enter-active,
.success-modal-leave-active {
  transition: opacity 0.25s ease;
}

.success-modal-enter-from,
.success-modal-leave-to {
  opacity: 0;
}

@keyframes scale-up {
  0% { transform: scale(0.9); opacity: 0; }
  100% { transform: scale(1); opacity: 1; }
}
</style>
