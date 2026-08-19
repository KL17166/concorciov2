<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '~/stores/auth'
import { useConsortiumStore } from '~/stores/consortium'
import { useCheckoutStore } from '~/stores/checkout'
import {
  ArrowLeft,
  ArrowRight,
  User,
  MapPin,
  Camera,
  Check,
  CreditCard,
  Building,
  Hash,
  Home,
  Phone,
  Calendar,
  AlertCircle,
  UploadCloud,
  CheckCircle2,
  RefreshCw,
  Zap,
  Sparkles
} from 'lucide-vue-next'

definePageMeta({
  middleware: 'auth',
  hideHeader: true,
  alias: ['/checkout']
})

const router = useRouter()
const authStore = useAuthStore()
const consortiumStore = useConsortiumStore()
const checkoutStore = useCheckoutStore()

const currentStep = ref(0)
const isLoadingCep = ref(false)
const isAddressExpanded = ref(false)
const isManualAddressMode = ref(false)
const cepSuccessMsg = ref<string | null>(null)
const formError = ref<string | null>(null)

// Step 0 - Personal
const name = ref('')
const cpf = ref('')
const phone = ref('')

// Step 1 - Address
const cep = ref('')
const street = ref('')
const number = ref('')
const district = ref('')
const city = ref('')
const state = ref('')
const complement = ref('')

// Step 2 - Documents
const docFront = ref<string | null>(null)
const docBack = ref<string | null>(null)
const selfie = ref<string | null>(null)

onMounted(() => {
  checkoutStore.initFromAuth()

  // Pre-fill from store or auth
  name.value = checkoutStore.personal.name
  cpf.value = formatCpf(checkoutStore.personal.cpf)
  phone.value = formatPhone(checkoutStore.personal.phone)

  cep.value = formatCep(checkoutStore.address.cep)
  street.value = checkoutStore.address.street
  number.value = checkoutStore.address.number
  district.value = checkoutStore.address.district
  city.value = checkoutStore.address.city
  state.value = checkoutStore.address.state
  complement.value = checkoutStore.address.complement || ''

  if (street.value && street.value.trim().length > 0) {
    isAddressExpanded.value = true
  }

  docFront.value = checkoutStore.documents.front
  docBack.value = checkoutStore.documents.back
  selfie.value = checkoutStore.documents.selfie
})

// Formatting helpers
function formatCpf(v: string) {
  const digits = v.replace(/\D/g, '').slice(0, 11)
  if (digits.length <= 3) return digits
  if (digits.length <= 6) return `${digits.slice(0, 3)}.${digits.slice(3)}`
  if (digits.length <= 9) return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6)}`
  return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9, 11)}`
}

function formatDateMask(v: string) {
  const digits = v.replace(/\D/g, '').slice(0, 8)
  if (digits.length <= 2) return digits
  if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`
  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4, 8)}`
}

function formatPhone(v: string) {
  const digits = v.replace(/\D/g, '').slice(0, 11)
  if (digits.length <= 2) return digits
  if (digits.length <= 7) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7, 11)}`
}

function formatCep(v: string) {
  const digits = v.replace(/\D/g, '').slice(0, 8)
  if (digits.length <= 5) return digits
  return `${digits.slice(0, 5)}-${digits.slice(5, 8)}`
}

// Watchers for masked input
watch(cpf, (val) => {
  cpf.value = formatCpf(val)
})
watch(phone, (val) => {
  phone.value = formatPhone(val)
})
watch(cep, (val) => {
  const formatted = formatCep(val)
  cep.value = formatted
  const raw = formatted.replace(/\D/g, '')
  if (raw.length === 8) {
    fetchAddressFromViaCep(raw)
  }
})

// Validation algorithms
function isValidCpf(str: string): boolean {
  const clean = str.replace(/\D/g, '')
  if (clean.length !== 11) return false

  if (/^(\d)\1{10}$/.test(clean)) return false

  let sum = 0
  for (let i = 0; i < 9; i++) {
    sum += parseInt(clean.charAt(i), 10) * (10 - i)
  }
  let firstDigit = (sum * 10) % 11
  if (firstDigit === 10) firstDigit = 0
  if (firstDigit !== parseInt(clean.charAt(9), 10)) return false

  sum = 0
  for (let i = 0; i < 10; i++) {
    sum += parseInt(clean.charAt(i), 10) * (11 - i)
  }
  let secondDigit = (sum * 10) % 11
  if (secondDigit === 10) secondDigit = 0
  return secondDigit === parseInt(clean.charAt(10), 10)
}

async function fetchAddressFromViaCep(cleanCep: string) {
  isLoadingCep.value = true
  cepSuccessMsg.value = null
  formError.value = null

  try {
    const res = await $fetch<any>(`https://viacep.com.br/ws/${cleanCep}/json/`)
    if (res.erro) {
      formError.value = 'CEP não encontrado. Por favor, preencha o endereço manualmente abaixo.'
      isAddressExpanded.value = true
      isManualAddressMode.value = true
    } else {
      street.value = res.logradouro || ''
      district.value = res.bairro || ''
      city.value = res.localidade || ''
      state.value = (res.uf || '').toUpperCase()
      cepSuccessMsg.value = 'Endereço localizado! Informe o número da residência.'
      isAddressExpanded.value = true
      isManualAddressMode.value = false

      // Auto focus on number input
      setTimeout(() => {
        const numInput = document.getElementById('number-input')
        numInput?.focus()
      }, 150)
    }
  } catch (_) {
    formError.value = 'Erro ao consultar CEP. Preencha o endereço manualmente abaixo.'
    isAddressExpanded.value = true
    isManualAddressMode.value = true
  } finally {
    isLoadingCep.value = false
  }
}

// Document File Upload
function handleFileUpload(event: Event, type: 'front' | 'back' | 'selfie') {
  const target = event.target as HTMLInputElement
  const file = target.files?.[0]
  if (!file) return

  const reader = new FileReader()
  reader.onload = (e) => {
    const result = e.target?.result as string
    if (type === 'front') docFront.value = result
    if (type === 'back') docBack.value = result
    if (type === 'selfie') selfie.value = result
    checkoutStore.updateDocument(type, result)
  }
  reader.readAsDataURL(file)
}

function validateCurrentStep(): boolean {
  formError.value = null

  if (currentStep.value === 0) {
    if (!name.value.trim() || name.value.trim().length < 3) {
      formError.value = 'Informe seu nome completo.'
      return false
    }
    if (!isValidCpf(cpf.value)) {
      formError.value = 'CPF inválido. Verifique os dígitos digitados.'
      return false
    }
    if (phone.value.replace(/\D/g, '').length < 10) {
      formError.value = 'Telefone com DDD inválido.'
      return false
    }
    return true
  }

  if (currentStep.value === 1) {
    if (cep.value.replace(/\D/g, '').length !== 8) {
      formError.value = 'Informe um CEP válido com 8 dígitos.'
      return false
    }
    if (!isAddressExpanded.value) {
      formError.value = 'Aguarde a busca do CEP ou clique para preencher manualmente.'
      return false
    }
    if (!street.value.trim()) {
      formError.value = 'Informe o nome da rua/avenida.'
      return false
    }
    if (!number.value.trim()) {
      formError.value = 'Informe o número da residência.'
      const numInput = document.getElementById('number-input')
      numInput?.focus()
      return false
    }
    if (!district.value.trim()) {
      formError.value = 'Informe o bairro.'
      return false
    }
    if (!city.value.trim()) {
      formError.value = 'Informe a cidade.'
      return false
    }
    if (!state.value.trim() || state.value.trim().length !== 2) {
      formError.value = 'Informe a UF do estado (2 letras).'
      return false
    }
    return true
  }

  if (currentStep.value === 2) {
    if (!docFront.value) {
      formError.value = 'Envie a foto da frente do seu RG ou CNH.'
      return false
    }
    if (!docBack.value) {
      formError.value = 'Envie a foto do verso do seu RG ou CNH.'
      return false
    }
    if (!selfie.value) {
      formError.value = 'Envie sua selfie segurando o documento.'
      return false
    }
    return true
  }

  return true
}

function handleContinue() {
  if (!validateCurrentStep()) return

  if (currentStep.value === 0) {
    checkoutStore.updatePersonal({
      name: name.value,
      cpf: cpf.value,
      phone: phone.value
    })
    currentStep.value = 1
    window.scrollTo({ top: 0, behavior: 'smooth' })
  } else if (currentStep.value === 1) {
    checkoutStore.updateAddress({
      cep: cep.value,
      street: street.value,
      number: number.value,
      district: district.value,
      city: city.value,
      state: state.value.toUpperCase(),
      complement: complement.value
    })
    currentStep.value = 2
    window.scrollTo({ top: 0, behavior: 'smooth' })
  } else if (currentStep.value === 2) {
    checkoutStore.updateDocument('front', docFront.value!)
    checkoutStore.updateDocument('back', docBack.value!)
    checkoutStore.updateDocument('selfie', selfie.value!)
    router.push('/checkout/contract')
  }
}
</script>

<template>
  <div class="checkout-screen-wrapper">
    <!-- Top App Bar -->
    <header class="appbar-header">
      <button class="appbar-back-btn" aria-label="Voltar" @click="currentStep > 0 ? currentStep-- : router.back()">
        <ArrowLeft :size="22" color="#263238" />
      </button>
      <h1 class="appbar-title">Contratação</h1>
      <div class="appbar-spacer"></div>
    </header>

    <!-- 1. Progress Step Bar -->
    <div class="checkout-stepper-bar">
      <div class="stepper-track">
        <!-- Step 0 -->
        <div class="step-item" :class="{ active: currentStep >= 0, completed: currentStep > 0 }">
          <div class="step-circle">
            <Check v-if="currentStep > 0" :size="18" color="#FFFFFF" />
            <User v-else :size="18" :color="currentStep === 0 ? '#FFFFFF' : '#9E9E9E'" />
          </div>
          <span class="step-label">Pessoal</span>
        </div>

        <div class="step-connector" :class="{ active: currentStep >= 1 }"></div>

        <!-- Step 1 -->
        <div class="step-item" :class="{ active: currentStep >= 1, completed: currentStep > 1 }">
          <div class="step-circle">
            <Check v-if="currentStep > 1" :size="18" color="#FFFFFF" />
            <MapPin v-else :size="18" :color="currentStep >= 1 ? '#FFFFFF' : '#9E9E9E'" />
          </div>
          <span class="step-label">Endereço</span>
        </div>

        <div class="step-connector" :class="{ active: currentStep >= 2 }"></div>

        <!-- Step 2 -->
        <div class="step-item" :class="{ active: currentStep >= 2 }">
          <div class="step-circle">
            <Camera :size="18" :color="currentStep >= 2 ? '#FFFFFF' : '#9E9E9E'" />
          </div>
          <span class="step-label">Documentos</span>
        </div>
      </div>
    </div>

    <main class="checkout-content-container">
      <!-- Error Message Banner -->
      <div v-if="formError" class="checkout-error-banner">
        <AlertCircle :size="18" color="#D32F2F" />
        <span>{{ formError }}</span>
      </div>

      <!-- Success CEP Banner -->
      <div v-if="cepSuccessMsg && currentStep === 1" class="checkout-success-banner">
        <CheckCircle2 :size="18" color="#2E7D32" />
        <span>{{ cepSuccessMsg }}</span>
      </div>

      <!-- ── STEP 0: DADOS PESSOAIS ────────────────────────────────────────── -->
      <section v-if="currentStep === 0" class="step-card-box">
        <div class="step-card-header">
          <h2 class="step-title">Dados Pessoais</h2>
          <p class="step-subtitle">Preencha seus dados cadastrais para o contrato</p>
        </div>

        <div class="form-grid">
          <!-- Nome -->
          <div class="input-group">
            <label class="input-label" for="name-input">Nome Completo</label>
            <div class="input-wrapper">
              <User :size="18" class="input-icon" />
              <input
                id="name-input"
                v-model="name"
                type="text"
                placeholder="Ex: João da Silva"
                class="form-input"
              />
            </div>
          </div>

          <!-- CPF -->
          <div class="input-group">
            <label class="input-label" for="cpf-input">CPF</label>
            <div class="input-wrapper">
              <CreditCard :size="18" class="input-icon" />
              <input
                id="cpf-input"
                v-model="cpf"
                type="text"
                placeholder="000.000.000-00"
                maxlength="14"
                class="form-input"
              />
            </div>
          </div>

          <!-- Telefone -->
          <div class="input-group">
            <label class="input-label" for="phone-input">Telefone Celular</label>
            <div class="input-wrapper">
              <Phone :size="18" class="input-icon" />
              <input
                id="phone-input"
                v-model="phone"
                type="text"
                placeholder="(00) 00000-0000"
                maxlength="15"
                class="form-input"
              />
            </div>
          </div>
        </div>
      </section>

      <!-- ── STEP 1: ENDEREÇO ─────────────────────────────────────────────── -->
      <section v-if="currentStep === 1" class="step-card-box">
        <div class="step-card-header">
          <h2 class="step-title">Endereço Residencial</h2>
          <p class="step-subtitle">
            {{ isAddressExpanded ? 'Confira os dados e informe o número da residência' : 'Digite seu CEP para carregar o endereço automaticamente' }}
          </p>
        </div>

        <div class="form-grid">
          <!-- CEP -->
          <div class="input-group">
            <div class="input-label-row">
              <label class="input-label" for="cep-input">CEP</label>
              <button
                v-if="!isAddressExpanded && !isLoadingCep"
                type="button"
                class="btn-text-action"
                @click="isAddressExpanded = true; isManualAddressMode = true"
              >
                Preencher endereço manualmente
              </button>
            </div>
            <div class="input-wrapper">
              <MapPin :size="18" class="input-icon" />
              <input
                id="cep-input"
                v-model="cep"
                type="text"
                placeholder="00000-000"
                maxlength="9"
                class="form-input"
              />
              <div v-if="isLoadingCep" class="input-loader">
                <RefreshCw :size="16" class="spin-icon" />
              </div>
            </div>
          </div>

          <!-- Loading State Box -->
          <div v-if="isLoadingCep" class="cep-loading-state">
            <RefreshCw :size="16" class="spin-icon" />
            <span>Buscando dados do CEP na base dos Correios...</span>
          </div>

          <!-- Expanded Address Details (Animated) -->
          <Transition name="slide-expand">
            <div v-if="isAddressExpanded" class="address-expanded-content">
              <!-- Rua -->
              <div class="input-group">
                <label class="input-label" for="street-input">Rua / Avenida</label>
                <div class="input-wrapper">
                  <Building :size="18" class="input-icon" />
                  <input
                    id="street-input"
                    v-model="street"
                    type="text"
                    placeholder="Nome do logradouro"
                    class="form-input"
                  />
                </div>
              </div>

              <!-- Número & Bairro -->
              <div class="form-row-two">
                <div class="input-group flex-1">
                  <label class="input-label" for="number-input">
                    Número <span class="required-star">*</span>
                  </label>
                  <div class="input-wrapper">
                    <Hash :size="18" class="input-icon" />
                    <input
                      id="number-input"
                      v-model="number"
                      type="text"
                      placeholder="123"
                      class="form-input highlight-number"
                    />
                  </div>
                </div>

                <div class="input-group flex-2">
                  <label class="input-label" for="district-input">Bairro</label>
                  <div class="input-wrapper">
                    <Building :size="18" class="input-icon" />
                    <input
                      id="district-input"
                      v-model="district"
                      type="text"
                      placeholder="Seu bairro"
                      class="form-input"
                    />
                  </div>
                </div>
              </div>

              <!-- Cidade & Estado -->
              <div class="form-row-two">
                <div class="input-group flex-3">
                  <label class="input-label" for="city-input">Cidade</label>
                  <div class="input-wrapper">
                    <Building :size="18" class="input-icon" />
                    <input
                      id="city-input"
                      v-model="city"
                      type="text"
                      placeholder="Sua cidade"
                      class="form-input"
                    />
                  </div>
                </div>

                <div class="input-group flex-1">
                  <label class="input-label" for="state-input">Estado (UF)</label>
                  <div class="input-wrapper">
                    <MapPin :size="18" class="input-icon" />
                    <input
                      id="state-input"
                      v-model="state"
                      type="text"
                      placeholder="UF"
                      maxlength="2"
                      class="form-input uppercase"
                    />
                  </div>
                </div>
              </div>

              <!-- Complemento -->
              <div class="input-group">
                <label class="input-label" for="comp-input">Complemento (Opcional)</label>
                <div class="input-wrapper">
                  <Home :size="18" class="input-icon" />
                  <input
                    id="comp-input"
                    v-model="complement"
                    type="text"
                    placeholder="Apto, Bloco, etc."
                    class="form-input"
                  />
                </div>
              </div>
            </div>
          </Transition>
        </div>
      </section>

      <!-- ── STEP 2: DOCUMENTOS / KYC ──────────────────────────────────────── -->
      <section v-if="currentStep === 2" class="step-card-box">
        <div class="step-card-header">
          <h2 class="step-title">Documentos de Identificação</h2>
          <p class="step-subtitle">Envie fotos nítidas do seu documento (RG ou CNH) e uma selfie</p>
        </div>

        <div class="docs-upload-list">
          <!-- Frente -->
          <div class="doc-upload-card" :class="{ uploaded: !!docFront }">
            <input
              id="file-front"
              type="file"
              accept="image/*"
              class="hidden-file-input"
              @change="handleFileUpload($event, 'front')"
            />
            <label for="file-front" class="doc-upload-label">
              <div class="doc-preview-box">
                <img v-if="docFront" :src="docFront" alt="Frente do Documento" class="preview-img" />
                <CreditCard v-else :size="32" color="#9E9E9E" />
              </div>
              <div class="doc-info-col">
                <span class="doc-name">Frente do RG / CNH</span>
                <span class="doc-desc">{{ docFront ? 'Foto anexada com sucesso' : 'Toque para enviar a foto' }}</span>
                <span v-if="docFront" class="doc-status-pill"><Check :size="12" /> Anexado</span>
              </div>
              <div class="doc-action-icon">
                <RefreshCw v-if="docFront" :size="20" color="#4CAF50" />
                <UploadCloud v-else :size="20" color="#FF6D00" />
              </div>
            </label>
          </div>

          <!-- Verso -->
          <div class="doc-upload-card" :class="{ uploaded: !!docBack }">
            <input
              id="file-back"
              type="file"
              accept="image/*"
              class="hidden-file-input"
              @change="handleFileUpload($event, 'back')"
            />
            <label for="file-back" class="doc-upload-label">
              <div class="doc-preview-box">
                <img v-if="docBack" :src="docBack" alt="Verso do Documento" class="preview-img" />
                <CreditCard v-else :size="32" color="#9E9E9E" />
              </div>
              <div class="doc-info-col">
                <span class="doc-name">Verso do RG / CNH</span>
                <span class="doc-desc">{{ docBack ? 'Foto anexada com sucesso' : 'Toque para enviar a foto' }}</span>
                <span v-if="docBack" class="doc-status-pill"><Check :size="12" /> Anexado</span>
              </div>
              <div class="doc-action-icon">
                <RefreshCw v-if="docBack" :size="20" color="#4CAF50" />
                <UploadCloud v-else :size="20" color="#FF6D00" />
              </div>
            </label>
          </div>

          <!-- Selfie -->
          <div class="doc-upload-card" :class="{ uploaded: !!selfie }">
            <input
              id="file-selfie"
              type="file"
              accept="image/*"
              class="hidden-file-input"
              @change="handleFileUpload($event, 'selfie')"
            />
            <label for="file-selfie" class="doc-upload-label">
              <div class="doc-preview-box">
                <img v-if="selfie" :src="selfie" alt="Selfie com Documento" class="preview-img" />
                <Camera v-else :size="32" color="#9E9E9E" />
              </div>
              <div class="doc-info-col">
                <span class="doc-name">Selfie com o Documento</span>
                <span class="doc-desc">{{ selfie ? 'Foto anexada com sucesso' : 'Segure o documento próximo ao rosto' }}</span>
                <span v-if="selfie" class="doc-status-pill"><Check :size="12" /> Anexado</span>
              </div>
              <div class="doc-action-icon">
                <RefreshCw v-if="selfie" :size="20" color="#4CAF50" />
                <UploadCloud v-else :size="20" color="#FF6D00" />
              </div>
            </label>
          </div>
        </div>
      </section>
    </main>

    <!-- Bottom Actions Bar -->
    <footer class="checkout-footer-bar">
      <div class="footer-buttons-row">
        <button
          v-if="currentStep > 0"
          class="btn-checkout-prev"
          @click="currentStep--"
        >
          VOLTAR
        </button>
        <button
          class="btn-checkout-next"
          :class="{ full: currentStep === 0 }"
          @click="handleContinue"
        >
          {{ currentStep < 2 ? 'CONTINUAR' : 'REVISAR CONTRATO' }}
        </button>
      </div>
    </footer>
  </div>
</template>

<style scoped>
.checkout-screen-wrapper {
  min-height: 100vh;
  background-color: var(--color-bg, #FAFAFA);
  font-family: 'Outfit', sans-serif;
  color: var(--color-secondary, #263238);
  display: flex;
  flex-direction: column;
}

/* ── Stepper Bar ────────────────────────────────────────────────────────── */
.checkout-stepper-bar {
  background-color: #FFFFFF;
  border-bottom: 1px solid var(--color-border, #E0E0E0);
  padding: 16px 24px;
}

.stepper-track {
  display: flex;
  align-items: center;
  justify-content: space-between;
  max-width: 500px;
  margin: 0 auto;
}

.step-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  z-index: 2;
}

.step-circle {
  width: 44px;
  height: 44px;
  border-radius: 50%;
  background-color: #F5F5F5;
  border: 2px solid var(--color-border, #E0E0E0);
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.25s ease;
}

.step-item.active .step-circle {
  background-color: var(--color-primary, #FF6D00);
  border-color: var(--color-primary, #FF6D00);
  box-shadow: 0 4px 12px rgba(255, 109, 0, 0.25);
}

.step-item.completed .step-circle {
  background-color: var(--color-primary, #FF6D00);
  border-color: var(--color-primary, #FF6D00);
  box-shadow: 0 4px 12px rgba(255, 109, 0, 0.25);
}

.step-label {
  font-size: 12px;
  font-weight: 600;
  color: #9E9E9E;
  transition: color 0.25s ease;
}

.step-item.active .step-label,
.step-item.completed .step-label {
  color: var(--color-primary, #FF6D00);
  font-weight: 700;
}

.step-connector {
  flex: 1;
  height: 3px;
  background-color: #EEEEEE;
  margin: 0 8px 20px 8px;
  border-radius: 2px;
  transition: background-color 0.25s ease;
}

.step-connector.active {
  background-color: var(--color-primary, #FF6D00);
}

/* ── Content Container ─────────────────────────────────────────────────── */
.checkout-content-container {
  flex: 1;
  max-width: 600px;
  width: 100%;
  margin: 0 auto;
  padding: 24px 20px 120px 20px;
}

/* ── Dev Bypass Action Card ─────────────────────────────────────────────── */
.dev-bypass-action-card {
  background: linear-gradient(135deg, #FFF8E1 0%, #FFF3E0 100%);
  border: 1.5px dashed #FFB74D;
  border-radius: 16px;
  padding: 16px;
  margin-bottom: 20px;
  display: flex;
  flex-direction: column;
  gap: 14px;
}

@media (min-width: 480px) {
  .dev-bypass-action-card {
    flex-direction: row;
    align-items: center;
    justify-content: space-between;
  }
}

.dev-bypass-left {
  display: flex;
  align-items: center;
  gap: 12px;
}

.dev-zap-circle {
  width: 38px;
  height: 38px;
  border-radius: 10px;
  background-color: rgba(255, 109, 0, 0.15);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.dev-bypass-texts {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.dev-bypass-title {
  font-size: 13.5px;
  font-weight: 800;
  color: #E65100;
}

.dev-bypass-sub {
  font-size: 11.5px;
  color: #8D6E63;
}

.dev-bypass-buttons {
  display: flex;
  gap: 8px;
}

.btn-dev-fill {
  padding: 8px 12px;
  border-radius: 10px;
  border: 1px solid #FFB74D;
  background-color: #FFFFFF;
  color: #E65100;
  font-size: 12px;
  font-weight: 700;
  display: flex;
  align-items: center;
  gap: 6px;
  cursor: pointer;
  transition: all 0.15s ease;
}

.btn-dev-fill:hover {
  background-color: #FFE082;
}

.btn-dev-skip {
  padding: 8px 14px;
  border-radius: 10px;
  border: none;
  background-color: #FF6D00;
  color: #FFFFFF;
  font-size: 12px;
  font-weight: 800;
  cursor: pointer;
  transition: all 0.15s ease;
  white-space: nowrap;
}

.btn-dev-skip:hover {
  background-color: #E65100;
}

.step-card-box {
  background-color: #FFFFFF;
  border: 1px solid var(--color-border, #E0E0E0);
  border-radius: 20px;
  padding: 24px;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.03);
}

.step-card-header {
  margin-bottom: 24px;
}

.step-title {
  font-size: 20px;
  font-weight: 800;
  color: var(--color-secondary, #263238);
  margin: 0 0 4px 0;
}

.step-subtitle {
  font-size: 13px;
  color: var(--color-text-muted, #757575);
  margin: 0;
}

/* ── Form Inputs ────────────────────────────────────────────────────────── */
.form-grid {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.form-row-two {
  display: flex;
  gap: 12px;
}

.flex-1 { flex: 1; }
.flex-2 { flex: 2; }
.flex-3 { flex: 3; }

.input-group {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.input-label {
  font-size: 13px;
  font-weight: 700;
  color: var(--color-secondary, #263238);
}

.input-label-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.btn-text-action {
  background: none;
  border: none;
  padding: 0;
  font-size: 12px;
  font-weight: 700;
  color: var(--color-primary, #FF6D00);
  cursor: pointer;
  text-decoration: underline;
  transition: color 0.15s ease;
}

.btn-text-action:hover {
  color: #E65100;
}

.required-star {
  color: #D32F2F;
  font-weight: 800;
}

.cep-loading-state {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 16px;
  background-color: #FFF3E0;
  border: 1px solid #FFE0B2;
  border-radius: 12px;
  color: #E65100;
  font-size: 13px;
  font-weight: 600;
}

.address-expanded-content {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.highlight-number:focus {
  border-color: #4CAF50;
  box-shadow: 0 0 0 3px rgba(76, 175, 80, 0.15);
}

/* ── Smooth Expand Animation ────────────────────────────────────────────── */
.slide-expand-enter-active,
.slide-expand-leave-active {
  transition: all 0.35s cubic-bezier(0.4, 0, 0.2, 1);
  overflow: hidden;
}

.slide-expand-enter-from,
.slide-expand-leave-to {
  opacity: 0;
  transform: translateY(-10px);
  max-height: 0;
}

.slide-expand-enter-to,
.slide-expand-leave-from {
  opacity: 1;
  transform: translateY(0);
  max-height: 500px;
}

.input-wrapper {
  position: relative;
  display: flex;
  align-items: center;
}

.input-icon {
  position: absolute;
  left: 14px;
  color: #9E9E9E;
  pointer-events: none;
}

.form-input {
  width: 100%;
  height: 50px;
  padding: 0 16px 0 44px;
  background-color: #FAFAFA;
  border: 1.5px solid var(--color-border, #E0E0E0);
  border-radius: 12px;
  font-size: 15px;
  color: var(--color-secondary, #263238);
  font-family: inherit;
  transition: all 0.2s ease;
}

.form-input:focus {
  outline: none;
  border-color: var(--color-primary, #FF6D00);
  background-color: #FFFFFF;
  box-shadow: 0 0 0 3px rgba(255, 109, 0, 0.1);
}

.text-center { text-align: center; }
.uppercase { text-transform: uppercase; }

.input-loader {
  position: absolute;
  right: 14px;
}

.spin-icon {
  animation: spin 1s linear infinite;
  color: var(--color-primary, #FF6D00);
}

@keyframes spin {
  100% { transform: rotate(360deg); }
}

/* ── Feedback Banners ───────────────────────────────────────────────────── */
.checkout-error-banner {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 16px;
  background-color: #FFEBEE;
  border: 1px solid #FFCDD2;
  border-radius: 12px;
  color: #D32F2F;
  font-size: 13px;
  font-weight: 600;
  margin-bottom: 20px;
}

.checkout-success-banner {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 16px;
  background-color: #E8F5E9;
  border: 1px solid #C8E6C9;
  border-radius: 12px;
  color: #2E7D32;
  font-size: 13px;
  font-weight: 600;
  margin-bottom: 20px;
}

/* ── Documents Upload Cards ─────────────────────────────────────────────── */
.docs-upload-list {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.hidden-file-input {
  display: none;
}

.doc-upload-card {
  border: 1.5px dashed var(--color-border, #E0E0E0);
  border-radius: 16px;
  background-color: #FAFAFA;
  transition: all 0.2s ease;
  overflow: hidden;
}

.doc-upload-card.uploaded {
  border-style: solid;
  border-color: #81C784;
  background-color: #F1F8E9;
}

.doc-upload-label {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 16px;
  cursor: pointer;
}

.doc-preview-box {
  width: 72px;
  height: 72px;
  border-radius: 12px;
  background-color: #FFFFFF;
  border: 1px solid #E0E0E0;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  flex-shrink: 0;
}

.preview-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.doc-info-col {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.doc-name {
  font-size: 14px;
  font-weight: 700;
  color: var(--color-secondary, #263238);
}

.doc-desc {
  font-size: 12px;
  color: var(--color-text-muted, #757575);
}

.doc-status-pill {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  align-self: flex-start;
  padding: 2px 8px;
  border-radius: 6px;
  background-color: #C8E6C9;
  color: #2E7D32;
  font-size: 11px;
  font-weight: 700;
}

.doc-action-icon {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  background-color: #FFFFFF;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 1px solid #E0E0E0;
}

/* ── Footer Actions Bar ─────────────────────────────────────────────────── */
.checkout-footer-bar {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  background-color: #FFFFFF;
  border-top: 1px solid var(--color-border, #E0E0E0);
  padding: 16px 20px;
  z-index: 40;
}

.footer-buttons-row {
  max-width: 600px;
  margin: 0 auto;
  display: flex;
  gap: 12px;
}

.btn-checkout-prev {
  flex: 1;
  height: 52px;
  border-radius: 14px;
  border: 1.5px solid var(--color-primary, #FF6D00);
  background-color: transparent;
  color: var(--color-primary, #FF6D00);
  font-size: 15px;
  font-weight: 700;
  cursor: pointer;
  transition: background 0.15s ease;
}

.btn-checkout-prev:hover {
  background-color: rgba(255, 109, 0, 0.05);
}

.btn-checkout-next {
  flex: 2;
  height: 52px;
  border-radius: 14px;
  border: none;
  background-color: var(--color-primary, #FF6D00);
  color: #FFFFFF;
  font-size: 15px;
  font-weight: 700;
  letter-spacing: 0.5px;
  cursor: pointer;
  box-shadow: 0 4px 12px rgba(255, 109, 0, 0.3);
  transition: background 0.15s ease;
}

.btn-checkout-next.full {
  flex: 1;
}

.btn-checkout-next:hover {
  background-color: #E65100;
}
</style>
