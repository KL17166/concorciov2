import { defineStore } from 'pinia'
import type { Product, ProductTypeKey, ActiveContract, ConsortiumPlan } from '~~/shared/types/catalog'
import { DEFAULT_PRODUCTS } from '~~/shared/utils/catalogData'
import { useAuthStore } from './auth'

// Reordena pela lista aprendida (índice menor primeiro); fora da lista mantém
// a ordem relativa original. Lista vazia = sem aprendizado ainda.
function applyRecOrder<T extends { id: string }>(items: T[], recOrder: string[]): T[] {
  if (!recOrder.length) return items
  const rank = new Map(recOrder.map((id, i) => [id, i]))
  return [...items].sort((a, b) => (rank.get(a.id) ?? 1e9) - (rank.get(b.id) ?? 1e9))
}

export const useConsortiumStore = defineStore('consortium', {
  state: () => ({
    products: DEFAULT_PRODUCTS as Product[],
    activeContracts: [] as ActiveContract[],
    selectedProduct: null as Product | null,
    selectedPlan: null as ConsortiumPlan | null,
    isLoading: false,
    // true após a primeira tentativa de carga do catálogo real (evita refetch em loop;
    // o fallback DEFAULT_PRODUCTS continua valendo se a API falhar)
    productsLoaded: false,
    // true SOMENTE quando a API devolveu o catálogo (foto/preço confiáveis;
    // falso = mocks/fallbacks, que nunca devem aparecer como se fossem reais)
    productsReal: false,
    searchQuery: '',
    selectedCategory: 'TODOS' as ProductTypeKey,
    selectedSubCategory: null as string | null,
    isSearching: false,
    isGridView: false,
    // Ordem aprendida pelo algoritmo (GET /api/recommendations); vazia = ordem do admin
    recOrder: [] as string[]
  }),

  getters: {
    hasActiveContracts: (state) => state.activeContracts.length > 0,

    // Produtos na ordem definida no painel admin (displayOrder crescente)
    orderedProducts: (state) => {
      return [...state.products].sort((a, b) => (a.displayOrder ?? 0) - (b.displayOrder ?? 0))
    },

    filteredProducts: (state) => {
      const q = state.searchQuery.toLowerCase().trim()
      return [...state.products]
        .filter(p => {
          const matchesQuery = !q ||
            p.name.toLowerCase().includes(q) ||
            p.description.toLowerCase().includes(q) ||
            (p.brand && p.brand.toLowerCase().includes(q)) ||
            (p.model && p.model.toLowerCase().includes(q))

          const matchesCat = state.selectedCategory === 'TODOS' || p.type === state.selectedCategory
          const matchesSub = !state.selectedSubCategory || p.category === state.selectedSubCategory

          return matchesQuery && matchesCat && matchesSub
        })
        .sort((a, b) => (a.displayOrder ?? 0) - (b.displayOrder ?? 0))
    },

    // Melhores Ofertas = destaques na ordem do admin (fallback: primeiros da ordem)
    // Com aprendizado ativo, a ordem do algoritmo passa na frente.
    bestOffers: (state) => {
      const ordered = [...state.products].sort((a, b) => (a.displayOrder ?? 0) - (b.displayOrder ?? 0))
      const featured = ordered.filter(p => p.isFeatured)
      const base = (featured.length > 0 ? featured : ordered).slice(0, 5)
      return applyRecOrder(base, state.recOrder)
    },

    // Mais Populares = populares na ordem do admin (ou do algoritmo)
    popularProducts: (state) => {
      const base = state.products
        .filter(p => p.isPopular)
        .sort((a, b) => (a.displayOrder ?? 0) - (b.displayOrder ?? 0))
      return applyRecOrder(base, state.recOrder)
    }
  },

  actions: {
    async loadHomeData() {
      const authStore = useAuthStore()

      const promises: Promise<any>[] = [
        $fetch<Product[]>('/api/products')
          .then(apiProducts => {
            if (Array.isArray(apiProducts) && apiProducts.length > 0) {
              this.products = [...apiProducts].sort((a, b) => (a.displayOrder ?? 0) - (b.displayOrder ?? 0))
              this.productsReal = true
            }
          })
          .catch(() => {
            if (!this.products.length) this.products = DEFAULT_PRODUCTS
          })
      ]

      if (authStore.isAuthenticated && authStore.user) {
        promises.push(
          $fetch<ActiveContract[]>(`/api/subscriptions/${authStore.user.id}`, {
            headers: authStore.token ? { Authorization: `Bearer ${authStore.token}` } : {}
          })
            .then(apiContracts => {
              this.activeContracts = Array.isArray(apiContracts) ? apiContracts : []
            })
            .catch(err => {
              console.warn('Could not load contracts from backend:', err)
            })
        )
      }

      await Promise.allSettled(promises)
      this.productsLoaded = true
      // Ranking aprendido (best-effort, não bloqueia o catálogo)
      this.fetchRecommendations().catch(() => {})
    },

    // Busca a ordem que o algoritmo aprendeu para este usuário
    async fetchRecommendations() {
      const authStore = useAuthStore()
      if (!authStore.isAuthenticated) return
      try {
        const res = await $fetch<{
          success: boolean
          recommendations: Array<{ productId: string; score: number; reason: string; explore: boolean }>
        }>('/api/recommendations', {
          headers: authStore.token ? { Authorization: `Bearer ${authStore.token}` } : {}
        })
        if (Array.isArray(res.recommendations)) {
          this.recOrder = res.recommendations.map(r => r.productId)
        }
      } catch (_) {}
    },

    // Garante o catálogo real carregado antes de resolver produto por id.
    // Corrige o "Nenhum produto selecionado" em deep-link/refresh (a store
    // inicia com DEFAULT_PRODUCTS e o detalhe/checkout não recarregavam).
    async ensureProductsLoaded() {
      if (this.productsLoaded) return
      await this.loadHomeData()
    },

    selectProduct(product: Product) {
      this.selectedProduct = product
      this.selectedPlan = product.plans[0] || null
    },

    selectPlan(plan: ConsortiumPlan) {
      this.selectedPlan = plan
    },

    openSearch() { this.isSearching = true },

    closeSearch() {
      this.isSearching = false
      this.searchQuery = ''
      this.selectedCategory = 'TODOS'
      this.selectedSubCategory = null
    },

    updateCategory(category: ProductTypeKey) {
      this.selectedCategory = category
      this.selectedSubCategory = null
    },

    updateSubCategory(sub: string | null) {
      this.selectedSubCategory = sub
    },

    clearFilters() {
      this.searchQuery = ''
      this.selectedCategory = 'TODOS'
      this.selectedSubCategory = null
    }
  }
})
