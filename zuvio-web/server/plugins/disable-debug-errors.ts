// server/plugins/disable-debug-errors.ts (plugin Nitro — roda em dev e prod)
//
// O h3 em dev serializa `error.stack` no JSON (caminhos internos) e os knobs
// `nitro.debug:false` / `nitro.errorHandler` são ignorados pelo dev server.
// Este plugin assume o `onError` do h3: responde JSON sanitizado e marca
// `event.handled`, desviando do `sendError` que anexaria o stack.
// Logs de terminal continuam completos.
export default defineNitroPlugin((nitroApp) => {
  try {
    const h3App = (nitroApp as any)?.h3App
    if (!h3App?.options) return
    const prevOnError = h3App.options.onError
    h3App.options.onError = async (error: any, event: any) => {
      try {
        if (typeof prevOnError === 'function') await prevOnError(error, event)
      } catch {
        // logging do Nitro nunca pode quebrar a resposta
      }
      try {
        const statusCode = Number(error?.statusCode) || 500
        const rawData = error?.data
        let data: Record<string, unknown> | undefined
        if (rawData && typeof rawData === 'object' && !Array.isArray(rawData)) {
          const { stack, stackTrace, trace, ...rest } = rawData as Record<string, unknown>
          data = rest
        }
        event.node.res.statusCode = statusCode
        event.node.res.setHeader('content-type', 'application/json')
        event.node.res.end(
          JSON.stringify({
            error: true,
            url: event.path,
            statusCode,
            statusMessage: error?.statusMessage || 'Server Error',
            message: error?.message || 'Erro no servidor',
            ...(data ? { data } : {})
          })
        )
        event.handled = true
      } catch {
        // último recurso: deixa o handler padrão agir
      }
    }
  } catch {
    // nunca quebrar o boot por causa disso
  }
})
