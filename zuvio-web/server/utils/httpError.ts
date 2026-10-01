// server/utils/httpError.ts — erro HTTP sem `throw`.
//
// Mesmo motivo do proxyToBackend: o h3 em dev anexa `error.stack` em toda
// exceção lançada. Retornando o objeto com o status setado, o corpo é
// exatamente este — sem stack, em dev e em prod. O $fetch do front
// continua lançando pelo status (contrato inalterado).
import type { H3Event } from 'h3'
import { setResponseStatus } from 'h3'

export function sendHttpError(
  event: H3Event,
  statusCode: number,
  message: string,
  data?: Record<string, unknown>
) {
  setResponseStatus(event, statusCode, 'Server Error')
  return {
    error: true,
    url: event.path,
    statusCode,
    statusMessage: 'Server Error',
    message,
    ...(data ? { data } : {})
  }
}
