<script setup lang="ts">
import { ref, reactive } from 'vue'
import { useAuthStore } from '~/stores/auth'
import { useToast } from '~/composables/useToast'
import { formatCpf, unmaskCpf, isValidCpf } from '~~/shared/utils/cpf'
import { IdCard, Lock, Eye, EyeOff } from 'lucide-vue-next'

definePageMeta({
  layout: false,
  middleware: 'guest',
  alias: ['/login']
})

const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()
const toast = useToast()

const form = reactive({
  cpf: '',
  password: ''
})

const obscurePassword = ref(true)
const errors = reactive({
  cpf: '',
  password: '',
  general: ''
})

function onCpfInput(event: Event) {
  const target = event.target as HTMLInputElement
  form.cpf = formatCpf(target.value)
  if (errors.cpf) errors.cpf = ''
  if (errors.general) errors.general = ''
}

function onPasswordInput(event: Event) {
  const target = event.target as HTMLInputElement
  form.password = target.value
  if (errors.password) errors.password = ''
  if (errors.general) errors.general = ''
}

function handleFillCredentials(data: { cpf: string; pass: string }) {
  form.cpf = formatCpf(data.cpf)
  form.password = data.pass
  errors.cpf = ''
  errors.password = ''
  errors.general = ''
}

onMounted(() => {
  const handler = (e: Event) => {
    const custom = e as CustomEvent<{ cpf: string; pass: string }>
    if (custom?.detail) {
      handleFillCredentials(custom.detail)
    }
  }
  window.addEventListener('dev-fill-credentials', handler)
  onUnmounted(() => {
    window.removeEventListener('dev-fill-credentials', handler)
  })
})

async function handleLogin() {
  errors.cpf = ''
  errors.password = ''
  errors.general = ''

  const cleanCpf = unmaskCpf(form.cpf)

  const result = await authStore.login({
    cpf: cleanCpf,
    password: form.password
  })

  if (result.success) {
    const redirectUrl = (route.query.redirect as string) || '/'
    router.push(redirectUrl)
  } else {
    errors.general = result.message || 'Falha ao realizar login'
    toast.error(errors.general)
  }
}
</script>

<template>
  <div class="flutter-scaffold">
    <!-- Background Gradient -->
    <div class="bg-gradient"></div>

    <!-- Background Pattern Overlay -->
    <div class="bg-pattern-overlay"></div>

    <!-- SafeArea + SingleChildScrollView -->
    <div class="safe-area">
      <div class="scroll-content animate-fade-in">
        <!-- Logo Container with glow and ClipOval -->
        <div class="logo-container">
          <div class="logo-clip-oval">
            <img
              src="/logo.png"
              alt="Katari Logo"
              class="logo-img"
              @error="($event.target as HTMLElement).style.display = 'none'"
            />
          </div>
        </div>

        <!-- Katari Title -->
        <h1 class="brand-title">Katari</h1>

        <!-- Subtitle -->
        <p class="brand-subtitle">Seu sonho em duas rodas</p>

        <div class="spacer-30"></div>

        <!-- Login Card -->
        <div class="login-card">
          <!-- CPF Field -->
          <div class="flutter-input-group" :class="{ 'has-error': !!errors.cpf }">
            <label class="flutter-label">CPF</label>
            <div class="flutter-input-box">
              <span class="flutter-prefix-icon">
                <IdCard :size="20" />
              </span>
              <input
                type="tel"
                :value="form.cpf"
                placeholder="000.000.000-00"
                maxlength="14"
                class="flutter-native-input"
                @input="onCpfInput"
                @keyup.enter="handleLogin"
              />
            </div>
            <span v-if="errors.cpf" class="field-error-text">{{ errors.cpf }}</span>
          </div>

          <div class="spacer-20"></div>

          <!-- Password Field -->
          <div class="flutter-input-group" :class="{ 'has-error': !!errors.password }">
            <label class="flutter-label">Senha</label>
            <div class="flutter-input-box">
              <span class="flutter-prefix-icon">
                <Lock :size="20" />
              </span>
              <input
                :type="obscurePassword ? 'password' : 'text'"
                :value="form.password"
                placeholder="••••••••"
                class="flutter-native-input"
                @input="onPasswordInput"
                @keyup.enter="handleLogin"
              />
              <button
                type="button"
                class="flutter-suffix-btn"
                tabindex="-1"
                @click="obscurePassword = !obscurePassword"
              >
                <component :is="obscurePassword ? EyeOff : Eye" :size="20" />
              </button>
            </div>
            <span v-if="errors.password" class="field-error-text">{{ errors.password }}</span>
          </div>

          <div class="spacer-5"></div>

          <!-- Forgot Password -->
          <div class="forgot-password-align">
            <button type="button" class="forgot-btn" @click="toast.info('Funcionalidade de recuperação em breve.')">
              Esqueceu a senha?
            </button>
          </div>

          <div class="spacer-5"></div>

          <!-- Login Button -->
          <button
            type="button"
            class="flutter-elevated-button"
            :disabled="authStore.isLoading"
            @click="handleLogin"
          >
            <div v-if="authStore.isLoading" class="flutter-spinner"></div>
            <span v-else class="flutter-button-text">ENTRAR</span>
          </button>
        </div>

        <div class="spacer-24"></div>

        <!-- Create Account Link -->
        <NuxtLink to="/auth/register" class="create-account-link">
          Não tem uma conta? <span class="create-now-underline">Criar agora</span>
        </NuxtLink>

        <div class="spacer-30"></div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.flutter-scaffold {
  position: relative;
  min-height: 100vh;
  width: 100vw;
  overflow-x: hidden;
  display: flex;
  justify-content: center;
  align-items: center;
  font-family: 'Outfit', sans-serif;
}

.bg-gradient {
  position: fixed;
  inset: 0;
  background: linear-gradient(135deg, #263238 0%, rgba(38, 50, 56, 0.8) 50%, #000000 100%);
  z-index: 1;
}

.bg-pattern-overlay {
  position: fixed;
  inset: 0;
  background-image: url('https://images.unsplash.com/photo-1558981852-426c6c22a060?w=800');
  background-size: cover;
  background-position: center;
  opacity: 0.05;
  pointer-events: none;
  z-index: 2;
}

.safe-area {
  position: relative;
  z-index: 10;
  width: 100%;
  max-width: 440px;
  padding: 24px 20px;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.scroll-content {
  width: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
}

.logo-container {
  padding: 7px;
  background: #FFFFFF;
  border-radius: 50%;
  box-shadow: 0 0 30px rgba(255, 109, 0, 0.3), 0 0 10px rgba(255, 109, 0, 0.2);
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 16px;
}

.logo-clip-oval {
  width: 70px;
  height: 70px;
  border-radius: 50%;
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
}

.logo-img {
  width: 70px;
  height: 70px;
  object-fit: cover;
  transform: scale(1.2);
}

.brand-title {
  font-size: 36px;
  font-weight: 800;
  color: #FFFFFF;
  letter-spacing: 1.2px;
  line-height: 1;
  margin-bottom: 6px;
}

.brand-subtitle {
  font-size: 16px;
  color: rgba(255, 255, 255, 0.9);
  letter-spacing: 0.5px;
}

.spacer-5 { height: 5px; }
.spacer-20 { height: 20px; }
.spacer-24 { height: 24px; }
.spacer-30 { height: 30px; }

.login-card {
  width: 100%;
  background: #FFFFFF;
  border-radius: 24px;
  padding: 28px;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.2);
  text-align: left;
}

.forgot-password-align {
  display: flex;
  justify-content: flex-end;
}

.forgot-btn {
  background: transparent;
  border: none;
  color: #FF6D00;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  padding: 4px 0;
}

.forgot-btn:hover {
  text-decoration: underline;
}

.flutter-spinner {
  width: 24px;
  height: 24px;
  border: 2.5px solid rgba(255, 255, 255, 0.4);
  border-top-color: #FFFFFF;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

.create-account-link {
  color: rgba(255, 255, 255, 0.7);
  font-size: 15px;
  text-decoration: none;
  cursor: pointer;
}

.create-now-underline {
  color: #FFFFFF;
  font-weight: 700;
  text-decoration: underline;
}

@media (max-width: 480px) {
  .safe-area {
    padding: 16px 14px;
  }
  .login-card {
    padding: 24px 20px;
  }
}
</style>
