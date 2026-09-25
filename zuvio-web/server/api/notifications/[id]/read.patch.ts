// PATCH /api/notifications/:id/read — marca notificação como lida
import { defineEventHandler, getRouterParam, createError } from 'h3'
import { proxyToBackend } from '~~/server/utils/backendProxy'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id || !UUID_RE.test(id)) {
    throw createError({ statusCode: 400, message: 'ID inválido' })
  }
  return proxyToBackend<{ success: boolean; marked: number }>(
    event,
    `/api/notifications/${encodeURIComponent(id)}/read`,
    { method: 'PATCH' }
  )
})
