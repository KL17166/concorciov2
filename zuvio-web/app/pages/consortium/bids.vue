<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useConsortiumStore } from '~/stores/consortium'
import { useBidStore } from '~/stores/bid'
import { formatCurrency } from '~~/shared/utils/currency'
import type { ActiveContract } from '~~/shared/types/catalog'
import {
  ArrowLeft,
  Info,
  Edit3,
  Lock,
  CreditCard,
  BarChart2,
  Package,
  CheckCircle2,
  AlertCircle,
  TrendingUp,
  ShieldCheck,
  X,
  History,
  ChevronDown,
  ChevronUp
} from 'lucide-vue-next'

definePageMeta({
  middleware: 'auth',
  hideHeader: true,
  alias: ['/bids']
})

const router = useRouter()
const consortiumStore = useConsortiumStore()
const bidStore = useBidStore()

// State
const bidPercentage = ref(30)
const selectedBidType = ref<0 | 1 | 2>(0) // 0 = Livre, 1 = Fixo, 2 = Embutido
const bidDestination = ref<'REDUCE_TERM' | 'REDUCE_INSTALLMENT'>('REDUCE_TERM')
const isConfirmModalOpen = ref(false)
const isHistoryOpen = ref(false)
const isSubmitting = ref(false)
const toastMessage = ref<{ type: 'success' | 'error'; text: string } | null>(null)

const contract = computed<ActiveContract | null>(() => {
  return consortiumStore.activeContracts[0] || null
})

onMounted(async () => {
  if (consortiumStore.activeContracts.length === 0) {
    await consortiumStore.loadHomeData()
  }
})

// Effective percentage based on modal selection
const effectivePercentage = computed(() => {
  switch (selectedBidType.value) {
    case 0:
      return bidPercentage.value
    case 1:
      return 25.0
    case 2:
      return 25.0
    default:
      return bidPercentage.value
  }
})

const creditValue = computed(() => {
  return contract.value?.creditValue || contract.value?.product?.price || 18500
})

const bidValue = computed(() => {
  return creditValue.value * (effectivePercentage.value / 100)
})

const installmentsFromBid = computed(() => {
  const nextPay = contract.value?.nextPaymentAmount || 289.90
  return nextPay > 0 ? Math.round(bidValue.value / nextPay) : 0
})

// Simulated reduced installment amount
const reducedInstallmentValue = computed(() => {
  const currentVal = contract.value?.nextPaymentAmount || 289.90
  const remaining = contract.value?.totalInstallments ? contract.value.totalInstallments - (contract.value.paidInstallments?.length || 0) : 68
  if (remaining <= 0) return currentVal
  const discountPerMonth = bidValue.value / remaining
  return Math.max(50, currentVal - discountPerMonth)
})

// Progress percentage for range slider background fill (5% to 50%)
const sliderProgressPct = computed(() => {
  const min = 5
  const max = 50
  const pct = ((bidPercentage.value - min) / (max - min)) * 100
  return `${pct}%`
})

// Competitiveness thermometer score
const competitiveness = computed(() => {
  const pct = effectivePercentage.value
  if (pct < 20) {
    return {
      level: 'BAIXA',
      color: '#FFA000',
      label: 'Competitividade Baixa',
      description: 'Lances abaixo de 20% costumam ter menor probabilidade nesta categoria.',
      badgeClass: 'orange'
    }
  } else if (pct <= 32) {
    return {
      level: 'MODERADA',
      color: '#1976D2',
      label: 'Competitividade Média',
      description: 'Dentro da faixa média histórica dos contemplados deste grupo.',
      badgeClass: 'blue'
    }
  } else {
    return {
      level: 'ALTA',
      color: '#4CAF50',
      label: 'Alta Probabilidade 🔥',
      description: 'Acima da média de lances vencedores das últimas 3 assembleias!',
      badgeClass: 'green'
    }
  }
})

function getBidTypeLabel(): string {
  switch (selectedBidType.value) {
    case 0:
      return 'LIVRE'
    case 1:
      return 'FIXO 25%'
    case 2:
      return 'EMBUTIDO 25%'
    default:
      return ''
  }
}

// Detailed financial explanation of each modality
const modalityDetails = computed(() => {
  if (selectedBidType.value === 0) {
    return {
      title: 'Lance Livre',
      badge: 'Recursos Próprios',
      badgeColor: '#E65100',
      badgeBg: '#FFF3E0',
      explanation: 'Você escolhe a porcentagem. Se for contemplado, você paga este valor com seu próprio dinheiro (PIX/Boleto) e o montante quita parcelas do seu plano.',
      cashOutflow: formatCurrency(bidValue.value),
      netCredit: formatCurrency(creditValue.value),
      isEmbedded: false
    }
  } else if (selectedBidType.value === 1) {
    return {
      title: 'Lance Fixo (25%)',
      badge: 'Recursos Próprios',
      badgeColor: '#1565C0',
      badgeBg: '#E3F2FD',
      explanation: 'Percentual fixado em 25% pela administradora. Se for contemplado, você paga o valor do lance com recursos próprios e amortiza parcelas do plano.',
      cashOutflow: formatCurrency(bidValue.value),
      netCredit: formatCurrency(creditValue.value),
      isEmbedded: false
    }
  } else {
    return {
      title: 'Lance Embutido (25%)',
      badge: 'R$ 0 do seu bolso',
      badgeColor: '#7B1FA2',
      badgeBg: '#F3E5F5',
      explanation: 'Você NÃO precisa desembolsar dinheiro do bolso! O valor do lance é descontado diretamente da sua carta de crédito na contemplação, quitando parcelas automaticamente.',
      cashOutflow: 'R$ 0,00 (Sem desembolso)',
      netCredit: formatCurrency(Math.max(0, creditValue.value - bidValue.value)),
      isEmbedded: true
    }
  }
})

function openConfirmationModal() {
  isConfirmModalOpen.value = true
}

async function handleConfirmBid() {
  if (!contract.value) return

  isSubmitting.value = true
  toastMessage.value = null

  const bidTypeKey = selectedBidType.value === 0 ? 'FREE' : 'FIXED'

  try {
    const res = await bidStore.submitBid({
      subscriptionId: contract.value.id,
      amount: bidValue.value,
      percentage: effectivePercentage.value,
      type: bidTypeKey
    })

    isConfirmModalOpen.value = false

    if (res.success) {
      toastMessage.value = {
        type: 'success',
        text: `Lance de ${effectivePercentage.value.toFixed(1)}% (${formatCurrency(bidValue.value)}) registrado com sucesso na próxima assembleia!`
      }
    } else {
      toastMessage.value = {
        type: 'error',
        text: res.message || 'Erro ao registrar lance'
      }
    }
  } catch (err: any) {
    toastMessage.value = {
      type: 'error',
      text: err?.message || 'Erro ao registrar lance'
    }
  } finally {
    isSubmitting.value = false
  }
}
</script>

<template>
  <div class="bids-screen-wrapper">
    <!-- Top App Bar -->
    <header class="bids-appbar">
      <button class="appbar-back-btn" aria-label="Voltar" @click="router.back()">
        <ArrowLeft :size="22" color="#263238" />
      </button>
      <h1 class="appbar-title">Ofertar Lance</h1>
      <div class="appbar-spacer"></div>
    </header>

    <div v-if="contract" class="bids-main-container">
      <!-- 1. Header Card with Product & Contract Info (Fiel ao Flutter) -->
      <div class="bid-header-card">
        <div class="bid-product-meta-row">
          <img
            v-if="contract.product?.imageUrl"
            :src="contract.product.imageUrl"
            :alt="contract.product.name"
            class="bid-product-thumb"
          />
          <div v-else class="bid-product-thumb placeholder">
            <Package :size="24" color="#9E9E9E" />
          </div>

          <div class="bid-product-details">
            <div class="bid-product-name">{{ contract.product?.name || 'Consórcio Moto' }}</div>
            <div class="bid-contract-badges">
              <span class="bid-group-badge">Grupo {{ contract.groupNumber }}</span>
              <span class="bid-quota-badge">Cota {{ contract.quotaNumber }}</span>
            </div>
          </div>
        </div>

        <div class="bid-credit-summary-row">
          <div class="credit-col">
            <span class="bid-credit-label">Saldo Crédito</span>
            <span class="bid-credit-amount">{{ formatCurrency(creditValue) }}</span>
          </div>

          <div class="adhesion-info-pill">
            <Info :size="15" color="#FF6D00" />
            <span>Lance antecipa parcelas</span>
          </div>
        </div>
      </div>

      <!-- 2. Modalidade Selection Cards (Fiel ao Flutter com tema Laranja vibrante no ativo) -->
      <div class="section-container">
        <h2 class="section-title">Selecione a Modalidade</h2>
        <div class="bid-modalities-carousel">
          <!-- Livre -->
          <div
            class="modality-card"
            :class="{ active: selectedBidType === 0 }"
            @click="selectedBidType = 0"
          >
            <div class="modality-icon-circle" :class="{ active: selectedBidType === 0 }">
              <Edit3 :size="20" :color="selectedBidType === 0 ? '#FFFFFF' : '#757575'" />
            </div>
            <span class="modality-title">Lance Livre</span>
            <span class="modality-subtitle">Escolha o valor</span>
          </div>

          <!-- Fixo 25% -->
          <div
            class="modality-card"
            :class="{ active: selectedBidType === 1 }"
            @click="selectedBidType = 1"
          >
            <div class="modality-icon-circle" :class="{ active: selectedBidType === 1 }">
              <Lock :size="20" :color="selectedBidType === 1 ? '#FFFFFF' : '#757575'" />
            </div>
            <span class="modality-title">Lance Fixo</span>
            <span class="modality-subtitle">25% do crédito</span>
          </div>

          <!-- Embutido 25% -->
          <div
            class="modality-card"
            :class="{ active: selectedBidType === 2 }"
            @click="selectedBidType = 2"
          >
            <div class="modality-icon-circle" :class="{ active: selectedBidType === 2 }">
              <CreditCard :size="20" :color="selectedBidType === 2 ? '#FFFFFF' : '#757575'" />
            </div>
            <span class="modality-title">Embutido</span>
            <span class="modality-subtitle">Até 25% do crédito</span>
          </div>
        </div>
      </div>

      <!-- 3. Calculator & Range Card (Fiel ao Flutter) -->
      <div class="bid-calc-card">
        <div class="calc-header-row">
          <span class="calc-title">Valor do Lance</span>
          <div class="calc-installments-pill">
            ~{{ installmentsFromBid }} parcelas
          </div>
        </div>

        <!-- Dynamic Badge based on bid type -->
        <div class="bid-type-chip-wrap">
          <div
            class="bid-type-chip"
            :class="{
              'orange-theme': selectedBidType === 0,
              'blue-theme': selectedBidType === 1,
              'purple-theme': selectedBidType === 2
            }"
          >
            {{ getBidTypeLabel() }}
          </div>
        </div>

        <div class="bid-calc-pct">{{ effectivePercentage.toFixed(0) }}%</div>
        <div class="bid-calc-currency">{{ formatCurrency(bidValue) }}</div>

        <!-- Special Note for Embutido -->
        <div v-if="selectedBidType === 2" class="embutido-notice">
          Valor será descontado do seu crédito
        </div>

        <!-- Interactive Range Slider (Only for Livre) -->
        <div v-if="selectedBidType === 0" class="bid-slider-container">
          <input
            v-model.number="bidPercentage"
            type="range"
            min="5"
            max="50"
            step="1"
            class="bid-range-slider"
            :style="{
              '--slider-progress': sliderProgressPct
            }"
          />
          <div class="slider-limits-row">
            <span>5% (Mínimo)</span>
            <span>50% (Máximo)</span>
          </div>
        </div>

        <!-- Fixed Percentage Info -->
        <div v-else class="fixed-type-description">
          {{ selectedBidType === 1 ? 'Percentual fixo de 25%' : 'Até 25% descontado do valor do crédito' }}
        </div>
      </div>

      <!-- ── 4. Unified Group Stats & Competitiveness Banner ───────────── -->
      <div class="bid-unified-stats-card">
        <div class="unified-stats-top-row">
          <div class="stats-left-info">
            <div class="stats-icon-circle">
              <BarChart2 :size="18" color="#1565C0" />
            </div>
            <div class="stats-text-col">
              <span class="stats-label">Média de lances do grupo</span>
              <div class="stats-value-line">
                <span class="stats-highlight">32.5%</span>
                <span class="stats-sub">neste mês</span>
              </div>
            </div>
          </div>

          <div
            class="comp-badge-pill"
            :style="{
              backgroundColor: competitiveness.color + '18',
              color: competitiveness.color,
              borderColor: competitiveness.color + '35'
            }"
          >
            <TrendingUp :size="14" />
            <span>{{ competitiveness.level }}</span>
          </div>
        </div>

        <div class="unified-stats-divider"></div>

        <div class="unified-stats-bottom-row">
          <span class="comp-label-lead" :style="{ color: competitiveness.color }">
            {{ competitiveness.label }}:
          </span>
          <span class="comp-desc-text">{{ competitiveness.description }}</span>
        </div>
      </div>

      <!-- ── 6. INCREMENTO: Simulador de Amortização (Prazo vs Valor) ────── -->
      <div class="amortization-choice-card">
        <h3 class="choice-title">Como deseja abater seu lance caso contemplado?</h3>
        <div class="choice-buttons-grid">
          <div
            class="choice-btn"
            :class="{ active: bidDestination === 'REDUCE_TERM' }"
            @click="bidDestination = 'REDUCE_TERM'"
          >
            <div class="choice-radio" :class="{ active: bidDestination === 'REDUCE_TERM' }"></div>
            <div class="choice-texts">
              <span class="choice-name">Reduzir Prazo</span>
              <span class="choice-impact">Abate ~{{ installmentsFromBid }} parcelas finais</span>
            </div>
          </div>

          <div
            class="choice-btn"
            :class="{ active: bidDestination === 'REDUCE_INSTALLMENT' }"
            @click="bidDestination = 'REDUCE_INSTALLMENT'"
          >
            <div class="choice-radio" :class="{ active: bidDestination === 'REDUCE_INSTALLMENT' }"></div>
            <div class="choice-texts">
              <span class="choice-name">Reduzir Parcela</span>
              <span class="choice-impact">Parcela cai para {{ formatCurrency(reducedInstallmentValue) }}</span>
            </div>
          </div>
        </div>
      </div>

      <!-- ── 7. INCREMENTO: Sanduíche de Histórico de Lances Anteriores ──── -->
      <div class="sandwich-accordion-card">
        <div class="sandwich-header" @click="isHistoryOpen = !isHistoryOpen">
          <div class="sandwich-header-left">
            <div class="sandwich-icon-wrap blue">
              <History :size="20" color="#2196F3" />
            </div>
            <div class="sandwich-header-texts">
              <h3 class="sandwich-title">Histórico de Lances e Assembleias</h3>
              <span class="sandwich-subtitle">Próxima assembleia: 15/09/2026</span>
            </div>
          </div>
          <div class="sandwich-toggle-indicator">
            <span class="toggle-text">{{ isHistoryOpen ? 'Recolher' : 'Ver' }}</span>
            <component :is="isHistoryOpen ? ChevronUp : ChevronDown" :size="20" color="#757575" />
          </div>
        </div>

        <div v-if="isHistoryOpen" class="sandwich-content-body">
          <div class="history-list">
            <div class="history-item">
              <div class="history-date">Assembleia 15/08/2026</div>
              <div class="history-details">
                <span class="history-bid">Lance Livre: 28% (R$ 5.180,00)</span>
                <span class="history-status pending">Não contemplado (Vencedor: 34%)</span>
              </div>
            </div>
            <div class="history-item">
              <div class="history-date">Assembleia 15/07/2026</div>
              <div class="history-details">
                <span class="history-bid">Lance Fixo: 25% (R$ 4.625,00)</span>
                <span class="history-status pending">Não contemplado no sorteio</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Disclaimer (Fiel ao Flutter) -->
      <div class="bid-disclaimer">
        Atenção: O valor do lance só será cobrado caso você seja contemplado.
      </div>

      <!-- Toast Feedback -->
      <div
        v-if="toastMessage"
        class="modal-error-banner"
        :style="{
          backgroundColor: toastMessage.type === 'success' ? '#E8F5E9' : '#FFEBEE',
          color: toastMessage.type === 'success' ? '#2E7D32' : '#D32F2F',
          margin: '0 20px 16px 20px'
        }"
      >
        <component :is="toastMessage.type === 'success' ? CheckCircle2 : AlertCircle" :size="16" />
        <span>{{ toastMessage.text }}</span>
      </div>

      <!-- 8. Submit Button -->
      <button
        class="bid-confirm-btn"
        :disabled="isSubmitting"
        @click="openConfirmationModal"
      >
        <span>CONFIRMAR OFERTA</span>
      </button>
    </div>

    <!-- ── Confirmation Bottom Sheet Modal ──────────────────────────────── -->
    <div v-if="isConfirmModalOpen" class="modal-overlay" @click.self="isConfirmModalOpen = false">
      <div class="modal-bottom-sheet">
        <div class="modal-handle"></div>

        <div class="modal-header-row">
          <h2 class="modal-title">Confirmar Oferta de Lance</h2>
          <button class="modal-close-btn" @click="isConfirmModalOpen = false">
            <X :size="20" color="#757575" />
          </button>
        </div>

        <p class="modal-subtitle">
          Revise os detalhes do lance antes de registrar sua oferta para a assembleia de <strong>15/09/2026</strong>:
        </p>

        <!-- ── Modality Explanation Card ── -->
        <div
          class="modal-modality-info-box"
          :style="{
            backgroundColor: modalityDetails.badgeBg,
            borderColor: modalityDetails.badgeColor + '40'
          }"
        >
          <div class="modal-info-top">
            <span class="modal-info-title" :style="{ color: modalityDetails.badgeColor }">
              {{ modalityDetails.title }}
            </span>
            <span
              class="modal-info-badge"
              :style="{ backgroundColor: modalityDetails.badgeColor, color: '#FFFFFF' }"
            >
              {{ modalityDetails.badge }}
            </span>
          </div>
          <p class="modal-info-text">{{ modalityDetails.explanation }}</p>
        </div>

        <div class="modal-calc-rows">
          <div class="calc-row">
            <span class="calc-label">Modalidade</span>
            <span class="calc-val">{{ getBidTypeLabel() }}</span>
          </div>
          <div class="calc-row">
            <span class="calc-label">Percentual Ofertado</span>
            <span class="calc-val highlight-orange">{{ effectivePercentage.toFixed(1) }}%</span>
          </div>
          <div class="calc-row">
            <span class="calc-label">Valor Equivalente do Lance</span>
            <span class="calc-val highlight-orange">{{ formatCurrency(bidValue) }}</span>
          </div>
          <div class="calc-row">
            <span class="calc-label">Desembolso do seu bolso</span>
            <span class="calc-val" :class="{ 'highlight-purple': modalityDetails.isEmbedded, 'highlight-orange': !modalityDetails.isEmbedded }">
              {{ modalityDetails.cashOutflow }}
            </span>
          </div>
          <div class="calc-row">
            <span class="calc-label">Crédito Líquido na Liberação</span>
            <span class="calc-val">{{ modalityDetails.netCredit }}</span>
          </div>
          <div class="calc-row">
            <span class="calc-label">Destino do Abatimento</span>
            <span class="calc-val">
              {{ bidDestination === 'REDUCE_TERM' ? 'Reduzir Prazo (~' + installmentsFromBid + ' parcelas)' : 'Reduzir Parcela (para ' + formatCurrency(reducedInstallmentValue) + ')' }}
            </span>
          </div>
        </div>

        <div class="confirmation-notice">
          <ShieldCheck :size="18" color="#4CAF50" />
          <span>{{ modalityDetails.isEmbedded ? 'Sem desembolso! O lance é descontado do crédito apenas na contemplação.' : 'Nenhum pagamento é feito agora. Você só pagará se for contemplado.' }}</span>
        </div>

        <button
          class="modal-submit-btn"
          :disabled="isSubmitting"
          @click="handleConfirmBid"
        >
          <span v-if="!isSubmitting">REGISTRAR LANCE AGORA</span>
          <span v-else>ENVIANDO...</span>
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* ── 1. Top Header Card (Matching Flutter) ──────────────────────────────── */
.bid-header-card {
  background-color: #FFFFFF;
  border-bottom: 1px solid var(--color-border, #E0E0E0);
  border-radius: 0 0 20px 20px;
  padding: 20px;
  margin-bottom: 24px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.03);
}

.bid-product-meta-row {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 14px;
  background-color: var(--color-surface-variant, #F8F8F8);
  border: 1px solid var(--color-border, #E0E0E0);
  border-radius: 16px;
  margin-bottom: 20px;
}

.bid-product-thumb {
  width: 56px;
  height: 56px;
  border-radius: 12px;
  object-fit: cover;
  flex-shrink: 0;
}

.bid-product-thumb.placeholder {
  background-color: #EEEEEE;
  display: flex;
  align-items: center;
  justify-content: center;
}

.bid-product-details {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.bid-product-name {
  font-size: 15px;
  font-weight: 700;
  color: var(--color-secondary, #263238);
}

.bid-contract-badges {
  display: flex;
  gap: 6px;
}

.bid-group-badge,
.bid-quota-badge {
  font-size: 11px;
  font-weight: 600;
  padding: 2px 8px;
  border-radius: 6px;
  background-color: #F0F0F0;
  border: 1px solid #E0E0E0;
  color: var(--color-text-muted, #616161);
}

.bid-credit-summary-row {
  display: flex;
  justify-content: space-between;
  align-items: flex-end;
  padding-top: 4px;
}

.credit-col {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.bid-credit-label {
  font-size: 13px;
  color: var(--color-text-muted, #757575);
  font-weight: 500;
}

.bid-credit-amount {
  font-size: 24px;
  font-weight: 800;
  color: var(--color-secondary, #263238);
  line-height: 1;
}

.adhesion-info-pill {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  border-radius: 20px;
  background-color: rgba(255, 109, 0, 0.1);
  color: var(--color-primary, #FF6D00);
  font-size: 12px;
  font-weight: 700;
}

/* ── 2. Modalities Section ──────────────────────────────────────────────── */
.section-container {
  padding: 0 20px;
  margin-bottom: 24px;
}

.section-title {
  font-size: 16px;
  font-weight: 700;
  color: var(--color-secondary, #263238);
  margin-bottom: 14px;
}

.bid-modalities-carousel {
  display: grid;
  grid-template-columns: 1fr 1fr 1fr;
  gap: 10px;
}

.modality-card {
  background-color: #FFFFFF;
  border: 1.5px solid var(--color-border, #E0E0E0);
  border-radius: 16px;
  padding: 16px 10px;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 8px;
  cursor: pointer;
  transition: all 0.2s ease;
  user-select: none;
}

.modality-card.active {
  background-color: var(--color-primary, #FF6D00);
  border-color: var(--color-primary, #FF6D00);
  box-shadow: 0 4px 14px rgba(255, 109, 0, 0.35);
  transform: translateY(-2px);
}

.modality-icon-circle {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  background-color: #F5F5F5;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s ease;
}

.modality-icon-circle.active {
  background-color: rgba(255, 255, 255, 0.25);
}

.modality-title {
  font-size: 13.5px;
  font-weight: 700;
  color: var(--color-secondary, #263238);
}

.modality-card.active .modality-title {
  color: #FFFFFF;
}

.modality-subtitle {
  font-size: 11px;
  color: var(--color-text-muted, #757575);
}

.modality-card.active .modality-subtitle {
  color: rgba(255, 255, 255, 0.85);
}

/* ── 3. Calculator Card Details ─────────────────────────────────────────── */
.bid-calc-card {
  margin: 0 20px 24px 20px;
  background-color: #FFFFFF;
  border: 1px solid var(--color-border, #E0E0E0);
  border-radius: 20px;
  padding: 24px;
  text-align: center;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.04);
}

.calc-header-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.calc-title {
  font-size: 15px;
  font-weight: 600;
  color: #616161;
}

.calc-installments-pill {
  padding: 4px 10px;
  border-radius: 8px;
  background-color: rgba(76, 175, 80, 0.1);
  color: #2E7D32;
  font-size: 12px;
  font-weight: 700;
}

.bid-type-chip-wrap {
  display: flex;
  justify-content: center;
  margin-bottom: 8px;
}

.bid-type-chip {
  padding: 4px 14px;
  border-radius: 20px;
  font-size: 12px;
  font-weight: 800;
  letter-spacing: 0.5px;
}

.bid-type-chip.orange-theme {
  background-color: #FFF3E0;
  border: 1px solid #FFE0B2;
  color: #E65100;
}

.bid-type-chip.blue-theme {
  background-color: #E3F2FD;
  border: 1px solid #BBDEFB;
  color: #1565C0;
}

.bid-type-chip.purple-theme {
  background-color: #F3E5F5;
  border: 1px solid #E1BEE7;
  color: #7B1FA2;
}

.bid-calc-pct {
  font-size: 48px;
  font-weight: 800;
  color: var(--color-primary, #FF6D00);
  margin: 6px 0;
  letter-spacing: -1px;
}

.bid-calc-currency {
  font-size: 20px;
  font-weight: 700;
  color: var(--color-secondary, #263238);
}

.embutido-notice {
  font-size: 12px;
  color: #8E24AA;
  font-style: italic;
  margin-top: 6px;
}

.bid-slider-container {
  padding: 16px 0 0 0;
}

.slider-limits-row {
  display: flex;
  justify-content: space-between;
  font-size: 11px;
  color: #9E9E9E;
  margin-top: 6px;
}

.fixed-type-description {
  font-size: 13px;
  color: #757575;
  margin-top: 12px;
}

/* ── 4. Unified Group Stats & Competitiveness Card ──────────────────────── */
.bid-unified-stats-card {
  margin: 0 20px 24px 20px;
  background-color: #FFFFFF;
  border: 1px solid var(--color-border, #E0E0E0);
  border-radius: 18px;
  padding: 16px 18px;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.04);
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.unified-stats-top-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
}

.stats-left-info {
  display: flex;
  align-items: center;
  gap: 12px;
}

.stats-icon-circle {
  width: 40px;
  height: 40px;
  border-radius: 12px;
  background-color: #E3F2FD;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.stats-text-col {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.stats-label {
  font-size: 11.5px;
  color: #757575;
  font-weight: 600;
}

.stats-value-line {
  display: flex;
  align-items: baseline;
  gap: 6px;
}

.stats-highlight {
  font-size: 18px;
  font-weight: 800;
  color: #1565C0;
}

.stats-sub {
  font-size: 11.5px;
  color: #9E9E9E;
}

.comp-badge-pill {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 11.5px;
  font-weight: 800;
  padding: 6px 12px;
  border-radius: 20px;
  border: 1px solid transparent;
  white-space: nowrap;
}

.unified-stats-divider {
  height: 1px;
  background-color: #F0F0F0;
}

.unified-stats-bottom-row {
  display: flex;
  align-items: baseline;
  gap: 6px;
  font-size: 12.5px;
  line-height: 1.4;
}

.comp-label-lead {
  font-weight: 800;
  flex-shrink: 0;
}

.comp-desc-text {
  color: #546E7A;
}

/* ── 6. Amortization Choice Card ────────────────────────────────────────── */
.amortization-choice-card {
  margin: 0 20px 24px 20px;
  background-color: #FFFFFF;
  border: 1px solid var(--color-border, #E0E0E0);
  border-radius: 16px;
  padding: 18px;
}

.choice-title {
  font-size: 14px;
  font-weight: 700;
  color: var(--color-secondary, #263238);
  margin: 0 0 12px 0;
}

.choice-buttons-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
}

.choice-btn {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 12px;
  border-radius: 12px;
  border: 1.5px solid var(--color-border, #E0E0E0);
  background-color: #FAFAFA;
  cursor: pointer;
  transition: all 0.2s ease;
}

.choice-btn.active {
  border-color: var(--color-primary, #FF6D00);
  background-color: rgba(255, 109, 0, 0.05);
}

.choice-radio {
  width: 16px;
  height: 16px;
  border-radius: 50%;
  border: 2px solid #B0BEC5;
  margin-top: 2px;
  flex-shrink: 0;
}

.choice-radio.active {
  border-color: var(--color-primary, #FF6D00);
  background-color: var(--color-primary, #FF6D00);
  box-shadow: inset 0 0 0 3px #FFFFFF;
}

.choice-texts {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.choice-name {
  font-size: 13px;
  font-weight: 700;
  color: var(--color-secondary, #263238);
}

.choice-impact {
  font-size: 11px;
  color: var(--color-text-muted, #757575);
}

/* ── 7. History List Accordion ──────────────────────────────────────────── */
.sandwich-accordion-card {
  margin: 0 20px 24px 20px;
  background-color: #FFFFFF;
  border: 1px solid var(--color-border, #E0E0E0);
  border-radius: 16px;
  overflow: hidden;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.03);
}

.history-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding-top: 10px;
}

.history-item {
  background-color: #FFFFFF;
  border: 1px solid #ECEFF1;
  border-radius: 10px;
  padding: 10px 12px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.history-date {
  font-size: 12px;
  font-weight: 700;
  color: #1976D2;
}

.history-details {
  display: flex;
  justify-content: space-between;
  font-size: 12px;
}

.history-bid {
  font-weight: 600;
  color: #263238;
}

.history-status.pending {
  color: #757575;
}

/* ── 8. Disclaimer & Action Button ──────────────────────────────────────── */
.bid-disclaimer {
  padding: 0 24px;
  font-size: 13px;
  color: #9E9E9E;
  text-align: center;
  font-style: italic;
  margin-bottom: 28px;
}

.bid-confirm-btn {
  margin: 0 20px 40px 20px;
  width: calc(100% - 40px);
  height: 56px;
  border-radius: 16px;
  background-color: var(--color-primary, #FF6D00);
  color: #FFFFFF;
  border: none;
  font-size: 16px;
  font-weight: 700;
  letter-spacing: 0.5px;
  cursor: pointer;
  box-shadow: 0 4px 14px rgba(255, 109, 0, 0.35);
  transition: background 0.2s ease, transform 0.15s ease;
}

.bid-confirm-btn:hover {
  background-color: #E65100;
  transform: translateY(-1px);
}

.bid-confirm-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

/* ── 9. Confirmation Modal ──────────────────────────────────────────────── */
.modal-subtitle {
  font-size: 14px;
  color: #616161;
  line-height: 1.4;
  margin: 0;
}

.modal-modality-info-box {
  border: 1px solid #E0E0E0;
  border-radius: 12px;
  padding: 12px 14px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.modal-info-top {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.modal-info-title {
  font-size: 13.5px;
  font-weight: 800;
}

.modal-info-badge {
  font-size: 11px;
  font-weight: 700;
  padding: 2px 8px;
  border-radius: 6px;
}

.modal-info-text {
  font-size: 12px;
  color: #424242;
  line-height: 1.4;
  margin: 0;
}

.highlight-orange {
  color: var(--color-primary, #FF6D00);
  font-weight: 800;
}

.highlight-purple {
  color: #7B1FA2;
  font-weight: 800;
}

.confirmation-notice {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 14px;
  border-radius: 10px;
  background-color: #E8F5E9;
  color: #2E7D32;
  font-size: 12.5px;
  font-weight: 600;
}
</style>
