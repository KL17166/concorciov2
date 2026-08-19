<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useConsortiumStore } from '~/stores/consortium'
import { formatCurrency } from '~~/shared/utils/currency'
import type { ActiveContract } from '~~/shared/types/catalog'
import {
  ArrowLeft,
  CheckCircle,
  Hourglass,
  BarChart2,
  PiggyBank,
  ShieldAlert,
  ShieldCheck,
  Check
} from 'lucide-vue-next'

definePageMeta({
  middleware: 'auth',
  hideHeader: true,
  alias: ['/statement']
})

const router = useRouter()
const consortiumStore = useConsortiumStore()

const contract = computed<ActiveContract | null>(() => {
  return consortiumStore.activeContracts[0] || null
})

onMounted(async () => {
  if (consortiumStore.activeContracts.length === 0) {
    await consortiumStore.loadHomeData()
  }
})

// Calculations matching Flutter ActiveContract model
const totalPaid = computed(() => {
  if (!contract.value) return 0
  const paidCount = contract.value.paidInstallments?.length || (contract.value.currentInstallment ? contract.value.currentInstallment - 1 : 0)
  if (!contract.value.installmentValues || Object.keys(contract.value.installmentValues).length === 0) {
    return (contract.value.nextPaymentAmount || 289.90) * paidCount
  }
  let sum = 0
  for (const idx of (contract.value.paidInstallments || [])) {
    sum += contract.value.installmentValues[idx] || contract.value.nextPaymentAmount || 289.90
  }
  return sum
})

const totalPaymentsCount = computed(() => {
  return contract.value?.paidInstallments?.length || (contract.value?.currentInstallment ? contract.value.currentInstallment - 1 : 0)
})

const remainingCount = computed(() => {
  if (!contract.value) return 0
  return Math.max(0, (contract.value.totalInstallments || 80) - totalPaymentsCount.value)
})

const progressRatio = computed(() => {
  if (!contract.value) return 0
  return totalPaymentsCount.value / (contract.value.totalInstallments || 80)
})

const progressPercentage = computed(() => {
  return Math.round(progressRatio.value * 100)
})

// Distribution calculations
const totalAdminFeePaid = computed(() => {
  const feeRate = contract.value?.administrationFee || 0.10
  return totalPaid.value * feeRate
})

const totalReserveFundPaid = computed(() => {
  return totalPaid.value * 0.02
})

const commonFundPaid = computed(() => {
  return Math.max(0, totalPaid.value - totalAdminFeePaid.value - totalReserveFundPaid.value)
})

function formatDate(dateStr?: string | Date): string {
  if (!dateStr) return '15/09/2026'
  const d = new Date(dateStr)
  if (isNaN(d.getTime())) return String(dateStr)
  return d.toLocaleDateString('pt-BR')
}

// Timeline Items
interface TimelineItem {
  title: string
  description: string
  value: string
  date: string
  isFirst: boolean
  isPaid: boolean
}

const timelineItems = computed<TimelineItem[]>(() => {
  if (!contract.value) return []
  const items: TimelineItem[] = []

  // Adesão
  if (contract.value.isAdesaoPaid) {
    items.push({
      title: 'Adesão Confirmada',
      description: `Grupo ${contract.value.groupNumber} - Cota ${contract.value.quotaNumber}`,
      value: formatCurrency(contract.value.installmentValues?.[1] || contract.value.nextPaymentAmount || 289.90),
      date: formatDate(contract.value.contractDate || '2024-01-15'),
      isFirst: true,
      isPaid: true
    })
  } else {
    items.push({
      title: 'Adesão Pendente',
      description: `Grupo ${contract.value.groupNumber} - Cota ${contract.value.quotaNumber}`,
      value: formatCurrency(contract.value.installmentValues?.[1] || contract.value.nextPaymentAmount || 289.90),
      date: formatDate(contract.value.contractDate || '2024-01-15'),
      isFirst: true,
      isPaid: false
    })
  }

  // Paid installments (> 1)
  const paidNumbers = (contract.value.paidInstallments || []).filter(n => n > 1).sort((a, b) => a - b)
  for (const num of paidNumbers) {
    const val = contract.value.installmentValues?.[num] || contract.value.nextPaymentAmount || 289.90
    const d = contract.value.installmentDueDates?.[num] || new Date(2024, num, 15).toISOString()
    items.push({
      title: `Parcela ${num}`,
      description: 'Pagamento realizado',
      value: formatCurrency(val),
      date: formatDate(d),
      isFirst: false,
      isPaid: true
    })
  }

  // Reverse so most recent is at the top
  return items.reverse()
})
</script>

<template>
  <div class="statement-screen-wrapper">
    <!-- Top App Bar -->
    <header class="statement-appbar">
      <button class="appbar-back-btn" aria-label="Voltar" @click="router.back()">
        <ArrowLeft :size="22" color="#263238" />
      </button>
      <h1 class="appbar-title">Extrato</h1>
      <div class="appbar-spacer"></div>
    </header>

    <div v-if="contract" class="statement-main-container">
      <!-- 1. Total Paid Header Card -->
      <div class="statement-header-card">
        <span class="total-paid-label">Valor Total Pago</span>
        <div class="total-paid-amount">{{ formatCurrency(totalPaid) }}</div>

        <!-- Linear Progress Bar -->
        <div class="statement-progress-track">
          <div class="statement-progress-fill" :style="{ width: `${progressPercentage}%` }"></div>
        </div>

        <!-- 3-Column Summary Row -->
        <div class="statement-summary-row">
          <!-- Pagas -->
          <div class="summary-sub-item">
            <div class="sub-item-top green">
              <CheckCircle :size="16" />
              <span>{{ totalPaymentsCount }}</span>
            </div>
            <span class="sub-item-label green">Pagas</span>
          </div>

          <div class="summary-vertical-divider"></div>

          <!-- Faltam -->
          <div class="summary-sub-item">
            <div class="sub-item-top orange">
              <Hourglass :size="16" />
              <span>{{ remainingCount }}</span>
            </div>
            <span class="sub-item-label orange">Faltam</span>
          </div>

          <div class="summary-vertical-divider"></div>

          <!-- Progresso -->
          <div class="summary-sub-item">
            <div class="sub-item-top blue">
              <BarChart2 :size="16" />
              <span>{{ progressPercentage }}%</span>
            </div>
            <span class="sub-item-label blue">Progresso</span>
          </div>
        </div>
      </div>

      <!-- 2. Distribuição Section -->
      <div class="statement-section-container">
        <h2 class="section-title">Distribuição</h2>
        <div class="distribution-card">
          <!-- Fundo Comum -->
          <div class="distribution-row">
            <div class="distribution-icon-box green">
              <PiggyBank :size="20" color="#4CAF50" />
            </div>
            <span class="distribution-name">Fundo Comum</span>
            <span class="distribution-value">{{ formatCurrency(commonFundPaid) }}</span>
          </div>

          <div class="distribution-divider"></div>

          <!-- Taxa Admin -->
          <div class="distribution-row">
            <div class="distribution-icon-box blue">
              <ShieldCheck :size="20" color="#2196F3" />
            </div>
            <span class="distribution-name">Taxa Admin</span>
            <span class="distribution-value">{{ formatCurrency(totalAdminFeePaid) }}</span>
          </div>

          <div class="distribution-divider"></div>

          <!-- Fundo Reserva -->
          <div class="distribution-row">
            <div class="distribution-icon-box orange">
              <ShieldAlert :size="20" color="#FF9800" />
            </div>
            <span class="distribution-name">Fundo Reserva</span>
            <span class="distribution-value">{{ formatCurrency(totalReserveFundPaid) }}</span>
          </div>
        </div>
      </div>

      <!-- 3. Histórico Timeline Section -->
      <div class="statement-section-container">
        <h2 class="section-title">Histórico</h2>
        <div class="timeline-list">
          <div
            v-for="(item, idx) in timelineItems"
            :key="idx"
            class="timeline-node-item"
          >
            <!-- Timeline Axis Column -->
            <div class="timeline-axis-col">
              <div
                class="timeline-dot"
                :class="{
                  'active-first': idx === 0,
                  'paid': item.isPaid,
                  'pending': !item.isPaid
                }"
              >
                <Check v-if="item.isPaid" :size="idx === 0 ? 10 : 8" />
                <Hourglass v-else :size="idx === 0 ? 10 : 8" />
              </div>
              <div v-if="idx !== timelineItems.length - 1" class="timeline-connector-line"></div>
            </div>

            <!-- Timeline Content Row -->
            <div class="timeline-content-card">
              <div class="timeline-text-col">
                <div class="timeline-item-title">{{ item.title }}</div>
                <div class="timeline-item-date">{{ item.date }}</div>
                <div class="timeline-item-desc">{{ item.description }}</div>
              </div>
              <div class="timeline-item-price" :class="{ 'paid': item.isPaid, 'pending': !item.isPaid }">
                {{ item.value }}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
