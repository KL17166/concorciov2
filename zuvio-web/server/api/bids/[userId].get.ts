// GET /api/bids/:userId
import { defineEventHandler, getRouterParam } from 'h3'
import { proxyToBackend } from '../../utils/backendProxy'
import type { Bid } from '~~/shared/types/bid'

export default defineEventHandler(async (event) => {
  const userId = getRouterParam(event, 'userId')
  return proxyToBackend<Bid[]>(event, `/api/bids/${userId}`, {
    method: 'GET',
    forwardAuth: true
  })
})
