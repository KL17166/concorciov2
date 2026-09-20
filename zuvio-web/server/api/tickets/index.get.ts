// GET /api/tickets — meus atendimentos
import { defineEventHandler } from 'h3'
import { proxyToBackend } from '../../utils/backendProxy'

export default defineEventHandler(async (event) => {
  return proxyToBackend<any[]>(event, '/api/tickets', {
    method: 'GET',
    forwardAuth: true
  })
})
