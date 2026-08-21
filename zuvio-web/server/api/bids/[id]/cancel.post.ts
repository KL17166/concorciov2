// POST /api/bids/:id/cancel
// Proxies client bid cancellation to Backend

import { proxyToBackend } from '~~/server/utils/backendProxy'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  return proxyToBackend<{ success: boolean; message: string }>(
    event,
    `/api/bids/${id}/cancel`,
    {
      method: 'POST'
    }
  )
})
