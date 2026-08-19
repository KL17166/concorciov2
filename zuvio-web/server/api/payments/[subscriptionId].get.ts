// GET /api/payments/:subscriptionId
import { defineEventHandler, getRouterParam } from 'h3'
import { proxyToBackend } from '../../utils/backendProxy'
import type { Installment } from '~~/shared/types/payment'

export default defineEventHandler(async (event) => {
  const subscriptionId = getRouterParam(event, 'subscriptionId')
  return proxyToBackend<Installment[]>(event, `/api/payments/${subscriptionId}`, {
    method: 'GET',
    forwardAuth: true
  })
})
