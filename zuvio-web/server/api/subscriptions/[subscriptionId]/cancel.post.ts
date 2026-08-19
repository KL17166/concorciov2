// POST /api/subscriptions/:subscriptionId/cancel
import { defineEventHandler, getRouterParam } from 'h3'
import { proxyToBackend } from '../../../utils/backendProxy'

export default defineEventHandler(async (event) => {
  const subscriptionId = getRouterParam(event, 'subscriptionId')
  return proxyToBackend<{ success: boolean; message: string }>(
    event,
    `/api/subscriptions/${subscriptionId}/cancel`,
    { method: 'POST', forwardAuth: true }
  )
})
