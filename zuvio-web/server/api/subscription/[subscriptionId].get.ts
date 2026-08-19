// GET /api/subscription/:subscriptionId
// Fetches a single subscription with full detail: plan, product, installments and bids.
// The backend recalculates all monetary values server-side.
import { defineEventHandler, getRouterParam } from 'h3'
import { proxyToBackend } from '../../utils/backendProxy'
import type { ActiveContract } from '~~/shared/types/catalog'

export default defineEventHandler(async (event) => {
  const subscriptionId = getRouterParam(event, 'subscriptionId')
  return proxyToBackend<ActiveContract>(event, `/api/subscription/${subscriptionId}`, {
    method: 'GET',
    forwardAuth: true
  })
})
