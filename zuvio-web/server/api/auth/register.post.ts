// POST /api/auth/register
// Proxies client registration to Backend: POST /api/auth/register

import { proxyToBackend } from '~~/server/utils/backendProxy'

interface RegisterResponse {
  success: boolean
  message: string
  user?: {
    id: string
    name: string
    email: string
    cpf: string
    phone?: string
  }
  token?: string
}

export default defineEventHandler(async (event) => {
  return proxyToBackend<RegisterResponse>(event, '/api/auth/register', {
    method: 'POST'
  })
})
