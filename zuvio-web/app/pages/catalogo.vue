<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import {
  ArrowLeft,
  UserRound,
  ChevronRight,
  Bike,
  CarFront,
  Wallet,
  Smartphone,
  Home,
  Wrench,
  SearchX
} from 'lucide-vue-next'
import { useConsortiumStore } from '~/stores/consortium'
import { useAuthStore } from '~/stores/auth'
import { PRODUCT_CATEGORIES } from '~~/shared/utils/catalogData'
import type { ProductTypeKey } from '~~/shared/types/catalog'
import { formatCurrency } from '~~/shared/utils/currency'
import { trackEvent } from '~/composables/useTrack'

definePageMeta({
  layout: false,
  // Espaço guest: logado cai pra home (o catálogo dele é a busca da home).
  middleware: 'guest'
})

useHead({
  title: 'Catálogo | Katari Consórcios',
  meta: [
    {
      name: 'description',
      content: 'Simule seu consórcio: motos, carros, cartas de crédito, eletrônicos, imóveis e serviços.'
    }
  ]
})

const route = useRoute()
const router = useRouter()
const consortiumStore = useConsortiumStore()
const authStore = useAuthStore()

const CATEGORY_KEYS: ProductTypeKey[] = ['MOTO', 'CARRO', 'CARTA_CREDITO', 'ELETRONICO', 'IMOVEL', 'SERVICO']

const CATEGORY_ICONS: Record<string, any> = {
  MOTO: Bike,
  CARRO: CarFront,
  CARTA_CREDITO: Wallet,
  ELETRONICO: Smartphone,
  IMOVEL: Home,
  SERVICO: Wrench
}

const categories = computed(() =>
  PRODUCT_CATEGORIES.filter(c => (CATEGORY_KEYS as string[]).includes(c.key))
)

function categoryLabel(key: string): string {
  return PRODUCT_CATEGORIES.find(c => c.key === key)?.label ?? key
}

// Subcategorias do nicho ativo (chips do Estado B).
const subCategories = computed(() => {
  if (!activeCategory.value) return []
  return PRODUCT_CATEGORIES.find(c => c.key === activeCategory.value)?.subCategories ?? []
})

const selectedSub = computed<string | null>(() => {
  const q = String(route.query.sub || '')
  if (!q) return null
  const keys = subCategories.value.map(s => s.key)
  return keys.includes(q) ? q : null
})

function subLabel(key: string): string {
  return subCategories.value.find(s => s.key === key)?.displayName ?? key
}

// Aliases conhecidos (mesmo mapa do store: sport/esportiva, pickup/picape).
function subMatches(selected: string, itemCat: string): boolean {
  if (!itemCat) return false
  const s = selected.toLowerCase()
  const c = itemCat.toLowerCase()
  if (s === c) return true
  const groups = [
    ['esportiva', 'sport'],
    ['picape', 'pickup']
  ]
  return groups.some(g => g.includes(s) && g.includes(c))
}

// Estado B (grade) só com categoria válida na query; senão Estado A (filtro).
const activeCategory = computed<ProductTypeKey | null>(() => {
  const q = String(route.query.categoria || '')
  return (CATEGORY_KEYS as string[]).includes(q) ? (q as ProductTypeKey) : null
})

const isLoading = ref(true)

const gridProducts = computed(() => {
  if (!activeCategory.value) return []
  return [...consortiumStore.products]
    .filter(p => p.type === activeCategory.value)
    .filter(p => !selectedSub.value || subMatches(selectedSub.value, p.category))
    .sort((a, b) => (a.displayOrder ?? 0) - (b.displayOrder ?? 0))
})

function minInstallment(price: number, plans: { monthlyInstallment: number }[]): number {
  if (plans.length > 0) return plans[plans.length - 1]?.monthlyInstallment ?? price / 80
  return price / 80
}

function pickCategory(key: string) {
  router.push({ path: '/catalogo', query: { categoria: key } })
}

function pickSub(sub: string | null) {
  if (!activeCategory.value) return
  if (!sub) {
    router.push({ path: '/catalogo', query: { categoria: activeCategory.value } })
  } else {
    router.push({ path: '/catalogo', query: { categoria: activeCategory.value, sub } })
  }
}

function backToFilter() {
  router.push({ path: '/catalogo' })
}

function goBack() {
  if (activeCategory.value) backToFilter()
  else router.push('/welcome')
}

function goAccount() {
  router.push(authStore.isAuthenticated ? '/' : '/auth/login')
}

function openProduct(id: string) {
  router.push(`/products/${id}`)
}

function handleImageFallback(e: Event) {
  const target = e.target as HTMLImageElement
  if (target) {
    target.onerror = null
    target.src = '/img/products/corolla_cross.svg'
  }
}

function trackGridView() {
  if (!activeCategory.value) return
  const metadata: Record<string, string> = { categoria: activeCategory.value }
  if (selectedSub.value) metadata.sub = selectedSub.value
  trackEvent({ event: 'VIEW_ITEM_LIST', screen: 'catalogo', metadata })
}

onMounted(async () => {
  authStore.initFromStorage()
  await consortiumStore.ensureProductsLoaded()
  isLoading.value = false
  trackGridView()
})

watch([activeCategory, selectedSub], () => {
  trackGridView()
})
</script>

<template>
  <div class="catalog-page">
    <!-- Header estilo print: voltar + título + conta -->
    <header class="catalog-header">
      <button type="button" class="header-btn" aria-label="Voltar" @click="goBack">
        <ArrowLeft :size="24" />
      </button>
      <h1 class="header-title">Catálogo Katari</h1>
      <button type="button" class="header-btn header-account" aria-label="Minha conta" @click="goAccount">
        <UserRound :size="24" />
      </button>
    </header>

    <!-- ═══ Estado A: filtro (tela igual ao print) ═══ -->
    <div v-if="!activeCategory" class="filter-state">
      <div class="hero-banner">
        <img
          src="/img/onboarding/carro-destaque.jpeg"
          alt="Conquiste seu veículo com a Katari"
          class="hero-img"
        />
      </div>

      <h2 class="filter-headline">
        Vamos te ajudar a escolher seu próximo consórcio!
      </h2>

      <h3 class="filter-section-title">Simule seu consórcio</h3>

      <div v-if="isLoading" class="rows-skeleton">
        <div v-for="i in 6" :key="i" class="row-skeleton"></div>
      </div>

      <nav v-else class="category-rows" aria-label="Categorias">
        <button
          v-for="cat in categories"
          :key="cat.key"
          type="button"
          class="category-row"
          @click="pickCategory(cat.key)"
        >
          <span class="row-icon-wrap">
            <component :is="CATEGORY_ICONS[cat.key]" :size="22" class="row-icon" />
          </span>
          <span class="row-label">{{ cat.label }}</span>
          <ChevronRight :size="22" class="row-chevron" />
        </button>
      </nav>
    </div>

    <!-- ═══ Estado B: grade com filtro aplicado (guest: só subs do nicho) ═══ -->
    <div v-else class="grid-state">
      <div class="chips-scroll">
        <div class="chips-track">
          <button
            type="button"
            class="chip"
            :class="{ 'is-active': !selectedSub }"
            @click="pickSub(null)"
          >
            Todas
          </button>
          <button
            v-for="sub in subCategories"
            :key="sub.key"
            type="button"
            class="chip"
            :class="{ 'is-active': selectedSub === sub.key }"
            @click="pickSub(sub.key)"
          >
            {{ sub.displayName }}
          </button>
        </div>
      </div>

      <h2 class="grid-title">
        {{ selectedSub ? subLabel(selectedSub) : categoryLabel(activeCategory) }}
      </h2>

      <div v-if="isLoading" class="grid-skeleton">
        <div v-for="i in 4" :key="i" class="card-skeleton"></div>
      </div>

      <div v-else-if="gridProducts.length === 0" class="empty-state">
        <SearchX :size="56" class="empty-icon" />
        <h3 class="empty-title">Nada por aqui ainda</h3>
        <p class="empty-subtitle">Novidades desta categoria chegam em breve.</p>
        <button v-if="selectedSub" type="button" class="btn-back-filter" @click="pickSub(null)">
          Ver todas
        </button>
        <button v-else type="button" class="btn-back-filter" @click="backToFilter">
          Ver outras categorias
        </button>
      </div>

      <div v-else class="product-grid">
        <div
          v-for="p in gridProducts"
          :key="p.id"
          class="product-card"
          @click="openProduct(p.id)"
        >
          <div class="card-img-box">
            <img
              :src="p.imageUrl || '/img/products/corolla_cross.svg'"
              :alt="p.name"
              class="card-img"
              loading="lazy"
              @error="handleImageFallback"
            />
          </div>
          <div class="card-body">
            <span v-if="p.brand" class="card-brand">{{ p.brand }}</span>
            <h4 class="card-name">{{ p.name }}</h4>
            <span class="card-price-label">Parcelas a partir de</span>
            <span class="card-price-val">{{ formatCurrency(minInstallment(p.price, p.plans)) }}</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.catalog-page {
  min-height: 100vh;
  width: 100%;
  background: #FAFAFA;
  font-family: 'Outfit', sans-serif;
  display: flex;
  flex-direction: column;
  align-items: center;
}

/* ── Header ── */
.catalog-header {
  width: 100%;
  max-width: 680px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 12px 6px;
}

.header-btn {
  background: transparent;
  border: none;
  cursor: pointer;
  color: #D32F2F;
  padding: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.header-account {
  color: #D32F2F;
}

.header-title {
  font-size: 20px;
  font-weight: 800;
  color: #263238;
  margin: 0;
}

/* ── Estado A: filtro ── */
.filter-state {
  width: 100%;
  max-width: 680px;
  padding: 10px 16px 40px;
  display: flex;
  flex-direction: column;
}

.hero-banner {
  border-radius: 20px;
  overflow: hidden;
  box-shadow: 0 8px 20px rgba(0, 0, 0, 0.12);
  margin-bottom: 22px;
}

.hero-img {
  width: 100%;
  height: 210px;
  object-fit: cover;
  display: block;
}

.filter-headline {
  font-size: 21px;
  font-weight: 800;
  line-height: 1.35;
  color: #D32F2F;
  text-align: center;
  margin: 0 0 24px;
  padding: 0 8px;
}

.filter-section-title {
  font-size: 19px;
  font-weight: 800;
  color: #263238;
  margin: 0 0 12px 2px;
}

.category-rows {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.category-row {
  display: flex;
  align-items: center;
  gap: 14px;
  background: #FFFFFF;
  border: 1px solid #EEEEEE;
  border-radius: 14px;
  padding: 16px;
  cursor: pointer;
  text-align: left;
  transition: transform 0.15s ease, box-shadow 0.15s ease;
  width: 100%;
}

.category-row:hover {
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.07);
}

.category-row:active {
  transform: scale(0.99);
}

.row-icon-wrap {
  width: 44px;
  height: 44px;
  border-radius: 12px;
  background: rgba(255, 109, 0, 0.12);
  color: #FF6D00;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.row-label {
  flex: 1;
  font-size: 16px;
  font-weight: 700;
  color: #263238;
}

.row-chevron {
  color: #D32F2F;
  flex-shrink: 0;
}

.rows-skeleton {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.row-skeleton {
  height: 76px;
  border-radius: 14px;
  background: linear-gradient(90deg, #EEEEEE 25%, #F7F7F7 50%, #EEEEEE 75%);
  background-size: 200% 100%;
  animation: shimmer 1.2s infinite;
}

/* ── Estado B: grade ── */
.grid-state {
  width: 100%;
  max-width: 680px;
  padding: 6px 14px 40px;
  display: flex;
  flex-direction: column;
}

.chips-scroll {
  overflow-x: auto;
  scrollbar-width: none;
  margin: 0 -14px;
  padding: 4px 14px 10px;
}

.chips-scroll::-webkit-scrollbar {
  display: none;
}

.chips-track {
  display: flex;
  gap: 8px;
  width: max-content;
}

.chip {
  padding: 8px 16px;
  border-radius: 20px;
  border: 1px solid #E0E0E0;
  background: #FFFFFF;
  color: #424242;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  white-space: nowrap;
}

.chip.is-active {
  background: #FF6D00;
  color: #FFFFFF;
  border-color: #FF6D00;
}

.grid-title {
  font-size: 22px;
  font-weight: 800;
  color: #263238;
  margin: 6px 2px 14px;
}

.product-grid {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.product-card {
  background: #FFFFFF;
  border-radius: 16px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
  overflow: hidden;
  cursor: pointer;
  display: flex;
  flex-direction: column;
  transition: transform 0.15s ease;
}

.product-card:hover {
  transform: translateY(-2px);
}

.product-card:active {
  transform: scale(0.99);
}

.card-img-box {
  height: 200px;
  background: #EEEEEE;
}

.card-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.card-body {
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.card-brand {
  font-size: 10px;
  font-weight: 700;
  color: #9E9E9E;
  text-transform: uppercase;
}

.card-name {
  font-size: 13px;
  font-weight: 800;
  color: #263238;
  margin: 0;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  min-height: 34px;
}

.card-price-label {
  font-size: 10px;
  color: #757575;
}

.card-price-val {
  font-size: 16px;
  font-weight: 800;
  color: #FF6D00;
}

.grid-skeleton {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.card-skeleton {
  height: 210px;
  border-radius: 16px;
  background: linear-gradient(90deg, #EEEEEE 25%, #F7F7F7 50%, #EEEEEE 75%);
  background-size: 200% 100%;
  animation: shimmer 1.2s infinite;
}

@keyframes shimmer {
  0% { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  padding: 50px 20px;
}

.empty-icon {
  color: #BDBDBD;
  margin-bottom: 14px;
}

.empty-title {
  font-size: 18px;
  font-weight: 700;
  color: #424242;
  margin: 0 0 6px;
}

.empty-subtitle {
  font-size: 14px;
  color: #757575;
  margin: 0 0 18px;
}

.btn-back-filter {
  background: #FF6D00;
  color: #FFFFFF;
  border: none;
  border-radius: 12px;
  padding: 12px 24px;
  font-size: 14px;
  font-weight: 800;
  cursor: pointer;
}
</style>
