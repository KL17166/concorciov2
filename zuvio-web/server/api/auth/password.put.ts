// PUT /api/auth/password
import { defineEventHandler, readBody } from 'h3'
import { proxyToBackend } from '../../utils/backendProxy'

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  return proxyToBackend<{ success: boolean; message: string }>(event, '/api/auth/password', {
    method: 'PUT',
    body,
    forwardAuth: true
  })
})
