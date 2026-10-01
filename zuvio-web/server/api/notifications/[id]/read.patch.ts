// PATCH /api/notifications/:id/read — marca notificação como lida
import { defineEventHandler, getRouterParam } from 'h3'
import { sendHttpError } from '~~/server/utils/httpError'
import { proxyToBackend } from '~~/server/utils/backendProxy'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id || !UUID_RE.test(id)) {
    return sendHttpError(event, 400, 'ID inválido')
  }
  return proxyToBackend<{ success: boolean; marked: number }>(
    event,
    `/api/notifications/${encodeURIComponent(id)}/read`,
    { method: 'PATCH' }
  )
})
