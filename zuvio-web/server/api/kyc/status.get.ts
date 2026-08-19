// GET /api/kyc/status
import { defineEventHandler } from 'h3'
import { proxyToBackend } from '../../utils/backendProxy'
import type { KycStatusResponse } from '~~/shared/types/kyc'

export default defineEventHandler(async (event) => {
  return proxyToBackend<KycStatusResponse>(event, '/api/kyc/status', {
    method: 'GET',
    forwardAuth: true
  })
})
