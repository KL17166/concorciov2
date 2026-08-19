// POST /api/auth/login
import { defineEventHandler, readBody } from 'h3'
import { proxyToBackend } from '../../utils/backendProxy'
import type { LoginResponse } from '~~/shared/types/auth'
import { unmaskCpf } from '~~/shared/utils/cpf'

export default defineEventHandler(async (event) => {
  const body = await readBody(event)

  const payload = {
    cpf: unmaskCpf(body.cpf || ''),
    password: body.password
  }

  return proxyToBackend<LoginResponse>(event, '/api/auth/login', {
    method: 'POST',
    body: payload,
    forwardAuth: false
  })
})
