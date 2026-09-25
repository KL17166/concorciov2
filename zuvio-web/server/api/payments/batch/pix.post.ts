// POST /api/payments/batch/pix
// 1 PIX combinado somando N parcelas (adesão, do mês, antecipações).
import { proxyToBackend } from '~~/server/utils/backendProxy'

export default defineEventHandler(async (event) => {
  const body = await readBody(event).catch(() => ({}))
  return proxyToBackend<{
    success: boolean
    message: string
    batchId: string
    subscriptionId: string
    items: Array<{ installmentId: string; number: number; amount: number; anticipated: boolean; dueDate: string | null; status: string }>
    totalAmount: number
    provider?: string
    isManualApproval?: boolean
    copyPaste?: string
    qrCode?: string
    expiresAt?: string
  }>(event, '/api/payments/batch/pix', {
    method: 'POST',
    body
  })
})
