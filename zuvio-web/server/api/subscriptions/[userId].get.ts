// GET /api/subscriptions/:userId
import { defineEventHandler, getRouterParam } from 'h3'
import { proxyToBackend } from '../../utils/backendProxy'
import type { ActiveContract } from '~~/shared/types/catalog'

export default defineEventHandler(async (event) => {
  const userId = getRouterParam(event, 'userId')
  return proxyToBackend<ActiveContract[]>(event, `/api/subscriptions/${userId}`, {
    method: 'GET',
    forwardAuth: true
  })
})
