<script setup lang="ts">
import { computed } from 'vue'

const props = withDefaults(
  defineProps<{
    modelValue: string | number
    label?: string
    id?: string
    name?: string
    type?: string
    placeholder?: string
    disabled?: boolean
    readonly?: boolean
    error?: string
    hint?: string
    required?: boolean
    mask?: string
  }>(),
  {
    type: 'text',
    disabled: false,
    readonly: false,
    required: false
  }
)

const emit = defineEmits<{
  (e: 'update:modelValue', value: string): void
  (e: 'blur', event: FocusEvent): void
  (e: 'focus', event: FocusEvent): void
}>()

const inputId = computed(() => props.id || 'input_' + Math.random().toString(36).substring(2, 9))

function onInput(event: Event) {
  const target = event.target as HTMLInputElement
  emit('update:modelValue', target.value)
}
</script>

<template>
  <div class="input-wrapper" :class="{ 'has-error': !!error, 'is-disabled': disabled }">
    <label v-if="label" :for="inputId" class="input-label">
      {{ label }}
      <span v-if="required" class="required-star">*</span>
    </label>

    <div class="input-container">
      <div v-if="$slots.prefix" class="input-prefix">
        <slot name="prefix" />
      </div>

      <input
        :id="inputId"
        :name="name"
        :type="type"
        :value="modelValue"
        :placeholder="placeholder"
        :disabled="disabled"
        :readonly="readonly"
        :required="required"
        class="native-input"
        @input="onInput"
        @blur="$emit('blur', $event)"
        @focus="$emit('focus', $event)"
      />

      <div v-if="$slots.suffix" class="input-suffix">
        <slot name="suffix" />
      </div>
    </div>

    <p v-if="error" class="input-error-msg">{{ error }}</p>
    <p v-else-if="hint" class="input-hint-msg">{{ hint }}</p>
  </div>
</template>

<style scoped>
.input-wrapper {
  display: flex;
  flex-direction: column;
  gap: 6px;
  width: 100%;
  text-align: left;
}

.input-label {
  font-size: 13px;
  font-weight: 600;
  color: var(--color-text-muted);
  letter-spacing: 0.2px;
}

.required-star {
  color: var(--color-primary);
  margin-left: 2px;
}

.input-container {
  display: flex;
  align-items: center;
  position: relative;
  background-color: var(--color-surface-variant);
  border: 1.5px solid var(--color-border);
  border-radius: var(--radius-md);
  transition: all var(--transition-fast);
  overflow: hidden;
}

.input-container:focus-within {
  border-color: var(--color-primary);
  background-color: #FFFFFF;
  box-shadow: 0 0 0 3px var(--color-primary-subtle);
}

.native-input {
  flex: 1;
  width: 100%;
  padding: 14px 16px;
  border: none;
  background: transparent;
  outline: none;
  font-size: 15px;
  font-weight: 500;
  color: var(--color-text-main);
}

.native-input::placeholder {
  color: var(--color-text-low);
  font-weight: 400;
}

.input-prefix {
  display: flex;
  align-items: center;
  padding-left: 14px;
  color: var(--color-text-muted);
}

.input-suffix {
  display: flex;
  align-items: center;
  padding-right: 12px;
  color: var(--color-text-muted);
}

/* ── Error & Disabled states ────────────────────────────────────────────── */
.has-error .input-container {
  border-color: var(--color-error);
  background-color: var(--color-error-subtle);
}

.has-error .input-container:focus-within {
  box-shadow: 0 0 0 3px rgba(211, 47, 47, 0.15);
}

.input-error-msg {
  font-size: 12px;
  font-weight: 500;
  color: var(--color-error);
  margin-top: 2px;
}

.input-hint-msg {
  font-size: 12px;
  color: var(--color-text-low);
  margin-top: 2px;
}

.is-disabled {
  opacity: 0.6;
  pointer-events: none;
}
</style>
