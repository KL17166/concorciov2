// PUT /api/auth/profile
import { defineEventHandler, readBody } from 'h3'
import { proxyToBackend } from '../../utils/backendProxy'
import type { UserProfile } from '~~/shared/types/user'

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  return proxyToBackend<{ message: string; user: UserProfile }>(event, '/api/auth/profile', {
    method: 'PUT',
    body,
    forwardAuth: true
  })
})
