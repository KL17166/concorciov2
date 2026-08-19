<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '~/stores/auth'
import { useConsortiumStore } from '~/stores/consortium'
import { useCheckoutStore } from '~/stores/checkout'
import { formatCurrency } from '~~/shared/utils/currency'
import {
  ArrowLeft,
  ArrowRight,
  FileText,
  User,
  Package,
  Calendar,
  Camera,
  Check,
  Zap,
  Sparkles,
  ShieldCheck,
  AlertCircle,
  Pencil,
  ArrowDown,
  BadgeCheck
} from 'lucide-vue-next'

definePageMeta({
  middleware: 'auth',
  hideHeader: true,
  alias: ['/contract', '/checkout/contract']
})

const router = useRouter()
const authStore = useAuthStore()
const consortiumStore = useConsortiumStore()
const checkoutStore = useCheckoutStore()

const isAccepted = ref(false)
const isSubmitting = ref(false)
const errorMessage = ref<string | null>(null)
const hasScrolledToBottom = ref(false)

// File inputs for re-uploading documents on the contract screen
const frontInputRef = ref<HTMLInputElement | null>(null)
const backInputRef = ref<HTMLInputElement | null>(null)
const selfieInputRef = ref<HTMLInputElement | null>(null)

// Selected product and plan fallback
const product = computed(() => {
  return consortiumStore.selectedProduct || consortiumStore.products[0] || {
    id: 'prod_cg_160',
    name: 'Honda CG 160 Titan',
    type: 'MOTO',
    category: 'Motos Populares',
    price: 18500,
    plans: [
      { id: 'p_80', durationMonths: 80, monthlyInstallment: 289.90, adminFeeRate: 15, fundRate: 3 }
    ]
  }
})

const plan = computed(() => {
  return consortiumStore.selectedPlan || (product.value.plans ? product.value.plans[0] : null) || {
    id: 'p_80',
    durationMonths: 80,
    monthlyInstallment: 289.90,
    adminFeeRate: 15,
    fundRate: 3
  }
})

function formatDate(date: Date) {
  const d = String(date.getDate()).padStart(2, '0')
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const y = date.getFullYear()
  return `${d}/${m}/${y}`
}

function handleScroll() {
  const scrollPosition = window.innerHeight + window.scrollY
  const threshold = document.documentElement.scrollHeight - 150
  if (scrollPosition >= threshold) {
    hasScrolledToBottom.value = true
  }
}

onMounted(() => {
  checkoutStore.initFromAuth()
  window.addEventListener('scroll', handleScroll, { passive: true })

  // Check initial height in case screen is very large
  setTimeout(() => {
    handleScroll()
  }, 300)

  if (!checkoutStore.personal.name) {
    router.replace('/checkout')
  }
})

onUnmounted(() => {
  window.removeEventListener('scroll', handleScroll)
})

function triggerDocUpload(type: 'front' | 'back' | 'selfie') {
  if (type === 'front') frontInputRef.value?.click()
  if (type === 'back') backInputRef.value?.click()
  if (type === 'selfie') selfieInputRef.value?.click()
}

function onFileSelected(event: Event, type: 'front' | 'back' | 'selfie') {
  const target = event.target as HTMLInputElement
  const file = target.files?.[0]
  if (!file) return

  const reader = new FileReader()
  reader.onload = (e) => {
    const result = e.target?.result as string
    checkoutStore.updateDocument(type, result)
  }
  reader.readAsDataURL(file)
}

async function handleSignContract() {
  if (!isAccepted.value) {
    errorMessage.value = 'É obrigatório ler e aceitar todas as cláusulas do contrato para prosseguir.'
    return
  }

  isSubmitting.value = true
  errorMessage.value = null

  try {
    const res = await checkoutStore.finalizeCheckout(product.value as any, plan.value as any)
    if (res.success) {
      router.push('/checkout/payment')
    } else {
      errorMessage.value = res.message || 'Erro ao processar contratação. Tente novamente.'
    }
  } catch (err: any) {
    errorMessage.value = err?.message || 'Erro inesperado ao assinar contrato.'
  } finally {
    isSubmitting.value = false
  }
}
</script>

<template>
  <div class="contract-screen-wrapper">
    <!-- Hidden file inputs for re-uploading documents directly on contract -->
    <input
      ref="frontInputRef"
      type="file"
      accept="image/*"
      class="hidden-file-input"
      @change="onFileSelected($event, 'front')"
    />
    <input
      ref="backInputRef"
      type="file"
      accept="image/*"
      class="hidden-file-input"
      @change="onFileSelected($event, 'back')"
    />
    <input
      ref="selfieInputRef"
      type="file"
      accept="image/*"
      class="hidden-file-input"
      @change="onFileSelected($event, 'selfie')"
    />

    <!-- Top App Bar -->
    <header class="appbar-header">
      <button class="appbar-back-btn" aria-label="Voltar" @click="router.back()">
        <ArrowLeft :size="22" color="#263238" />
      </button>
      <h1 class="appbar-title">Contrato de Adesão</h1>
      <div class="appbar-spacer"></div>
    </header>

    <!-- Progress Notification Bar -->
    <div class="contract-notice-bar">
      <div class="notice-icon-box">
        <FileText :size="22" color="#FF6D00" />
      </div>
      <div class="notice-texts">
        <span class="notice-title">Revise o contrato</span>
        <span class="notice-desc">Leia atentamente antes de aceitar e assinar digitalmente</span>
      </div>
    </div>

    <main class="contract-content-container">
      <!-- ── Papel do Contrato Oficial Katari ───────────────────────────── -->
      <section class="contract-paper-card">
        <!-- 1. Header Oficial Katari -->
        <div class="brand-center-header">
          <div class="brand-logo-badge">
            <Package :size="28" color="#FF6D00" />
          </div>
          <h2 class="brand-title">KATARI CONSÓRCIOS</h2>
          <span class="brand-cnpj">CNPJ: 00.000.000/0001-00</span>
          <div class="contract-badge-pill">
            CONTRATO DE ADESÃO AO GRUPO DE CONSÓRCIO
          </div>
        </div>

        <!-- 2. Box: Dados do Contrato -->
        <div class="info-section-box">
          <div class="box-title-row">
            <FileText :size="18" color="#FF6D00" />
            <h3 class="box-title">DADOS DO CONTRATO</h3>
          </div>
          <div class="box-grid">
            <div class="data-row">
              <span class="data-label">Nº do Contrato</span>
              <span class="data-value">{{ checkoutStore.contractNumber }}</span>
            </div>
            <div class="data-row">
              <span class="data-label">Grupo</span>
              <span class="data-value">{{ checkoutStore.groupNumber }}</span>
            </div>
            <div class="data-row">
              <span class="data-label">Data de Emissão</span>
              <span class="data-value">{{ formatDate(new Date()) }}</span>
            </div>
            <div class="data-row">
              <span class="data-label">Administradora</span>
              <span class="data-value">Katari Consórcios S.A.</span>
            </div>
          </div>
        </div>

        <!-- 3. Box: Dados do Consorciado -->
        <div class="info-section-box">
          <div class="box-title-row">
            <User :size="18" color="#FF6D00" />
            <h3 class="box-title">DADOS DO CONSORCIADO</h3>
          </div>
          <div class="box-grid">
            <div class="data-row">
              <span class="data-label">Nome</span>
              <span class="data-value">{{ checkoutStore.personal.name || 'Não informado' }}</span>
            </div>
            <div class="data-row">
              <span class="data-label">CPF</span>
              <span class="data-value">{{ checkoutStore.personal.cpf || 'Não informado' }}</span>
            </div>
            <div class="data-row">
              <span class="data-label">Telefone</span>
              <span class="data-value">{{ checkoutStore.personal.phone || 'Não informado' }}</span>
            </div>
            <div v-if="checkoutStore.address.street" class="data-row">
              <span class="data-label">Endereço</span>
              <span class="data-value">
                {{ checkoutStore.address.street }}, {{ checkoutStore.address.number }} - {{ checkoutStore.address.district }}, {{ checkoutStore.address.city }}/{{ checkoutStore.address.state }}
              </span>
            </div>
          </div>
        </div>

        <!-- 4. Box: Dados do Bem -->
        <div v-if="product" class="info-section-box">
          <div class="box-title-row">
            <Package :size="18" color="#FF6D00" />
            <h3 class="box-title">DADOS DO BEM</h3>
          </div>
          <div class="box-grid">
            <div class="data-row">
              <span class="data-label">Tipo</span>
              <span class="data-value">{{ product.type === 'MOTO' ? 'Motocicleta' : product.type }}</span>
            </div>
            <div class="data-row">
              <span class="data-label">Modelo</span>
              <span class="data-value">{{ product.name }}</span>
            </div>
            <div class="data-row">
              <span class="data-label">Categoria</span>
              <span class="data-value">{{ product.category || 'Motos Populares' }}</span>
            </div>
            <div class="data-row">
              <span class="data-label">Valor do Crédito</span>
              <span class="data-value highlight-orange">{{ formatCurrency(product.price) }}</span>
            </div>
          </div>
        </div>

        <!-- 5. Box: Condições do Plano -->
        <div v-if="plan && product" class="info-section-box">
          <div class="box-title-row">
            <Calendar :size="18" color="#FF6D00" />
            <h3 class="box-title">CONDIÇÕES DO PLANO</h3>
          </div>
          <div class="box-grid">
            <div class="data-row">
              <span class="data-label">Prazo</span>
              <span class="data-value">{{ plan.durationMonths }} meses</span>
            </div>
            <div class="data-row">
              <span class="data-label">Valor do Crédito</span>
              <span class="data-value">{{ formatCurrency(product.price) }}</span>
            </div>
            <div class="data-row">
              <span class="data-label">Taxa de Administração</span>
              <span class="data-value">{{ Number(plan.adminFeeRate).toFixed(2) }}%</span>
            </div>
            <div class="data-row">
              <span class="data-label">Fundo de Reserva</span>
              <span class="data-value">{{ Number(plan.fundRate).toFixed(2) }}%</span>
            </div>
            <div class="data-row">
              <span class="data-label">Parcela Mensal (inicial)</span>
              <span class="data-value highlight-orange">{{ formatCurrency(plan.monthlyInstallment) }}</span>
            </div>
            <div class="data-row">
              <span class="data-label">Valor Total Estimado</span>
              <span class="data-value">{{ formatCurrency(plan.monthlyInstallment * plan.durationMonths) }}</span>
            </div>
          </div>
        </div>

        <div class="contract-divider"></div>

        <!-- 6. Seção de Documentação com Prévia das Fotos do Cliente -->
        <div class="docs-section-wrapper">
          <div class="docs-header-row">
            <Camera :size="20" color="#263238" />
            <h3 class="docs-section-title">DOCUMENTAÇÃO</h3>
          </div>

          <div class="docs-info-alert">
            <div class="info-alert-icon">ℹ</div>
            <p class="info-alert-text">
              Para validar seu contrato, precisamos de fotos legíveis do seu documento e uma selfie.
            </p>
          </div>

          <div class="docs-cards-gallery">
            <!-- Frente RG/CNH -->
            <div class="doc-upload-card-wrapper">
              <div
                class="doc-preview-box"
                :class="{ 'has-image': !!checkoutStore.documents.front }"
                @click="triggerDocUpload('front')"
              >
                <img
                  v-if="checkoutStore.documents.front"
                  :src="checkoutStore.documents.front"
                  alt="Frente RG/CNH"
                  class="doc-thumb-img"
                />
                <div v-else class="doc-empty-placeholder">
                  <Camera :size="26" color="#9E9E9E" />
                  <span class="placeholder-text">Adicionar</span>
                </div>

                <div v-if="checkoutStore.documents.front" class="edit-badge-circle" title="Trocar imagem">
                  <Pencil :size="12" color="#FF6D00" />
                </div>
              </div>
              <span class="doc-caption" :class="{ verified: !!checkoutStore.documents.front }">
                Frente RG/CNH
              </span>
            </div>

            <!-- Verso RG/CNH -->
            <div class="doc-upload-card-wrapper">
              <div
                class="doc-preview-box"
                :class="{ 'has-image': !!checkoutStore.documents.back }"
                @click="triggerDocUpload('back')"
              >
                <img
                  v-if="checkoutStore.documents.back"
                  :src="checkoutStore.documents.back"
                  alt="Verso RG/CNH"
                  class="doc-thumb-img"
                />
                <div v-else class="doc-empty-placeholder">
                  <Camera :size="26" color="#9E9E9E" />
                  <span class="placeholder-text">Adicionar</span>
                </div>

                <div v-if="checkoutStore.documents.back" class="edit-badge-circle" title="Trocar imagem">
                  <Pencil :size="12" color="#FF6D00" />
                </div>
              </div>
              <span class="doc-caption" :class="{ verified: !!checkoutStore.documents.back }">
                Verso RG/CNH
              </span>
            </div>

            <!-- Selfie -->
            <div class="doc-upload-card-wrapper">
              <div
                class="doc-preview-box"
                :class="{ 'has-image': !!checkoutStore.documents.selfie }"
                @click="triggerDocUpload('selfie')"
              >
                <img
                  v-if="checkoutStore.documents.selfie"
                  :src="checkoutStore.documents.selfie"
                  alt="Sua Selfie"
                  class="doc-thumb-img"
                />
                <div v-else class="doc-empty-placeholder">
                  <Camera :size="26" color="#9E9E9E" />
                  <span class="placeholder-text">Adicionar</span>
                </div>

                <div v-if="checkoutStore.documents.selfie" class="edit-badge-circle" title="Trocar imagem">
                  <Pencil :size="12" color="#FF6D00" />
                </div>
              </div>
              <span class="doc-caption" :class="{ verified: !!checkoutStore.documents.selfie }">
                Sua Selfie
              </span>
            </div>
          </div>
        </div>

        <div class="contract-divider"></div>

        <!-- 7. Todas as 13 Cláusulas Contratuais Oficiais Katari -->
        <div class="clauses-container">
          <h3 class="clauses-main-title">CLÁUSULAS CONTRATUAIS</h3>

          <!-- Cláusula 1 -->
          <article class="clause-item">
            <div class="clause-header">
              <div class="clause-badge">1.</div>
              <h4 class="clause-title">OBJETO</h4>
            </div>
            <p class="clause-content">
              O presente instrumento tem por objeto a adesão do CONSORCIADO ao grupo de consórcio administrado pela KATARI CONSÓRCIOS S.A., para aquisição do bem especificado neste contrato, regido pela Lei nº 11.795/2008 e pelas normas do Banco Central do Brasil.
            </p>
          </article>

          <!-- Cláusula 2 -->
          <article class="clause-item">
            <div class="clause-header">
              <div class="clause-badge">2.</div>
              <h4 class="clause-title">FORMAÇÃO DO GRUPO</h4>
            </div>
            <p class="clause-content">
              O grupo de consórcio será formado quando atingir o número mínimo de participantes ativos necessário para sua viabilidade econômica. A ADMINISTRADORA comunicará ao CONSORCIADO a efetiva formação do grupo e a data da primeira assembleia.
            </p>
          </article>

          <!-- Cláusula 3 -->
          <article class="clause-item">
            <div class="clause-header">
              <div class="clause-badge">3.</div>
              <h4 class="clause-title">OBRIGAÇÕES DO CONSORCIADO</h4>
            </div>
            <div class="clause-content">
              <p>O CONSORCIADO obriga-se a:</p>
              <p>a) Pagar pontualmente as parcelas mensais até o dia de vencimento estabelecido;</p>
              <p>b) Manter seus dados cadastrais atualizados junto à ADMINISTRADORA;</p>
              <p>c) Comparecer às assembleias ordinárias e extraordinárias quando convocado;</p>
              <p>d) Oferecer garantias exigidas quando da contemplação;</p>
              <p>e) Cumprir todas as obrigações previstas neste contrato e na legislação aplicável.</p>
            </div>
          </article>

          <!-- Cláusula 4 -->
          <article class="clause-item">
            <div class="clause-header">
              <div class="clause-badge">4.</div>
              <h4 class="clause-title">PARCELAS E PAGAMENTO</h4>
            </div>
            <div class="clause-content">
              <p>As parcelas mensais são compostas por:</p>
              <p>a) Fundo comum: destinado à contemplação dos participantes;</p>
              <p>b) Taxa de administração: remuneração da ADMINISTRADORA pelos serviços prestados ({{ Number(plan.adminFeeRate).toFixed(2) }}% sobre o valor do crédito, diluída nas parcelas);</p>
              <p>c) Fundo de reserva: destinado a cobrir eventual inadimplência e despesas extraordinárias ({{ Number(plan.fundRate).toFixed(2) }}% sobre o valor do crédito);</p>
              <p>d) Seguro prestamista: quando aplicável.</p>
              <p class="mt-2">O atraso no pagamento acarretará multa de 2% (dois por cento) e juros de mora de 1% (um por cento) ao mês.</p>
            </div>
          </article>

          <!-- Cláusula 5 -->
          <article class="clause-item">
            <div class="clause-header">
              <div class="clause-badge">5.</div>
              <h4 class="clause-title">REAJUSTE DAS PARCELAS</h4>
            </div>
            <p class="clause-content">
              O valor da carta de crédito e, consequentemente, das parcelas vincendas, será reajustado ANUALMENTE, no aniversário da cota, com base na variação da Tabela FIPE para veículos ou índice que a substitua. O reajuste tem por objetivo manter o poder de compra da carta de crédito ao longo do prazo do consórcio. Caso o índice seja negativo, o valor será mantido. O CONSORCIADO declara estar ciente de que as parcelas poderão sofrer aumentos durante a vigência do contrato.
            </p>
          </article>

          <!-- Cláusula 6 -->
          <article class="clause-item">
            <div class="clause-header">
              <div class="clause-badge">6.</div>
              <h4 class="clause-title">CONTEMPLAÇÃO</h4>
            </div>
            <div class="clause-content">
              <p>A contemplação ocorrerá mensalmente por meio de:</p>
              <p>a) SORTEIO: realizado nas assembleias ordinárias mensais, mediante extração da Loteria Federal;</p>
              <p>b) LANCE: oferta de antecipação de parcelas vincendas. O maior lance ofertado será o contemplado.</p>
              <p class="mt-2">O CONSORCIADO contemplado deverá apresentar as garantias exigidas no prazo de 30 (trinta) dias, sob pena de perda da contemplação.</p>
            </div>
          </article>

          <!-- Cláusula 7 -->
          <article class="clause-item">
            <div class="clause-header">
              <div class="clause-badge">7.</div>
              <h4 class="clause-title">UTILIZAÇÃO DO CRÉDITO</h4>
            </div>
            <p class="clause-content">
              O crédito contemplado será utilizado exclusivamente para aquisição do bem descrito neste contrato, através de pagamento direto ao fornecedor escolhido pelo CONSORCIADO, desde que devidamente autorizado pela ADMINISTRADORA.
            </p>
          </article>

          <!-- Cláusula 8 -->
          <article class="clause-item">
            <div class="clause-header">
              <div class="clause-badge">8.</div>
              <h4 class="clause-title">ALIENAÇÃO FIDUCIÁRIA</h4>
            </div>
            <p class="clause-content">
              O bem adquirido ficará alienado fiduciariamente em favor do GRUPO até a quitação integral de todas as obrigações assumidas pelo CONSORCIADO, nos termos da Lei nº 9.514/97.
            </p>
          </article>

          <!-- Cláusula 9 -->
          <article class="clause-item">
            <div class="clause-header">
              <div class="clause-badge">9.</div>
              <h4 class="clause-title">EXCLUSÃO E DESISTÊNCIA</h4>
            </div>
            <div class="clause-content">
              <p>O CONSORCIADO será excluído do grupo nas seguintes hipóteses:</p>
              <p>a) Inadimplência de 3 (três) parcelas consecutivas ou 4 (quatro) alternadas;</p>
              <p>b) Não apresentação de garantias no prazo estipulado;</p>
              <p>c) Fraude documental ou declarações falsas.</p>
              <p class="mt-2">Em caso de desistência voluntária ou exclusão, o CONSORCIADO participará dos sorteios dos excluídos para restituição dos valores pagos ao fundo comum, deduzidas as penalidades contratuais.</p>
            </div>
          </article>

          <!-- Cláusula 10 -->
          <article class="clause-item">
            <div class="clause-header">
              <div class="clause-badge">10.</div>
              <h4 class="clause-title">TRANSFERÊNCIA DE COTA</h4>
            </div>
            <div class="clause-content">
              <p>O CONSORCIADO poderá transferir sua cota a terceiros, mediante:</p>
              <p>a) Solicitação formal à ADMINISTRADORA;</p>
              <p>b) Aprovação cadastral do cessionário;</p>
              <p>c) Pagamento da taxa de transferência de 1% (um por cento) sobre o valor do crédito.</p>
            </div>
          </article>

          <!-- Cláusula 11 -->
          <article class="clause-item">
            <div class="clause-header">
              <div class="clause-badge">11.</div>
              <h4 class="clause-title">ENCERRAMENTO DO GRUPO</h4>
            </div>
            <p class="clause-content">
              O grupo será encerrado após a contemplação de todos os participantes e liquidação de todas as obrigações. Eventuais valores remanescentes no fundo de reserva serão rateados entre os participantes proporcionalmente.
            </p>
          </article>

          <!-- Cláusula 12 -->
          <article class="clause-item">
            <div class="clause-header">
              <div class="clause-badge">12.</div>
              <h4 class="clause-title">DISPOSIÇÕES GERAIS</h4>
            </div>
            <div class="clause-content">
              <p>a) Toda comunicação entre as partes será realizada pelos meios cadastrados (e-mail, telefone ou aplicativo);</p>
              <p>b) A ADMINISTRADORA poderá ceder os direitos creditórios deste contrato a terceiros;</p>
              <p>c) Este contrato é celebrado em caráter irrevogável e irretratável, obrigando as partes e seus sucessores.</p>
            </div>
          </article>

          <!-- Cláusula 13 -->
          <article class="clause-item">
            <div class="clause-header">
              <div class="clause-badge">13.</div>
              <h4 class="clause-title">FORO</h4>
            </div>
            <p class="clause-content">
              Fica eleito o foro da Comarca de São Paulo/SP para dirimir quaisquer questões oriundas deste contrato, renunciando as partes a qualquer outro, por mais privilegiado que seja.
            </p>
          </article>
        </div>

        <div class="contract-divider"></div>

        <!-- 8. Aviso Legal BACEN -->
        <div class="bacen-legal-alert">
          <div class="bacen-title-row">
            <BadgeCheck :size="20" color="#1976D2" />
            <h4 class="bacen-title">CONTRATO REGULAMENTADO</h4>
          </div>
          <p class="bacen-text">
            Este contrato está em conformidade com a Lei nº 11.795/2008, Circular BACEN nº 3.432/2009 e demais normas aplicáveis ao Sistema de Consórcios.
          </p>
        </div>

        <!-- 9. Declaração Formal de Concordância & Assinatura Digital -->
        <div class="signature-formal-card">
          <h4 class="sig-title">DECLARAÇÃO DE CONCORDÂNCIA</h4>
          <p class="sig-text">
            Declaro que li, compreendi e estou de pleno acordo com todas as cláusulas e condições estabelecidas neste Contrato de Adesão ao Grupo de Consórcio, bem como recebi cópia do mesmo para arquivo pessoal.
          </p>
          <span class="sig-city-date">São Paulo, {{ formatDate(new Date()) }}</span>

          <div class="signature-line"></div>
          <span class="sig-name">{{ checkoutStore.personal.name || 'CONSORCIADO' }}</span>
          <span class="sig-cpf">CPF: {{ checkoutStore.personal.cpf || '000.000.000-00' }}</span>
        </div>
      </section>

      <!-- Error alert -->
      <div v-if="errorMessage" class="contract-error-alert">
        <AlertCircle :size="18" color="#D32F2F" />
        <span>{{ errorMessage }}</span>
      </div>

      <!-- Prompt de Rolagem se não rolou até o final -->
      <div v-if="!hasScrolledToBottom" class="scroll-down-prompt">
        <ArrowDown :size="18" color="#E65100" />
        <span>Role até o final da página para ler todo o contrato</span>
      </div>

      <!-- Accept Checkbox Card -->
      <div
        class="contract-accept-card"
        :class="{ checked: isAccepted, disabled: !hasScrolledToBottom }"
        @click="hasScrolledToBottom ? (isAccepted = !isAccepted) : null"
      >
        <div class="custom-checkbox" :class="{ checked: isAccepted }">
          <Check v-if="isAccepted" :size="16" color="#FFFFFF" />
        </div>
        <div class="accept-text-col">
          <span class="accept-title">Li e aceito todas as cláusulas deste contrato</span>
          <span class="accept-subtitle">Confirmo a veracidade de meus dados e autorizo a adesão ao grupo</span>
        </div>
      </div>
    </main>

    <!-- Bottom Action Footer -->
    <footer class="contract-footer-bar">
      <div class="footer-inner">
        <button
          class="btn-sign-contract"
          :disabled="!isAccepted || isSubmitting"
          @click="handleSignContract"
        >
          <ShieldCheck :size="20" />
          <span v-if="!isSubmitting">ASSINAR CONTRATO DIGITALMENTE</span>
          <span v-else>PROCESSANDO ASSINATURA...</span>
        </button>
      </div>
    </footer>
  </div>
</template>

<style scoped>
.contract-screen-wrapper {
  min-height: 100vh;
  background-color: var(--color-bg, #FAFAFA);
  font-family: 'Outfit', sans-serif;
  color: var(--color-secondary, #263238);
  display: flex;
  flex-direction: column;
}

.hidden-file-input {
  display: none;
}

/* ── Notice Bar ─────────────────────────────────────────────────────────── */
.contract-notice-bar {
  background-color: #FFFFFF;
  border-bottom: 1px solid var(--color-border, #E0E0E0);
  padding: 16px 20px;
  display: flex;
  align-items: center;
  gap: 14px;
}

.notice-icon-box {
  width: 44px;
  height: 44px;
  border-radius: 12px;
  background-color: rgba(255, 109, 0, 0.1);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.notice-texts {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.notice-title {
  font-size: 15px;
  font-weight: 700;
  color: var(--color-secondary, #263238);
}

.notice-desc {
  font-size: 12.5px;
  color: var(--color-text-muted, #757575);
}

/* ── Content Container ─────────────────────────────────────────────────── */
.contract-content-container {
  flex: 1;
  max-width: 640px;
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

.btn-dev-sign-quick {
  padding: 10px 16px;
  border-radius: 12px;
  border: none;
  background-color: #FF6D00;
  color: #FFFFFF;
  font-size: 13px;
  font-weight: 800;
  display: flex;
  align-items: center;
  gap: 6px;
  cursor: pointer;
  box-shadow: 0 4px 12px rgba(255, 109, 0, 0.25);
  transition: all 0.15s ease;
  white-space: nowrap;
}

.btn-dev-sign-quick:hover {
  background-color: #E65100;
}

/* ── Papel do Contrato ─────────────────────────────────────────────────── */
.contract-paper-card {
  background-color: #FFFFFF;
  border: 1px solid var(--color-border, #E0E0E0);
  border-radius: 20px;
  padding: 24px;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.03);
  margin-bottom: 20px;
}

/* ── Brand Center Header ────────────────────────────────────────────────── */
.brand-center-header {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  margin-bottom: 28px;
}

.brand-logo-badge {
  width: 56px;
  height: 56px;
  border-radius: 50%;
  background-color: rgba(255, 109, 0, 0.1);
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 12px;
}

.brand-title {
  font-size: 22px;
  font-weight: 900;
  letter-spacing: 2px;
  color: var(--color-secondary, #263238);
  margin: 0 0 4px 0;
}

.brand-cnpj {
  font-size: 12px;
  color: #757575;
  margin-bottom: 14px;
}

.contract-badge-pill {
  padding: 6px 16px;
  border-radius: 20px;
  background-color: var(--color-secondary, #263238);
  color: #FFFFFF;
  font-size: 11px;
  font-weight: 800;
  letter-spacing: 0.5px;
}

/* ── Info Section Boxes ─────────────────────────────────────────────────── */
.info-section-box {
  background-color: #F8F9FA;
  border: 1px solid var(--color-border, #EEEEEE);
  border-radius: 12px;
  padding: 16px;
  margin-bottom: 16px;
}

.box-title-row {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 12px;
}

.box-title {
  font-size: 13.5px;
  font-weight: 800;
  letter-spacing: 0.5px;
  color: var(--color-secondary, #263238);
  margin: 0;
}

.box-grid {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.data-row {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  font-size: 13px;
  gap: 12px;
}

.data-label {
  color: #757575;
  flex-shrink: 0;
  width: 140px;
}

.data-value {
  font-weight: 700;
  color: var(--color-secondary, #263238);
  text-align: right;
  flex: 1;
}

.highlight-orange {
  color: var(--color-primary, #FF6D00);
  font-weight: 800;
}

.contract-divider {
  height: 1px;
  background-color: #E0E0E0;
  margin: 24px 0;
}

/* ── Document Preview Gallery ───────────────────────────────────────────── */
.docs-section-wrapper {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.docs-header-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.docs-section-title {
  font-size: 15px;
  font-weight: 800;
  letter-spacing: 1px;
  color: var(--color-secondary, #263238);
  margin: 0;
}

.docs-info-alert {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 14px;
  background-color: #E3F2FD;
  border: 1px solid #BBDEFB;
  border-radius: 10px;
}

.info-alert-icon {
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background-color: #1976D2;
  color: #FFFFFF;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  font-weight: 800;
  flex-shrink: 0;
}

.info-alert-text {
  font-size: 12.5px;
  color: #0D47A1;
  line-height: 1.4;
  margin: 0;
}

.docs-cards-gallery {
  display: flex;
  justify-content: space-around;
  gap: 12px;
  margin-top: 6px;
}

.doc-upload-card-wrapper {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
}

.doc-preview-box {
  width: 90px;
  height: 90px;
  border-radius: 12px;
  background-color: #FFFFFF;
  border: 2px solid #E0E0E0;
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
  overflow: hidden;
  cursor: pointer;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.04);
  transition: all 0.2s ease;
}

.doc-preview-box:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 10px rgba(0, 0, 0, 0.08);
}

.doc-preview-box.has-image {
  border-color: #4CAF50;
  background-color: #E8F5E9;
}

.doc-thumb-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.doc-empty-placeholder {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
}

.placeholder-text {
  font-size: 10px;
  font-weight: 600;
  color: #9E9E9E;
}

.edit-badge-circle {
  position: absolute;
  top: 4px;
  right: 4px;
  width: 22px;
  height: 22px;
  border-radius: 50%;
  background-color: #FFFFFF;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.15);
  display: flex;
  align-items: center;
  justify-content: center;
}

.doc-caption {
  font-size: 11.5px;
  font-weight: 700;
  color: #757575;
  text-align: center;
}

.doc-caption.verified {
  color: #2E7D32;
}

/* ── Clauses ────────────────────────────────────────────────────────────── */
.clauses-container {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.clauses-main-title {
  font-size: 16px;
  font-weight: 800;
  color: var(--color-secondary, #263238);
  letter-spacing: 1px;
  margin: 0 0 4px 0;
}

.clause-item {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.clause-header {
  display: flex;
  align-items: center;
  gap: 10px;
}

.clause-badge {
  width: 28px;
  height: 28px;
  border-radius: 6px;
  background-color: rgba(255, 109, 0, 0.1);
  color: var(--color-primary, #FF6D00);
  font-size: 12px;
  font-weight: 800;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.clause-title {
  font-size: 14.5px;
  font-weight: 800;
  color: var(--color-secondary, #263238);
  margin: 0;
}

.clause-content {
  font-size: 13px;
  color: #424242;
  line-height: 1.6;
  padding-left: 38px;
  text-align: justify;
  margin: 0;
}

.clause-content p {
  margin: 0 0 6px 0;
}

.clause-content p:last-child {
  margin-bottom: 0;
}

.mt-2 {
  margin-top: 8px !important;
}

/* ── BACEN Legal Alert ──────────────────────────────────────────────────── */
.bacen-legal-alert {
  background-color: #E3F2FD;
  border: 1px solid #BBDEFB;
  border-radius: 12px;
  padding: 16px;
  margin-bottom: 20px;
}

.bacen-title-row {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 6px;
}

.bacen-title {
  font-size: 13.5px;
  font-weight: 800;
  color: #0D47A1;
  margin: 0;
}

.bacen-text {
  font-size: 12.5px;
  color: #1565C0;
  line-height: 1.45;
  margin: 0;
}

/* ── Digital Signature Card ─────────────────────────────────────────────── */
.signature-formal-card {
  background-color: #F5F5F5;
  border: 1px solid #E0E0E0;
  border-radius: 14px;
  padding: 20px;
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
}

.sig-title {
  font-size: 13.5px;
  font-weight: 800;
  letter-spacing: 1px;
  color: var(--color-secondary, #263238);
  margin: 0 0 10px 0;
}

.sig-text {
  font-size: 12.5px;
  color: #616161;
  line-height: 1.5;
  margin: 0 0 16px 0;
}

.sig-city-date {
  font-size: 12px;
  color: #757575;
  margin-bottom: 16px;
}

.signature-line {
  width: 220px;
  height: 1px;
  background-color: #B0BEC5;
  margin-bottom: 8px;
}

.sig-name {
  font-size: 14px;
  font-weight: 800;
  color: var(--color-secondary, #263238);
}

.sig-cpf {
  font-size: 12px;
  color: #757575;
}

/* ── Scroll Down Prompt ─────────────────────────────────────────────────── */
.scroll-down-prompt {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 16px;
  background-color: #FFF3E0;
  border: 1px solid #FFE0B2;
  border-radius: 12px;
  color: #E65100;
  font-size: 13px;
  font-weight: 700;
  margin-bottom: 16px;
  animation: bounce 1.5s infinite;
}

@keyframes bounce {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-4px); }
}

/* ── Accept Checkbox Card ───────────────────────────────────────────────── */
.contract-accept-card {
  background-color: #FFFFFF;
  border: 1.5px solid var(--color-border, #E0E0E0);
  border-radius: 16px;
  padding: 16px;
  display: flex;
  align-items: flex-start;
  gap: 14px;
  cursor: pointer;
  transition: all 0.2s ease;
  user-select: none;
}

.contract-accept-card.disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.contract-accept-card.checked {
  border-color: var(--color-primary, #FF6D00);
  background-color: rgba(255, 109, 0, 0.04);
}

.custom-checkbox {
  width: 24px;
  height: 24px;
  border-radius: 6px;
  border: 2px solid #B0BEC5;
  background-color: #FAFAFA;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  transition: all 0.2s ease;
  margin-top: 2px;
}

.custom-checkbox.checked {
  border-color: var(--color-primary, #FF6D00);
  background-color: var(--color-primary, #FF6D00);
}

.accept-text-col {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.accept-title {
  font-size: 14px;
  font-weight: 700;
  color: var(--color-secondary, #263238);
}

.accept-subtitle {
  font-size: 12px;
  color: var(--color-text-muted, #757575);
}

.contract-error-alert {
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
  margin-bottom: 16px;
}

/* ── Footer ─────────────────────────────────────────────────────────────── */
.contract-footer-bar {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  background-color: #FFFFFF;
  border-top: 1px solid var(--color-border, #E0E0E0);
  padding: 16px 20px;
  z-index: 40;
}

.footer-inner {
  max-width: 640px;
  margin: 0 auto;
}

.btn-sign-contract {
  width: 100%;
  height: 54px;
  border-radius: 16px;
  border: none;
  background-color: var(--color-primary, #FF6D00);
  color: #FFFFFF;
  font-size: 16px;
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

.btn-sign-contract:hover:not(:disabled) {
  background-color: #E65100;
  transform: translateY(-1px);
}

.btn-sign-contract:disabled {
  opacity: 0.5;
  cursor: not-allowed;
  box-shadow: none;
}
</style>
