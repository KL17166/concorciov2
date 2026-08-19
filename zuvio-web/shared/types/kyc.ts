export type KycStatusType = 'NOT_SUBMITTED' | 'PENDING' | 'SUBMITTED' | 'APPROVED' | 'REJECTED'

export interface KycStatusResponse {
  kycStatus: KycStatusType
  rejectReason?: string | null
  documentsUploaded: boolean
}

export interface KycSubmitPayload {
  documentFrontUrl: string
  documentBackUrl: string
  selfieUrl: string
}
