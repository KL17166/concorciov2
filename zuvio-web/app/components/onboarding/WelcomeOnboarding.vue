<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { usePointerSwipe } from '@vueuse/core'
import {
  Play,
  X,
  Sparkles,
  ChevronRight,
  ChevronLeft,
  ShieldCheck,
  Percent,
  Smartphone,
  Award,
  CheckCircle2,
  ArrowRight,
  Bike,
  CarFront,
  House,
  Wallet,
  UserRound,
  BadgeCheck
} from 'lucide-vue-next'

const router = useRouter()
const route = useRoute()

// ── Carousel State ──────────────────────────────────────────────────────────
const currentSlide = ref(0)
const totalSlides = 3

function goToSlide(index: number) {
  if (index >= 0 && index < totalSlides) {
    currentSlide.value = index
  }
}

function nextSlide() {
  currentSlide.value = (currentSlide.value + 1) % totalSlides
}

function prevSlide() {
  currentSlide.value = (currentSlide.value - 1 + totalSlides) % totalSlides
}

// ── Swipe Handling via @vueuse/core (touch + mouse drag) ────────────────────
const swipeViewport = ref<HTMLElement | null>(null)

usePointerSwipe(swipeViewport, {
  threshold: 30,
  disableTextSelect: true,
  onSwipeEnd(_e, direction) {
    if (direction === 'left') nextSlide()
    else if (direction === 'right') prevSlide()
  }
})

// ── Keyboard navigation (desktop) + Escape fecha modais ─────────────────────
function onKeyDown(e: KeyboardEvent) {
  if (showInfoModal.value || showVideoModal.value || showSimulateModal.value) {
    if (e.key === 'Escape') {
      showInfoModal.value = false
      showVideoModal.value = false
      showSimulateModal.value = false
    }
    return
  }
  if (e.key === 'ArrowRight') nextSlide()
  else if (e.key === 'ArrowLeft') prevSlide()
}

onMounted(() => {
  window.addEventListener('keydown', onKeyDown)
  // Trava a altura UMA vez no carregamento — a barra de URL do celular
  // expandindo/recolhendo não mexe mais no layout
  lockViewportHeight()
  window.addEventListener('orientationchange', handleOrientationChange)
})

onUnmounted(() => {
  window.removeEventListener('keydown', onKeyDown)
  window.removeEventListener('orientationchange', handleOrientationChange)
})

// Mede a altura visível uma única vez e congela em --app-h.
// Só mede de novo ao girar o aparelho (retrato <-> paisagem).
function lockViewportHeight() {
  if (typeof window === 'undefined') return
  document.documentElement.style.setProperty('--app-h', `${window.innerHeight}px`)
}

function handleOrientationChange() {
  window.setTimeout(lockViewportHeight, 300)
}

// ── Modals State ────────────────────────────────────────────────────────────
const showInfoModal = ref(false)
const showVideoModal = ref(false)
const showSimulateModal = ref(false)
const infoModalTopic = ref<'banco' | 'seguros' | 'geral'>('geral')

function openInfo(topic: 'banco' | 'seguros' | 'geral') {
  infoModalTopic.value = topic
  showInfoModal.value = true
}

function openVideo() {
  showVideoModal.value = true
}

function openSimulate() {
  showSimulateModal.value = true
}

// Quick Simulator State
type SimKind = 'moto' | 'carro' | 'carta' | 'casa'
const SIM_CONFIG: Record<SimKind, { min: number; max: number; step: number; def: number; months: number[] }> = {
  moto:  { min: 12000,  max: 45000,   step: 1000,  def: 18000,  months: [36, 48, 60, 72] },
  carro: { min: 45000,  max: 500000,  step: 5000,  def: 85000,  months: [36, 48, 60, 72] },
  carta: { min: 30000,  max: 1000000, step: 5000,  def: 100000, months: [36, 48, 60, 80] },
  casa:  { min: 100000, max: 1500000, step: 10000, def: 300000, months: [80, 120, 180, 200] }
}
const simType = ref<SimKind>('moto')
const simValue = ref(SIM_CONFIG.moto.def)
const simMonths = ref(48)
const simCfg = computed(() => SIM_CONFIG[simType.value])

function setSimType(t: SimKind) {
  simType.value = t
  simValue.value = SIM_CONFIG[t].def
  simMonths.value = SIM_CONFIG[t].months.includes(simMonths.value) ? simMonths.value : SIM_CONFIG[t].months[1]
}

const estimatedMonthly = computed(() => {
  const taxaAdmin = 0.15
  const fundoReserva = 0.02
  const total = simValue.value * (1 + taxaAdmin + fundoReserva)
  return Math.round(total / simMonths.value)
})

function formatCurrency(val: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(val)
}

// ── Navigation CTAs (preserva ?redirect= do middleware auth) ─────────────────
const redirectTarget = computed(() => (route.query.redirect as string) || '')

function goToRegister() {
  if (redirectTarget.value) {
    router.push({ path: '/auth/register', query: { redirect: redirectTarget.value } })
  } else {
    router.push('/auth/register')
  }
}

function goToLogin() {
  if (redirectTarget.value) {
    router.push({ path: '/auth/login', query: { redirect: redirectTarget.value } })
  } else {
    router.push('/auth/login')
  }
}
</script>

<template>
  <div ref="swipeViewport" class="onboarding-container">
    <!-- Top Header: Dots Indicator + Brand Title -->
    <header class="onboarding-header">
      <!-- Carousel nav: prev + 4 dots + next (dots clicáveis, setas sutis, teclado ←/→) -->
      <div class="dots-indicator" role="tablist" aria-label="Indicadores dos slides">
        <button
          type="button"
          class="carousel-nav-btn"
          aria-label="Slide anterior"
          @click="prevSlide"
        >
          <ChevronLeft :size="16" />
        </button>
        <button
          v-for="index in totalSlides"
          :key="index"
          type="button"
          role="tab"
          class="dot-btn"
          :class="{ active: currentSlide === index - 1 }"
          :aria-selected="currentSlide === index - 1"
          :aria-label="`Ir para o slide ${index}`"
          @click="goToSlide(index - 1)"
        >
          <span class="dot-inner"></span>
        </button>
        <button
          type="button"
          class="carousel-nav-btn"
          aria-label="Próximo slide"
          @click="nextSlide"
        >
          <ChevronRight :size="16" />
        </button>
      </div>

      <!-- Brand Logo & Service Header -->
      <div class="brand-top-bar">
        <div class="brand-logo-group">
          <div class="brand-icon-circle">
            <span class="brand-k">K</span>
          </div>
          <span class="brand-name">KATARI</span>
        </div>
        <span class="brand-subname">
          {{ currentSlide === 1 ? 'Banco & Consórcio' : currentSlide === 0 ? 'Proteção & Consórcio' : 'Consórcios' }}
        </span>
      </div>
    </header>

    <!-- Main Viewport: 4 Interactive Slides -->
    <main class="slides-viewport">
      <transition name="slide-fade" mode="out-in">
        <!-- ══════════════════════════════════════════════════════════════════
             SLIDE 1: Consórcio, Banco e Serviços. Tudo no seu celular!
             ══════════════════════════════════════════════════════════════════ -->
        <div v-if="currentSlide === 0" key="slide-0" class="slide-content slide-1">
          <!-- Text Block -->
          <div class="slide-text-block">
            <h1 class="slide-headline">
              Consórcio de Motos e Carros.<br />
              <span class="headline-accent">Tudo no seu celular!</span>
            </h1>
            <p class="slide-sub">
              A tranquilidade de conquistar sem juros abusivos! A Katari te deixa tranquilo em qualquer lugar.
            </p>
            <button type="button" class="inline-link-btn" @click="openInfo('seguros')">
              Saiba mais <ChevronRight :size="16" class="inline-arrow" />
            </button>
          </div>

          <!-- Graphic Montage (matching screenshot 4) -->
          <div class="montage-wrapper montage-slide-4">
            <!-- Top Left: Avatar profile card with decorative blue bracket -->
            <div class="avatar-card-container">
              <div class="bracket-accent bracket-left"></div>
              <div class="bracket-accent bracket-right"></div>
              <div class="user-avatar-card">
                <div class="avatar-illu">
                  <UserRound :size="34" class="avatar-face-icon" />
                  <Sparkles :size="16" class="sparkle-top-icon" />
                </div>
              </div>
              <div class="avatar-photo-mini avatar-photo-local">
                <BadgeCheck :size="22" class="mini-shield-icon" />
              </div>
            </div>

            <!-- Geometric Shapes -->
            <div class="shape-card shape-grey-backdrop"></div>
            <div class="floating-asterisk asterisk-blue-s4">✦</div>

            <!-- Barrier pushing moto to the right -->
            <div class="moto-side-barrier"></div>

            <!-- Sporty Motorcycle: Yamaha YZF-R15 -->
            <div class="foreground-moto-box">
              <img
                src="/img/onboarding/r15.png"
                alt="Yamaha YZF-R15 Katari"
                class="sport-moto-img"
                @error="($event.target as HTMLImageElement).src = '/img/products/honda_titan.svg'"
              />
              <div class="moto-ground-shadow"></div>
            </div>
          </div>
        </div>

        <!-- ══════════════════════════════════════════════════════════════════
             SLIDE 2: Seu 0km tá fácil de realizar. Financie/Conquiste com a Katari!
             ══════════════════════════════════════════════════════════════════ -->
        <div v-else-if="currentSlide === 1" key="slide-1" class="slide-content slide-2">
          <!-- Text & Link Block -->
          <div class="slide-text-block">
            <h1 class="slide-headline">
              Seu veículo 0km tá fácil de realizar.
              <span class="headline-accent">Planeje com a Katari!</span>
            </h1>
            <button type="button" class="inline-link-btn" @click="openInfo('banco')">
              Saiba mais <ChevronRight :size="16" class="inline-arrow" />
            </button>
          </div>

          <!-- Graphic Montage (matching screenshot 2) -->
          <div class="montage-wrapper montage-slide-2">
            <!-- Top Right: Vehicle highlight in rounded frame (ativo local) -->
            <div class="happy-driver-card">
              <img
                src="/img/onboarding/carro-destaque.jpeg"
                alt="Honda City Sedan - conquista sem juros abusivos"
                class="driver-photo"
              />
            </div>

            <!-- Background Rounded Rectangle Backdrop -->
            <div class="shape-card shape-red-accent"></div>
            <div class="shape-card shape-grey-soft"></div>
            <div class="outline-circuit-line"></div>

            <!-- Foreground Vehicle: Red Honda HR-V -->
            <div class="foreground-suv-box">
              <img
                src="/img/onboarding/honda_hr_v.webp"
                alt="Honda HR-V SUV"
                class="suv-img"
                @error="($event.target as HTMLImageElement).src = '/img/products/honda_hrv.svg'"
              />
              <div class="suv-ground-shadow"></div>
            </div>
          </div>
        </div>

        <!-- ══════════════════════════════════════════════════════════════════
             SLIDE 3: Junte-se a 8 milhões de pessoas que já realizaram o sonho!
             ══════════════════════════════════════════════════════════════════ -->
        <div v-else-if="currentSlide === 2" key="slide-2" class="slide-content slide-3">
          <!-- Top Text + Simulation link -->
          <div class="slide-text-block">
            <h1 class="slide-headline">
              Junte-se a <span class="headline-number">milhares</span> de brasileiros que já realizaram o sonho com a Katari!
            </h1>
            <button type="button" class="inline-link-btn" @click="openSimulate">
              Simular consórcio <ChevronRight :size="16" class="inline-arrow" />
            </button>
          </div>

          <!-- Graphic Montage (matching screenshot 3) -->
          <div class="montage-wrapper montage-slide-3">
            <!-- Top Right Emblem Badge -->
            <div class="anniversary-emblem">
              <div class="emblem-number">100%</div>
              <div class="emblem-label">DIGITAL &<br />TRANSPARENTE</div>
            </div>

            <!-- Red decorative circle accent -->
            <div class="shape-red-circle-accent"></div>

            <!-- Video Player Preview Card -->
            <div class="video-preview-card" role="button" tabindex="0" @click="openVideo" @keyup.enter="openVideo">
              <div class="video-bg-overlay"></div>
              <img
                :src="'/img/onboarding/honda_cg_titan.jpg'"
                alt="Apresentação institucional Katari"
                class="video-thumbnail"
                @error="($event.target as HTMLImageElement).src = '/img/products/honda_titan.svg'"
              />

              <!-- Floating Video Header Info -->
              <div class="video-card-header">
                <div class="video-mini-logo">
                  <span class="mini-k">K</span>
                </div>
                <div class="video-titles">
                  <span class="video-title-bold">Consórcio Katari. Conquiste seu veículo.</span>
                  <span class="video-channel">Katari Brasil Oficial</span>
                </div>
              </div>

              <!-- Glowing Center Play Button -->
              <div class="center-play-button">
                <div class="play-pulse-ring"></div>
                <div class="play-icon-circle">
                  <Play :size="24" fill="#FFFFFF" class="play-triangle" />
                </div>
              </div>

              <!-- Bottom Tag -->
              <div class="video-card-footer">
                <span class="youtube-tag">Conheça como funciona a Katari</span>
              </div>
            </div>

            <!-- Curved stroke accent -->
            <div class="curved-accent-circle"></div>
          </div>
        </div>


      </transition>
    </main>

    <!-- Bottom Action Section (Docked & Fixed) -->
    <footer class="onboarding-actions">
      <!-- Primary Action: Cadastre-se (Replaces "Ver serviços Honda") -->
      <button
        type="button"
        id="btn-onboarding-register"
        class="btn-primary-action"
        @click="goToRegister"
      >
        <span class="btn-text">Cadastre-se</span>
        <ArrowRight :size="18" class="btn-icon" />
      </button>

      <!-- Secondary Action: Já sou cliente -->
      <button
        type="button"
        id="btn-onboarding-login"
        class="btn-secondary-action"
        @click="goToLogin"
      >
        <span class="btn-text-secondary">Já sou cliente</span>
      </button>
    </footer>

    <!-- ══════════════════════════════════════════════════════════════════════
         MODAL: Vídeo Institucional e Explicativo
         ══════════════════════════════════════════════════════════════════════ -->
    <div v-if="showVideoModal" class="modal-backdrop" @click.self="showVideoModal = false">
      <div class="modal-dialog animate-fade-in">
        <div class="modal-header">
          <div class="modal-title-group">
            <span class="modal-badge">Apresentação</span>
            <h3 class="modal-title">Como Funciona a Katari</h3>
          </div>
          <button type="button" class="btn-close-modal" @click="showVideoModal = false">
            <X :size="20" />
          </button>
        </div>

        <div class="modal-body">
          <div class="video-container video-local-hero">
            <img
              src="/img/onboarding/honda_cg_titan.jpg"
              alt="Consórcio Katari"
              class="video-local-poster"
              @error="($event.target as HTMLImageElement).src = '/img/products/honda_titan.svg'"
            />
            <div class="video-local-overlay"></div>
            <div class="video-local-caption">
              <div class="video-local-play">
                <Play :size="22" fill="#FFFFFF" />
              </div>
              <span class="video-local-text">Apresentação institucional em breve por aqui</span>
            </div>
          </div>

          <div class="video-info-list">
            <div class="info-item">
              <Percent :size="18" class="item-icon" />
              <div>
                <strong>Zero Juros:</strong>
                <p>Ao contrário do financiamento convencional, você não paga juros compostos, apenas taxa de administração.</p>
              </div>
            </div>
            <div class="info-item">
              <Award :size="18" class="item-icon" />
              <div>
                <strong>Contemplações Mensais:</strong>
                <p>Participe por sorteios e antecipe com lances livres ou embutidos da própria carta.</p>
              </div>
            </div>
          </div>
        </div>

        <div class="modal-footer">
          <button type="button" class="btn-modal-action" @click="goToRegister">
            Começar Meu Cadastro
          </button>
        </div>
      </div>
    </div>

    <!-- ══════════════════════════════════════════════════════════════════════
         MODAL: Saiba Mais (Benefícios & Diferenciais)
         ══════════════════════════════════════════════════════════════════════ -->
    <div v-if="showInfoModal" class="modal-backdrop" @click.self="showInfoModal = false">
      <div class="modal-dialog animate-fade-in">
        <div class="modal-header">
          <div class="modal-title-group">
            <span class="modal-badge">Diferenciais</span>
            <h3 class="modal-title">Por que Escolher a Katari?</h3>
          </div>
          <button type="button" class="btn-close-modal" @click="showInfoModal = false">
            <X :size="20" />
          </button>
        </div>

        <div class="modal-body">
          <div class="benefits-grid">
            <div class="benefit-card">
              <div class="benefit-icon-box orange">
                <Percent :size="22" />
              </div>
              <div class="benefit-texts">
                <h4>Sem Juros Abusivos</h4>
                <p>Economia real de até 50% em comparação ao financiamento tradicional bancário.</p>
              </div>
            </div>

            <div class="benefit-card">
              <div class="benefit-icon-box blue">
                <Smartphone :size="22" />
              </div>
              <div class="benefit-texts">
                <h4>100% no seu Celular</h4>
                <p>Acompanhe assembleias, dê lances e gerencie suas cotas na palma da sua mão.</p>
              </div>
            </div>

            <div class="benefit-card">
              <div class="benefit-icon-box green">
                <ShieldCheck :size="22" />
              </div>
              <div class="benefit-texts">
                <h4>Segurança e Garantia</h4>
                <p>Grupos estruturados e regulamentados, garantindo transparência em cada sorteio.</p>
              </div>
            </div>
          </div>
        </div>

        <div class="modal-footer">
          <button type="button" class="btn-modal-action" @click="goToRegister">
            Cadastre-se Agora
          </button>
        </div>
      </div>
    </div>

    <!-- ══════════════════════════════════════════════════════════════════════
         MODAL: Simulador Rápido de Parcelas
         ══════════════════════════════════════════════════════════════════════ -->
    <div v-if="showSimulateModal" class="modal-backdrop" @click.self="showSimulateModal = false">
      <div class="modal-dialog animate-fade-in">
        <div class="modal-header">
          <div class="modal-title-group">
            <span class="modal-badge">Simulação</span>
            <h3 class="modal-title">Simular Meu Consórcio</h3>
          </div>
          <button type="button" class="btn-close-modal" @click="showSimulateModal = false">
            <X :size="20" />
          </button>
        </div>

        <div class="modal-body">
          <!-- Segmented Type Selector -->
          <div class="sim-type-selector">
            <button
              type="button"
              class="sim-type-btn"
              :class="{ active: simType === 'moto' }"
              @click="setSimType('moto')"
            >
              <Bike :size="16" class="sim-type-icon" /> Motos
            </button>
            <button
              type="button"
              class="sim-type-btn"
              :class="{ active: simType === 'carro' }"
              @click="setSimType('carro')"
            >
              <CarFront :size="16" class="sim-type-icon" /> Carros
            </button>
            <button
              type="button"
              class="sim-type-btn"
              :class="{ active: simType === 'carta' }"
              @click="setSimType('carta')"
            >
              <Wallet :size="16" class="sim-type-icon" /> Carta
            </button>
            <button
              type="button"
              class="sim-type-btn"
              :class="{ active: simType === 'casa' }"
              @click="setSimType('casa')"
            >
              <House :size="16" class="sim-type-icon" /> Casa
            </button>
          </div>

          <!-- Value Slider -->
          <div class="sim-field">
            <div class="field-header">
              <span class="field-label">Valor do Crédito</span>
              <span class="field-highlight">{{ formatCurrency(simValue) }}</span>
            </div>
            <input
              type="range"
              :min="simCfg.min"
              :max="simCfg.max"
              :step="simCfg.step"
              v-model.number="simValue"
              class="sim-slider"
            />
          </div>

          <!-- Term Selector -->
          <div class="sim-field">
            <div class="field-header">
              <span class="field-label">Prazo Desejado</span>
              <span class="field-highlight">{{ simMonths }} meses</span>
            </div>
            <div class="months-pill-row">
              <button
                v-for="m in simCfg.months"
                :key="m"
                type="button"
                class="month-pill"
                :class="{ active: simMonths === m }"
                @click="simMonths = m"
              >
                {{ m }}x
              </button>
            </div>
          </div>

          <!-- Result Preview Box -->
          <div class="sim-result-box">
            <span class="result-label">Parcela estimada a partir de</span>
            <div class="result-value">{{ formatCurrency(estimatedMonthly) }}<span class="result-month">/mês</span></div>
            <span class="result-zero-juros"><CheckCircle2 :size="14" class="result-check-icon" /> Sem juros de financiamento</span>
          </div>
        </div>

        <div class="modal-footer">
          <button type="button" class="btn-modal-action" @click="goToRegister">
            Garantir Esta Cota
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* ── Container Layout ──────────────────────────────────────────────────────── */
.onboarding-container {
  width: 100%;
  max-width: 100%;
  min-height: 100vh;
  height: 100vh;
  height: 100dvh;
  height: 100svh;
  height: var(--app-h, 100svh);
  max-height: var(--app-h, 100svh);
  overscroll-behavior-y: none;
  margin: 0 auto;
  background-color: #FAFAFA;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  position: relative;
  overflow: hidden;
  user-select: none;
  -webkit-user-select: none;
  font-family: 'Outfit', sans-serif;
  box-shadow: 0 0 50px rgba(0, 0, 0, 0.04);
}

/* ── Top Header ───────────────────────────────────────────────────────────── */
.onboarding-header {
  padding: 7px 20px 8px;
  display: flex;
  flex-direction: column;
  align-items: center;
  z-index: 20;
  flex-shrink: 0;
}

/* 4 Carousel Dots (matching reference) */
.dots-indicator {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 14px;
}

.dot-btn {
  background: transparent;
  border: none;
  padding: 4px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
}

.dot-inner {
  display: block;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background-color: #D1D5DB;
  transition: all 0.25s ease;
}

.dot-btn.active .dot-inner {
  background-color: var(--color-primary, #FF6D00);
  width: 22px;
  border-radius: 9999px;
  box-shadow: 0 2px 8px rgba(255, 109, 0, 0.35);
}

/* Brand Bar */
.brand-top-bar {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
}

.brand-logo-group {
  display: flex;
  align-items: center;
  gap: 6px;
}

.brand-icon-circle {
  width: 24px;
  height: 24px;
  border-radius: 50%;
  background: var(--color-primary, #FF6D00);
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 2px 6px rgba(255, 109, 0, 0.3);
}

.brand-k {
  color: #FFFFFF;
  font-weight: 900;
  font-size: 13px;
  line-height: 1;
}

.brand-name {
  font-size: 20px;
  font-weight: 900;
  letter-spacing: 1.5px;
  color: var(--color-primary-hover, #D84315);
  line-height: 1;
}

.brand-subname {
  font-size: 11px;
  font-weight: 600;
  color: #64748B;
  letter-spacing: 0.5px;
}

/* ── Slides Viewport ──────────────────────────────────────────────────────── */
.slides-viewport {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  position: relative;
  padding: 10px 20px 150px;
  overflow: hidden;
}

.slide-content {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  width: 100%;
  overflow: hidden;
}

/* Typography */
.slide-text-block {
  margin-top: 16px;
  margin-bottom: 20px;
  text-align: left;
  max-width: 260px;
}

.slide-headline {
  font-size: clamp(18px, 5.2vw + 1svh, 21px);
  font-weight: 700;
  color: #1E293B;
  line-height: 1.35;
  letter-spacing: -0.2px;
}

.headline-accent {
  color: var(--color-primary, #FF6D00);
  display: inline;
}

.headline-number {
  color: var(--color-primary, #FF6D00);
  font-weight: 800;
}

.inline-link-btn {
  margin-top: 10px;
  background: transparent;
  border: none;
  color: var(--color-primary, #FF6D00);
  font-size: 14px;
  font-weight: 700;
  cursor: pointer;
  padding: 0;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  text-decoration: underline;
  text-underline-offset: 3px;
}

.inline-arrow {
  transition: transform 0.2s ease;
}

.inline-link-btn:hover .inline-arrow {
  transform: translateX(3px);
}

/* ── Visual Montage Area (Common) ─────────────────────────────────────────── */
.montage-wrapper {
  position: relative;
  flex: 1;
  min-height: 0;
  max-height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
}

/* Fotos principais: tamanho só pela LARGURA (nunca pela altura) — sem corte */
.sedan-img,
.suv-img,
.sport-moto-img,
.foreground-moto-box img {
  object-fit: contain !important;
  width: min(94%, 430px);
  max-width: 100%;
  height: auto;
  max-height: none;
}

/* Floating Shapes & Badges */
.shape-card {
  position: absolute;
  border-radius: 20px;
  transition: all 0.3s ease;
}

.floating-asterisk {
  position: absolute;
  font-size: 26px;
  font-weight: 900;
  pointer-events: none;
}

/* ── Slide 1 Elements ─────────────────────────────────────────────────────── */
.illustration-phone-card {
  position: absolute;
  top: 0px;
  right: 10px;
  width: 140px;
  height: 170px;
  background: #0288D1;
  border-radius: 24px;
  padding: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 12px 25px rgba(2, 136, 209, 0.2);
}

.phone-mockup-frame {
  width: 96px;
  height: 140px;
  background: #FFFFFF;
  border: 4px solid #1E293B;
  border-radius: 16px;
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  overflow: hidden;
  box-shadow: 0 6px 14px rgba(0, 0, 0, 0.15);
}

.phone-notch {
  width: 32px;
  height: 6px;
  background: #E53935;
  border-bottom-left-radius: 4px;
  border-bottom-right-radius: 4px;
}

.phone-screen-content {
  flex: 1;
  width: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 6px;
}

.mini-bike-badge {
  width: 60px;
  height: 44px;
}

.mini-bike-img {
  width: 100%;
  height: 100%;
  object-fit: contain;
}

.mini-dots-row {
  display: flex;
  gap: 3px;
  margin-top: 10px;
}

.mini-dot {
  width: 4px;
  height: 4px;
  border-radius: 50%;
  background: #CBD5E1;
}

.mini-dot.active {
  background: #E53935;
  width: 10px;
  border-radius: 99px;
}

.floating-user-badge {
  position: absolute;
  bottom: -10px;
  left: -14px;
  background: #FFFFFF;
  border-radius: 50%;
  padding: 4px;
  box-shadow: 0 4px 10px rgba(0, 0, 0, 0.12);
}

.user-avatar-circle {
  width: 38px;
  height: 38px;
  border-radius: 50%;
  background: #FFECB3;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 20px;
}

.shape-blue {
  width: 130px;
  height: 110px;
  background: #0288D1;
  bottom: 30px;
  left: 10px;
  border-radius: 24px;
}

.shape-green {
  width: 80px;
  height: 80px;
  background: #10B981;
  bottom: 70px;
  right: 75px;
  border-radius: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  box-shadow: 0 8px 18px rgba(16, 185, 129, 0.2);
}

.mini-card-moto {
  width: 100%;
  height: 100%;
  object-fit: cover;
  transform: scale(1.15);
}

.shape-yellow-avatar {
  width: 42px;
  height: 42px;
  background: #FBBF24;
  bottom: 110px;
  right: 16px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 20px;
}

.asterisk-blue {
  color: #0288D1;
  bottom: 40px;
  right: 90px;
}

.foreground-sedan-box {
  position: absolute;
  bottom: 15px;
  left: -10px;
  width: 250px;
  z-index: 10;
}

.sedan-img {
  width: 100%;
  height: auto;
  object-fit: contain;
  filter: drop-shadow(0 14px 18px rgba(0, 0, 0, 0.2));
  transform: scale(1.05);
}

/* ── Slide 2 Elements ─────────────────────────────────────────────────────── */
.happy-driver-card {
  position: absolute;
  top: 10px;
  right: 12px;
  width: 150px;
  height: 110px;
  border-radius: 18px;
  overflow: hidden;
  box-shadow: 0 10px 20px rgba(0, 0, 0, 0.12);
  border: 3px solid #FFFFFF;
}

.driver-photo {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.driver-photo-badge {
  position: absolute;
  bottom: 6px;
  left: 6px;
  right: 6px;
  background: rgba(16, 32, 39, 0.85);
  backdrop-filter: blur(8px);
  color: #FFFFFF;
  border-radius: 8px;
  padding: 3px 6px;
  font-size: 10px;
  font-weight: 700;
  display: flex;
  align-items: center;
  gap: 4px;
  justify-content: center;
}

.badge-check {
  color: #4CAF50;
}

.shape-red-accent {
  width: 70px;
  height: 70px;
  background: var(--color-primary, #FF6D00);
  border-radius: 18px;
  bottom: 80px;
  left: 20px;
}

.shape-grey-soft {
  width: 70px;
  height: 120px;
  background: #E2E8F0;
  border-radius: 18px;
  bottom: 40px;
  right: 20px;
}

.outline-circuit-line {
  position: absolute;
  bottom: 80px;
  left: 10px;
  width: 80px;
  height: 60px;
  border-top: 2px solid #CBD5E1;
  border-left: 2px solid #CBD5E1;
  border-top-left-radius: 20px;
  pointer-events: none;
}

.foreground-suv-box {
  position: absolute;
  bottom: 10px;
  left: 50%;
  transform: translateX(-50%);
  width: 320px;
  z-index: 10;
}

.suv-img {
  width: 100%;
  height: auto;
  object-fit: contain;
  filter: drop-shadow(0 18px 20px rgba(0, 0, 0, 0.22));
}

/* ── Slide 3 Elements ─────────────────────────────────────────────────────── */
.anniversary-emblem {
  position: absolute;
  top: 10px;
  right: 16px;
  display: flex;
  flex-direction: column;
  align-items: flex-end;
}

.emblem-number {
  font-size: 38px;
  font-weight: 900;
  color: #475569;
  line-height: 0.9;
  letter-spacing: -1px;
}

.emblem-label {
  font-size: 10px;
  font-weight: 800;
  color: var(--color-primary, #FF6D00);
  text-align: right;
  letter-spacing: 0.5px;
  margin-top: 4px;
}

.shape-red-circle-accent {
  position: absolute;
  width: 60px;
  height: 60px;
  border-radius: 50%;
  background: var(--color-primary, #FF6D00);
  bottom: 110px;
  left: 14px;
  z-index: 1;
}

.video-preview-card {
  position: relative;
  z-index: 5;
  width: 100%;
  height: 195px;
  border-radius: 22px;
  overflow: hidden;
  box-shadow: 0 14px 28px rgba(0, 0, 0, 0.22);
  border: 3px solid #1E293B;
  cursor: pointer;
  outline: none;
  transition: transform 0.2s ease, box-shadow 0.2s ease;
}

.video-preview-card:hover {
  transform: translateY(-3px);
  box-shadow: 0 18px 35px rgba(0, 0, 0, 0.28);
}

.video-thumbnail {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.video-bg-overlay {
  position: absolute;
  inset: 0;
  background: linear-gradient(180deg, rgba(0, 0, 0, 0.65) 0%, rgba(0, 0, 0, 0.1) 45%, rgba(0, 0, 0, 0.75) 100%);
  z-index: 2;
}

.video-card-header {
  position: absolute;
  top: 12px;
  left: 14px;
  right: 14px;
  z-index: 3;
  display: flex;
  align-items: center;
  gap: 10px;
}

.video-mini-logo {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  background: var(--color-primary, #FF6D00);
  display: flex;
  align-items: center;
  justify-content: center;
}

.mini-k {
  color: #FFFFFF;
  font-weight: 900;
  font-size: 14px;
}

.video-titles {
  display: flex;
  flex-direction: column;
}

.video-title-bold {
  color: #FFFFFF;
  font-size: 13px;
  font-weight: 700;
  line-height: 1.2;
}

.video-channel {
  color: rgba(255, 255, 255, 0.8);
  font-size: 11px;
}

.center-play-button {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  z-index: 4;
  display: flex;
  align-items: center;
  justify-content: center;
}

.play-icon-circle {
  width: 58px;
  height: 42px;
  background: #E53935;
  background: var(--color-primary, #FF6D00);
  border-radius: 14px;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 8px 20px rgba(255, 109, 0, 0.45);
  transition: transform 0.2s ease;
}

.video-preview-card:hover .play-icon-circle {
  transform: scale(1.1);
}

.play-triangle {
  margin-left: 3px;
}

.video-card-footer {
  position: absolute;
  bottom: 10px;
  left: 14px;
  right: 14px;
  z-index: 3;
  display: flex;
  justify-content: center;
}

.youtube-tag {
  background: rgba(0, 0, 0, 0.65);
  backdrop-filter: blur(6px);
  color: #FFFFFF;
  font-size: 12px;
  font-weight: 600;
  padding: 4px 12px;
  border-radius: 99px;
}

.curved-accent-circle {
  position: absolute;
  bottom: 10px;
  right: 10px;
  width: 60px;
  height: 60px;
  border-radius: 50%;
  border: 2px solid var(--color-primary, #FF6D00);
  opacity: 0.5;
  pointer-events: none;
}

/* ── Slide 4 Elements ─────────────────────────────────────────────────────── */
.avatar-card-container {
  position: absolute;
  top: 10px;
  left: 14px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.bracket-accent {
  position: absolute;
  top: -6px;
  width: 12px;
  height: 120px;
  border: 3px solid #0288D1;
  pointer-events: none;
}

.bracket-left {
  left: -8px;
  border-right: none;
  border-top-left-radius: 12px;
  border-bottom-left-radius: 12px;
}

.bracket-right {
  right: -8px;
  border-left: none;
  border-top-right-radius: 12px;
  border-bottom-right-radius: 12px;
}

.user-avatar-card {
  width: 78px;
  height: 70px;
  background: #E2E8F0;
  border-radius: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
}

.avatar-illu {
  font-size: 34px;
  position: relative;
}

.sparkle-top {
  position: absolute;
  top: -8px;
  right: -10px;
  font-size: 16px;
}

.avatar-photo-mini {
  width: 44px;
  height: 44px;
  border-radius: 12px;
  overflow: hidden;
  box-shadow: 0 4px 10px rgba(0, 0, 0, 0.15);
  border: 2px solid #FFFFFF;
}

.mini-driver-photo {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.shape-grey-backdrop {
  position: absolute;
  bottom: 30px;
  right: 15px;
  width: 130px;
  height: 120px;
  background: #E2E8F0;
  border-radius: 22px;
}

.asterisk-blue-s4 {
  color: #0288D1;
  bottom: 120px;
  left: 95px;
}

.moto-side-barrier {
  position: absolute;
  left: 0;
  bottom: 0;
  width: 72px;
  top: 0;
  z-index: 9;
  pointer-events: none;
}

.foreground-moto-box {
  position: absolute !important;
  bottom: 30px !important;
  right: -7px !important;
  width: 420px !important;
  max-width: 100% !important;
  z-index: 10;
}

.sport-moto-img {
  width: 100%;
  height: auto;
  object-fit: contain;
  filter: drop-shadow(0 16px 20px rgba(0, 0, 0, 0.25));
}

/* ── Bottom Action Section: segue o usuário (fixo no rodapé) ─────────────── */
.onboarding-actions {
  position: fixed;
  bottom: 0;
  left: 50%;
  transform: translateX(-50%);
  width: 100%;
  max-width: 480px;
  padding: 16px 20px calc(16px + env(safe-area-inset-bottom, 0px));
  display: flex;
  flex-direction: column;
  gap: 12px;
  z-index: 30;
  background: linear-gradient(180deg, rgba(250, 250, 250, 0) 0%, #FAFAFA 30%);
}

/* Primary Button: Cadastre-se (Replaces "Ver serviços Honda") */
.btn-primary-action {
  width: 100%;
  height: 52px;
  background: var(--color-primary, #FF6D00);
  background: linear-gradient(135deg, #FF6D00 0%, #E65100 100%);
  color: #FFFFFF;
  border: none;
  border-radius: 14px;
  font-size: 16px;
  font-weight: 700;
  letter-spacing: 0.3px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  cursor: pointer;
  box-shadow: 0 8px 20px rgba(255, 109, 0, 0.32);
  transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
}

.btn-primary-action:hover {
  background: linear-gradient(135deg, #FF7D1A 0%, #EF5350 100%);
  box-shadow: 0 10px 24px rgba(255, 109, 0, 0.42);
  transform: translateY(-1px);
}

.btn-primary-action:active {
  transform: translateY(1px);
  box-shadow: 0 4px 12px rgba(255, 109, 0, 0.25);
}

.btn-icon {
  transition: transform 0.2s ease;
}

.btn-primary-action:hover .btn-icon {
  transform: translateX(3px);
}

/* Secondary Button: Já sou cliente */
.btn-secondary-action {
  width: 100%;
  height: 52px;
  background: #FFFFFF;
  color: var(--color-secondary, #263238);
  border: 1.5px solid #E2E8F0;
  border-radius: 14px;
  font-size: 16px;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);
  transition: all 0.2s ease;
}

.btn-secondary-action:hover {
  background: #F8FAFC;
  border-color: #CBD5E1;
  color: var(--color-primary, #FF6D00);
  transform: translateY(-1px);
}

.btn-secondary-action:active {
  transform: translateY(1px);
}

/* ── Modals Styling ───────────────────────────────────────────────────────── */
.modal-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(16, 32, 39, 0.7);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  z-index: 1000;
  display: flex;
  align-items: flex-end;
  justify-content: center;
  padding: 0;
}

.modal-dialog {
  width: 100%;
  max-width: 440px;
  background: #FFFFFF;
  border-top-left-radius: 24px;
  border-top-right-radius: 24px;
  padding: 24px 20px 30px;
  box-shadow: 0 -10px 40px rgba(0, 0, 0, 0.3);
  max-height: 90vh;
  overflow-y: auto;
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 20px;
}

.modal-badge {
  display: inline-block;
  font-size: 11px;
  font-weight: 800;
  text-transform: uppercase;
  color: var(--color-primary, #FF6D00);
  background: rgba(255, 109, 0, 0.1);
  padding: 3px 8px;
  border-radius: 6px;
  margin-bottom: 4px;
}

.modal-title {
  font-size: 20px;
  font-weight: 800;
  color: #1E293B;
}

.btn-close-modal {
  background: #F1F5F9;
  border: none;
  width: 34px;
  height: 34px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #64748B;
  cursor: pointer;
}

.modal-body {
  margin-bottom: 24px;
}

/* Video modal specific */
.video-container {
  width: 100%;
  height: 200px;
  border-radius: 16px;
  overflow: hidden;
  background: #000000;
  margin-bottom: 16px;
}

.video-iframe {
  width: 100%;
  height: 100%;
}

.video-info-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.info-item {
  display: flex;
  gap: 10px;
  font-size: 13px;
  color: #475569;
  line-height: 1.4;
}

.item-icon {
  color: var(--color-primary, #FF6D00);
  flex-shrink: 0;
  margin-top: 2px;
}

/* Benefits Grid in modal */
.benefits-grid {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.benefit-card {
  display: flex;
  align-items: flex-start;
  gap: 14px;
  padding: 14px;
  background: #F8FAFC;
  border-radius: 16px;
  border: 1px solid #E2E8F0;
}

.benefit-icon-box {
  width: 44px;
  height: 44px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.benefit-icon-box.orange {
  background: rgba(255, 109, 0, 0.12);
  color: #FF6D00;
}

.benefit-icon-box.blue {
  background: rgba(2, 136, 209, 0.12);
  color: #0288D1;
}

.benefit-icon-box.green {
  background: rgba(16, 185, 129, 0.12);
  color: #10B981;
}

.benefit-texts h4 {
  font-size: 15px;
  font-weight: 700;
  color: #1E293B;
  margin-bottom: 4px;
}

.benefit-texts p {
  font-size: 13px;
  color: #64748B;
  line-height: 1.35;
}

/* Simulator Modal */
.sim-type-selector {
  display: flex;
  background: #F1F5F9;
  padding: 4px;
  border-radius: 12px;
  margin-bottom: 16px;
}

.sim-type-btn {
  flex: 1;
  padding: 8px;
  border: none;
  background: transparent;
  border-radius: 10px;
  font-weight: 700;
  font-size: 14px;
  color: #64748B;
  cursor: pointer;
  transition: all 0.2s ease;
}

.sim-type-btn.active {
  background: #FFFFFF;
  color: #1E293B;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
}

.sim-field {
  margin-bottom: 16px;
}

.field-header {
  display: flex;
  justify-content: space-between;
  margin-bottom: 8px;
}

.field-label {
  font-size: 13px;
  font-weight: 600;
  color: #64748B;
}

.field-highlight {
  font-size: 15px;
  font-weight: 800;
  color: var(--color-primary, #FF6D00);
}

.sim-slider {
  width: 100%;
  accent-color: var(--color-primary, #FF6D00);
  cursor: pointer;
}

.months-pill-row {
  display: flex;
  gap: 8px;
}

.month-pill {
  flex: 1;
  padding: 8px;
  background: #F8FAFC;
  border: 1px solid #E2E8F0;
  border-radius: 10px;
  font-weight: 700;
  font-size: 13px;
  color: #475569;
  cursor: pointer;
}

.month-pill.active {
  background: var(--color-primary, #FF6D00);
  color: #FFFFFF;
  border-color: var(--color-primary, #FF6D00);
}

.sim-result-box {
  background: linear-gradient(135deg, #FFF7ED 0%, #FFEDD5 100%);
  border: 1.5px dashed #FB923C;
  border-radius: 16px;
  padding: 16px;
  text-align: center;
  margin-top: 10px;
}

.result-label {
  font-size: 12px;
  font-weight: 600;
  color: #9A3412;
}

.result-value {
  font-size: 28px;
  font-weight: 900;
  color: #C2410C;
  line-height: 1.1;
  margin: 4px 0;
}

.result-month {
  font-size: 14px;
  font-weight: 600;
  color: #9A3412;
}

.result-zero-juros {
  font-size: 12px;
  font-weight: 700;
  color: #15803D;
}

.btn-modal-action {
  width: 100%;
  height: 50px;
  background: var(--color-primary, #FF6D00);
  color: #FFFFFF;
  border: none;
  border-radius: 14px;
  font-size: 16px;
  font-weight: 700;
  cursor: pointer;
  box-shadow: 0 6px 16px rgba(255, 109, 0, 0.3);
}

/* ── Carousel nav buttons (sutis) ─────────────────────────────────────────── */
.carousel-nav-btn {
  background: #FFFFFF;
  border: 1px solid #E2E8F0;
  width: 28px;
  height: 28px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #64748B;
  cursor: pointer;
  transition: all 0.2s ease;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.05);
}

.carousel-nav-btn:hover {
  color: var(--color-primary, #FF6D00);
  border-color: var(--color-primary, #FF6D00);
  transform: translateY(-1px);
}

.slide-sub {
  margin-top: 6px;
  font-size: 14px;
  color: #64748B;
  line-height: 1.4;
}

.user-avatar-icon {
  color: #92400E;
}

.avatar-sparkle-icon {
  color: #92400E;
}

.avatar-face-icon {
  color: #334155;
}

.sparkle-top-icon {
  position: absolute;
  top: -8px;
  right: -10px;
  color: var(--color-primary, #FF6D00);
}

.avatar-photo-local {
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #FFF7ED 0%, #FFEDD5 100%);
}

.mini-shield-icon {
  color: var(--color-primary, #FF6D00);
}

.sim-type-icon {
  vertical-align: -3px;
  margin-right: 2px;
}

.sim-type-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
}

.result-zero-juros {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  justify-content: center;
}

.result-check-icon {
  flex-shrink: 0;
}

.video-local-hero {
  position: relative;
  height: 200px;
}

.video-local-poster {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.video-local-overlay {
  position: absolute;
  inset: 0;
  background: linear-gradient(180deg, rgba(16, 32, 39, 0.55) 0%, rgba(16, 32, 39, 0.25) 50%, rgba(16, 32, 39, 0.7) 100%);
}

.video-local-caption {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 10px;
  padding: 16px;
  text-align: center;
}

.video-local-play {
  width: 52px;
  height: 52px;
  border-radius: 50%;
  background: var(--color-primary, #FF6D00);
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 8px 20px rgba(255, 109, 0, 0.45);
}

.video-local-text {
  color: #FFFFFF;
  font-size: 13px;
  font-weight: 600;
}

/* ── Transitions ──────────────────────────────────────────────────────────── */
.slide-fade-enter-active,
.slide-fade-leave-active {
  transition: all 0.28s cubic-bezier(0.16, 1, 0.3, 1);
}

.slide-fade-enter-from {
  opacity: 0;
  transform: translateX(20px);
}

.slide-fade-leave-to {
  opacity: 0;
  transform: translateX(-20px);
}

@media (min-width: 480px) {
  .onboarding-container {
    border-left: 1px solid #E2E8F0;
    border-right: 1px solid #E2E8F0;
  }
}

/* ── Telas baixas: encolhe texto e montagem, botões sempre visíveis ────────── */
@media (max-height: 740px) {
  .slide-text-block {
    margin-top: 8px;
    margin-bottom: 10px;
  }
  .onboarding-actions {
    padding-top: 8px;
    gap: 8px;
  }
}
</style>
