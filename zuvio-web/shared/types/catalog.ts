export type ProductTypeKey = 'TODOS' | 'MOTO' | 'CARRO' | 'CARTA_CREDITO' | 'ELETRONICO' | 'IMOVEL' | 'SERVICO'

export interface SubCategoryItem {
  key: string
  displayName: string
  icon: string
}

export interface ConsortiumPlan {
  id: string
  durationMonths: number
  monthlyInstallment: number
  adminFeeRate?: number
  adminFeePercentage?: number
  fundRate?: number
  reserveFundPercentage?: number
  totalAmount?: number
}

export interface Product {
  id: string
  name: string
  imageUrl: string
  imageUrls: string[]
  price: number
  monthlyPrice?: number
  active: boolean
  plans: ConsortiumPlan[]
  description: string
  type: ProductTypeKey
  category: string // subcategory key
  isFeatured: boolean
  isPopular: boolean
  brand?: string
  model?: string
  year?: number
  minDuration: number
  maxDuration: number
  specs?: Record<string, any>
}

export interface ActiveContract {
  id: string
  userId: string
  productId: string
  product: Product
  planId: string
  durationMonths: number
  currentInstallment: number
  totalInstallments: number
  groupNumber: string
  quotaNumber: string
  creditValue?: number
  administrationFee?: number
  status: 'active' | 'pending' | 'canceled' | 'finished'
  isAdesaoPaid: boolean
  nextPaymentAmount: number
  dueDate: string
  contractDate?: string
  progressPercentage: number
  paidInstallments?: number[]
  installmentValues?: Record<number, number>
  installmentIds?: Record<number, string>
  installmentDueDates?: Record<number, string>
  installmentTokens?: Record<number, string>
}
