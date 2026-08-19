// POST /api/payments/:installmentId/boleto
import { defineEventHandler, getRouterParam, readBody } from 'h3'
import { proxyToBackend } from '../../../utils/backendProxy'
import type { BoletoPaymentResponse } from '~~/shared/types/payment'

export default defineEventHandler(async (event) => {
  const installmentId = getRouterParam(event, 'installmentId')
  const body = await readBody(event)

  return proxyToBackend<BoletoPaymentResponse>(event, `/api/payments/${installmentId}/boleto`, {
    method: 'POST',
    body: { idTokenPay: body.idTokenPay },
    forwardAuth: true
  })
})
