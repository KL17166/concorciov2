// POST /api/subscription/:subscriptionId/payment-check
// Registra que o cliente clicou em "Verificar Pagamento" (gera alerta p/ o dev).
import { defineEventHandler, getRouterParam } from 'h3'
import { proxyToBackend } from '../../../utils/backendProxy'

export default defineEventHandler(async (event) => {
  const subscriptionId = getRouterParam(event, 'subscriptionId')
  return proxyToBackend<{ success: boolean; notified: boolean }>(
    event,
    `/api/subscription/${subscriptionId}/payment-check`,
    {
      method: 'POST',
      forwardAuth: true
    }
  )
})
