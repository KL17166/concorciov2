// POST /api/bids/:id/pix
// Proxies client bid PIX payment generation to Backend

import { proxyToBackend } from '~~/server/utils/backendProxy'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  return proxyToBackend<{
    success: boolean
    message: string
    bidId: string
    amount: number
    percentage: number
    productName: string
    qrCode?: string
    qrCodeText?: string
    pixCopiaECola?: string
    expiresAt?: string
  }>(event, `/api/bids/${id}/pix`, {
    method: 'POST'
  })
})
