// server/error.ts — handler global de erros do Nitro.
//
// O front roda `nuxt dev` como servidor vivo, e o h3 em dev serializa
// `error.stack` na resposta JSON (vazava paths internos — obs. 2 do pentest).
// Este handler substitui o padrão e NUNCA inclui stack, em qualquer ambiente,
// mantendo o formato que o front já consome { error, url, statusCode,
// statusMessage, message, data }.
import type { H3Error, H3Event } from 'h3'
import { setResponseStatus } from 'h3'

function sanitizeData(data: unknown): Record<string, unknown> | undefined {
  if (!data || typeof data !== 'object' || Array.isArray(data)) return undefined
  const { stack, stackTrace, trace, ...rest } = data as Record<string, unknown>
  return rest
}

export default async function errorHandler(error: H3Error, event: H3Event) {
  const statusCode = error.statusCode || 500
  const statusMessage = error.statusMessage || 'Server Error'
  setResponseStatus(event, statusCode, statusMessage)
  return {
    error: true,
    url: event.path,
    statusCode,
    statusMessage,
    message: error.message || 'Erro no servidor',
    data: sanitizeData((error as any).data)
  }
}
