// POST /api/subscription/:subscriptionId/payment-check
// Registra que o cliente clicou em "Verificar Pagamento" (gera alerta p/ o dev).
import { defineEventHandler, getRouterParam, readBody } from 'h3'
import { proxyToBackend } from '../../../utils/backendProxy'

export default defineEventHandler(async (event) => {
  const subscriptionId = getRouterParam(event, 'subscriptionId')
  const body = await readBody(event).catch(() => ({}))
  const installmentId = (body as any)?.installmentId
  const installmentIds = Array.isArray((body as any)?.installmentIds)
    ? (body as any).installmentIds.filter((x: unknown) => typeof x === 'string')
    : undefined
  const batchId = (body as any)?.batchId
  return proxyToBackend<{ success: boolean; notified: boolean }>(
    event,
    `/api/subscription/${subscriptionId}/payment-check`,
    {
      method: 'POST',
      body: { installmentId, installmentIds, batchId },
      forwardAuth: true
    }
  )
})
