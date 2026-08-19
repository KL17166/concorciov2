// POST /api/payments/:installmentId/pix
import { defineEventHandler, getRouterParam, readBody } from 'h3'
import { proxyToBackend } from '../../../utils/backendProxy'
import type { PixPaymentResponse } from '~~/shared/types/payment'

export default defineEventHandler(async (event) => {
  const installmentId = getRouterParam(event, 'installmentId')
  const body = await readBody(event)

  return proxyToBackend<PixPaymentResponse>(event, `/api/payments/${installmentId}/pix`, {
    method: 'POST',
    body: { idTokenPay: body.idTokenPay },
    forwardAuth: true
  })
})
