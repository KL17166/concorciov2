import { defineStore } from 'pinia'
import type { Product, ProductTypeKey, ActiveContract, ConsortiumPlan } from '~~/shared/types/catalog'
import { DEFAULT_PRODUCTS } from '~~/shared/utils/catalogData'
import { useAuthStore } from './auth'

export const useConsortiumStore = defineStore('consortium', {
  state: () => ({
    products: [] as Product[],
    activeContracts: [] as ActiveContract[],
    selectedProduct: null as Product | null,
    selectedPlan: null as ConsortiumPlan | null,
    isLoading: false,
    searchQuery: '',
    selectedCategory: 'TODOS' as ProductTypeKey,
    selectedSubCategory: null as string | null,
    isSearching: false,
    isGridView: false
  }),

  getters: {
    hasActiveContracts: (state) => state.activeContracts.length > 0,
    
    filteredProducts: (state) => {
      return state.products.filter(p => {
        // Query match
        const q = state.searchQuery.toLowerCase().trim()
        const matchesQuery = !q ||
          p.name.toLowerCase().includes(q) ||
          p.description.toLowerCase().includes(q) ||
          (p.brand && p.brand.toLowerCase().includes(q)) ||
          (p.model && p.model.toLowerCase().includes(q))

        // Category match
        const matchesCat = state.selectedCategory === 'TODOS' || p.type === state.selectedCategory

        // Subcategory match
        const matchesSub = !state.selectedSubCategory || p.category === state.selectedSubCategory

        return matchesQuery && matchesCat && matchesSub
      })
    },

    bestOffers: (state) => {
      const sorted = [...state.products].sort((a, b) => {
        const minA = a.plans.length ? Math.min(...a.plans.map(p => p.monthlyInstallment)) : a.price
        const minB = b.plans.length ? Math.min(...b.plans.map(p => p.monthlyInstallment)) : b.price
        return minA - minB
      })
      return sorted.slice(0, 5)
    },

    popularProducts: (state) => {
      return state.products.filter(p => p.isPopular)
    }
  },

  actions: {
    async loadHomeData() {
      this.isLoading = true
      const authStore = useAuthStore()

      try {
        const config = useRuntimeConfig()
        const apiBase = config.public.apiBase || 'http://localhost:3000'

        // Fetch products from server
        try {
          const apiProducts = await $fetch<Product[]>(`${apiBase}/api/products`)
          if (Array.isArray(apiProducts) && apiProducts.length > 0) {
            this.products = apiProducts
          } else {
            this.products = DEFAULT_PRODUCTS
          }
        } catch (_) {
          this.products = DEFAULT_PRODUCTS
        }

        // Fetch active contracts from backend
        if (authStore.isAuthenticated && authStore.user) {
          try {
            const apiContracts = await $fetch<ActiveContract[]>(`${apiBase}/api/subscriptions/${authStore.user.id}`, {
              headers: authStore.token ? { Authorization: `Bearer ${authStore.token}` } : {}
            })
            if (Array.isArray(apiContracts)) {
              this.activeContracts = apiContracts
            } else {
              this.activeContracts = []
            }
          } catch (err) {
            console.warn('Could not load contracts from backend:', err)
            this.activeContracts = []
          }
        } else {
          this.activeContracts = []
        }
      } finally {
        this.isLoading = false
      }
    },

    selectProduct(product: Product) {
      this.selectedProduct = product
      this.selectedPlan = product.plans[0] || null
    },

    selectPlan(plan: ConsortiumPlan) {
      this.selectedPlan = plan
    },

    openSearch() {
      this.isSearching = true
    },

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
