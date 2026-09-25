// GET /api/recommendations — ranking que o algoritmo aprendeu para o usuário
import { defineEventHandler } from 'h3'
import { proxyToBackend } from '../../utils/backendProxy'

export default defineEventHandler(async (event) => {
  return proxyToBackend<{
    success: boolean
    recommendations: Array<{
      productId: string
      score: number
      reason: string
      explore: boolean
    }>
  }>(event, '/api/recommendations', { method: 'GET' })
})
