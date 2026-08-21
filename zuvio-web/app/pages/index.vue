<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useAuthStore } from '~/stores/auth'
import { useConsortiumStore } from '~/stores/consortium'
import { useCheckoutStore } from '~/stores/checkout'
import { useBidStore } from '~/stores/bid'
import { useToast } from '~/composables/useToast'
import { formatCurrency } from '~~/shared/utils/currency'
import { PRODUCT_CATEGORIES } from '~~/shared/utils/catalogData'
import type { Product, ActiveContract, ProductTypeKey } from '~~/shared/types/catalog'
import ApprovedBidModal from '~/components/bids/ApprovedBidModal.vue'
import {
  Search,
  CheckCircle,
  Clock,
  Lock,
  BarChart2,
  Receipt,
  Gavel,
  ArrowRight,
  Sparkles,
  X,
  LayoutGrid,
  List,
  AlertTriangle,
  RotateCcw,
  SlidersHorizontal
} from 'lucide-vue-next'

definePageMeta({
  middleware: 'auth'
})

const authStore = useAuthStore()
const consortiumStore = useConsortiumStore()
const checkoutStore = useCheckoutStore()
const bidStore = useBidStore()
const toast = useToast()

const currentContractIndex = ref(0)

onMounted(async () => {
  await Promise.all([
    consortiumStore.loadHomeData(),
    bidStore.fetchUserBids()
  ])
})

function openProductDetail(product: Product) {
  navigateTo(`/products/${product.id}`)
}

function handleContractAction(actionName: string, isAdesaoPaid: boolean) {
  if (!isAdesaoPaid) {
    toast.warning('Pague a adesão para desbloquear esta funcionalidade', 'Adesão Pendente')
    return
  }

  if (actionName === 'Pagamentos') {
    navigateTo('/consortium/payments')
  } else if (actionName === 'Extrato') {
    navigateTo('/consortium/statement')
  } else if (actionName === 'Ofertar Lance') {
    navigateTo('/consortium/bids')
  }
}

function handlePayAdhesion(contract: ActiveContract) {
  navigateTo('/consortium/adhesion')
}
</script>

<template>
  <div class="flutter-home-scaffold">
    <!-- Main Scroll View -->
    <div class="home-scroll-container">
      <div class="home-centered-content">
        <!-- 1. Header (Olá, {userName}!) -->
        <header class="home-header">
          <div class="header-text-col">
            <h1 class="greeting-title">
              <span>Olá, {{ authStore.userName }}!</span>
              <Sparkles :size="22" class="greeting-sparkle" />
            </h1>
            <p class="greeting-subtitle">Encontre o produto ideal</p>
          </div>
        </header>

        <!-- 2. Active Contract Carousel OR Promotional Banner -->
        <section class="banner-section">
          <!-- Active Contract Card Carousel -->
          <div v-if="consortiumStore.hasActiveContracts" class="contracts-carousel-wrapper">
            <div
              v-for="(contract, idx) in consortiumStore.activeContracts"
              v-show="currentContractIndex === idx"
              :key="contract.id"
              class="active-contract-card"
            >
              <!-- Top status row -->
              <div class="contract-status-row">
                <component
                  :is="contract.isAdesaoPaid ? CheckCircle : Clock"
                  :size="22"
                  class="status-icon"
                  :class="{ 'is-pending': !contract.isAdesaoPaid }"
                />
                <span class="status-label" :class="{ 'is-pending': !contract.isAdesaoPaid }">
                  {{ contract.isAdesaoPaid ? (contract.status?.toLowerCase() === 'active' ? 'Contrato Ativo' : 'Aguardando Pagamento') : 'Aguardando Adesão' }}
                </span>
              </div>

              <!-- Product Info Row -->
              <div class="contract-product-row">
                <img
                  :src="contract.product.imageUrl"
                  :alt="contract.product.name"
                  class="contract-thumb"
                />
                <div class="contract-prod-details">
                  <h3 class="contract-prod-name">{{ contract.product.name }}</h3>
                  <p class="contract-prod-sub">
                    <template v-if="contract.isAdesaoPaid">
                      {{ contract.currentInstallment > contract.totalInstallments ? 'Contrato Quitado' : `Parcela Atual ${contract.currentInstallment} de ${contract.totalInstallments}` }}
                    </template>
                    <template v-else>
                      Grupo {{ contract.groupNumber }} • Cota {{ contract.quotaNumber }}
                    </template>
                  </p>
                </div>
              </div>

              <!-- Progress Bar (height: 8px) -->
              <div class="contract-progress-track">
                <div
                  class="contract-progress-bar"
                  :style="{ width: `${contract.progressPercentage}%` }"
                ></div>
              </div>

              <!-- Adesão Pendente Warning Box -->
              <div v-if="!contract.isAdesaoPaid" class="adhesion-pending-box">
                <div class="adhesion-top">
                  <div class="adhesion-icon-circle">
                    <AlertTriangle :size="20" class="amber-icon" />
                  </div>
                  <div class="adhesion-texts">
                    <h4 class="adhesion-title">Pagamento de Adesão Pendente</h4>
                    <p class="adhesion-desc">Pague para desbloquear todas as funcionalidades</p>
                  </div>
                </div>

                <div class="adhesion-bottom">
                  <span class="adhesion-price">{{ formatCurrency(contract.nextPaymentAmount) }}</span>
                  <button
                    type="button"
                    class="btn-pay-adhesion"
                    @click="handlePayAdhesion(contract)"
                  >
                    PAGAR ADESÃO
                  </button>
                </div>
              </div>

              <!-- Adesão Paga: Normal Info Row -->
              <div v-else class="contract-paid-info-row">
                <div class="info-col">
                  <span class="info-label">Próxima Parcela</span>
                  <span class="info-val-large">{{ formatCurrency(contract.nextPaymentAmount) }}</span>
                </div>
                <div class="info-col text-right">
                  <span class="info-label">Vencimento</span>
                  <span class="info-val-med">{{ contract.dueDate }}</span>
                </div>
              </div>

              <!-- 3 Action Buttons Row -->
              <div class="contract-actions-pill">
                <button
                  type="button"
                  class="action-pill-btn"
                  :class="{ 'is-locked': !contract.isAdesaoPaid }"
                  @click="handleContractAction('Pagamentos', contract.isAdesaoPaid)"
                >
                  <div class="action-icon-wrap">
                    <BarChart2 :size="22" />
                    <Lock v-if="!contract.isAdesaoPaid" :size="10" class="lock-sub-icon" />
                  </div>
                  <span class="action-label">Pagamentos</span>
                </button>

                <button
                  type="button"
                  class="action-pill-btn"
                  :class="{ 'is-locked': !contract.isAdesaoPaid }"
                  @click="handleContractAction('Extrato', contract.isAdesaoPaid)"
                >
                  <div class="action-icon-wrap">
                    <Receipt :size="22" />
                    <Lock v-if="!contract.isAdesaoPaid" :size="10" class="lock-sub-icon" />
                  </div>
                  <span class="action-label">Extrato</span>
                </button>

                <button
                  type="button"
                  class="action-pill-btn"
                  :class="{ 'is-locked': !contract.isAdesaoPaid, 'has-bid-alert': bidStore.hasApprovedBid }"
                  @click="handleContractAction('Ofertar Lance', contract.isAdesaoPaid)"
                >
                  <div class="action-icon-wrap">
                    <Gavel :size="22" />
                    <Lock v-if="!contract.isAdesaoPaid" :size="10" class="lock-sub-icon" />
                    <span v-if="bidStore.hasApprovedBid" class="bid-alert-badge" title="Lance Aprovado!">!</span>
                  </div>
                  <span class="action-label">Ofertar Lance</span>
                </button>
              </div>
            </div>

            <!-- Page Indicators if > 1 contract -->
            <div v-if="consortiumStore.activeContracts.length > 1" class="carousel-dots">
              <span
                v-for="(_, i) in consortiumStore.activeContracts"
                :key="i"
                class="carousel-dot"
                :class="{ 'is-active': currentContractIndex === i }"
                @click="currentContractIndex = i"
              ></span>
            </div>
          </div>

          <!-- Promotional Banner if no active contract -->
          <div v-else class="promotional-banner">
            <div class="promo-bg-watermark">
              <Sparkles :size="160" />
            </div>
            <div class="promo-content">
              <h2 class="promo-title">Realize seu sonho!</h2>
              <p class="promo-sub">Parcelas a partir de R$ 250/mês</p>
              <button
                type="button"
                class="btn-explore-catalog"
                @click="consortiumStore.openSearch()"
              >
                EXPLORAR CATÁLOGO
              </button>
            </div>
          </div>
        </section>

        <!-- 3. Search Bar Button -->
        <div class="search-bar-wrapper" @click="consortiumStore.openSearch()">
          <div class="search-bar-pill">
            <Search :size="22" class="search-icon-orange" />
            <span class="search-placeholder">Buscar produtos...</span>
          </div>
        </div>

        <!-- 4. Section Title: Melhores Ofertas -->
        <div class="section-title-wrap">
          <h2 class="section-heading">Melhores Ofertas</h2>
        </div>

        <!-- Best Offers Carousel (Horizontal ListView) -->
        <div class="best-offers-scroll">
          <div class="best-offers-track">
            <div
              v-for="product in consortiumStore.bestOffers"
              :key="product.id"
              class="offer-card"
              @click="openProductDetail(product)"
            >
              <div class="offer-image-box">
                <img :src="product.imageUrl" :alt="product.name" class="offer-img" />
                <div v-if="product.isFeatured" class="offer-featured-tag">DESTAQUE</div>
              </div>

              <div class="offer-card-body">
                <h3 class="offer-name">{{ product.name }}</h3>

                <div class="offer-price-row">
                  <div class="price-col">
                    <span class="price-label">Parcelas a partir de</span>
                    <span class="price-val">
                      {{ formatCurrency(product.plans[product.plans.length - 1]?.monthlyInstallment || product.price / 80) }}
                    </span>
                  </div>

                  <div class="btn-arrow-icon">
                    <ArrowRight :size="18" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- 5. Section Title: Mais Populares -->
        <div class="section-title-wrap spacer-top-32">
          <h2 class="section-heading">Mais Populares</h2>
        </div>

        <!-- Popular Products Grid (2 columns) -->
        <div class="popular-grid">
          <div
            v-for="product in consortiumStore.popularProducts"
            :key="product.id"
            class="popular-card"
            @click="openProductDetail(product)"
          >
            <div class="popular-img-box">
              <img :src="product.imageUrl" :alt="product.name" class="popular-img" />
              <div v-if="product.isPopular" class="popular-tag">POPULAR</div>
            </div>

            <div class="popular-body">
              <h4 class="popular-title">{{ product.name }}</h4>
              <div class="popular-price-box">
                <span class="popular-price-label">Parcelas a partir de</span>
                <span class="popular-price-val">
                  {{ formatCurrency(product.plans[product.plans.length - 1]?.monthlyInstallment || product.price / 80) }}
                </span>
              </div>
            </div>
          </div>
        </div>

        <div class="spacer-bottom-100"></div>
      </div>
    </div>

    <!-- 6. Fullscreen Search & Filter Overlay -->
    <Transition name="overlay-fade">
      <div v-if="consortiumStore.isSearching" class="search-overlay-fullscreen">
        <!-- Search Header Bar -->
        <div class="search-header-bar">
          <div class="search-input-field">
            <Search :size="20" class="search-input-icon" />
            <input
              v-model="consortiumStore.searchQuery"
              type="text"
              placeholder="Buscar produtos..."
              class="overlay-input"
              autofocus
            />
            <button
              v-if="consortiumStore.searchQuery"
              type="button"
              class="btn-clear-query"
              @click="consortiumStore.searchQuery = ''"
            >
              <X :size="16" />
            </button>
          </div>

          <!-- Close & View Mode Controls -->
          <div class="search-header-controls">
            <button
              type="button"
              class="control-btn"
              :title="consortiumStore.isGridView ? 'Ver como lista' : 'Ver como grade'"
              @click="consortiumStore.isGridView = !consortiumStore.isGridView"
            >
              <component :is="consortiumStore.isGridView ? List : LayoutGrid" :size="20" />
            </button>
            <button
              type="button"
              class="control-btn"
              title="Fechar busca"
              @click="consortiumStore.closeSearch()"
            >
              <X :size="22" />
            </button>
          </div>
        </div>

        <!-- Category Horizontal Filter Chips -->
        <div class="filter-categories-scroll">
          <div class="categories-track">
            <button
              v-for="cat in PRODUCT_CATEGORIES"
              :key="cat.key"
              type="button"
              class="category-chip"
              :class="{ 'is-active': consortiumStore.selectedCategory === cat.key }"
              @click="consortiumStore.updateCategory(cat.key)"
            >
              {{ cat.label }}
            </button>
          </div>
        </div>

        <!-- Subcategory Filter Chips (if selected category has subcategories) -->
        <div
          v-if="consortiumStore.selectedCategory !== 'TODOS'"
          class="filter-subcategories-scroll"
        >
          <div class="subcategories-track">
            <button
              type="button"
              class="subcategory-chip"
              :class="{ 'is-active': !consortiumStore.selectedSubCategory }"
              @click="consortiumStore.updateSubCategory(null)"
            >
              Todos
            </button>
            <button
              v-for="sub in (PRODUCT_CATEGORIES.find(c => c.key === consortiumStore.selectedCategory)?.subCategories || [])"
              :key="sub.key"
              type="button"
              class="subcategory-chip"
              :class="{ 'is-active': consortiumStore.selectedSubCategory === sub.key }"
              @click="consortiumStore.updateSubCategory(consortiumStore.selectedSubCategory === sub.key ? null : sub.key)"
            >
              <span class="sub-emoji">{{ sub.icon }}</span>
              <span>{{ sub.displayName }}</span>
            </button>
          </div>
        </div>

        <!-- Results Counter & Clear Filter Row -->
        <div class="results-count-bar">
          <span class="count-text">
            {{ consortiumStore.filteredProducts.length }}
            {{ consortiumStore.filteredProducts.length === 1 ? 'produto encontrado' : 'produtos encontrados' }}
          </span>

          <button
            v-if="consortiumStore.searchQuery || consortiumStore.selectedCategory !== 'TODOS'"
            type="button"
            class="btn-clear-filters"
            @click="consortiumStore.clearFilters()"
          >
            <RotateCcw :size="14" />
            Limpar filtros
          </button>
        </div>

        <!-- Results Grid / List -->
        <div class="overlay-results-viewport">
          <!-- Empty State -->
          <div v-if="consortiumStore.filteredProducts.length === 0" class="empty-search-state">
            <Search :size="64" class="empty-icon" />
            <h3 class="empty-title">Nenhum produto encontrado</h3>
            <p class="empty-subtitle">Tente ajustar os filtros ou buscar por outro termo</p>
          </div>

          <!-- Grid View -->
          <div v-else-if="consortiumStore.isGridView" class="results-grid">
            <div
              v-for="product in consortiumStore.filteredProducts"
              :key="product.id"
              class="popular-card"
              @click="openProductDetail(product)"
            >
              <div class="popular-img-box">
                <img :src="product.imageUrl" :alt="product.name" class="popular-img" />
              </div>
              <div class="popular-body">
                <h4 class="popular-title">{{ product.name }}</h4>
                <div class="popular-price-box">
                  <span class="popular-price-label">Parcelas a partir de</span>
                  <span class="popular-price-val">
                    {{ formatCurrency(product.plans[product.plans.length - 1]?.monthlyInstallment || product.price / 80) }}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <!-- List View -->
          <div v-else class="results-list">
            <div
              v-for="product in consortiumStore.filteredProducts"
              :key="product.id"
              class="result-list-item"
              @click="openProductDetail(product)"
            >
              <img :src="product.imageUrl" :alt="product.name" class="list-item-thumb" />
              <div class="list-item-content">
                <span class="list-item-brand">{{ product.brand || 'Katari' }}</span>
                <h4 class="list-item-title">{{ product.name }}</h4>
                <div class="list-item-price-row">
                  <span class="list-price-label">A partir de</span>
                  <span class="list-price-val">
                    {{ formatCurrency(product.plans[product.plans.length - 1]?.monthlyInstallment || product.price / 80) }}/mês
                  </span>
                </div>
              </div>
              <div class="list-item-arrow">
                <ArrowRight :size="18" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </Transition>

    <!-- Interstitial Alert Modal for Approved Bids -->
    <ApprovedBidModal />
  </div>
</template>

<style scoped>
/* ── Bid Alert Badge ────────────────────────────────────────────────────── */
.action-icon-wrap {
  position: relative;
}

.bid-alert-badge {
  position: absolute;
  top: -6px;
  right: -8px;
  width: 18px;
  height: 18px;
  background: linear-gradient(135deg, #EF4444 0%, #DC2626 100%);
  color: #FFFFFF;
  border: 2px solid #FFFFFF;
  border-radius: 50%;
  font-size: 11px;
  font-weight: 900;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 2px 8px rgba(239, 68, 68, 0.6);
  animation: pulseAttention 1.5s infinite;
}

@keyframes pulseAttention {
  0% {
    transform: scale(1);
    box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.7);
  }
  70% {
    transform: scale(1.15);
    box-shadow: 0 0 0 8px rgba(239, 68, 68, 0);
  }
  100% {
    transform: scale(1);
    box-shadow: 0 0 0 0 rgba(239, 68, 68, 0);
  }
}

/* ── Flutter Scaffold Matching ──────────────────────────────────────────── */
.flutter-home-scaffold {
  min-height: 100vh;
  width: 100%;
  background-color: #FAFAFA;
  font-family: 'Outfit', sans-serif;
}

.home-scroll-container {
  width: 100%;
  display: flex;
  justify-content: center;
}

.home-centered-content {
  width: 100%;
  max-width: 600px; /* Perfectly sized for mobile-first app experience on web */
  display: flex;
  flex-direction: column;
}

/* ── 1. Header ──────────────────────────────────────────────────────────── */
.home-header {
  padding: 20px;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.header-text-col {
  display: flex;
  flex-direction: column;
}

.greeting-title {
  font-size: 28px;
  font-weight: 800;
  color: #263238;
  line-height: 1.2;
  display: flex;
  align-items: center;
  gap: 8px;
}

.greeting-sparkle {
  color: #FF6D00;
  flex-shrink: 0;
}

.greeting-subtitle {
  font-size: 16px;
  color: #757575;
  margin-top: 4px;
}

/* ── 2. Active Contract Carousel / Promo Banner ─────────────────────────── */
.banner-section {
  padding: 0 20px;
}

.active-contract-card {
  background: linear-gradient(135deg, #FF6D00 0%, #FF8F00 100%);
  border-radius: 20px;
  padding: 20px;
  box-shadow: 0 4px 10px rgba(0, 0, 0, 0.2);
  color: #FFFFFF;
  margin-bottom: 8px;
}

.contract-status-row {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 16px;
}

.status-icon {
  color: #FFFFFF;
}

.status-icon.is-pending {
  color: #FFF59D;
}

.status-label {
  font-size: 18px;
  font-weight: 800;
  color: #FFFFFF;
}

.status-label.is-pending {
  color: #FFF9C4;
}

.contract-product-row {
  display: flex;
  align-items: center;
  gap: 16px;
  margin-bottom: 16px;
}

.contract-thumb {
  width: 80px;
  height: 60px;
  border-radius: 12px;
  object-fit: cover;
  background: rgba(255, 255, 255, 0.2);
}

.contract-prod-details {
  display: flex;
  flex-direction: column;
}

.contract-prod-name {
  font-size: 16px;
  font-weight: 800;
  color: #FFFFFF;
}

.contract-prod-sub {
  font-size: 14px;
  color: rgba(255, 255, 255, 0.9);
  margin-top: 2px;
}

.contract-progress-track {
  width: 100%;
  height: 8px;
  background: rgba(255, 255, 255, 0.24);
  border-radius: 10px;
  overflow: hidden;
  margin-bottom: 16px;
}

.contract-progress-bar {
  height: 100%;
  background: #FFFFFF;
  border-radius: 10px;
  transition: width 0.4s ease;
}

/* ── Adesão Pendente Box ────────────────────────────────────────────────── */
.adhesion-pending-box {
  background: rgba(255, 255, 255, 0.15);
  border: 1.5px solid rgba(255, 235, 59, 0.4);
  border-radius: 14px;
  padding: 16px;
  margin-bottom: 16px;
}

.adhesion-top {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 14px;
}

.adhesion-icon-circle {
  padding: 8px;
  background: rgba(255, 235, 59, 0.2);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
}

.amber-icon {
  color: #FFEB3B;
}

.adhesion-title {
  font-size: 14px;
  font-weight: 800;
  color: #FFFFFF;
}

.adhesion-desc {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.75);
}

.adhesion-bottom {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.adhesion-price {
  font-size: 20px;
  font-weight: 800;
  color: #FFFFFF;
}

.btn-pay-adhesion {
  background: #FFFFFF;
  color: #FF6D00;
  border: none;
  border-radius: 12px;
  padding: 10px 16px;
  font-size: 13px;
  font-weight: 800;
  cursor: pointer;
  transition: transform 0.2s ease;
}

.btn-pay-adhesion:hover {
  transform: scale(1.03);
}

/* ── Paid Info Row ──────────────────────────────────────────────────────── */
.contract-paid-info-row {
  display: flex;
  justify-content: space-between;
  margin-bottom: 16px;
}

.info-label {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.8);
}

.info-val-large {
  display: block;
  font-size: 20px;
  font-weight: 800;
  color: #FFFFFF;
  margin-top: 2px;
}

.info-val-med {
  display: block;
  font-size: 16px;
  font-weight: 800;
  color: #FFFFFF;
  margin-top: 2px;
}

.text-right {
  text-align: right;
}

/* ── 3 Action Buttons Pill ──────────────────────────────────────────────── */
.contract-actions-pill {
  background: rgba(255, 255, 255, 0.15);
  border-radius: 12px;
  padding: 8px 0;
  display: flex;
  justify-content: space-around;
  align-items: center;
}

.action-pill-btn {
  background: transparent;
  border: none;
  color: #FFFFFF;
  cursor: pointer;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  padding: 4px 12px;
  transition: opacity 0.2s ease;
}

.action-pill-btn.is-locked {
  opacity: 0.4;
}

.action-icon-wrap {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
}

.lock-sub-icon {
  position: absolute;
  bottom: -4px;
  right: -6px;
  background: #E65100;
  border-radius: 50%;
  padding: 2px;
}

.action-label {
  font-size: 12px;
  font-weight: 600;
}

.carousel-dots {
  display: flex;
  justify-content: center;
  gap: 6px;
  margin-top: 10px;
}

.carousel-dot {
  width: 8px;
  height: 8px;
  border-radius: 4px;
  background: #E0E0E0;
  cursor: pointer;
  transition: all 0.2s ease;
}

.carousel-dot.is-active {
  width: 24px;
  background: #FF6D00;
}

/* ── Promotional Banner (Matching Flutter _buildPromotionalBanner) ─────── */
.promotional-banner {
  position: relative;
  height: 180px;
  background: linear-gradient(135deg, #263238 0%, rgba(38, 50, 56, 0.85) 100%);
  border-radius: 20px;
  box-shadow: 0 10px 20px rgba(0, 0, 0, 0.2);
  overflow: hidden;
  padding: 24px;
  display: flex;
  align-items: center;
}

.promo-bg-watermark {
  position: absolute;
  right: -20px;
  bottom: -20px;
  opacity: 0.08;
  color: #FFFFFF;
  pointer-events: none;
}

.promo-content {
  position: relative;
  z-index: 2;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
}

.promo-title {
  font-size: 28px;
  font-weight: 800;
  color: #FFFFFF;
  line-height: 1.1;
}

.promo-sub {
  font-size: 16px;
  color: rgba(255, 255, 255, 0.9);
  margin: 8px 0 16px;
}

.btn-explore-catalog {
  background-color: #FF6D00;
  color: #FFFFFF;
  border: none;
  border-radius: 12px;
  padding: 12px 24px;
  font-size: 14px;
  font-weight: 800;
  cursor: pointer;
  box-shadow: 0 4px 12px rgba(255, 109, 0, 0.3);
  transition: all 0.2s ease;
}

.btn-explore-catalog:hover {
  background-color: #E65100;
  transform: translateY(-1px);
}

/* ── 3. Search Bar Button ───────────────────────────────────────────────── */
.search-bar-wrapper {
  padding: 16px 20px 0;
  cursor: pointer;
}

.search-bar-pill {
  background: #FFFFFF;
  border-radius: 16px;
  box-shadow: 0 4px 10px rgba(0, 0, 0, 0.05);
  padding: 16px;
  display: flex;
  align-items: center;
  gap: 12px;
  transition: transform 0.2s ease, box-shadow 0.2s ease;
}

.search-bar-pill:hover {
  transform: translateY(-1px);
  box-shadow: 0 6px 16px rgba(0, 0, 0, 0.08);
}

.search-icon-orange {
  color: #FF6D00;
}

.search-placeholder {
  font-size: 16px;
  color: #9E9E9E;
}

/* ── Section Titles ─────────────────────────────────────────────────────── */
.section-title-wrap {
  padding: 24px 20px 12px;
}

.spacer-top-32 {
  padding-top: 32px;
}

.section-heading {
  font-size: 24px;
  font-weight: 800;
  color: #263238;
}

/* ── 4. Best Offers Carousel ────────────────────────────────────────────── */
.best-offers-scroll {
  width: 100%;
  overflow-x: auto;
  padding: 0 20px;
  scrollbar-width: none;
}

.best-offers-scroll::-webkit-scrollbar {
  display: none;
}

.best-offers-track {
  display: flex;
  gap: 16px;
  width: max-content;
  padding-bottom: 8px;
}

.offer-card {
  width: 280px;
  background: #FFFFFF;
  border-radius: 20px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
  overflow: hidden;
  cursor: pointer;
  transition: transform 0.2s ease, box-shadow 0.2s ease;
}

.offer-card:hover {
  transform: translateY(-3px);
  box-shadow: 0 8px 20px rgba(0, 0, 0, 0.12);
}

.offer-image-box {
  position: relative;
  height: 140px;
  background: #EEEEEE;
}

.offer-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.offer-featured-tag {
  position: absolute;
  top: 12px;
  right: 12px;
  background: #FF6D00;
  color: #FFFFFF;
  padding: 6px 10px;
  border-radius: 8px;
  font-size: 10px;
  font-weight: 800;
}

.offer-card-body {
  padding: 16px;
}

.offer-name {
  font-size: 16px;
  font-weight: 800;
  color: #263238;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  margin-bottom: 8px;
}

.offer-price-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.price-col {
  display: flex;
  flex-direction: column;
}

.price-label {
  font-size: 12px;
  color: #757575;
}

.price-val {
  font-size: 20px;
  font-weight: 800;
  color: #FF6D00;
}

.btn-arrow-icon {
  width: 36px;
  height: 36px;
  border-radius: 8px;
  background: rgba(255, 109, 0, 0.12);
  color: #FF6D00;
  display: flex;
  align-items: center;
  justify-content: center;
}

/* ── 5. Popular Grid (2 Columns) ────────────────────────────────────────── */
.popular-grid {
  padding: 0 20px;
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}

.popular-card {
  background: #FFFFFF;
  border-radius: 16px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
  overflow: hidden;
  cursor: pointer;
  display: flex;
  flex-direction: column;
  transition: transform 0.2s ease;
}

.popular-card:hover {
  transform: translateY(-2px);
}

.popular-img-box {
  position: relative;
  height: 125px;
  background: #EEEEEE;
}

.popular-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.popular-tag {
  position: absolute;
  top: 8px;
  right: 8px;
  background: #D32F2F;
  color: #FFFFFF;
  padding: 4px 8px;
  border-radius: 6px;
  font-size: 9px;
  font-weight: 800;
}

.popular-body {
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.popular-title {
  font-size: 13px;
  font-weight: 800;
  color: #263238;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  min-height: 34px;
}

.popular-price-box {
  display: flex;
  flex-direction: column;
}

.popular-price-label {
  font-size: 10px;
  color: #757575;
}

.popular-price-val {
  font-size: 16px;
  font-weight: 800;
  color: #FF6D00;
}

.spacer-bottom-100 {
  height: 100px;
}

/* ── 6. Fullscreen Search & Filter Overlay ──────────────────────────────── */
.search-overlay-fullscreen {
  position: fixed;
  inset: 0;
  z-index: 9000;
  background: #FFFFFF;
  display: flex;
  flex-direction: column;
}

.search-header-bar {
  padding: 16px;
  background: #FFFFFF;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.05);
  display: flex;
  align-items: center;
  gap: 8px;
}

.search-input-field {
  flex: 1;
  display: flex;
  align-items: center;
  border: 1px solid #E0E0E0;
  border-radius: 12px;
  padding: 0 12px;
  height: 48px;
  transition: border-color 0.2s ease;
}

.search-input-field:focus-within {
  border-color: #FF6D00;
  border-width: 2px;
}

.search-input-icon {
  color: #FF6D00;
  margin-right: 8px;
}

.overlay-input {
  flex: 1;
  border: none;
  outline: none;
  font-size: 15px;
  color: #1A1A1A;
}

.btn-clear-query {
  background: transparent;
  border: none;
  color: #9E9E9E;
  cursor: pointer;
  padding: 4px;
}

.search-header-controls {
  display: flex;
  align-items: center;
  gap: 4px;
}

.control-btn {
  background: transparent;
  border: none;
  color: #424242;
  cursor: pointer;
  padding: 8px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.control-btn:hover {
  background: #F5F5F5;
}

/* Category Chips */
.filter-categories-scroll {
  padding: 12px 16px 6px;
  overflow-x: auto;
  scrollbar-width: none;
}

.filter-categories-scroll::-webkit-scrollbar {
  display: none;
}

.categories-track {
  display: flex;
  gap: 8px;
  width: max-content;
}

.category-chip {
  padding: 8px 16px;
  border-radius: 20px;
  border: 1px solid #E0E0E0;
  background: #F5F5F5;
  color: #424242;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
}

.category-chip.is-active {
  background: #FF6D00;
  color: #FFFFFF;
  border-color: #FF6D00;
}

/* Subcategory Chips */
.filter-subcategories-scroll {
  padding: 6px 16px 10px;
  overflow-x: auto;
  scrollbar-width: none;
}

.filter-subcategories-scroll::-webkit-scrollbar {
  display: none;
}

.subcategories-track {
  display: flex;
  gap: 6px;
  width: max-content;
}

.subcategory-chip {
  padding: 6px 12px;
  border-radius: 16px;
  border: 1px solid #EEEEEE;
  background: #F8F8F8;
  color: #616161;
  font-size: 12px;
  font-weight: 500;
  display: flex;
  align-items: center;
  gap: 4px;
  cursor: pointer;
}

.subcategory-chip.is-active {
  background: rgba(255, 109, 0, 0.8);
  color: #FFFFFF;
  border-color: transparent;
  font-weight: 700;
}

/* Results Count Bar */
.results-count-bar {
  padding: 8px 20px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  border-bottom: 1px solid #EEEEEE;
}

.count-text {
  font-size: 13px;
  font-weight: 600;
  color: #616161;
}

.btn-clear-filters {
  background: transparent;
  border: none;
  color: #FF6D00;
  font-size: 13px;
  font-weight: 600;
  display: flex;
  align-items: center;
  gap: 4px;
  cursor: pointer;
}

.overlay-results-viewport {
  flex: 1;
  overflow-y: auto;
  padding: 16px;
}

.results-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}

.results-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.result-list-item {
  display: flex;
  align-items: center;
  gap: 14px;
  background: #FFFFFF;
  border: 1px solid #EEEEEE;
  border-radius: 14px;
  padding: 10px 14px;
  cursor: pointer;
  transition: transform 0.2s ease, box-shadow 0.2s ease;
}

.result-list-item:hover {
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.06);
}

.list-item-thumb {
  width: 70px;
  height: 54px;
  border-radius: 10px;
  object-fit: cover;
  background: #F0F0F0;
}

.list-item-content {
  flex: 1;
  display: flex;
  flex-direction: column;
}

.list-item-brand {
  font-size: 11px;
  color: #9E9E9E;
  font-weight: 600;
  text-transform: uppercase;
}

.list-item-title {
  font-size: 14px;
  font-weight: 800;
  color: #263238;
}

.list-item-price-row {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: 2px;
}

.list-price-label {
  font-size: 11px;
  color: #757575;
}

.list-price-val {
  font-size: 13px;
  font-weight: 800;
  color: #FF6D00;
}

.list-item-arrow {
  color: #BDBDBD;
}

/* Empty State */
.empty-search-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 60px 20px;
  text-align: center;
}

.empty-icon {
  color: #BDBDBD;
  margin-bottom: 16px;
}

.empty-title {
  font-size: 18px;
  font-weight: 700;
  color: #424242;
  margin-bottom: 6px;
}

.empty-subtitle {
  font-size: 14px;
  color: #757575;
}

/* ── Overlay Animation ──────────────────────────────────────────────────── */
.overlay-fade-enter-active,
.overlay-fade-leave-active {
  transition: all 0.25s cubic-bezier(0.16, 1, 0.3, 1);
}

.overlay-fade-enter-from,
.overlay-fade-leave-to {
  opacity: 0;
  transform: translateY(20px);
}
</style>
