// POST /api/track — pixel próprio (telas/cliques) → server-consorcio
import { defineEventHandler, readBody, createError } from 'h3'
import { proxyToBackend } from '../utils/backendProxy'

const EVENTS = new Set([
  'SCREEN_VIEW',
  'GENERATE_QR_CLICK',
  'QR_SHOWN',
  'COPY_PIX_CLICK',
  'VERIFY_PAYMENT_CLICK',
  'PAYMENT_CONFIRMED_VIEW',
  'BID_CREATED'
])

const SCREENS = new Set([
  'home', 'welcome', 'auth', 'bids', 'payment', 'checkout', 'contract',
  'adhesion', 'contracts', 'payments', 'statement', 'kyc', 'products', 'profile'
])

const ENTITY_TYPES = new Set(['bid', 'installment', 'subscription'])

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export default defineEventHandler(async (event) => {
  const body = await readBody(event)

  if (!body || !EVENTS.has(body.event)) {
    throw createError({ statusCode: 400, message: 'Evento inválido' })
  }
  if (body.screen !== undefined && body.screen !== null && !SCREENS.has(body.screen)) {
    throw createError({ statusCode: 400, message: 'Tela inválida' })
  }
  if (body.entityType !== undefined && body.entityType !== null && !ENTITY_TYPES.has(body.entityType)) {
    throw createError({ statusCode: 400, message: 'Entidade inválida' })
  }
  if (body.entityId !== undefined && body.entityId !== null && !UUID_RE.test(String(body.entityId))) {
    throw createError({ statusCode: 400, message: 'entityId inválido' })
  }
  if (body.metadata !== undefined && body.metadata !== null) {
    if (typeof body.metadata !== 'object' || Array.isArray(body.metadata)) {
      throw createError({ statusCode: 400, message: 'metadata inválido' })
    }
    if (JSON.stringify(body.metadata).length > 2048) {
      throw createError({ statusCode: 413, message: 'metadata muito grande' })
    }
  }

  return proxyToBackend<{ success: boolean; recorded: boolean }>(event, '/api/track', {
    method: 'POST',
    body: {
      event: body.event,
      screen: body.screen ?? null,
      entityType: body.entityType ?? null,
      entityId: body.entityId ?? null,
      metadata: body.metadata ?? null
    }
  })
})
