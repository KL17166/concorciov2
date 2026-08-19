<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '~/stores/auth'
import { useKycStore } from '~/stores/kyc'
import {
  ArrowLeft,
  ShieldCheck,
  AlertTriangle,
  Clock,
  CheckCircle2,
  Camera,
  CreditCard,
  UploadCloud,
  RefreshCw,
  Info
} from 'lucide-vue-next'

definePageMeta({
  middleware: 'auth',
  hideHeader: true,
  alias: ['/kyc', '/profile/kyc']
})

const router = useRouter()
const authStore = useAuthStore()
const kycStore = useKycStore()

const docFront = ref<string | null>(null)
const docBack = ref<string | null>(null)
const selfie = ref<string | null>(null)

const isSubmitting = ref(false)
const submitSuccess = ref(false)
const submitError = ref<string | null>(null)

const kycStatus = computed(() => authStore.user?.kycStatus || kycStore.status || 'NOT_SUBMITTED')
const rejectReason = computed(() => kycStore.rejectReason || 'Seus documentos anteriores estavam ilegíveis ou com reflexo. Por favor, envie novas fotos nítidas.')

onMounted(async () => {
  await kycStore.fetchStatus()
  docFront.value = kycStore.documentFrontUrl
  docBack.value = kycStore.documentBackUrl
  selfie.value = kycStore.selfieUrl
})

function handleFileUpload(event: Event, type: 'document' | 'document_back' | 'selfie') {
  const target = event.target as HTMLInputElement
  const file = target.files?.[0]
  if (!file) return

  const reader = new FileReader()
  reader.onload = async (e) => {
    const result = e.target?.result as string
    if (type === 'document') docFront.value = result
    if (type === 'document_back') docBack.value = result
    if (type === 'selfie') selfie.value = result

    await kycStore.uploadDocument(file, type)
  }
  reader.readAsDataURL(file)
}

async function handleSubmit() {
  submitError.value = null
  submitSuccess.value = false

  if (!docFront.value || !docBack.value || !selfie.value) {
    submitError.value = 'Por favor, anexe todas as 3 fotos antes de submeter.'
    return
  }

  isSubmitting.value = true

  try {
    const res = await kycStore.submitAll()
    if (res.success) {
      submitSuccess.value = true
      if (authStore.user) {
        authStore.user.kycStatus = 'SUBMITTED'
      }
    } else {
      submitError.value = res.message || 'Erro ao enviar documentos. Tente novamente.'
    }
  } catch (err: any) {
    submitError.value = err?.message || 'Erro inesperado ao enviar documentos.'
  } finally {
    isSubmitting.value = false
  }
}
</script>

<template>
  <div class="kyc-screen-wrapper">
    <!-- Top App Bar -->
    <header class="appbar-header">
      <button class="appbar-back-btn" aria-label="Voltar" @click="router.back()">
        <ArrowLeft :size="22" color="#263238" />
      </button>
      <h1 class="appbar-title">Validação de Documentos</h1>
      <div class="appbar-spacer"></div>
    </header>

    <main class="kyc-main-container">
      <!-- ── 1. Status Banners ────────────────────────────────────────────── -->
      <!-- REJECTED -->
      <div v-if="kycStatus === 'REJECTED'" class="kyc-status-banner rejected">
        <div class="banner-icon-circle red">
          <AlertTriangle :size="32" color="#D32F2F" />
        </div>
        <h2 class="banner-title red">Documentos Recusados</h2>
        <p class="banner-reason">{{ rejectReason }}</p>
      </div>

      <!-- SUBMITTED (Em Análise) -->
      <div v-else-if="kycStatus === 'SUBMITTED' || submitSuccess" class="kyc-status-banner submitted">
        <div class="banner-icon-circle blue">
          <Clock :size="32" color="#1976D2" />
        </div>
        <h2 class="banner-title blue">Documentos em Análise</h2>
        <p class="banner-desc">
          Recebemos seus documentos! Nossa equipe de compliance está validando seus dados. A resposta é emitida em até 2 horas úteis.
        </p>
      </div>

      <!-- APPROVED -->
      <div v-else-if="kycStatus === 'APPROVED'" class="kyc-status-banner approved">
        <div class="banner-icon-circle green">
          <CheckCircle2 :size="32" color="#388E3C" />
        </div>
        <h2 class="banner-title green">Documentos Verificados</h2>
        <p class="banner-desc">
          Sua identidade e documentos foram aprovados com sucesso! Sua conta está 100% habilitada para lances e contemplações.
        </p>
      </div>

      <!-- NOT_SUBMITTED -->
      <div v-else class="kyc-status-banner pending">
        <div class="banner-icon-circle orange">
          <Info :size="32" color="#E65100" />
        </div>
        <h2 class="banner-title orange">Envio de Documentos</h2>
        <p class="banner-desc">
          Envie fotos do seu documento de identificação (RG ou CNH) para liberar todas as funcionalidades de contemplação.
        </p>
      </div>

      <!-- Error alert -->
      <div v-if="submitError" class="kyc-error-alert">
        <AlertTriangle :size="18" color="#D32F2F" />
        <span>{{ submitError }}</span>
      </div>

      <!-- ── 2. Documents Upload List ──────────────────────────────────────── -->
      <section v-if="kycStatus !== 'APPROVED'" class="kyc-upload-section">
        <h3 class="section-title">Fotos Necessárias</h3>

        <div class="docs-upload-list">
          <!-- Frente -->
          <div class="doc-upload-card" :class="{ uploaded: !!docFront }">
            <input
              id="kyc-front"
              type="file"
              accept="image/*"
              class="hidden-file-input"
              @change="handleFileUpload($event, 'document')"
            />
            <label for="kyc-front" class="doc-upload-label">
              <div class="doc-preview-box">
                <img v-if="docFront" :src="docFront" alt="Frente do Documento" class="preview-img" />
                <CreditCard v-else :size="28" color="#9E9E9E" />
              </div>
              <div class="doc-info-col">
                <span class="doc-name">Frente do RG / CNH</span>
                <span class="doc-desc">{{ docFront ? 'Foto capturada com sucesso' : 'Toque para enviar a foto' }}</span>
              </div>
              <div class="doc-action-icon">
                <RefreshCw v-if="docFront" :size="18" color="#4CAF50" />
                <UploadCloud v-else :size="18" color="#FF6D00" />
              </div>
            </label>
          </div>

          <!-- Verso -->
          <div class="doc-upload-card" :class="{ uploaded: !!docBack }">
            <input
              id="kyc-back"
              type="file"
              accept="image/*"
              class="hidden-file-input"
              @change="handleFileUpload($event, 'document_back')"
            />
            <label for="kyc-back" class="doc-upload-label">
              <div class="doc-preview-box">
                <img v-if="docBack" :src="docBack" alt="Verso do Documento" class="preview-img" />
                <CreditCard v-else :size="28" color="#9E9E9E" />
              </div>
              <div class="doc-info-col">
                <span class="doc-name">Verso do RG / CNH</span>
                <span class="doc-desc">{{ docBack ? 'Foto capturada com sucesso' : 'Toque para enviar a foto' }}</span>
              </div>
              <div class="doc-action-icon">
                <RefreshCw v-if="docBack" :size="18" color="#4CAF50" />
                <UploadCloud v-else :size="18" color="#FF6D00" />
              </div>
            </label>
          </div>

          <!-- Selfie -->
          <div class="doc-upload-card" :class="{ uploaded: !!selfie }">
            <input
              id="kyc-selfie"
              type="file"
              accept="image/*"
              class="hidden-file-input"
              @change="handleFileUpload($event, 'selfie')"
            />
            <label for="kyc-selfie" class="doc-upload-label">
              <div class="doc-preview-box">
                <img v-if="selfie" :src="selfie" alt="Selfie com Documento" class="preview-img" />
                <Camera v-else :size="28" color="#9E9E9E" />
              </div>
              <div class="doc-info-col">
                <span class="doc-name">Selfie com o Documento</span>
                <span class="doc-desc">{{ selfie ? 'Foto capturada com sucesso' : 'Segure o documento próximo ao rosto' }}</span>
              </div>
              <div class="doc-action-icon">
                <RefreshCw v-if="selfie" :size="18" color="#4CAF50" />
                <UploadCloud v-else :size="18" color="#FF6D00" />
              </div>
            </label>
          </div>
        </div>

        <!-- Submit Button -->
        <button
          class="btn-kyc-submit"
          :disabled="isSubmitting || !docFront || !docBack || !selfie"
          @click="handleSubmit"
        >
          <ShieldCheck :size="20" />
          <span v-if="!isSubmitting">ENVIAR PARA VALIDAÇÃO</span>
          <span v-else>ENVIANDO DOCUMENTOS...</span>
        </button>
      </section>
    </main>
  </div>
</template>

<style scoped>
.kyc-screen-wrapper {
  min-height: 100vh;
  background-color: var(--color-bg, #FAFAFA);
  font-family: 'Outfit', sans-serif;
  color: var(--color-secondary, #263238);
}

.kyc-main-container {
  max-width: 600px;
  margin: 0 auto;
  padding: 24px 20px 60px 20px;
}

/* ── Status Banners ─────────────────────────────────────────────────────── */
.kyc-status-banner {
  border-radius: 20px;
  padding: 28px 20px;
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  margin-bottom: 24px;
  border: 1px solid;
}

.kyc-status-banner.rejected {
  background-color: #FFEBEE;
  border-color: #FFCDD2;
}

.kyc-status-banner.submitted {
  background-color: #E3F2FD;
  border-color: #BBDEFB;
}

.kyc-status-banner.approved {
  background-color: #E8F5E9;
  border-color: #C8E6C9;
}

.kyc-status-banner.pending {
  background-color: #FFF3E0;
  border-color: #FFE0B2;
}

.banner-icon-circle {
  width: 64px;
  height: 64px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 14px;
}

.banner-icon-circle.red { background-color: rgba(211, 47, 47, 0.1); }
.banner-icon-circle.blue { background-color: rgba(25, 118, 210, 0.1); }
.banner-icon-circle.green { background-color: rgba(56, 142, 60, 0.1); }
.banner-icon-circle.orange { background-color: rgba(230, 81, 0, 0.1); }

.banner-title {
  font-size: 18px;
  font-weight: 800;
  margin: 0 0 8px 0;
}

.banner-title.red { color: #D32F2F; }
.banner-title.blue { color: #1565C0; }
.banner-title.green { color: #2E7D32; }
.banner-title.orange { color: #E65100; }

.banner-reason {
  font-size: 13.5px;
  color: #B71C1C;
  line-height: 1.4;
  margin: 0;
  font-weight: 500;
}

.banner-desc {
  font-size: 13.5px;
  color: var(--color-text-muted, #616161);
  line-height: 1.4;
  margin: 0;
}

.kyc-error-alert {
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

/* ── Upload Section ─────────────────────────────────────────────────────── */
.section-title {
  font-size: 16px;
  font-weight: 700;
  color: var(--color-secondary, #263238);
  margin-bottom: 14px;
}

.docs-upload-list {
  display: flex;
  flex-direction: column;
  gap: 14px;
  margin-bottom: 24px;
}

.hidden-file-input {
  display: none;
}

.doc-upload-card {
  border: 1.5px dashed var(--color-border, #E0E0E0);
  border-radius: 16px;
  background-color: #FFFFFF;
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
  width: 64px;
  height: 64px;
  border-radius: 12px;
  background-color: #F5F5F5;
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

/* ── Submit Button ──────────────────────────────────────────────────────── */
.btn-kyc-submit {
  width: 100%;
  height: 54px;
  border-radius: 16px;
  border: none;
  background-color: var(--color-primary, #FF6D00);
  color: #FFFFFF;
  font-size: 15px;
  font-weight: 700;
  letter-spacing: 0.5px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  cursor: pointer;
  box-shadow: 0 4px 14px rgba(255, 109, 0, 0.35);
  transition: all 0.2s ease;
}

.btn-kyc-submit:hover:not(:disabled) {
  background-color: #E65100;
  transform: translateY(-1px);
}

.btn-kyc-submit:disabled {
  opacity: 0.5;
  cursor: not-allowed;
  box-shadow: none;
}
</style>
