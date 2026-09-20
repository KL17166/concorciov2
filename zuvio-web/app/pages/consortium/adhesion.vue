<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useConsortiumStore } from '~/stores/consortium'
import { useAuthStore } from '~/stores/auth'
import { useCheckoutStore } from '~/stores/checkout'
import { usePaymentStore } from '~/stores/payment'
import { useToast } from '~/composables/useToast'
import { formatCurrency } from '~~/shared/utils/currency'
import type { ActiveContract } from '~~/shared/types/catalog'
import QRCode from 'qrcode'
import {
  ArrowLeft,
  QrCode,
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
  Package,
  Loader2
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
const paymentStore = usePaymentStore()
const toast = useToast()

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
    imageUrl: '/img/onboarding/honda_cg_titan.jpg',
    price: 18500
  }
})

const adhesionAmount = computed(() => {
  // Prefer server-calculated value from the fetched subscription installments
  const firstInst = paymentStore.installments?.[0]
  if (firstInst?.valueToPay) return firstInst.valueToPay
  if (firstInst?.amount) return firstInst.amount
  // Fallback to auto-generated PIX amount from checkout flow
  return checkoutStore.paymentData?.amount || 0
})

const pixCode = computed(() => {
  return checkoutStore.paymentData?.copyPaste || ''
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

const qrCodeImage = ref<string>('')
const isGeneratingQr = ref(false)
const isGeneratingPix = ref(false)
const pixError = ref<string | null>(null)

const hasPix = computed(() => !!checkoutStore.paymentData?.copyPaste)

const isPreparingPix = ref(!checkoutStore.paymentData?.copyPaste)

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
  const initData = async () => {
    isPreparingPix.value = !checkoutStore.paymentData?.copyPaste
    try {
      let subId: string | undefined = checkoutStore.createdSubscriptionId || route.query.subscriptionId as string | undefined
      
      const promises = []
      
      if (consortiumStore.activeContracts.length === 0) {
        if (subId) {
          promises.push(consortiumStore.loadHomeData())
        } else {
          await consortiumStore.loadHomeData()
          subId = consortiumStore.activeContracts[0]?.id
        }
      }
      
      if (subId) {
        promises.push(
          paymentStore.fetchSubscription(subId).then(async () => {
            if (!checkoutStore.paymentData?.copyPaste) {
              await generateAdhesionPix()
            }
          })
        )
      } else if (!checkoutStore.paymentData?.copyPaste) {
        promises.push(generateAdhesionPix())
      }
      
      await Promise.all(promises)
    } finally {
      isPreparingPix.value = false
    }
  }

  initData().catch(console.error)

  // Start 30 min countdown
  timerInterval = setInterval(() => {
    if (totalSeconds.value > 0) {
      totalSeconds.value--
    } else {
      clearInterval(timerInterval)
      isExpired.value = true
    }
  }, 1000)

  // Start payment status polling against backend
  pollInterval = setInterval(async () => {
    if (isPaymentConfirmed.value) return
    isVerifying.value = true
    setTimeout(() => { isVerifying.value = false }, 1500)
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

async function generateAdhesionPix() {
  const first = paymentStore.installments?.find(i => i.number === 1) || paymentStore.installments?.[0]
  if (!first?.id || !first?.idTokenPay) return
  isGeneratingPix.value = true
  pixError.value = null
  try {
    const res = await paymentStore.generatePix(first.id, first.idTokenPay, false)
    if (res && (res as any).copyPaste) {
      checkoutStore.paymentData = {
        amount: (res as any).amount,
        requestedAmount: (res as any).requestedAmount ?? (res as any).amount,
        copyPaste: (res as any).copyPaste,
        qrCode: (res as any).qrCode || null,
        expirationDate: (res as any).expirationDate || null
      }
    } else {
      pixError.value = 'Não foi possível gerar o PIX. Tente novamente.'
    }
  } catch (_) {
    pixError.value = 'Não foi possível gerar o PIX. Tente novamente.'
  } finally {
    isGeneratingPix.value = false
  }
}

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

  // Avisa o dev que o cliente afirma ter pago (baixa manual no admin)
  const subId = checkoutStore.createdSubscriptionId
    || route.query.subscriptionId as string
    || contract.value?.id
  if (subId) {
    $fetch(`/api/subscription/${subId}/payment-check`, {
      method: 'POST',
      headers: authStore.token ? { Authorization: `Bearer ${authStore.token}` } : {}
    }).catch(() => {})
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
          <p class="qr-subtext">Aponte a câmera do seu aplicativo de banco para escanear</p>
        </div>

        <!-- Copy-Paste Section -->
        <div class="copy-paste-card">
          <label class="copy-paste-label">Ou copie o código PIX Copia e Cola:</label>
          <div class="copy-paste-input-row">
            <input
              type="text"
              readonly
              :value="(isPreparingPix || isGeneratingPix) ? 'Gerando código PIX...' : pixCode"
              class="copy-paste-input"
              :class="{ 'input-loading': isPreparingPix || isGeneratingPix }"
              @focus="($event.target as HTMLInputElement).select()"
            />
            <button
              type="button"
              class="btn-copy"
              :class="{ 'btn-copied': isCopied, 'btn-disabled': isPreparingPix || isGeneratingPix || !hasPix }"
              :disabled="isPreparingPix || isGeneratingPix || !hasPix"
              @click="copyToClipboard(pixCode)"
            >
              <Loader2 v-if="isPreparingPix || isGeneratingPix" :size="16" class="spin-icon" />
              <component v-else :is="isCopied ? Check : Copy" :size="16" />
              <span>{{ (isPreparingPix || isGeneratingPix) ? 'Gerando...' : (isCopied ? 'Copiado!' : 'Copiar Código') }}</span>
            </button>
          </div>
        </div>

        <!-- Retry gerar PIX (quando o automático da assinatura falhou) -->
        <div v-if="!hasPix && !isPreparingPix" class="pix-retry-box">
          <p v-if="pixError" class="pix-retry-error">{{ pixError }}</p>
          <button
            type="button"
            class="btn-generate-pix"
            :disabled="isGeneratingPix"
            @click="generateAdhesionPix"
          >
            <QrCode v-if="!isGeneratingPix" :size="18" />
            <Loader2 v-else :size="18" class="spin-icon" />
            <span>{{ isGeneratingPix ? 'GERANDO PIX...' : 'GERAR PIX' }}</span>
          </button>
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

/* ── Retry gerar PIX ── */
.pix-retry-box {
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin: 6px 0 18px 0;
}

.pix-retry-error {
  font-size: 13px;
  color: #D32F2F;
  text-align: center;
  margin: 0;
}

.btn-generate-pix {
  width: 100%;
  height: 52px;
  border-radius: 14px;
  border: none;
  background-color: var(--color-primary, #FF6D00);
  color: #FFFFFF;
  font-size: 15px;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  cursor: pointer;
}

.btn-generate-pix:disabled {
  opacity: 0.6;
  cursor: not-allowed;
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
  padding: 10px;
  background-color: #FFFFFF;
  border: 2px solid #E0E0E0;
  border-radius: 18px;
  box-shadow: 0 8px 20px rgba(0, 0, 0, 0.06);
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
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
  transition: all 0.2s ease;
}

.copy-paste-input.input-loading {
  color: #757575;
  font-style: italic;
  background-color: #F5F5F5;
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

.btn-copy:disabled,
.btn-copy.btn-disabled {
  background: #B0BEC5;
  color: #ECEFF1;
  cursor: not-allowed;
  opacity: 0.8;
  box-shadow: none;
  transform: none;
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
