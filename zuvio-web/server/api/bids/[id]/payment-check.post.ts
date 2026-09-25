// POST /api/bids/:id/payment-check
// Cliente clicou em "Já paguei" no PIX do lance → alerta p/ baixa manual.
import { defineEventHandler, getRouterParam, createError } from 'h3'
import { proxyToBackend } from '~~/server/utils/backendProxy'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id || !UUID_RE.test(id)) {
    throw createError({ statusCode: 400, message: 'ID de lance inválido' })
  }
  return proxyToBackend<{ success: boolean; notified: boolean }>(
    event,
    `/api/bids/${encodeURIComponent(id)}/payment-check`,
    { method: 'POST' }
  )
})
