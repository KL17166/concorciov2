<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useConsortiumStore } from '~/stores/consortium'
import { formatCurrency } from '~~/shared/utils/currency'
import { DEFAULT_PRODUCTS } from '~~/shared/utils/catalogData'
import type { Product, ConsortiumPlan } from '~~/shared/types/catalog'
import {
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  Star,
  Check,
  CheckCircle,
  Info,
  ChevronLeft,
  ChevronRight,
  Shield,
  Headphones,
  TrendingUp,
  Gift,
  PackageX,
  Camera,
  Maximize2,
  X
} from 'lucide-vue-next'

definePageMeta({
  middleware: 'auth'
})

const route = useRoute()
const router = useRouter()
const consortiumStore = useConsortiumStore()

const currentImageIndex = ref(0)
const selectedPlan = ref<ConsortiumPlan | null>(null)
const showFab = ref(false)
const isPageLoading = ref(true)
const imageLoadError = ref(false)
const isLightboxOpen = ref(false)
const lightboxIndex = ref(0)

// Resolve Product
const product = computed<Product | null>(() => {
  const paramId = String(route.params.id || '')
  const fromStore = consortiumStore.products.find(p => p.id === paramId)
  if (fromStore) return fromStore
  const fromDefault = DEFAULT_PRODUCTS.find(p => p.id === paramId)
  return fromDefault || null
})

// Gallery Images list
const images = computed<string[]>(() => {
  if (!product.value) return []
  if (product.value.imageUrls && product.value.imageUrls.length > 0) {
    return product.value.imageUrls
  }
  return product.value.imageUrl ? [product.value.imageUrl] : []
})

// Available plans filtered by maxDuration (matching Flutter: plans.where((p) => p.durationMonths <= product.maxDuration))
const availablePlans = computed<ConsortiumPlan[]>(() => {
  if (!product.value || !product.value.plans) return []
  const maxDur = product.value.maxDuration || 80
  return product.value.plans.filter(p => p.durationMonths <= maxDur)
})

// Auto-select the plan that best matches the product's monthly price (Exact Flutter algorithm)
function autoSelectBestPlan() {
  if (!product.value || availablePlans.value.length === 0) return
  if (selectedPlan.value) return

  let bestMatch: ConsortiumPlan = availablePlans.value[0]
  let smallestDifference = Number.POSITIVE_INFINITY
  const targetMonthlyPrice = product.value.monthlyPrice || (product.value.price / (product.value.maxDuration || 80))

  for (const plan of availablePlans.value) {
    const diff = Math.abs(plan.monthlyInstallment - targetMonthlyPrice)
    if (diff < smallestDifference) {
      smallestDifference = diff
      bestMatch = plan
    }
  }

  selectedPlan.value = bestMatch
}

onMounted(async () => {
  window.addEventListener('scroll', handleScroll, { passive: true })
  window.addEventListener('keydown', handleKeydown)

  if (consortiumStore.products.length === 0) {
    await consortiumStore.loadHomeData()
  }
  isPageLoading.value = false
  autoSelectBestPlan()
})

watch(product, () => {
  autoSelectBestPlan()
})

onUnmounted(() => {
  window.removeEventListener('scroll', handleScroll)
  window.removeEventListener('keydown', handleKeydown)
})

function handleScroll() {
  showFab.value = window.scrollY > 400
}

function handleKeydown(e: KeyboardEvent) {
  if (isLightboxOpen.value) {
    if (e.key === 'Escape') closeLightbox()
    if (e.key === 'ArrowRight') nextLightbox()
    if (e.key === 'ArrowLeft') prevLightbox()
  }
}

function scrollToTop() {
  window.scrollTo({ top: 0, behavior: 'smooth' })
}

function nextImage() {
  if (currentImageIndex.value < images.value.length - 1) {
    currentImageIndex.value++
  }
}

function prevImage() {
  if (currentImageIndex.value > 0) {
    currentImageIndex.value--
  }
}

function openLightbox(idx = 0) {
  lightboxIndex.value = idx
  isLightboxOpen.value = true
}

function closeLightbox() {
  isLightboxOpen.value = false
}

function nextLightbox() {
  if (lightboxIndex.value < images.value.length - 1) {
    lightboxIndex.value++
  } else {
    lightboxIndex.value = 0
  }
}

function prevLightbox() {
  if (lightboxIndex.value > 0) {
    lightboxIndex.value--
  } else {
    lightboxIndex.value = images.value.length - 1
  }
}

function selectPlan(plan: ConsortiumPlan) {
  selectedPlan.value = plan
}

function handleContinue() {
  if (!product.value || !selectedPlan.value) return
  router.push({
    path: '/checkout',
    query: {
      productId: product.value.id,
      planId: selectedPlan.value.id
    }
  })
}

// Key features derived from specs (Exact Flutter matching)
const keyFeatures = computed<string[]>(() => {
  if (!product.value || !product.value.specs) return []
  const specs = product.value.specs as Record<string, any>
  const features: string[] = []

  if (specs.engineType && String(specs.engineType).trim()) {
    features.push(`Motor ${specs.engineType}`)
  }
  if (specs.power && String(specs.power).trim()) {
    features.push(`Potência de ${specs.power}`)
  }
  if (specs.displacement && String(specs.displacement).trim()) {
    features.push(`Cilindrada de ${specs.displacement}`)
  }
  if (specs.transmission && String(specs.transmission).trim()) {
    features.push(`Transmissão ${specs.transmission}`)
  }
  if (specs.consumption && String(specs.consumption).trim()) {
    features.push(`Consumo médio de ${specs.consumption}`)
  }

  return features
})

// Detailed specs mapping (Exact Flutter key names and order)
const detailedSpecs = computed<Record<string, string>>(() => {
  if (!product.value || !product.value.specs) return {}
  const specs = product.value.specs as Record<string, any>
  const displaySpecs: Record<string, string> = {}

  const knownKeys: Record<string, string> = {
    engineType: 'Motor',
    displacement: 'Cilindrada',
    power: 'Potência',
    torque: 'Torque',
    transmission: 'Transmissão',
    frontBrake: 'Freio Dianteiro',
    rearBrake: 'Freio Traseiro',
    weight: 'Peso',
    fuelCapacity: 'Capacidade do Tanque',
    consumption: 'Consumo Médio'
  }

  for (const [key, label] of Object.entries(knownKeys)) {
    if (specs[key] && String(specs[key]).trim().length > 0) {
      displaySpecs[label] = String(specs[key])
    }
  }

  // Fallback if no known keys matched
  if (Object.keys(displaySpecs).length === 0) {
    for (const [key, value] of Object.entries(specs)) {
      if (value && String(value).trim().length > 0) {
        displaySpecs[key] = String(value)
      }
    }
  }

  return displaySpecs
})

// Exact benefits from details_screen.dart
const benefits = [
  {
    icon: Shield,
    title: 'Seguro Incluso',
    description: 'Proteção completa durante todo o consórcio',
    color: '#2196F3',
    bgColor: 'rgba(33, 150, 243, 0.1)'
  },
  {
    icon: Headphones,
    title: 'Suporte 24/7',
    description: 'Atendimento sempre que você precisar',
    color: '#4CAF50',
    bgColor: 'rgba(76, 175, 80, 0.1)'
  },
  {
    icon: TrendingUp,
    title: 'Sem Juros',
    description: 'Apenas taxa administrativa fixa',
    color: '#FF6D00',
    bgColor: 'rgba(255, 109, 0, 0.1)'
  },
  {
    icon: Gift,
    title: 'Benefícios Exclusivos',
    description: 'Descontos em manutenção e acessórios',
    color: '#9C27B0',
    bgColor: 'rgba(156, 39, 176, 0.1)'
  }
]
</script>

<template>
  <div class="details-screen-wrapper">
    <!-- 404 Not Found -->
    <div v-if="!product && !isPageLoading" class="not-found-scaffold">
      <div class="not-found-body">
        <PackageX :size="80" color="#B0BEC5" />
        <h2>Nenhum produto selecionado</h2>
        <p>O produto que você procura não está mais disponível.</p>
        <button class="not-found-back-btn" @click="router.push('/')">
          Voltar ao Catálogo
        </button>
      </div>
    </div>

    <!-- Main Details Screen -->
    <div v-else-if="product" class="details-body">
      <!-- 1. SliverAppBar with Image Gallery (_buildImageGalleryAppBar) -->
      <div class="image-gallery-appbar">
        <!-- Fixed Circle Back Button (top: 8, left: 14) -->
        <button class="flutter-back-circle" aria-label="Voltar" @click="router.back()">
          <ArrowLeft :size="22" color="#FFFFFF" />
        </button>

        <!-- "Ver mais fotos" floating button badge -->
        <button
          v-if="images.length > 0"
          class="flutter-view-photos-badge"
          aria-label="Ver todas as fotos"
          @click="openLightbox(currentImageIndex)"
        >
          <Camera :size="15" color="#FFFFFF" />
          <span>{{ images.length }} fotos</span>
          <Maximize2 :size="13" color="#FFFFFF" />
        </button>

        <!-- Carousel Viewport -->
        <div class="gallery-viewport" @click="openLightbox(currentImageIndex)">
          <img
            v-if="!imageLoadError"
            :src="images[currentImageIndex] || product.imageUrl"
            :alt="product.name"
            class="gallery-image"
            @error="imageLoadError = true"
          />
          <div v-else class="image-placeholder-fallback">
            <PackageX :size="100" color="#BDBDBD" />
            <span>Imagem não disponível</span>
          </div>

          <!-- Bottom Gradient Overlay (height: 120px) -->
          <div class="gallery-bottom-gradient"></div>

          <!-- Swipe Indicator Arrows (chevrons) -->
          <template v-if="images.length > 1">
            <button
              class="gallery-chevron left"
              :class="{ disabled: currentImageIndex === 0 }"
              aria-label="Imagem anterior"
              @click.stop="prevImage"
            >
              <ChevronLeft :size="24" color="#FFFFFF" />
            </button>
            <button
              class="gallery-chevron right"
              :class="{ disabled: currentImageIndex === images.length - 1 }"
              aria-label="Próxima imagem"
              @click.stop="nextImage"
            >
              <ChevronRight :size="24" color="#FFFFFF" />
            </button>
          </template>

          <!-- Page Indicator Dots (bottom: 20px) -->
          <div v-if="images.length > 1" class="gallery-dots-row">
            <div
              v-for="(_, idx) in images"
              :key="idx"
              class="gallery-dot"
              :class="{ active: currentImageIndex === idx }"
              @click.stop="currentImageIndex = idx"
            ></div>
          </div>
        </div>
      </div>

      <!-- Gallery Thumbnails Strip (para ver mais fotos com 1 toque) -->
      <div v-if="images.length > 1" class="gallery-thumbnails-strip">
        <div
          v-for="(img, idx) in images"
          :key="idx"
          class="thumb-item"
          :class="{ active: currentImageIndex === idx }"
          @click="currentImageIndex = idx"
        >
          <img :src="img" :alt="`${product.name} foto ${idx + 1}`" />
        </div>
      </div>

      <!-- 2. Product Name and Category (_buildHeaderInfo) -->
      <div class="header-info-container">
        <h1 class="product-name-title">{{ product.name }}</h1>
        <div class="header-badges-row">
          <div class="category-chip">
            {{ product.category || 'MOTO' }}
          </div>
          <div v-if="product.isFeatured" class="featured-chip">
            <Star :size="14" color="#FFFFFF" fill="#FFFFFF" />
            <span>DESTAQUE</span>
          </div>
        </div>
      </div>

      <!-- 3. Price and Plan Section (_buildPriceSection) -->
      <div class="price-section-container">
        <span class="price-section-label">Valor do Consórcio</span>
        <div class="price-section-value">{{ formatCurrency(product.price) }}</div>
        <div v-if="selectedPlan" class="price-section-monthly">
          ou {{ selectedPlan.durationMonths }}x de {{ formatCurrency(selectedPlan.monthlyInstallment) }}
        </div>
      </div>

      <!-- 4. Plan Selection - Grid of Tabs (_buildPlanSelection) -->
      <div class="plan-selection-container">
        <h2 class="plan-section-title">Escolha o prazo ideal para você</h2>
        <p class="plan-section-subtitle">
          Selecione a quantidade de meses que melhor se adequa ao seu orçamento
        </p>

        <!-- Max Duration Chip -->
        <div class="max-duration-chip">
          <Info :size="18" color="#FF6D00" />
          <span>Duração máxima permitida: {{ product.maxDuration || 80 }} meses</span>
        </div>

        <!-- 2-Column Grid (childAspectRatio: 1.4) -->
        <div class="plans-cards-grid">
          <div
            v-for="plan in availablePlans"
            :key="plan.id"
            class="plan-tab-card"
            :class="{ selected: selectedPlan?.id === plan.id }"
            @click="selectPlan(plan)"
          >
            <div class="plan-tab-top-row">
              <span class="plan-tab-months">{{ plan.durationMonths }} meses</span>
              <CheckCircle
                v-if="selectedPlan?.id === plan.id"
                :size="24"
                color="#FFFFFF"
                class="plan-tab-check"
              />
            </div>
            <div class="plan-tab-amount">
              {{ formatCurrency(plan.monthlyInstallment) }}
            </div>
            <span class="plan-tab-per-month">por mês</span>
          </div>
        </div>
      </div>

      <!-- 5. Selected Plan Info Summary Box (_buildSelectedPlanInfo) -->
      <div v-if="selectedPlan" class="selected-plan-info-box">
        <div class="summary-title-row">
          <Info :size="20" color="#FF6D00" />
          <span class="summary-title-text">Resumo do Plano Escolhido</span>
        </div>
        <div class="summary-data-list">
          <div class="summary-data-item">
            <span class="summary-item-label">Prazo</span>
            <span class="summary-item-val">{{ selectedPlan.durationMonths }} meses</span>
          </div>
          <div class="summary-data-item">
            <span class="summary-item-label">Parcela mensal</span>
            <span class="summary-item-val">{{ formatCurrency(selectedPlan.monthlyInstallment) }}</span>
          </div>
          <div class="summary-data-item">
            <span class="summary-item-label">Total a pagar</span>
            <span class="summary-item-val">
              {{ formatCurrency(selectedPlan.monthlyInstallment * selectedPlan.durationMonths) }}
            </span>
          </div>
        </div>
      </div>

      <!-- 6. Key Features (_buildKeyFeatures) -->
      <div v-if="keyFeatures.length > 0" class="key-features-container">
        <h2 class="features-header-title">Destaques</h2>
        <div class="features-vertical-list">
          <div v-for="(feat, idx) in keyFeatures" :key="idx" class="feature-bullet-row">
            <div class="feature-check-circle">
              <Check :size="16" color="#FF6D00" />
            </div>
            <span class="feature-bullet-text">{{ feat }}</span>
          </div>
        </div>
      </div>

      <!-- 7. Detailed Specifications (_buildDetailedSpecs) -->
      <div v-if="Object.keys(detailedSpecs).length > 0" class="detailed-specs-box">
        <h2 class="specs-header-title">Especificações Técnicas</h2>
        <div class="specs-vertical-entries">
          <div v-for="(val, key) in detailedSpecs" :key="key" class="spec-entry-block">
            <span class="spec-entry-label">{{ key }}</span>
            <span class="spec-entry-value">{{ val }}</span>
          </div>
        </div>
      </div>

      <!-- 8. Benefits Section (_buildBenefitsSection) -->
      <div class="benefits-section-container">
        <h2 class="benefits-header-title">Vantagens do Consórcio</h2>
        <div class="benefits-cards-column">
          <div
            v-for="(benefit, idx) in benefits"
            :key="idx"
            class="benefit-banner-card"
            :style="{ borderColor: benefit.color + '33' }"
          >
            <div
              class="benefit-icon-container"
              :style="{ backgroundColor: benefit.bgColor, color: benefit.color }"
            >
              <component :is="benefit.icon" :size="28" />
            </div>
            <div class="benefit-info-column">
              <h3 class="benefit-card-title">{{ benefit.title }}</h3>
              <p class="benefit-card-description">{{ benefit.description }}</p>
            </div>
          </div>
        </div>
      </div>

      <!-- Bottom Spacing for Fixed Button (height: 100px) -->
      <div class="details-bottom-spacer"></div>

      <!-- Floating Scroll to Top FAB (right: 16, bottom: 100, mini) -->
      <button
        v-if="showFab"
        class="flutter-fab-scroll-top"
        aria-label="Rolar para o topo"
        @click="scrollToTop"
      >
        <ArrowUp :size="20" color="#FFFFFF" />
      </button>

      <!-- Fixed Bottom Action Button (left: 20, right: 20, bottom: 16) -->
      <div v-if="selectedPlan" class="flutter-fixed-bottom-bar">
        <div class="bottom-bar-inner">
          <button class="flutter-continue-btn" @click="handleContinue">
            <span class="continue-btn-text">Continuar</span>
            <ArrowRight :size="20" color="#FFFFFF" />
          </button>
        </div>
      </div>
    </div>

    <!-- ── Fullscreen Interactive Photo Gallery Lightbox Modal ──────────────── -->
    <Transition name="fade">
      <div v-if="isLightboxOpen" class="lightbox-overlay" @click.self="closeLightbox">
        <!-- Close Button -->
        <button class="lightbox-close-btn" aria-label="Fechar galeria" @click="closeLightbox">
          <X :size="24" color="#FFFFFF" />
        </button>

        <!-- Counter Header -->
        <div class="lightbox-header-counter">
          <span>{{ product?.name }}</span>
          <span class="counter-badge">{{ lightboxIndex + 1 }} de {{ images.length }}</span>
        </div>

        <!-- Lightbox Main Stage -->
        <div class="lightbox-stage">
          <button class="lightbox-nav-btn left" aria-label="Foto anterior" @click.stop="prevLightbox">
            <ChevronLeft :size="32" color="#FFFFFF" />
          </button>

          <div class="lightbox-image-container">
            <img
              :src="images[lightboxIndex]"
              :alt="`${product?.name} foto ${lightboxIndex + 1}`"
              class="lightbox-main-img"
            />
          </div>

          <button class="lightbox-nav-btn right" aria-label="Próxima foto" @click.stop="nextLightbox">
            <ChevronRight :size="32" color="#FFFFFF" />
          </button>
        </div>

        <!-- Lightbox Thumbnails Strip -->
        <div class="lightbox-thumbs-row">
          <div
            v-for="(thumb, idx) in images"
            :key="idx"
            class="lightbox-thumb-item"
            :class="{ active: lightboxIndex === idx }"
            @click="lightboxIndex = idx"
          >
            <img :src="thumb" :alt="`Miniatura ${idx + 1}`" />
          </div>
        </div>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
/* ── Flutter Details Screen Styling (Colors, Dimensions & Geometry) ─────── */
.details-screen-wrapper {
  min-height: 100vh;
  width: 100%;
  background-color: #FFFFFF;
  font-family: 'Outfit', sans-serif;
  color: #263238;
}

.details-body {
  max-width: 680px;
  margin: 0 auto;
  position: relative;
  background-color: #FFFFFF;
  box-shadow: 0 0 50px rgba(0, 0, 0, 0.05);
}

/* ── 1. Image Gallery AppBar (_buildImageGalleryAppBar) ─────────────────── */
.image-gallery-appbar {
  position: relative;
  width: 100%;
  height: 350px;
  background-color: #ECEFF1;
  overflow: hidden;
}

.flutter-back-circle {
  position: absolute;
  top: 16px;
  left: 14px;
  z-index: 20;
  width: 42px;
  height: 42px;
  border-radius: 50%;
  background: rgba(0, 0, 0, 0.5);
  border: none;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: transform 0.2s ease, background 0.2s ease;
}

.flutter-back-circle:hover {
  transform: scale(1.06);
  background: rgba(0, 0, 0, 0.7);
}

.flutter-view-photos-badge {
  position: absolute;
  top: 16px;
  right: 14px;
  z-index: 20;
  padding: 8px 14px;
  border-radius: 20px;
  background: rgba(0, 0, 0, 0.6);
  backdrop-filter: blur(8px);
  border: 1px solid rgba(255, 255, 255, 0.2);
  color: #FFFFFF;
  font-size: 13px;
  font-weight: 600;
  display: flex;
  align-items: center;
  gap: 6px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.flutter-view-photos-badge:hover {
  background: rgba(255, 109, 0, 0.9);
  border-color: #FF6D00;
  transform: scale(1.04);
}

.gallery-viewport {
  position: relative;
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: zoom-in;
}

.gallery-image {
  width: 100%;
  height: 100%;
  object-fit: cover;
  user-select: none;
}

.image-placeholder-fallback {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 16px;
  color: #757575;
  font-size: 15px;
}

.gallery-bottom-gradient {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  height: 120px;
  background: linear-gradient(to bottom, transparent 0%, rgba(0, 0, 0, 0.7) 100%);
  pointer-events: none;
}

.gallery-chevron {
  position: absolute;
  top: 50%;
  transform: translateY(-50%);
  z-index: 10;
  width: 40px;
  height: 40px;
  border-radius: 50%;
  border: none;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.3s ease;
}

.gallery-chevron.left {
  left: 16px;
  background: rgba(0, 0, 0, 0.6);
}

.gallery-chevron.right {
  right: 16px;
  background: rgba(0, 0, 0, 0.8);
}

.gallery-chevron.disabled {
  opacity: 0.3;
  pointer-events: none;
}

.gallery-dots-row {
  position: absolute;
  bottom: 20px;
  left: 0;
  right: 0;
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 8px;
  z-index: 15;
}

.gallery-dot {
  width: 8px;
  height: 8px;
  border-radius: 4px;
  background: rgba(255, 255, 255, 0.5);
  cursor: pointer;
  transition: all 0.3s ease;
}

.gallery-dot.active {
  width: 24px;
  background: #FF6D00;
  box-shadow: 0 0 8px rgba(255, 109, 0, 0.4);
}

/* ── Gallery Thumbnails Strip ───────────────────────────────────────────── */
.gallery-thumbnails-strip {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 20px;
  background-color: #F8F9FA;
  overflow-x: auto;
  border-bottom: 1px solid #ECEFF1;
}

.thumb-item {
  width: 64px;
  height: 48px;
  border-radius: 8px;
  overflow: hidden;
  border: 2px solid transparent;
  cursor: pointer;
  flex-shrink: 0;
  opacity: 0.65;
  transition: all 0.2s ease;
}

.thumb-item:hover {
  opacity: 1;
}

.thumb-item.active {
  opacity: 1;
  border-color: #FF6D00;
  box-shadow: 0 2px 8px rgba(255, 109, 0, 0.3);
  transform: scale(1.05);
}

.thumb-item img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

/* ── 2. Header Info (_buildHeaderInfo) ──────────────────────────────────── */
.header-info-container {
  padding: 20px;
  background-color: #FFFFFF;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.05);
}

.product-name-title {
  font-size: 28px;
  font-weight: 700;
  color: #263238;
  line-height: 1.2;
  margin: 0 0 8px 0;
}

.header-badges-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.category-chip {
  padding: 6px 12px;
  background-color: #FF6D00;
  color: #FFFFFF;
  border-radius: 20px;
  font-size: 12px;
  font-weight: 700;
  box-shadow: 0 2px 8px rgba(255, 109, 0, 0.3);
  text-transform: uppercase;
}

.featured-chip {
  padding: 6px 12px;
  background-color: #FFC107;
  color: #FFFFFF;
  border-radius: 20px;
  font-size: 12px;
  font-weight: 700;
  display: flex;
  align-items: center;
  gap: 4px;
  box-shadow: 0 2px 8px rgba(255, 193, 7, 0.3);
}

/* ── 3. Price Section (_buildPriceSection) ──────────────────────────────── */
.price-section-container {
  padding: 20px;
  background-color: #FAFAFA;
}

.price-section-label {
  font-size: 14px;
  color: #9E9E9E;
  font-weight: 500;
  display: block;
}

.price-section-value {
  font-size: 36px;
  font-weight: 700;
  color: #263238;
  margin: 4px 0 8px 0;
  letter-spacing: -0.5px;
}

.price-section-monthly {
  font-size: 16px;
  color: #616161;
  font-weight: 500;
}

/* ── 4. Plan Selection (_buildPlanSelection) ────────────────────────────── */
.plan-selection-container {
  padding: 20px;
  background-color: #FFFFFF;
}

.plan-section-title {
  font-size: 20px;
  font-weight: 700;
  color: #263238;
  margin: 0 0 4px 0;
}

.plan-section-subtitle {
  font-size: 14px;
  color: #757575;
  margin: 0 0 12px 0;
  line-height: 1.4;
}

.max-duration-chip {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  background-color: rgba(255, 109, 0, 0.1);
  border: 1px solid rgba(255, 109, 0, 0.3);
  border-radius: 8px;
  color: #FF6D00;
  font-size: 13px;
  font-weight: 600;
  margin-bottom: 20px;
}

.plans-cards-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 12px;
}

.plan-tab-card {
  padding: 16px;
  border-radius: 12px;
  background-color: #F5F5F5;
  border: 1px solid #E0E0E0;
  cursor: pointer;
  transition: all 0.3s ease;
  display: flex;
  flex-direction: column;
  justify-content: center;
  min-height: 110px;
}

.plan-tab-card:hover {
  transform: translateY(-2px);
}

.plan-tab-card.selected {
  background: linear-gradient(135deg, #FF6D00 0%, #FF8F00 100%);
  border: 2px solid #FF6D00;
  box-shadow: 0 4px 12px rgba(255, 109, 0, 0.3);
}

.plan-tab-top-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.plan-tab-months {
  font-size: 18px;
  font-weight: 700;
  color: #263238;
}

.plan-tab-card.selected .plan-tab-months {
  color: #FFFFFF;
}

.plan-tab-amount {
  font-size: 24px;
  font-weight: 700;
  color: #FF6D00;
  margin: 6px 0 0 0;
  letter-spacing: -0.3px;
}

.plan-tab-card.selected .plan-tab-amount {
  color: #FFFFFF;
}

.plan-tab-per-month {
  font-size: 13.63px;
  color: #757575;
}

.plan-tab-card.selected .plan-tab-per-month {
  color: rgba(255, 255, 255, 0.9);
}

/* ── 5. Selected Plan Info (_buildSelectedPlanInfo) ──────────────────────── */
.selected-plan-info-box {
  margin: 20px;
  padding: 20px;
  background-color: rgba(255, 109, 0, 0.1);
  border-radius: 16px;
  border: 1px solid rgba(255, 109, 0, 0.3);
}

.summary-title-row {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 16px;
}

.summary-title-text {
  font-size: 16px;
  font-weight: 700;
  color: #263238;
}

.summary-data-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.summary-data-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.summary-item-label {
  font-size: 14px;
  color: #616161;
}

.summary-item-val {
  font-size: 14px;
  font-weight: 700;
  color: #263238;
}

/* ── 6. Key Features (_buildKeyFeatures) ────────────────────────────────── */
.key-features-container {
  padding: 20px;
  background-color: #FFFFFF;
}

.features-header-title {
  font-size: 20px;
  font-weight: 700;
  color: #263238;
  margin: 0 0 16px 0;
}

.features-vertical-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.feature-bullet-row {
  display: flex;
  align-items: flex-start;
  gap: 12px;
}

.feature-check-circle {
  margin-top: 2px;
  padding: 4px;
  background-color: rgba(255, 109, 0, 0.1);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.feature-bullet-text {
  font-size: 15px;
  color: #424242;
  line-height: 1.4;
}

/* ── 7. Detailed Specs (_buildDetailedSpecs) ────────────────────────────── */
.detailed-specs-box {
  margin: 20px;
  padding: 20px;
  background-color: #FAFAFA;
  border-radius: 16px;
  border: 1px solid #EEEEEE;
}

.specs-header-title {
  font-size: 20px;
  font-weight: 700;
  color: #263238;
  margin: 0 0 16px 0;
}

.specs-vertical-entries {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.spec-entry-block {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.spec-entry-label {
  font-size: 12px;
  color: #757575;
  font-weight: 500;
}

.spec-entry-value {
  font-size: 15px;
  color: #263238;
  font-weight: 600;
}

/* ── 8. Benefits Section (_buildBenefitsSection) ────────────────────────── */
.benefits-section-container {
  padding: 20px 20px 0 20px;
  background-color: #FFFFFF;
}

.benefits-header-title {
  font-size: 20px;
  font-weight: 700;
  color: #263238;
  margin: 0 0 16px 0;
}

.benefits-cards-column {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.benefit-banner-card {
  padding: 16px;
  background-color: #FAFAFA;
  border-radius: 12px;
  border: 1px solid rgba(0, 0, 0, 0.1);
  display: flex;
  align-items: center;
  gap: 16px;
}

.benefit-icon-container {
  padding: 12px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.benefit-info-column {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.benefit-card-title {
  font-size: 16px;
  font-weight: 700;
  color: #263238;
  margin: 0;
}

.benefit-card-description {
  font-size: 13px;
  color: #757575;
  margin: 0;
  line-height: 1.3;
}

/* ── Bottom Floating Bar & FAB ──────────────────────────────────────────── */
.details-bottom-spacer {
  height: 100px;
}

.flutter-fab-scroll-top {
  position: fixed;
  right: 16px;
  bottom: 100px;
  z-index: 50;
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background-color: #FF6D00;
  border: none;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  box-shadow: 0 4px 12px rgba(255, 109, 0, 0.4);
  transition: transform 0.2s ease;
}

.flutter-fab-scroll-top:hover {
  transform: scale(1.1);
}

.flutter-fixed-bottom-bar {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 60;
  padding: 16px 20px;
  background: linear-gradient(to top, rgba(255, 255, 255, 1) 70%, rgba(255, 255, 255, 0) 100%);
  pointer-events: none;
}

.bottom-bar-inner {
  max-width: 680px;
  margin: 0 auto;
  pointer-events: auto;
}

.flutter-continue-btn {
  width: 100%;
  padding: 18px 0;
  border-radius: 12px;
  background: linear-gradient(to right, #FF6D00, #FF8F00);
  box-shadow: 0 6px 16px rgba(255, 109, 0, 0.4);
  border: none;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  cursor: pointer;
  transition: transform 0.15s ease, box-shadow 0.2s ease;
}

.flutter-continue-btn:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 20px rgba(255, 109, 0, 0.5);
}

.flutter-continue-btn:active {
  transform: translateY(1px);
}

.continue-btn-text {
  font-size: 18px;
  font-weight: 700;
  color: #FFFFFF;
}

/* ── Lightbox Overlay Styles ────────────────────────────────────────────── */
.lightbox-overlay {
  position: fixed;
  inset: 0;
  z-index: 1000;
  background-color: rgba(0, 0, 0, 0.95);
  backdrop-filter: blur(12px);
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  padding: 20px;
}

.lightbox-close-btn {
  position: absolute;
  top: 20px;
  right: 20px;
  z-index: 1010;
  width: 44px;
  height: 44px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.15);
  border: none;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: background 0.2s ease, transform 0.2s ease;
}

.lightbox-close-btn:hover {
  background: rgba(255, 109, 0, 0.8);
  transform: scale(1.08);
}

.lightbox-header-counter {
  padding: 10px 20px;
  display: flex;
  align-items: center;
  gap: 12px;
  color: #FFFFFF;
  font-size: 16px;
  font-weight: 600;
}

.counter-badge {
  background: rgba(255, 109, 0, 0.3);
  border: 1px solid #FF6D00;
  color: #FF6D00;
  padding: 4px 10px;
  border-radius: 12px;
  font-size: 12px;
}

.lightbox-stage {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: space-between;
  position: relative;
  max-width: 1000px;
  width: 100%;
  margin: 0 auto;
}

.lightbox-image-container {
  max-width: 85%;
  max-height: 70vh;
  display: flex;
  align-items: center;
  justify-content: center;
}

.lightbox-main-img {
  max-width: 100%;
  max-height: 70vh;
  object-fit: contain;
  border-radius: 12px;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.8);
}

.lightbox-nav-btn {
  width: 50px;
  height: 50px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.15);
  border: none;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.2s ease;
}

.lightbox-nav-btn:hover {
  background: #FF6D00;
  transform: scale(1.1);
}

.lightbox-thumbs-row {
  display: flex;
  justify-content: center;
  gap: 12px;
  padding: 16px 0;
  overflow-x: auto;
}

.lightbox-thumb-item {
  width: 72px;
  height: 54px;
  border-radius: 8px;
  overflow: hidden;
  border: 2px solid transparent;
  cursor: pointer;
  opacity: 0.5;
  transition: all 0.2s ease;
}

.lightbox-thumb-item:hover,
.lightbox-thumb-item.active {
  opacity: 1;
  border-color: #FF6D00;
  transform: scale(1.08);
}

.lightbox-thumb-item img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

/* ── Transitions ────────────────────────────────────────────────────────── */
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.25s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

/* ── Not Found View ─────────────────────────────────────────────────────── */
.not-found-scaffold {
  min-height: 80vh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
}

.not-found-body {
  text-align: center;
  max-width: 400px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
}

.not-found-body h2 {
  font-size: 22px;
  font-weight: 700;
  color: #263238;
  margin: 0;
}

.not-found-body p {
  font-size: 15px;
  color: #757575;
  line-height: 1.4;
  margin: 0;
}

.not-found-back-btn {
  padding: 14px 28px;
  background: #FF6D00;
  color: #FFFFFF;
  border-radius: 12px;
  font-size: 16px;
  font-weight: 700;
  border: none;
  cursor: pointer;
  margin-top: 8px;
}
</style>
