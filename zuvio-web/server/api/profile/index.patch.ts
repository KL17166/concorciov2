// PATCH /api/profile — atualizar e-mail/telefone do próprio cadastro
import { defineEventHandler, readBody } from 'h3'
import { proxyToBackend } from '../../utils/backendProxy'

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  return proxyToBackend<{ success: boolean; user: any }>(event, '/api/profile', {
    method: 'PATCH',
    body,
    forwardAuth: true
  })
})
