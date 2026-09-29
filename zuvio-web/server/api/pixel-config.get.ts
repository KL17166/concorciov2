// GET /api/pixel-config — IDs públicos dos pixels (do painel admin) → front
import { defineEventHandler } from 'h3'
import { proxyToBackend } from '../utils/backendProxy'

export default defineEventHandler((event) => {
  return proxyToBackend<{ ga4Id: string; metaPixelId: string; tiktokPixelId: string }>(
    event,
    '/api/pixel-config',
    { method: 'GET' }
  )
})
