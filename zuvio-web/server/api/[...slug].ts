// GET|POST|* /api/[...] — catch-all: rota da API inexistente.
// Evita que o fallback da SPA responda (com stack em dev): 404 JSON limpo.
import { sendHttpError } from '~~/server/utils/httpError'

export default defineEventHandler((event) => {
  return sendHttpError(event, 404, `Rota não encontrada: ${event.path}`)
})
