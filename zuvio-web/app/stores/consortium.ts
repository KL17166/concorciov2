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

        // Fetch or simulate active contracts
        if (authStore.isAuthenticated && authStore.user) {
          try {
            const apiContracts = await $fetch<ActiveContract[]>(`${apiBase}/api/subscriptions/${authStore.user.id}`, {
              headers: authStore.token ? { Authorization: `Bearer ${authStore.token}` } : {}
            })
            if (Array.isArray(apiContracts) && apiContracts.length > 0) {
              this.activeContracts = apiContracts
            } else if (this.activeContracts.length === 0) {
              // If not seeded yet, seed according to user state
              if (authStore.user.kycStatus === 'PENDING' || authStore.user.cpf === '222.333.444-05') {
                this.seedScenario('pending_adhesion')
              } else {
                this.seedScenario('active_12')
              }
            }
          } catch (_) {
            if (this.activeContracts.length === 0) {
              if (authStore.user.kycStatus === 'PENDING' || authStore.user.cpf === '222.333.444-05') {
                this.seedScenario('pending_adhesion')
              } else {
                this.seedScenario('active_12')
              }
            }
          }
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
    },

    seedScenario(type: 'active_12' | 'pending_adhesion' | 'multiple' | 'empty') {
      const authStore = useAuthStore()
      const motoProd = this.products.find(p => p.type === 'MOTO') || this.products[0] || DEFAULT_PRODUCTS[0]!
      const carroProd = this.products.find(p => p.type === 'CARRO') || this.products[1] || DEFAULT_PRODUCTS[1]!

      if (type === 'empty') {
        this.activeContracts = []
        return
      }

      if (type === 'pending_adhesion') {
        const instValues: Record<number, number> = { 1: 289.90 }
        const instIds: Record<number, string> = { 1: 'inst_1_pending' }
        const instTokens: Record<number, string> = { 1: 'tok_1_pending' }
        const instDueDates: Record<number, string> = { 1: new Date(Date.now() + 30 * 60 * 1000).toISOString() }

        this.activeContracts = [
          {
            id: 'ct_pending_1',
            userId: authStore.user?.id || 'usr_dev',
            productId: motoProd.id,
            product: motoProd,
            planId: motoProd.plans[0]?.id || 'plan_1',
            durationMonths: 80,
            currentInstallment: 1,
            totalInstallments: 80,
            groupNumber: '104',
            quotaNumber: '042',
            creditValue: motoProd.price || 18500,
            administrationFee: 0.15,
            status: 'pending' as any,
            isAdesaoPaid: false,
            nextPaymentAmount: 289.90,
            dueDate: 'Aguardando Pagamento da Adesão',
            contractDate: new Date().toISOString(),
            progressPercentage: 0,
            paidInstallments: [],
            installmentValues: instValues,
            installmentIds: instIds,
            installmentTokens: instTokens,
            installmentDueDates: instDueDates
          }
        ]
        return
      }

      if (type === 'active_12') {
        const paidList = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]
        const instValues: Record<number, number> = {}
        const instIds: Record<number, string> = {}
        const instTokens: Record<number, string> = {}
        const instDueDates: Record<number, string> = {}

        for (let i = 1; i <= 80; i++) {
          instIds[i] = `inst_${i}`
          instTokens[i] = `tok_${i}`
          const date = new Date(2024, 0 + i, 15)
          instDueDates[i] = date.toISOString()
          if (i > 13) {
            const monthsAhead = i - 13
            const discountFactor = Math.max(0.7, 1 - (monthsAhead * 0.005))
            instValues[i] = +(289.90 * discountFactor).toFixed(2)
          } else {
            instValues[i] = 289.90
          }
        }

        this.activeContracts = [
          {
            id: 'ct_active_1',
            userId: authStore.user?.id || 'usr_dev',
            productId: motoProd.id,
            product: motoProd,
            planId: motoProd.plans[0]?.id || 'plan_1',
            durationMonths: 80,
            currentInstallment: 13,
            totalInstallments: 80,
            groupNumber: '104',
            quotaNumber: '042',
            creditValue: motoProd.price || 18500,
            administrationFee: 0.10,
            status: 'active',
            isAdesaoPaid: true,
            nextPaymentAmount: 289.90,
            dueDate: '15/09/2026',
            contractDate: '2024-01-15',
            progressPercentage: 15,
            paidInstallments: paidList,
            installmentValues: instValues,
            installmentIds: instIds,
            installmentTokens: instTokens,
            installmentDueDates: instDueDates
          }
        ]
        return
      }

      if (type === 'multiple') {
        const paidList = [1, 2, 3, 4, 5, 6]
        const instValues: Record<number, number> = {}
        const instIds: Record<number, string> = {}
        const instTokens: Record<number, string> = {}
        const instDueDates: Record<number, string> = {}

        for (let i = 1; i <= 80; i++) {
          instIds[i] = `inst_m_${i}`
          instTokens[i] = `tok_m_${i}`
          const date = new Date(2024, 0 + i, 15)
          instDueDates[i] = date.toISOString()
          instValues[i] = 289.90
        }

        this.activeContracts = [
          {
            id: 'ct_moto_active',
            userId: authStore.user?.id || 'usr_dev',
            productId: motoProd.id,
            product: motoProd,
            planId: motoProd.plans[0]?.id || 'plan_1',
            durationMonths: 80,
            currentInstallment: 7,
            totalInstallments: 80,
            groupNumber: '104',
            quotaNumber: '042',
            creditValue: motoProd.price || 18500,
            administrationFee: 0.10,
            status: 'active',
            isAdesaoPaid: true,
            nextPaymentAmount: 289.90,
            dueDate: '15/09/2026',
            contractDate: '2024-01-15',
            progressPercentage: 8,
            paidInstallments: paidList,
            installmentValues: instValues,
            installmentIds: instIds,
            installmentTokens: instTokens,
            installmentDueDates: instDueDates
          },
          {
            id: 'ct_carro_pending',
            userId: authStore.user?.id || 'usr_dev',
            productId: carroProd.id,
            product: carroProd,
            planId: carroProd.plans[0]?.id || 'plan_car_1',
            durationMonths: 100,
            currentInstallment: 1,
            totalInstallments: 100,
            groupNumber: '205',
            quotaNumber: '118',
            creditValue: carroProd.price || 85000,
            administrationFee: 0.12,
            status: 'pending' as any,
            isAdesaoPaid: false,
            nextPaymentAmount: 980.50,
            dueDate: 'Aguardando Pagamento da Adesão',
            contractDate: new Date().toISOString(),
            progressPercentage: 0,
            paidInstallments: [],
            installmentValues: { 1: 980.50 },
            installmentIds: { 1: 'inst_car_1' },
            installmentTokens: { 1: 'tok_car_1' },
            installmentDueDates: { 1: new Date(Date.now() + 30 * 60 * 1000).toISOString() }
          }
        ]
      }
    }
  }
})
