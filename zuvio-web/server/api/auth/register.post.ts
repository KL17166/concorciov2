// POST /api/auth/register
// Proxies client registration to Backend: POST /api/auth/register
// M8: lê, valida e encaminha allowlist (antes o body era descartado).

import { defineEventHandler, readBody } from 'h3'
import { sendHttpError } from '~~/server/utils/httpError'
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

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export default defineEventHandler(async (event) => {
  const body = await readBody(event)

  const name = String(body?.name ?? '').trim().slice(0, 120)
  const email = String(body?.email ?? '').trim().toLowerCase().slice(0, 160)
  const cpf = String(body?.cpf ?? '').replace(/\D/g, '').slice(0, 11)
  const phone = body?.phone ? String(body.phone).replace(/\D/g, '').slice(0, 15) : undefined
  const password = typeof body?.password === 'string' ? body.password : ''

  if (!name) return sendHttpError(event, 400, 'Nome é obrigatório.')
  if (!EMAIL_RE.test(email)) return sendHttpError(event, 400, 'E-mail inválido.')
  if (cpf.length !== 11) return sendHttpError(event, 400, 'CPF inválido.')
  if (password.length < 8) return sendHttpError(event, 400, 'Senha deve ter ao menos 8 caracteres.')

  // Allowlist explícita: role e cia nunca atravessam (mass assignment).
  return proxyToBackend<RegisterResponse>(event, '/api/auth/register', {
    method: 'POST',
    body: { name, email, cpf, phone, password },
    forwardAuth: false
  })
})
