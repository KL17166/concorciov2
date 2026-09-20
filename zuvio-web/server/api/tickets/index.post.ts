// POST /api/tickets — abrir atendimento
import { defineEventHandler, readBody } from 'h3'
import { proxyToBackend } from '../../utils/backendProxy'

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  return proxyToBackend<{ success: boolean; ticket: any }>(event, '/api/tickets', {
    method: 'POST',
    body,
    forwardAuth: true
  })
})
