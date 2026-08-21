<script setup lang="ts">
import { ref, reactive } from 'vue'
import { useAuthStore } from '~/stores/auth'
import { useToast } from '~/composables/useToast'
import { formatCpf, unmaskCpf, isValidCpf } from '~~/shared/utils/cpf'
import { UserPlus, ArrowLeft, User, Mail, Phone, Lock, IdCard, Eye, EyeOff, CheckCircle } from 'lucide-vue-next'

definePageMeta({
  layout: false,
  middleware: 'guest',
  alias: ['/register']
})

const router = useRouter()
const authStore = useAuthStore()
const toast = useToast()

const form = reactive({
  name: '',
  email: '',
  cpf: '',
  phone: '',
  password: '',
  confirmPassword: ''
})

const obscurePassword = ref(true)
const obscureConfirmPassword = ref(true)
const isSubmitting = ref(false)

const errors = reactive({
  name: '',
  email: '',
  cpf: '',
  phone: '',
  password: '',
  confirmPassword: '',
  general: ''
})

function onCpfInput(event: Event) {
  const target = event.target as HTMLInputElement
  form.cpf = formatCpf(target.value)
  if (errors.cpf) errors.cpf = ''
  if (errors.general) errors.general = ''
}

function onPhoneInput(event: Event) {
  const target = event.target as HTMLInputElement
  let v = target.value.replace(/\D/g, '').slice(0, 11)
  if (v.length > 10) {
    v = v.replace(/^(\d{2})(\d{5})(\d{4})$/, '($1) $2-$3')
  } else if (v.length > 5) {
    v = v.replace(/^(\d{2})(\d{4})(\d{0,4})$/, '($1) $2-$3')
  } else if (v.length > 2) {
    v = v.replace(/^(\d{2})(\d{0,5})$/, '($1) $2')
  }
  form.phone = v
  if (errors.phone) errors.phone = ''
}

function validate(): boolean {
  let valid = true

  if (!form.name.trim()) {
    errors.name = 'Nome é obrigatório'
    valid = false
  }

  if (!form.email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
    errors.email = 'E-mail válido é obrigatório'
    valid = false
  }

  const cleanCpf = unmaskCpf(form.cpf)
  if (!isValidCpf(cleanCpf)) {
    errors.cpf = 'CPF inválido'
    valid = false
  }

  if (!form.password || form.password.length < 6) {
    errors.password = 'A senha deve ter pelo menos 6 caracteres'
    valid = false
  }

  if (form.password !== form.confirmPassword) {
    errors.confirmPassword = 'As senhas não coincidem'
    valid = false
  }

  return valid
}

async function handleRegister() {
  errors.name = ''
  errors.email = ''
  errors.cpf = ''
  errors.phone = ''
  errors.password = ''
  errors.confirmPassword = ''
  errors.general = ''

  if (!validate()) return

  isSubmitting.value = true

  try {
    const result = await authStore.register({
      name: form.name.trim(),
      email: form.email.trim().toLowerCase(),
      cpf: form.cpf,
      phone: form.phone.trim() || undefined,
      password: form.password
    })

    if (result.success) {
      toast.success('Conta criada com sucesso! Seja bem-vindo(a).')
      router.push('/')
    } else {
      errors.general = result.message || 'Erro ao criar conta'
      toast.error(errors.general)
    }
  } catch (err: any) {
    errors.general = err.message || 'Erro inesperado'
    toast.error(errors.general)
  } finally {
    isSubmitting.value = false
  }
}
</script>

<template>
  <div class="flutter-scaffold">
    <div class="bg-gradient"></div>
    <div class="bg-pattern-overlay"></div>

    <div class="safe-area">
      <div class="scroll-content animate-fade-in">
        <div class="logo-container">
          <div class="logo-glow"></div>
          <div class="logo-circle">
            <UserPlus :size="32" color="#FFFFFF" />
          </div>
        </div>

        <h1 class="screen-title">Criar Conta Katari</h1>
        <p class="screen-subtitle">Preencha seus dados para começar seu consórcio</p>

        <form class="login-card" @submit.prevent="handleRegister">
          <div v-if="errors.general" class="error-banner">
            {{ errors.general }}
          </div>

          <!-- Nome -->
          <div class="field-container">
            <label class="field-label">Nome Completo</label>
            <div class="input-shell" :class="{ 'has-error': errors.name }">
              <User class="field-icon" :size="20" />
              <input
                v-model="form.name"
                type="text"
                class="field-input"
                placeholder="Ex: Carlos Alberto Silva"
                required
              />
            </div>
            <span v-if="errors.name" class="field-error-text">{{ errors.name }}</span>
          </div>

          <!-- E-mail -->
          <div class="field-container">
            <label class="field-label">E-mail</label>
            <div class="input-shell" :class="{ 'has-error': errors.email }">
              <Mail class="field-icon" :size="20" />
              <input
                v-model="form.email"
                type="email"
                class="field-input"
                placeholder="seu.email@exemplo.com"
                required
              />
            </div>
            <span v-if="errors.email" class="field-error-text">{{ errors.email }}</span>
          </div>

          <!-- CPF -->
          <div class="field-container">
            <label class="field-label">CPF</label>
            <div class="input-shell" :class="{ 'has-error': errors.cpf }">
              <IdCard class="field-icon" :size="20" />
              <input
                :value="form.cpf"
                type="text"
                class="field-input"
                placeholder="000.000.000-00"
                maxlength="14"
                required
                @input="onCpfInput"
              />
            </div>
            <span v-if="errors.cpf" class="field-error-text">{{ errors.cpf }}</span>
          </div>

          <!-- Telefone -->
          <div class="field-container">
            <label class="field-label">Telefone Celular (WhatsApp)</label>
            <div class="input-shell" :class="{ 'has-error': errors.phone }">
              <Phone class="field-icon" :size="20" />
              <input
                :value="form.phone"
                type="tel"
                class="field-input"
                placeholder="(11) 99999-9999"
                maxlength="15"
                @input="onPhoneInput"
              />
            </div>
            <span v-if="errors.phone" class="field-error-text">{{ errors.phone }}</span>
          </div>

          <!-- Senha -->
          <div class="field-container">
            <label class="field-label">Senha</label>
            <div class="input-shell" :class="{ 'has-error': errors.password }">
              <Lock class="field-icon" :size="20" />
              <input
                v-model="form.password"
                :type="obscurePassword ? 'password' : 'text'"
                class="field-input"
                placeholder="Mínimo 6 caracteres"
                minlength="6"
                required
              />
              <button
                type="button"
                class="eye-button"
                tabindex="-1"
                @click="obscurePassword = !obscurePassword"
              >
                <EyeOff v-if="obscurePassword" :size="20" />
                <Eye v-else :size="20" />
              </button>
            </div>
            <span v-if="errors.password" class="field-error-text">{{ errors.password }}</span>
          </div>

          <!-- Confirmar Senha -->
          <div class="field-container">
            <label class="field-label">Confirmar Senha</label>
            <div class="input-shell" :class="{ 'has-error': errors.confirmPassword }">
              <Lock class="field-icon" :size="20" />
              <input
                v-model="form.confirmPassword"
                :type="obscureConfirmPassword ? 'password' : 'text'"
                class="field-input"
                placeholder="Repita sua senha"
                minlength="6"
                required
              />
              <button
                type="button"
                class="eye-button"
                tabindex="-1"
                @click="obscureConfirmPassword = !obscureConfirmPassword"
              >
                <EyeOff v-if="obscureConfirmPassword" :size="20" />
                <Eye v-else :size="20" />
              </button>
            </div>
            <span v-if="errors.confirmPassword" class="field-error-text">{{ errors.confirmPassword }}</span>
          </div>

          <button
            type="submit"
            class="submit-button"
            :disabled="isSubmitting || authStore.isLoading"
          >
            <span v-if="!isSubmitting && !authStore.isLoading">Criar Minha Conta</span>
            <span v-else class="loading-spinner"></span>
          </button>
        </form>

        <div class="create-account-container">
          <span class="create-account-text">Já possui uma conta?</span>
          <NuxtLink to="/auth/login" class="create-account-link">
            Fazer Login
          </NuxtLink>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.flutter-scaffold {
  position: relative;
  min-height: 100vh;
  width: 100%;
  background-color: var(--color-bg-dark, #102027);
  display: flex;
  justify-content: center;
  align-items: flex-start;
  overflow-y: auto;
}

.bg-gradient {
  position: fixed;
  inset: 0;
  background: radial-gradient(circle at 50% 15%, rgba(255, 109, 0, 0.15) 0%, transparent 60%);
  pointer-events: none;
}

.bg-pattern-overlay {
  position: fixed;
  inset: 0;
  background-image: radial-gradient(rgba(255, 255, 255, 0.05) 1px, transparent 1px);
  background-size: 24px 24px;
  pointer-events: none;
}

.safe-area {
  position: relative;
  z-index: 1;
  width: 100%;
  max-width: 440px;
  padding: 32px 16px 48px;
  margin: auto;
}

.scroll-content {
  display: flex;
  flex-direction: column;
  align-items: center;
}

.logo-container {
  position: relative;
  margin-bottom: 20px;
}

.logo-glow {
  position: absolute;
  inset: -10px;
  background: radial-gradient(circle, rgba(255, 109, 0, 0.4) 0%, transparent 70%);
  filter: blur(12px);
  border-radius: 50%;
}

.logo-circle {
  position: relative;
  width: 68px;
  height: 68px;
  border-radius: 50%;
  background: linear-gradient(135deg, #FF6D00 0%, #E65100 100%);
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 10px 25px rgba(255, 109, 0, 0.35);
}

.screen-title {
  font-size: 24px;
  font-weight: 800;
  color: #FFFFFF;
  margin-bottom: 6px;
  text-align: center;
}

.screen-subtitle {
  font-size: 14px;
  color: #90A4AE;
  margin-bottom: 24px;
  text-align: center;
}

.login-card {
  width: 100%;
  background: rgba(38, 50, 56, 0.7);
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 24px;
  padding: 28px 20px;
  box-shadow: 0 20px 40px rgba(0, 0, 0, 0.4);
}

.error-banner {
  background: rgba(211, 47, 47, 0.15);
  border: 1px solid rgba(211, 47, 47, 0.4);
  color: #EF5350;
  font-size: 13px;
  padding: 10px 14px;
  border-radius: 12px;
  margin-bottom: 18px;
  text-align: center;
}

.field-container {
  margin-bottom: 16px;
  display: flex;
  flex-direction: column;
}

.field-label {
  font-size: 13px;
  font-weight: 600;
  color: #ECEFF1;
  margin-bottom: 6px;
}

.input-shell {
  display: flex;
  align-items: center;
  background: rgba(16, 32, 39, 0.6);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 14px;
  padding: 0 12px;
  height: 48px;
  transition: all 0.2s ease;
}

.input-shell:focus-within {
  border-color: #FF6D00;
  box-shadow: 0 0 0 3px rgba(255, 109, 0, 0.2);
}

.input-shell.has-error {
  border-color: #D32F2F;
}

.field-icon {
  color: #90A4AE;
  margin-right: 10px;
  flex-shrink: 0;
}

.field-input {
  flex: 1;
  background: transparent;
  border: none;
  color: #FFFFFF;
  font-size: 14px;
  outline: none;
  width: 100%;
}

.field-input::placeholder {
  color: #546E7A;
}

.eye-button {
  background: transparent;
  border: none;
  color: #90A4AE;
  cursor: pointer;
  padding: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.eye-button:hover {
  color: #ECEFF1;
}

.field-error-text {
  font-size: 12px;
  color: #EF5350;
  margin-top: 4px;
}

.submit-button {
  width: 100%;
  height: 50px;
  background: linear-gradient(135deg, #FF6D00 0%, #E65100 100%);
  border: none;
  border-radius: 14px;
  color: #FFFFFF;
  font-size: 15px;
  font-weight: 700;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-top: 10px;
  box-shadow: 0 8px 20px rgba(255, 109, 0, 0.3);
  transition: transform 0.15s ease, box-shadow 0.15s ease;
}

.submit-button:hover:not(:disabled) {
  transform: translateY(-1px);
  box-shadow: 0 10px 25px rgba(255, 109, 0, 0.4);
}

.submit-button:active:not(:disabled) {
  transform: scale(0.98);
}

.submit-button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.create-account-container {
  margin-top: 24px;
  display: flex;
  align-items: center;
  gap: 6px;
}

.create-account-text {
  font-size: 14px;
  color: #90A4AE;
}

.create-account-link {
  font-size: 14px;
  font-weight: 700;
  color: #FF6D00;
  text-decoration: none;
}

.create-account-link:hover {
  text-decoration: underline;
}

.loading-spinner {
  width: 20px;
  height: 20px;
  border: 2px solid rgba(255, 255, 255, 0.3);
  border-top-color: #FFFFFF;
  border-radius: 50%;
  animation: spin 0.6s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}
</style>
