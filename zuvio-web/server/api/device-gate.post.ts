// POST /api/device-gate — telemetria do porteiro mobile-first → server-consorcio
import { defineEventHandler, readBody } from 'h3'
import { sendHttpError } from '~~/server/utils/httpError'
import { proxyToBackend } from '../utils/backendProxy'

const GATE_EVENTS = new Set([
  'gate.view',
  'gate.bypass',
  'gate.devtools',
  'gate.resize-spoof',
  'gate.client-enforce'
])

export default defineEventHandler(async (event) => {
  const body = await readBody(event)

  if (!body || !GATE_EVENTS.has(body.type)) {
    return sendHttpError(event, 400, 'Evento inválido')
  }
  if (body.signals !== undefined && body.signals !== null) {
    if (typeof body.signals !== 'object' || Array.isArray(body.signals)) {
      return sendHttpError(event, 400, 'signals inválido')
    }
    if (JSON.stringify(body.signals).length > 3072) {
      return sendHttpError(event, 413, 'signals muito grande')
    }
  }

  return proxyToBackend<{ success: boolean; recorded: boolean }>(event, '/api/device-gate/event', {
    method: 'POST',
    body: {
      type: body.type,
      signals: body.signals ?? {}
    }
  })
})
