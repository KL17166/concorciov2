// GET /api/auth/profile
import { defineEventHandler } from 'h3'
import { proxyToBackend } from '../../utils/backendProxy'
import type { UserProfile } from '~~/shared/types/user'

export default defineEventHandler(async (event) => {
  return proxyToBackend<{ user: UserProfile }>(event, '/api/auth/profile', {
    method: 'GET',
    forwardAuth: true
  })
})
