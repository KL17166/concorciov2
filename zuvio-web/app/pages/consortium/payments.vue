<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useConsortiumStore } from '~/stores/consortium'
import { useAuthStore } from '~/stores/auth'
import { usePaymentStore } from '~/stores/payment'
import { formatCurrency } from '~~/shared/utils/currency'
import type { ActiveContract } from '~~/shared/types/catalog'
import {
  ArrowLeft,
  CheckCircle,
  Clock,
  Hourglass,
  Calendar,
  CalendarCheck,
  Users,
  Ticket,
  ChevronDown,
  ChevronUp,
  Lock,
  AlertTriangle,
  QrCode,
  FileText,
  CreditCard,
  X,
  Sparkles,
  Zap,
  Layers,
  Folder,
  FolderOpen
} from 'lucide-vue-next'

definePageMeta({
  middleware: 'auth',
  hideHeader: true,
  alias: ['/payments']
})

const router = useRouter()
const consortiumStore = useConsortiumStore()
const authStore = useAuthStore()
const paymentStore = usePaymentStore()

// Filter Tab
const activeTab = ref<'ALL' | 'PENDING' | 'PAID' | 'FUTURE'>('ALL')

// Accordion Collapsible States (Sanduíches)
const isPaidAccordionOpen = ref(false)
const isFutureAccordionOpen = ref(true)
const openYearGroup = ref<string | null>('2025')

// Payment modal state
const isModalOpen = ref(false)
const selectedInstallmentNumber = ref<number | null>(null)
const selectedMethod = ref<'PIX' | 'BOLETO'>('PIX')
const isSubmitting = ref(false)
const isKycAlertOpen = ref(false)
const errorMessage = ref<string | null>(null)

// Primary contract for current user
const contract = computed<ActiveContract | null>(() => {
  return consortiumStore.activeContracts[0] || null
})

onMounted(async () => {
  if (consortiumStore.activeContracts.length === 0) {
    await consortiumStore.loadHomeData()
  }

  // Fetch full subscription from backend — server recalculates all monetary values
  const contractId = consortiumStore.activeContracts[0]?.id
  if (contractId) {
    await paymentStore.fetchSubscription(contractId)
  }
})

// Counts and indicators matching Flutter
const paidCount = computed(() => {
  if (!contract.value?.paidInstallments) return contract.value?.currentInstallment ? contract.value.currentInstallment - 1 : 0
  return contract.value.paidInstallments.length
})

const currentInstallmentIndex = computed(() => {
  if (!contract.value) return 1
  const total = contract.value.totalInstallments || 80
  const paidSet = new Set(contract.value.paidInstallments || [])
  for (let i = 1; i <= total; i++) {
    if (!paidSet.has(i)) return i
  }
  return total + 1
})

const hasPending = computed(() => {
  if (!contract.value) return false
  return paidCount.value < contract.value.totalInstallments
})

const remainingCount = computed(() => {
  if (!contract.value) return 0
  return Math.max(0, contract.value.totalInstallments - paidCount.value)
})

function formatDate(dateStr?: string | Date): string {
  if (!dateStr) return '15/09/2026'
  const d = new Date(dateStr)
  if (isNaN(d.getTime())) return String(dateStr)
  return d.toLocaleDateString('pt-BR')
}

function getInstallmentValue(installmentNumber: number): number {
  if (!contract.value) return 289.90
  if (contract.value.installmentValues && contract.value.installmentValues[installmentNumber]) {
    return contract.value.installmentValues[installmentNumber]!
  }
  return contract.value.nextPaymentAmount || 289.90
}

function getInstallmentDueDate(installmentNumber: number): string {
  if (!contract.value) return '15/09/2026'
  if (contract.value.installmentDueDates && contract.value.installmentDueDates[installmentNumber]) {
    return formatDate(contract.value.installmentDueDates[installmentNumber])
  }
  return '15/09/2026'
}

function getInstallmentYear(installmentNumber: number): string {
  if (!contract.value) return '2025'
  const rawDate = contract.value.installmentDueDates?.[installmentNumber]
  if (rawDate) {
    const d = new Date(rawDate)
    if (!isNaN(d.getTime())) return String(d.getFullYear())
  }
  return String(2024 + Math.floor((installmentNumber - 1) / 12))
}

function isPaid(installmentNumber: number): boolean {
  if (!contract.value?.paidInstallments) return installmentNumber < currentInstallmentIndex.value
  return contract.value.paidInstallments.includes(installmentNumber)
}

function isCurrent(installmentNumber: number): boolean {
  return !isPaid(installmentNumber) && installmentNumber === currentInstallmentIndex.value
}

function isFuture(installmentNumber: number): boolean {
  return !isPaid(installmentNumber) && installmentNumber > currentInstallmentIndex.value
}

// Categorized Lists for the Accordions
const paidInstallmentsList = computed(() => {
  if (!contract.value) return []
  const list: number[] = []
  for (let i = 1; i <= contract.value.totalInstallments; i++) {
    if (isPaid(i)) list.push(i)
  }
  return list
})

const futureInstallmentsList = computed(() => {
  if (!contract.value) return []
  const list: number[] = []
  for (let i = 1; i <= contract.value.totalInstallments; i++) {
    if (isFuture(i)) list.push(i)
  }
  return list
})

// Future installments grouped by Year (Sub-sanduíches)
const futureByYearGroups = computed(() => {
  const groups: Record<string, number[]> = {}
  for (const num of futureInstallmentsList.value) {
    const yr = getInstallmentYear(num)
    if (!groups[yr]) groups[yr] = []
    groups[yr].push(num)
  }
  return groups
})

const totalPaidAmountSum = computed(() => {
  let sum = 0
  for (const num of paidInstallmentsList.value) {
    sum += getInstallmentValue(num)
  }
  return sum
})

// Toggle year group sub-accordion
function toggleYearGroup(year: string) {
  if (openYearGroup.value === year) {
    openYearGroup.value = null
  } else {
    openYearGroup.value = year
  }
}

// Open Payment Modal
function openPaymentModal(installmentNumber: number) {
  if (authStore.user?.kycStatus === 'REJECTED') {
    isKycAlertOpen.value = true
    return
  }
  selectedInstallmentNumber.value = installmentNumber
  selectedMethod.value = 'PIX'
  isModalOpen.value = true
}

async function processPayment() {
  if (!contract.value || !selectedInstallmentNumber.value) return

  isSubmitting.value = true
  errorMessage.value = null

  try {
    const instId = contract.value.installmentIds?.[selectedInstallmentNumber.value] || `inst_${selectedInstallmentNumber.value}`
    const token = contract.value.installmentTokens?.[selectedInstallmentNumber.value] || `tok_${selectedInstallmentNumber.value}`

    if (selectedMethod.value === 'PIX') {
      await paymentStore.generatePix(instId, token)
    } else {
      await paymentStore.generateBoleto(instId, token)
    }

    isModalOpen.value = false
    router.push({
      path: '/payment',
      query: {
        method: selectedMethod.value,
        installment: selectedInstallmentNumber.value,
        contractId: contract.value.id
      }
    })
  } catch (err: any) {
    errorMessage.value = err?.message || 'Erro ao gerar pagamento. Tente novamente.'
  } finally {
    isSubmitting.value = false
  }
}
</script>

<template>
  <div class="business-page-wrapper">
    <!-- Top App Bar -->
    <header class="appbar-header">
      <button class="appbar-back-btn" aria-label="Voltar" @click="router.back()">
        <ArrowLeft :size="22" color="#263238" />
      </button>
      <h1 class="appbar-title">Pagamentos</h1>
      <div class="appbar-spacer"></div>
    </header>

    <!-- Guard: Adesão Não Paga -->
    <div v-if="contract && !contract.isAdesaoPaid" class="adhesion-guard-container">
      <div class="guard-lock-circle">
        <Lock :size="56" color="#FF6D00" />
      </div>
      <h2 class="guard-title">Funcionalidade Bloqueada</h2>
      <p class="guard-description">
        Para acessar seus pagamentos, é necessário pagar a adesão (1ª parcela) do consórcio.
      </p>
      <div class="guard-amount">
        {{ formatCurrency(getInstallmentValue(1)) }}
      </div>
      <button class="guard-pay-btn" @click="router.push('/consortium/adhesion')">
        <CreditCard :size="20" color="#FFFFFF" />
        <span>PAGAR ADESÃO AGORA</span>
      </button>
    </div>

    <!-- Main Payments View with Accordions (Sanduíches) -->
    <div v-else-if="contract" class="business-main-container">
      <!-- 1. Summary Header Card -->
      <div class="business-summary-card">
        <div class="summary-indicators-row">
          <!-- Pagas -->
          <div class="summary-stat-col" @click="activeTab = 'PAID'">
            <div class="stat-icon-circle green">
              <CheckCircle :size="22" color="#4CAF50" />
            </div>
            <span class="stat-number green">{{ paidCount }}</span>
            <span class="stat-label">Pagas</span>
          </div>

          <!-- Pendente -->
          <div class="summary-stat-col" @click="activeTab = 'PENDING'">
            <div class="stat-icon-circle orange">
              <Clock :size="22" color="#FF9800" />
            </div>
            <span class="stat-number orange">{{ hasPending ? currentInstallmentIndex : '-' }}</span>
            <span class="stat-label">Pendente</span>
          </div>

          <!-- Restantes -->
          <div class="summary-stat-col" @click="activeTab = 'FUTURE'">
            <div class="stat-icon-circle grey">
              <Hourglass :size="22" color="#9E9E9E" />
            </div>
            <span class="stat-number grey">{{ remainingCount }}</span>
            <span class="stat-label">Restantes</span>
          </div>
        </div>

        <div class="summary-divider"></div>

        <!-- Next Due Date Row -->
        <div class="summary-due-row">
          <CalendarCheck :size="20" color="#4CAF50" />
          <span class="due-text" :class="{ 'paid-off': !hasPending }">
            {{ hasPending ? `Próxima: ${formatDate(contract.dueDate)}` : 'Contrato Quitado' }}
          </span>
          <div v-if="hasPending" class="due-amount-pill">
            {{ formatCurrency(contract.nextPaymentAmount || 289.90) }}
          </div>
        </div>
      </div>

      <!-- 2. Consortium Info Cards (Grupo / Cota) -->
      <div class="consortium-meta-row">
        <!-- Grupo -->
        <div class="meta-card">
          <Users :size="20" color="#FF6D00" />
          <div class="meta-texts">
            <span class="meta-label">Grupo</span>
            <span class="meta-value">{{ contract.groupNumber }}</span>
          </div>
        </div>

        <!-- Cota -->
        <div class="meta-card">
          <Ticket :size="20" color="#FF6D00" />
          <div class="meta-texts">
            <span class="meta-label">Cota</span>
            <span class="meta-value">{{ contract.quotaNumber }}</span>
          </div>
        </div>
      </div>

      <!-- 3. Navigation Filter Tabs -->
      <div class="filter-pills-row">
        <button
          class="pill-btn"
          :class="{ active: activeTab === 'ALL' }"
          @click="activeTab = 'ALL'"
        >
          <Layers :size="15" />
          <span>Todas ({{ contract.totalInstallments }})</span>
        </button>
        <button
          class="pill-btn orange"
          :class="{ active: activeTab === 'PENDING' }"
          @click="activeTab = 'PENDING'"
        >
          <Clock :size="15" />
          <span>Pendente ({{ hasPending ? 1 : 0 }})</span>
        </button>
        <button
          class="pill-btn green"
          :class="{ active: activeTab === 'PAID' }"
          @click="activeTab = 'PAID'; isPaidAccordionOpen = true"
        >
          <CheckCircle :size="15" />
          <span>Pagas ({{ paidCount }})</span>
        </button>
        <button
          class="pill-btn blue"
          :class="{ active: activeTab === 'FUTURE' }"
          @click="activeTab = 'FUTURE'; isFutureAccordionOpen = true"
        >
          <Zap :size="15" />
          <span>Antecipar ({{ remainingCount - (hasPending ? 1 : 0) }})</span>
        </button>
      </div>

      <!-- ── SECTION A: PARCELA ATUAL / PENDENTE (HERO HIGHLIGHT) ──────────── -->
      <div
        v-if="(activeTab === 'ALL' || activeTab === 'PENDING') && hasPending"
        class="highlight-pending-section"
      >
        <div class="section-label-bar">
          <span class="label-badge orange">BOLA DA VEZ</span>
          <span class="section-title-sm">Parcela Pendente Atual</span>
        </div>

        <div
          class="hero-pending-card"
          @click="openPaymentModal(currentInstallmentIndex)"
        >
          <div class="pending-card-top">
            <div class="pending-number-badge">
              {{ currentInstallmentIndex }}
            </div>
            <div class="pending-details">
              <div class="pending-title">
                {{ currentInstallmentIndex === 1 ? 'Adesão (1ª Parcela)' : `Parcela ${currentInstallmentIndex} de ${contract.totalInstallments}` }}
              </div>
              <div class="pending-due">
                Vence em {{ getInstallmentDueDate(currentInstallmentIndex) }}
              </div>
            </div>
            <div class="pending-amount-box">
              <span class="pending-price">{{ formatCurrency(getInstallmentValue(currentInstallmentIndex)) }}</span>
              <span class="pending-status-chip">Pendente</span>
            </div>
          </div>

          <div class="pending-card-action">
            <button class="btn-pay-now-hero">
              <CreditCard :size="18" />
              <span>PAGAR ESTA PARCELA</span>
            </button>
          </div>
        </div>
      </div>

      <!-- ── SECTION B: SANDUÍCHE DE PARCELAS PAGAS (ACCORDION) ─────────────── -->
      <div
        v-if="activeTab === 'ALL' || activeTab === 'PAID'"
        class="sandwich-accordion-card green-theme"
      >
        <!-- Accordion Header Toggle -->
        <div
          class="sandwich-header"
          @click="isPaidAccordionOpen = !isPaidAccordionOpen"
        >
          <div class="sandwich-header-left">
            <div class="sandwich-icon-wrap green">
              <CheckCircle :size="20" color="#4CAF50" />
            </div>
            <div class="sandwich-header-texts">
              <h3 class="sandwich-title">
                Parcelas Pagas ({{ paidInstallmentsList.length }} de {{ contract.totalInstallments }})
              </h3>
              <span class="sandwich-subtitle">
                Total acumulado: {{ formatCurrency(totalPaidAmountSum) }}
              </span>
            </div>
          </div>

          <div class="sandwich-toggle-indicator">
            <span class="toggle-text">{{ isPaidAccordionOpen ? 'Recolher' : 'Expandir' }}</span>
            <component
              :is="isPaidAccordionOpen ? ChevronUp : ChevronDown"
              :size="20"
              color="#4CAF50"
            />
          </div>
        </div>

        <!-- Accordion Content -->
        <div v-if="isPaidAccordionOpen" class="sandwich-content-body">
          <div class="installments-inner-list">
            <div
              v-for="idx in paidInstallmentsList"
              :key="idx"
              class="installment-card is-paid"
            >
              <div class="installment-number-box paid">{{ idx }}</div>
              <div class="installment-details-col">
                <div class="installment-title">
                  {{ idx === 1 ? 'Adesão (1ª Parcela)' : `Parcela ${idx} de ${contract.totalInstallments}` }}
                </div>
                <div class="installment-due-date">Venc: {{ getInstallmentDueDate(idx) }}</div>
              </div>
              <div class="installment-price-col">
                <span class="installment-amount">{{ formatCurrency(getInstallmentValue(idx)) }}</span>
                <div class="installment-status-pill paid">
                  <CheckCircle :size="13" />
                  <span>Pago</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- ── SECTION C: SANDUÍCHE DE PARCELAS FUTURAS & ANTECIPAÇÃO (ACCORDION) -->
      <div
        v-if="(activeTab === 'ALL' || activeTab === 'FUTURE') && futureInstallmentsList.length > 0"
        class="sandwich-accordion-card blue-theme"
      >
        <!-- Accordion Header Toggle -->
        <div
          class="sandwich-header"
          @click="isFutureAccordionOpen = !isFutureAccordionOpen"
        >
          <div class="sandwich-header-left">
            <div class="sandwich-icon-wrap blue">
              <Sparkles :size="20" color="#2196F3" />
            </div>
            <div class="sandwich-header-texts">
              <h3 class="sandwich-title">
                Antecipar Parcelas ({{ futureInstallmentsList.length }} disponíveis)
              </h3>
              <span class="sandwich-subtitle discount-badge">
                Economize até 30% com desconto de amortização
              </span>
            </div>
          </div>

          <div class="sandwich-toggle-indicator">
            <span class="toggle-text">{{ isFutureAccordionOpen ? 'Recolher' : 'Expandir' }}</span>
            <component
              :is="isFutureAccordionOpen ? ChevronUp : ChevronDown"
              :size="20"
              color="#2196F3"
            />
          </div>
        </div>

        <!-- Accordion Content -->
        <div v-if="isFutureAccordionOpen" class="sandwich-content-body">
          <!-- Year Groups (Sub-Sanduíches por Ano) -->
          <div class="year-groups-container">
            <div
              v-for="(insts, yr) in futureByYearGroups"
              :key="yr"
              class="year-group-box"
            >
              <!-- Year Sub-header Toggle -->
              <div
                class="year-group-header"
                @click="toggleYearGroup(String(yr))"
              >
                <div class="year-group-title-row">
                  <component
                    :is="openYearGroup === yr ? FolderOpen : Folder"
                    :size="18"
                    color="#1976D2"
                  />
                  <span class="year-name">Ano {{ yr }}</span>
                  <span class="year-count-pill">{{ insts.length }} parcelas</span>
                </div>
                <component
                  :is="openYearGroup === yr ? ChevronUp : ChevronDown"
                  :size="16"
                  color="#757575"
                />
              </div>

              <!-- Year Sub-list -->
              <div v-if="openYearGroup === yr" class="year-installments-sublist">
                <div
                  v-for="idx in insts"
                  :key="idx"
                  class="installment-card is-future"
                  @click="openPaymentModal(idx)"
                >
                  <div class="installment-number-box future">{{ idx }}</div>
                  <div class="installment-details-col">
                    <div class="installment-title">Parcela {{ idx }} de {{ contract.totalInstallments }}</div>
                    <div class="installment-due-date">Venc: {{ getInstallmentDueDate(idx) }}</div>
                  </div>
                  <div class="installment-price-col">
                    <span class="installment-amount future-amount">{{ formatCurrency(getInstallmentValue(idx)) }}</span>
                    <div class="installment-status-pill future">
                      <Calendar :size="13" />
                      <span>Antecipar</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- ── Payment Bottom Sheet Modal ────────────────────────────────────── -->
    <div v-if="isModalOpen" class="modal-overlay" @click.self="isModalOpen = false">
      <div class="modal-bottom-sheet">
        <div class="modal-handle"></div>

        <div class="modal-header-row">
          <h2 class="modal-title">
            {{ isFuture(selectedInstallmentNumber || 1) ? `Antecipar Parcela ${selectedInstallmentNumber}` : `Pagar Parcela ${selectedInstallmentNumber}` }}
          </h2>
          <button class="modal-close-btn" @click="isModalOpen = false">
            <X :size="20" color="#757575" />
          </button>
        </div>

        <!-- Price Calculations -->
        <div class="modal-calc-rows">
          <div class="calc-row">
            <span class="calc-label">Valor Original</span>
            <span class="calc-val">{{ formatCurrency(contract?.nextPaymentAmount || 289.90) }}</span>
          </div>

          <div
            v-if="selectedInstallmentNumber && (contract?.nextPaymentAmount || 289.90) - getInstallmentValue(selectedInstallmentNumber) > 0.01"
            class="calc-row discount"
          >
            <span class="calc-label">Desconto (Amortização)</span>
            <span class="calc-val">
              - {{ formatCurrency((contract?.nextPaymentAmount || 289.90) - getInstallmentValue(selectedInstallmentNumber)) }}
            </span>
          </div>

          <div class="calc-divider"></div>

          <div class="calc-row total">
            <span class="calc-label">Total a Pagar</span>
            <span class="calc-val">
              {{ formatCurrency(selectedInstallmentNumber ? getInstallmentValue(selectedInstallmentNumber) : 0) }}
            </span>
          </div>
        </div>

        <!-- Method Selector Tabs -->
        <div class="method-selector-tabs">
          <button
            class="method-tab"
            :class="{ active: selectedMethod === 'PIX' }"
            @click="selectedMethod = 'PIX'"
          >
            <QrCode :size="18" />
            <span>PIX</span>
          </button>
          <button
            class="method-tab"
            :class="{ active: selectedMethod === 'BOLETO' }"
            @click="selectedMethod = 'BOLETO'"
          >
            <FileText :size="18" />
            <span>Boleto Bancário</span>
          </button>
        </div>

        <!-- Error Alert -->
        <div v-if="errorMessage" class="modal-error-banner">
          <AlertTriangle :size="16" color="#D32F2F" />
          <span>{{ errorMessage }}</span>
        </div>

        <!-- Submit Button -->
        <button
          class="modal-submit-btn"
          :disabled="isSubmitting"
          @click="processPayment"
        >
          <span v-if="!isSubmitting">Pagar via {{ selectedMethod }}</span>
          <span v-else>Processando...</span>
        </button>
      </div>
    </div>

    <!-- ── KYC Rejected Alert Modal ──────────────────────────────────────── -->
    <div v-if="isKycAlertOpen" class="modal-overlay" @click.self="isKycAlertOpen = false">
      <div class="kyc-alert-dialog">
        <div class="alert-icon-title-row">
          <AlertTriangle :size="24" color="#D32F2F" />
          <h3 class="alert-title">Documentos Recusados</h3>
        </div>
        <p class="alert-msg">
          Seu pagamento foi bloqueado temporariamente porque seus documentos não puderam ser validados.
        </p>
        <div class="alert-reason-box">
          <strong>Motivo:</strong> Documentos ilegíveis ou inválidos
        </div>
        <div class="alert-actions-row">
          <button class="alert-btn-secondary" @click="isKycAlertOpen = false">DEPOIS</button>
          <button class="alert-btn-primary" @click="router.push('/profile/kyc')">REENVIAR AGORA</button>
        </div>
      </div>
    </div>
  </div>
</template>
