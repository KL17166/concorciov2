export type UserRole = 'CLIENT' | 'ADMIN' | 'MASTER'

export type KycStatus = 'NOT_SUBMITTED' | 'PENDING' | 'SUBMITTED' | 'APPROVED' | 'REJECTED'

export interface UserProfile {
  id: string
  name: string
  email: string
  role: UserRole
  cpf: string

  phone?: string
  cep?: string
  street?: string
  number?: string
  district?: string
  city?: string
  state?: string
  kycStatus: KycStatus
  kycRejectReason?: string | null
  createdAt?: string
}
