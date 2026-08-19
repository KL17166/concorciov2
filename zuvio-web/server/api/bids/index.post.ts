// POST /api/bids
import { defineEventHandler, readBody } from 'h3'
import { proxyToBackend } from '../../utils/backendProxy'
import type { Bid } from '~~/shared/types/bid'

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  return proxyToBackend<{ success: boolean; message: string; bid: Bid }>(event, '/api/bids', {
    method: 'POST',
    body,
    forwardAuth: true
  })
})
