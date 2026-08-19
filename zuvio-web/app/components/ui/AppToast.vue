<script setup lang="ts">
import { useToast } from '~/composables/useToast'
import { CheckCircle2, AlertCircle, AlertTriangle, Info, X } from 'lucide-vue-next'

const { toasts, remove } = useToast()

const iconMap = {
  success: CheckCircle2,
  error: AlertCircle,
  warning: AlertTriangle,
  info: Info
}
</script>

<template>
  <div class="toast-container" aria-live="polite">
    <TransitionGroup name="toast">
      <div
        v-for="toast in toasts"
        :key="toast.id"
        class="toast-item"
        :class="`toast-${toast.type}`"
      >
        <div class="toast-icon">
          <component :is="iconMap[toast.type]" :size="20" />
        </div>
        <div class="toast-body">
          <h4 v-if="toast.title" class="toast-title">{{ toast.title }}</h4>
          <p class="toast-message">{{ toast.message }}</p>
        </div>
        <button
          type="button"
          class="toast-close"
          aria-label="Fechar notificação"
          @click="remove(toast.id)"
        >
          <X :size="16" />
        </button>
      </div>
    </TransitionGroup>
  </div>
</template>

<style scoped>
.toast-container {
  position: fixed;
  top: 24px;
  right: 24px;
  z-index: 9999;
  display: flex;
  flex-direction: column;
  gap: 12px;
  max-width: 400px;
  width: calc(100vw - 48px);
  pointer-events: none;
}

.toast-item {
  pointer-events: auto;
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 16px;
  border-radius: var(--radius-md);
  box-shadow: 0 12px 30px rgba(0, 0, 0, 0.15);
  backdrop-filter: blur(12px);
  background: white;
  border: 1px solid var(--color-border);
  transition: all var(--transition-normal);
}

.toast-icon {
  flex-shrink: 0;
  margin-top: 2px;
}

.toast-body {
  flex: 1;
}

.toast-title {
  font-size: 14px;
  font-weight: 700;
  margin-bottom: 2px;
  color: var(--color-text-main);
}

.toast-message {
  font-size: 13px;
  color: var(--color-text-muted);
  line-height: 1.4;
}

.toast-close {
  flex-shrink: 0;
  background: transparent;
  border: none;
  color: var(--color-text-low);
  cursor: pointer;
  padding: 4px;
  border-radius: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: color var(--transition-fast);
}

.toast-close:hover {
  color: var(--color-text-main);
}

/* ── Toast Variants ──────────────────────────────────────────────────────── */
.toast-success {
  border-left: 4px solid var(--color-success);
}
.toast-success .toast-icon {
  color: var(--color-success);
}

.toast-error {
  border-left: 4px solid var(--color-error);
}
.toast-error .toast-icon {
  color: var(--color-error);
}

.toast-warning {
  border-left: 4px solid var(--color-warning);
}
.toast-warning .toast-icon {
  color: var(--color-warning);
}

.toast-info {
  border-left: 4px solid var(--color-info);
}
.toast-info .toast-icon {
  color: var(--color-info);
}

/* ── Animations ──────────────────────────────────────────────────────────── */
.toast-enter-active,
.toast-leave-active {
  transition: all 0.35s cubic-bezier(0.16, 1, 0.3, 1);
}

.toast-enter-from {
  opacity: 0;
  transform: translateX(40px) scale(0.95);
}

.toast-leave-to {
  opacity: 0;
  transform: translateX(30px) scale(0.9);
}
</style>
