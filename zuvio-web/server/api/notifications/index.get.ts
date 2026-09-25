// GET /api/notifications — notificações in-app do próprio usuário
import { defineEventHandler } from 'h3'
import { proxyToBackend } from '../../utils/backendProxy'

export default defineEventHandler(async (event) => {
  return proxyToBackend<{
    success: boolean
    unreadCount: number
    notifications: Array<{
      id: string
      type: string
      title: string
      message: string
      read: boolean
      createdAt: string
    }>
  }>(event, '/api/notifications', { method: 'GET' })
})
