export interface Installment {
  id: string
  idTokenPay: string
  number: number
  amount: number
  valueToPay: number
  dueDate: string
  status: 'PENDING' | 'PAID' | 'OVERDUE' | 'CANCELLED'
  paymentDate?: string | null
  paymentMethod?: string | null
}

export interface PixPaymentResponse {
  success: boolean
  provider: string
  paymentId: string
  qrCode: string | null // base64 string or null
  copyPaste: string // PIX EMV code
  amount: number
  expirationDate: string | null
  message?: string
  error?: string
}

export interface BoletoPaymentResponse {
  success: boolean
  provider: string
  paymentId: string
  copyPaste: string // Linha digitável
  amount: number
  expirationDate: string | null
  message?: string
  error?: string
}
