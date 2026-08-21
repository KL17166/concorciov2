<script setup lang="ts">
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { useBidStore } from '~/stores/bid'
import { useAuthStore } from '~/stores/auth'
import { formatCurrency } from '~~/shared/utils/currency'
import { Trophy, Sparkles, X, ArrowRight, CheckCircle2 } from 'lucide-vue-next'

const router = useRouter()
const bidStore = useBidStore()
const authStore = useAuthStore()

const approvedBid = computed(() => bidStore.approvedBid)

const isVisible = computed(() => {
  if (!authStore.isAuthenticated) return false
  if (!approvedBid.value) return false
  if (bidStore.hasDismissedInterstitial) return false
  if (typeof window !== 'undefined' && sessionStorage.getItem('dismissed_bid_interstitial') === 'true') {
    return false
  }
  return true
})

function handleClose() {
  bidStore.dismissInterstitial()
}

function handleGoToBids() {
  bidStore.dismissInterstitial()
  router.push('/consortium/bids')
}
</script>

<template>
  <Teleport to="body">
    <Transition name="fade-scale">
      <div v-if="isVisible" class="bid-modal-overlay" @click.self="handleClose">
        <div class="bid-modal-card animate-scale-in">
          <!-- Close Button -->
          <button type="button" class="btn-close-modal" aria-label="Fechar" @click="handleClose">
            <X :size="20" />
          </button>

          <!-- Glow & Trophy Icon -->
          <div class="trophy-wrapper">
            <div class="trophy-glow"></div>
            <div class="trophy-circle">
              <Trophy :size="42" class="trophy-icon" />
            </div>
            <Sparkles :size="20" class="sparkle-decoration top-left" />
            <Sparkles :size="24" class="sparkle-decoration bottom-right" />
          </div>

          <!-- Titles -->
          <div class="modal-badge">
            <CheckCircle2 :size="14" />
            <span>LANCE CONTEMPLADO NA ASSEMBLEIA</span>
          </div>

          <h2 class="modal-title">
            Parabéns, {{ authStore.userName.split(' ')[0] }}!
          </h2>

          <p class="modal-subtitle">
            Seu lance foi aprovado e sua cota está pronta para ser contemplada!
          </p>

          <!-- Bid Summary Box -->
          <div class="bid-highlight-box">
            <div class="highlight-row">
              <span class="highlight-label">Valor do Lance:</span>
              <strong class="highlight-amount">{{ formatCurrency(approvedBid?.amount || 0) }}</strong>
            </div>
            <div class="highlight-row sub">
              <span class="highlight-sublabel">Percentual Ofertado:</span>
              <span class="highlight-subval">{{ approvedBid?.percentage }}% do crédito</span>
            </div>
          </div>

          <p class="modal-tip">
            Realize o pagamento do lance para emitir sua carta de crédito e faturar seu bem.
          </p>

          <!-- Action Buttons -->
          <div class="modal-actions">
            <button type="button" class="btn-primary-action" @click="handleGoToBids">
              <span>Ver Lance & Pagar</span>
              <ArrowRight :size="18" />
            </button>

            <button type="button" class="btn-secondary-action" @click="handleClose">
              Lembrar mais tarde
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.bid-modal-overlay {
  position: fixed;
  inset: 0;
  z-index: 9999;
  background: rgba(15, 23, 42, 0.65);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px;
}

.bid-modal-card {
  position: relative;
  width: 100%;
  max-width: 420px;
  background: #FFFFFF;
  border: 1px solid var(--color-border, #E2E8F0);
  border-radius: 28px;
  padding: 36px 24px 28px;
  text-align: center;
  box-shadow: 0 20px 50px rgba(0, 0, 0, 0.18);
  overflow: hidden;
}

.btn-close-modal {
  position: absolute;
  top: 16px;
  right: 16px;
  width: 36px;
  height: 36px;
  border-radius: 50%;
  background: #F1F5F9;
  border: 1px solid #E2E8F0;
  color: #64748B;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.2s ease;
}

.btn-close-modal:hover {
  background: #E2E8F0;
  color: #1E293B;
  transform: scale(1.08);
}

.trophy-wrapper {
  position: relative;
  width: 84px;
  height: 84px;
  margin: 0 auto 16px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.trophy-glow {
  position: absolute;
  inset: -10px;
  background: radial-gradient(circle, rgba(251, 191, 36, 0.35) 0%, transparent 70%);
  border-radius: 50%;
  filter: blur(10px);
  animation: pulseGlow 2.5s infinite alternate;
}

.trophy-circle {
  position: relative;
  width: 76px;
  height: 76px;
  background: linear-gradient(135deg, #FBBF24 0%, #D97706 100%);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 10px 20px rgba(217, 119, 6, 0.3);
}

.trophy-icon {
  color: #FFFFFF;
}

.sparkle-decoration {
  position: absolute;
  color: #F59E0B;
  pointer-events: none;
  animation: floatSparkle 2s infinite ease-in-out alternate;
}

.sparkle-decoration.top-left {
  top: -4px;
  left: 0;
}

.sparkle-decoration.bottom-right {
  bottom: 0;
  right: -4px;
  animation-delay: 1s;
}

.modal-badge {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 14px;
  background: #ECFDF5;
  border: 1px solid #A7F3D0;
  color: #047857;
  border-radius: 999px;
  font-size: 11px;
  font-weight: 800;
  letter-spacing: 0.5px;
  margin-bottom: 12px;
}

.modal-title {
  font-size: 22px;
  font-weight: 800;
  color: var(--color-text, #1E293B);
  margin-bottom: 6px;
  line-height: 1.2;
}

.modal-subtitle {
  font-size: 14px;
  color: #64748B;
  margin-bottom: 18px;
  line-height: 1.4;
}

.bid-highlight-box {
  background: #F8FAFC;
  border: 1px solid #E2E8F0;
  border-radius: 18px;
  padding: 16px;
  margin-bottom: 16px;
}

.highlight-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.highlight-row.sub {
  margin-top: 6px;
  padding-top: 6px;
  border-top: 1px solid #E2E8F0;
}

.highlight-label {
  font-size: 13px;
  color: #64748B;
  font-weight: 600;
}

.highlight-amount {
  font-size: 22px;
  font-weight: 900;
  color: #059669;
}

.highlight-sublabel {
  font-size: 12px;
  color: #94A3B8;
}

.highlight-subval {
  font-size: 12px;
  font-weight: 700;
  color: #334155;
}

.modal-tip {
  font-size: 12px;
  color: #64748B;
  line-height: 1.4;
  margin-bottom: 22px;
}

.modal-actions {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.btn-primary-action {
  height: 50px;
  background: linear-gradient(135deg, #FF6D00 0%, #E65100 100%);
  border: none;
  border-radius: 14px;
  color: #FFFFFF;
  font-size: 15px;
  font-weight: 800;
  letter-spacing: 0.5px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  cursor: pointer;
  box-shadow: 0 6px 18px rgba(255, 109, 0, 0.35);
  transition: transform 0.15s ease, box-shadow 0.15s ease;
}

.btn-primary-action:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 24px rgba(255, 109, 0, 0.45);
}

.btn-secondary-action {
  background: transparent;
  border: none;
  color: #94A3B8;
  font-size: 13px;
  font-weight: 600;
  padding: 8px;
  cursor: pointer;
  transition: color 0.15s ease;
}

.btn-secondary-action:hover {
  color: #475569;
}

@keyframes pulseGlow {
  0% { transform: scale(0.95); opacity: 0.5; }
  100% { transform: scale(1.15); opacity: 0.9; }
}

@keyframes floatSparkle {
  0% { transform: translateY(0) scale(0.9); }
  100% { transform: translateY(-4px) scale(1.1); }
}

/* Animations */
.fade-scale-enter-active,
.fade-scale-leave-active {
  transition: opacity 0.25s ease, transform 0.25s cubic-bezier(0.34, 1.56, 0.64, 1);
}

.fade-scale-enter-from,
.fade-scale-leave-to {
  opacity: 0;
  transform: scale(0.92);
}
</style>
