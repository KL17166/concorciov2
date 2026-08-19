// POST /api/subscriptions
import { defineEventHandler, readBody } from 'h3'
import { proxyToBackend } from '../../utils/backendProxy'
import type { Installment } from '~~/shared/types/payment'
import { getHeader } from 'h3'

export default defineEventHandler(async (event) => {
  const body = await readBody(event)

  // Backend requires the JWT in the request body as well for double-auth.
  // We extract it from the Authorization header sent by the Nuxt BFF client.
  const authHeader = getHeader(event, 'authorization') || ''
  const token = authHeader.replace('Bearer ', '').trim()

  const payload = {
    userId: body.userId,
    planId: body.planId,
    productId: body.productId,
    termsAccepted: body.termsAccepted,
    documentFrontUrl: body.documentFrontUrl,
    documentBackUrl: body.documentBackUrl,
    selfieUrl: body.selfieUrl,
    token
  }

  return proxyToBackend<{
    success: boolean
    subscriptionId: string
    status: string
    plan: any
    installments: Installment[]
  }>(event, '/api/subscriptions', {
    method: 'POST',
    body: payload,
    forwardAuth: true
  })
})
