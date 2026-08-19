// POST /api/auth/logout
import { defineEventHandler } from 'h3'
import { proxyToBackend } from '../../utils/backendProxy'

export default defineEventHandler(async (event) => {
  return proxyToBackend<{ success: boolean; message: string }>(event, '/api/auth/logout', {
    method: 'POST',
    forwardAuth: true
  })
})
