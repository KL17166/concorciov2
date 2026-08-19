// POST /api/kyc/submit
import { defineEventHandler, readBody } from 'h3'
import { proxyToBackend } from '../../utils/backendProxy'
import type { KycSubmitPayload } from '~~/shared/types/kyc'

export default defineEventHandler(async (event) => {
  const body = await readBody<KycSubmitPayload>(event)
  return proxyToBackend<{ success: boolean; message: string; kycStatus: string }>(
    event,
    '/api/kyc/submit',
    { method: 'POST', body, forwardAuth: true }
  )
})
