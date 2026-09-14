export type BidType = 'FREE' | 'FIXED'

export interface Bid {
  id: string
  subscriptionId?: string
  type: BidType
  percentage: number
  amount: number
  status: 'PENDING' | 'APPROVED' | 'ACCEPTED' | 'REJECTED' | 'CANCELLED' | 'CONTEMPLATED'
  isWinner?: boolean
  createdAt: string
  product?: {
    id: string
    name: string
    imageUrl: string
  }
  groupNumber?: string
  quotaNumber?: string
}

export interface CreateBidPayload {
  subscriptionId: string
  type: BidType
  percentage: number
  amount: number
}
