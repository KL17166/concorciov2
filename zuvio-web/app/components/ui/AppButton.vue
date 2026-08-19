<script setup lang="ts">
withDefaults(
  defineProps<{
    variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger'
    size?: 'sm' | 'md' | 'lg'
    loading?: boolean
    disabled?: boolean
    type?: 'button' | 'submit' | 'reset'
    block?: boolean
  }>(),
  {
    variant: 'primary',
    size: 'md',
    loading: false,
    disabled: false,
    type: 'button',
    block: false
  }
)
</script>

<template>
  <button
    :type="type"
    :disabled="disabled || loading"
    class="app-btn"
    :class="[
      `btn-${variant}`,
      `btn-${size}`,
      { 'btn-block': block, 'is-loading': loading }
    ]"
  >
    <div v-if="loading" class="btn-spinner animate-spin"></div>
    <span v-if="$slots.icon && !loading" class="btn-icon">
      <slot name="icon" />
    </span>
    <span class="btn-text" :class="{ 'opacity-0': loading }">
      <slot />
    </span>
  </button>
</template>

<style scoped>
.app-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  position: relative;
  border-radius: var(--radius-md);
  font-weight: 700;
  cursor: pointer;
  border: 1.5px solid transparent;
  transition: all var(--transition-fast);
  user-select: none;
  text-decoration: none;
  white-space: nowrap;
}

.btn-block {
  width: 100%;
}

/* ── Sizes ──────────────────────────────────────────────────────────────── */
.btn-sm {
  padding: 8px 14px;
  font-size: 13px;
  border-radius: var(--radius-sm);
}

.btn-md {
  padding: 12px 20px;
  font-size: 15px;
  height: 48px;
}

.btn-lg {
  padding: 15px 26px;
  font-size: 16px;
  height: 54px;
  letter-spacing: 0.5px;
}

/* ── Variants ───────────────────────────────────────────────────────────── */
.btn-primary {
  background-color: var(--color-primary);
  color: #FFFFFF;
  box-shadow: 0 4px 14px var(--color-primary-glow);
}

.btn-primary:hover:not(:disabled) {
  background-color: var(--color-primary-hover);
  transform: translateY(-1px);
  box-shadow: 0 6px 20px var(--color-primary-glow);
}

.btn-primary:active:not(:disabled) {
  transform: translateY(0);
}

.btn-secondary {
  background-color: var(--color-secondary);
  color: #FFFFFF;
}

.btn-secondary:hover:not(:disabled) {
  background-color: var(--color-secondary-light);
  transform: translateY(-1px);
}

.btn-outline {
  background-color: transparent;
  border-color: var(--color-border);
  color: var(--color-text-main);
}

.btn-outline:hover:not(:disabled) {
  background-color: var(--color-surface-variant);
  border-color: var(--color-border-strong);
}

.btn-ghost {
  background-color: transparent;
  color: var(--color-primary);
}

.btn-ghost:hover:not(:disabled) {
  background-color: var(--color-primary-subtle);
}

.btn-danger {
  background-color: var(--color-error);
  color: #FFFFFF;
}

.btn-danger:hover:not(:disabled) {
  background-color: var(--color-error-light);
}

/* ── Disabled & Loading ─────────────────────────────────────────────────── */
.app-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
  transform: none !important;
  box-shadow: none !important;
}

.btn-spinner {
  position: absolute;
  width: 20px;
  height: 20px;
  border: 2.5px solid rgba(255, 255, 255, 0.4);
  border-top-color: #FFFFFF;
  border-radius: 50%;
}

.opacity-0 {
  opacity: 0;
}
</style>
