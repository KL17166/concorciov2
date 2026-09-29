import { defineStore } from 'pinia'
import type { Product, ProductTypeKey, ActiveContract, ConsortiumPlan } from '~~/shared/types/catalog'
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
    products: [] as Product[],
    activeContracts: [] as ActiveContract[],
    selectedProduct: null as Product | null,
    selectedPlan: null as ConsortiumPlan | null,
    isLoading: false,
    productsLoaded: false,
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

          const isCategoryMatch = (selected: string, itemCat: string) => {
            if (!itemCat) return false
            if (selected === itemCat) return true
            const s = selected.toLowerCase()
            const c = itemCat.toLowerCase()
            if ((s === 'esportiva' || s === 'sport') && (c === 'esportiva' || c === 'sport')) return true
            if ((s === 'picape' || s === 'pickup') && (c === 'picape' || c === 'pickup')) return true
            return false
          }

          const matchesSub = !state.selectedSubCategory || isCategoryMatch(state.selectedSubCategory, p.category)

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
      const authHeaders: Record<string, string> = authStore.token ? { Authorization: `Bearer ${authStore.token}` } : {}

      const promises: Promise<any>[] = [
        $fetch<Product[]>('/api/products', { headers: authHeaders })
          .then(apiProducts => {
            if (Array.isArray(apiProducts) && apiProducts.length > 0) {
              this.products = [...apiProducts].sort((a, b) => (a.displayOrder ?? 0) - (b.displayOrder ?? 0))
              this.productsReal = true
            }
          })
          .catch(err => {
            console.error('Falha ao carregar catálogo da API/banco:', err)
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

    // Garante o catálogo carregado do servidor antes de resolver rotas que dependem dele
    async ensureProductsLoaded() {
      if (this.productsLoaded) return
      await this.loadHomeData()
    },

    async fetchProductById(id: string): Promise<Product | null> {
      const existing = this.products.find(p => p.id === id)
      if (existing) return existing

      const authStore = useAuthStore()
      const authHeaders: Record<string, string> = authStore.token ? { Authorization: `Bearer ${authStore.token}` } : {}

      try {
        const prod = await $fetch<Product>(`/api/products/${id}`, { headers: authHeaders })
        if (prod) {
          const idx = this.products.findIndex(p => p.id === id)
          if (idx >= 0) {
            this.products[idx] = prod
          } else {
            this.products.push(prod)
          }
          return prod
        }
      } catch (err) {
        console.error(`Erro ao buscar produto ${id} do servidor/DB:`, err)
      }
      return null
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
