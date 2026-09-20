<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useConsortiumStore } from '~/stores/consortium'
import { useAuthStore } from '~/stores/auth'
import { useToast } from '~/composables/useToast'
import { formatCurrency } from '~~/shared/utils/currency'
import type { ActiveContract } from '~~/shared/types/catalog'
import {
  ArrowLeft,
  Package,
  XCircle,
  Headset,
  CheckCircle2,
  AlertTriangle,
  Loader2
} from 'lucide-vue-next'

definePageMeta({
  middleware: 'auth',
  hideHeader: true,
  alias: ['/contracts']
})

const router = useRouter()
const consortiumStore = useConsortiumStore()
const authStore = useAuthStore()
const toast = useToast()

const isLoading = ref(false)

// Cancel direto (só adesão / PENDING)
const cancelTarget = ref<ActiveContract | null>(null)
const isCancelling = ref(false)

// Ticket (contrato com parcelas pagas)
const ticketTarget = ref<ActiveContract | null>(null)
const ticketMessage = ref('')
const isTicketSending = ref(false)

const contracts = computed<ActiveContract[]>(() => consortiumStore.activeContracts)

onMounted(async () => {
  isLoading.value = true
  try {
    await consortiumStore.loadHomeData()
  } finally {
    isLoading.value = false
  }
})

function isPendingOnly(c: ActiveContract): boolean {
  return c.status === 'pending' || (!c.isAdesaoPaid && (c.paidInstallments?.length || 0) === 0)
}

function isCancelled(c: ActiveContract): boolean {
  return c.status === 'canceled'
}

function statusLabel(c: ActiveContract): string {
  if (isCancelled(c)) return 'Cancelado'
  if (c.status === 'finished') return 'Concluído'
  if (c.status === 'active') return 'Ativo'
  return 'Em adesão'
}

function paidCount(c: ActiveContract): number {
  return c.paidInstallments?.length || (c.currentInstallment ? c.currentInstallment - 1 : 0)
}

function openCancel(c: ActiveContract) {
  cancelTarget.value = c
}

function openTicket(c: ActiveContract) {
  ticketTarget.value = c
  ticketMessage.value = ''
}

async function confirmCancel() {
  if (!cancelTarget.value) return
  isCancelling.value = true
  try {
    await $fetch(`/api/subscriptions/${cancelTarget.value.id}/cancel`, {
      method: 'POST',
      headers: authStore.token ? { Authorization: `Bearer ${authStore.token}` } : {}
    })
    toast.success('Contrato cancelado com sucesso.')
    cancelTarget.value = null
    await consortiumStore.loadHomeData()
  } catch (err: any) {
    toast.error(err?.data?.message || err?.message || 'Não foi possível cancelar. Tente novamente.')
  } finally {
    isCancelling.value = false
  }
}

async function sendTicket() {
  if (!ticketTarget.value) return
  if (!ticketMessage.value.trim()) {
    toast.error('Descreva o motivo do cancelamento.')
    return
  }
  isTicketSending.value = true
  try {
    await $fetch('/api/tickets', {
      method: 'POST',
      headers: authStore.token ? { Authorization: `Bearer ${authStore.token}` } : {},
      body: {
        subscriptionId: ticketTarget.value.id,
        type: 'CANCELLATION',
        subject: `Solicitação de cancelamento — Grupo ${ticketTarget.value.groupNumber}/Cota ${ticketTarget.value.quotaNumber}`,
        message: ticketMessage.value.trim()
      }
    })
    toast.success('Pedido enviado! Um atendente vai analisar e retornar.')
    ticketTarget.value = null
    ticketMessage.value = ''
  } catch (err: any) {
    toast.error(err?.data?.message || err?.message || 'Não foi possível enviar. Tente novamente.')
  } finally {
    isTicketSending.value = false
  }
}
</script>

<template>
  <div class="contracts-screen">
    <header class="appbar-header">
      <button class="appbar-back-btn" aria-label="Voltar" @click="router.back()">
        <ArrowLeft :size="22" color="#263238" />
      </button>
      <h1 class="appbar-title">Meus Contratos</h1>
      <div class="appbar-spacer"></div>
    </header>

    <main class="contracts-container">
      <div v-if="isLoading" class="loading-box">
        <Loader2 :size="28" class="spin-icon" color="#FF6D00" />
        <span>Carregando contratos...</span>
      </div>

      <div v-else-if="contracts.length === 0" class="empty-box">
        <Package :size="40" color="#B0BEC5" />
        <p>Você ainda não tem contratos.</p>
        <button class="btn-primary-action" @click="router.push('/')">
          Ver produtos
        </button>
      </div>

      <section v-else class="contracts-list">
        <article v-for="c in contracts" :key="c.id" class="contract-card">
          <div class="contract-top">
            <div class="contract-icon">
              <Package :size="22" color="#FF6D00" />
            </div>
            <div class="contract-meta">
              <h3 class="contract-title">{{ c.product?.name || 'Consórcio' }}</h3>
              <span class="contract-sub">Grupo {{ c.groupNumber }} • Cota {{ c.quotaNumber }}</span>
            </div>
            <span
              class="status-pill"
              :class="{
                'st-pending': c.status === 'pending',
                'st-active': c.status === 'active',
                'st-canceled': isCancelled(c),
                'st-finished': c.status === 'finished'
              }"
            >
              {{ statusLabel(c) }}
            </span>
          </div>

          <div class="contract-values">
            <div class="value-col">
              <span class="value-label">Crédito</span>
              <span class="value-num">{{ formatCurrency(c.creditValue || c.product?.price || 0) }}</span>
            </div>
            <div class="value-col">
              <span class="value-label">Pagas</span>
              <span class="value-num">{{ paidCount(c) }}/{{ c.totalInstallments || 0 }}</span>
            </div>
            <div class="value-col">
              <span class="value-label">Próx. parcela</span>
              <span class="value-num">{{ formatCurrency(c.nextPaymentAmount || 0) }}</span>
            </div>
          </div>

          <div class="contract-actions">
            <button
              v-if="!isCancelled(c) && c.status !== 'finished' && isPendingOnly(c)"
              type="button"
              class="btn-cancel"
              @click="openCancel(c)"
            >
              <XCircle :size="16" />
              Cancelar contrato
            </button>
            <button
              v-else-if="!isCancelled(c) && c.status !== 'finished'"
              type="button"
              class="btn-ticket"
              @click="openTicket(c)"
            >
              <Headset :size="16" />
              Solicitar cancelamento
            </button>
            <span v-else class="no-action-hint">
              <CheckCircle2 :size="14" />
              Sem ações disponíveis
            </span>
          </div>
        </article>
      </section>
    </main>

    <!-- Modal: confirmar cancelamento direto -->
    <div v-if="cancelTarget" class="modal-overlay" @click.self="cancelTarget = null">
      <div class="modal-card">
        <div class="modal-icon danger">
          <AlertTriangle :size="28" color="#D32F2F" />
        </div>
        <h2 class="modal-title">Cancelar contrato?</h2>
        <p class="modal-text">
          Grupo {{ cancelTarget.groupNumber }} • Cota {{ cancelTarget.quotaNumber }} será
          cancelado imediatamente. Essa ação não pode ser desfeita.
        </p>
        <div class="modal-actions">
          <button type="button" class="btn-secondary" :disabled="isCancelling" @click="cancelTarget = null">
            Voltar
          </button>
          <button type="button" class="btn-danger" :disabled="isCancelling" @click="confirmCancel">
            <Loader2 v-if="isCancelling" :size="16" class="spin-icon" />
            {{ isCancelling ? 'Cancelando...' : 'Confirmar' }}
          </button>
        </div>
      </div>
    </div>

    <!-- Modal: solicitar cancelamento (ticket p/ atendente) -->
    <div v-if="ticketTarget" class="modal-overlay" @click.self="ticketTarget = null">
      <div class="modal-card">
        <div class="modal-icon info">
          <Headset :size="28" color="#1565C0" />
        </div>
        <h2 class="modal-title">Solicitar cancelamento</h2>
        <p class="modal-text">
          Este contrato já tem parcelas pagas, então um atendente vai analisar seu pedido.
          Grupo {{ ticketTarget.groupNumber }} • Cota {{ ticketTarget.quotaNumber }}.
        </p>
        <textarea
          v-model="ticketMessage"
          class="ticket-textarea"
          rows="4"
          maxlength="2000"
          placeholder="Descreva o motivo do cancelamento..."
        ></textarea>
        <div class="modal-actions">
          <button type="button" class="btn-secondary" :disabled="isTicketSending" @click="ticketTarget = null">
            Voltar
          </button>
          <button type="button" class="btn-primary-action" :disabled="isTicketSending" @click="sendTicket">
            <Loader2 v-if="isTicketSending" :size="16" class="spin-icon" />
            {{ isTicketSending ? 'Enviando...' : 'Enviar pedido' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.contracts-screen {
  min-height: 100vh;
  background-color: var(--color-bg, #FAFAFA);
  font-family: 'Outfit', sans-serif;
  color: var(--color-secondary, #263238);
  display: flex;
  flex-direction: column;
}

.appbar-header {
  border-radius: 0 0 47px 47px;
}

.contracts-container {
  flex: 1;
  max-width: 640px;
  width: 100%;
  margin: 0 auto;
  padding: 20px 20px 60px 20px;
}

.loading-box,
.empty-box {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  padding: 60px 20px;
  color: #757575;
  font-size: 14px;
}

.contracts-list {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.contract-card {
  background: #FFFFFF;
  border: 1px solid var(--color-border, #E0E0E0);
  border-radius: 16px;
  padding: 16px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.03);
}

.contract-top {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 14px;
}

.contract-icon {
  width: 44px;
  height: 44px;
  border-radius: 12px;
  background: rgba(255, 109, 0, 0.1);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.contract-meta {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.contract-title {
  font-size: 15px;
  font-weight: 800;
  margin: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.contract-sub {
  font-size: 12px;
  color: #757575;
}

.status-pill {
  font-size: 10.5px;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.4px;
  padding: 4px 10px;
  border-radius: 20px;
  flex-shrink: 0;
}

.st-pending {
  background: #FFF3E0;
  color: #E65100;
}

.st-active {
  background: #E8F5E9;
  color: #2E7D32;
}

.st-canceled {
  background: #FFEBEE;
  color: #C62828;
}

.st-finished {
  background: #E3F2FD;
  color: #1565C0;
}

.contract-values {
  display: flex;
  gap: 12px;
  padding: 12px;
  background: #F8F9FA;
  border-radius: 12px;
  margin-bottom: 12px;
}

.value-col {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.value-label {
  font-size: 10.5px;
  color: #757575;
}

.value-num {
  font-size: 14px;
  font-weight: 800;
}

.contract-actions {
  display: flex;
}

.btn-cancel,
.btn-ticket {
  width: 100%;
  height: 46px;
  border-radius: 12px;
  font-size: 14px;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  cursor: pointer;
  transition: all 0.15s ease;
}

.btn-cancel {
  background: #FFFFFF;
  border: 1.5px solid #FFCDD2;
  color: #D32F2F;
}

.btn-cancel:hover {
  background: #FFEBEE;
}

.btn-ticket {
  background: #FFFFFF;
  border: 1.5px solid #BBDEFB;
  color: #1565C0;
}

.btn-ticket:hover {
  background: #E3F2FD;
}

.no-action-hint {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 12.5px;
  color: #9E9E9E;
  margin: 0 auto;
  padding: 10px 0;
}

.btn-primary-action {
  height: 48px;
  padding: 0 22px;
  border-radius: 12px;
  border: none;
  background: var(--color-primary, #FF6D00);
  color: #FFFFFF;
  font-size: 14px;
  font-weight: 700;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
}

/* ── Modals ── */
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.45);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
  z-index: 100;
}

.modal-card {
  background: #FFFFFF;
  border-radius: 20px;
  padding: 24px;
  max-width: 420px;
  width: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
}

.modal-icon {
  width: 60px;
  height: 60px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 14px;
}

.modal-icon.danger {
  background: #FFEBEE;
}

.modal-icon.info {
  background: #E3F2FD;
}

.modal-title {
  font-size: 18px;
  font-weight: 800;
  margin: 0 0 8px 0;
}

.modal-text {
  font-size: 13.5px;
  color: #616161;
  line-height: 1.5;
  margin: 0 0 16px 0;
}

.ticket-textarea {
  width: 100%;
  border: 1.5px solid #E0E0E0;
  border-radius: 12px;
  padding: 12px;
  font-size: 13.5px;
  font-family: inherit;
  resize: vertical;
  margin-bottom: 16px;
}

.ticket-textarea:focus {
  outline: none;
  border-color: var(--color-primary, #FF6D00);
}

.modal-actions {
  display: flex;
  gap: 10px;
  width: 100%;
}

.modal-actions .btn-secondary,
.modal-actions .btn-danger,
.modal-actions .btn-primary-action {
  flex: 1;
}

.btn-secondary {
  height: 48px;
  border-radius: 12px;
  border: 1.5px solid #E0E0E0;
  background: #FFFFFF;
  color: #616161;
  font-size: 14px;
  font-weight: 700;
  cursor: pointer;
}

.btn-danger {
  height: 48px;
  border-radius: 12px;
  border: none;
  background: #D32F2F;
  color: #FFFFFF;
  font-size: 14px;
  font-weight: 700;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
}

.btn-secondary:disabled,
.btn-danger:disabled,
.btn-primary-action:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.spin-icon {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}
</style>
