// POST /api/track — pixel próprio (telas/cliques) → server-consorcio
import { defineEventHandler, readBody } from 'h3'
import { sendHttpError } from '~~/server/utils/httpError'
import { proxyToBackend } from '../utils/backendProxy'

const EVENTS = new Set([
  'SCREEN_VIEW',
  'VIEW_ITEM_LIST',
  'VIEW_ITEM',
  'SEARCH',
  'FILTER_CATEGORY',
  'ADD_TO_CART',
  'BEGIN_CHECKOUT',
  'CHECKOUT_STEP',
  'CHECKOUT_COMPLETE',
  'GENERATE_QR_CLICK',
  'QR_SHOWN',
  'COPY_PIX_CLICK',
  'VERIFY_PAYMENT_CLICK',
  'PAYMENT_CONFIRMED_VIEW',
  'BID_CREATED',
  'BID_VIEWED',
  'LOGIN',
  'LOGOUT',
  'REGISTER',
  'KYC_STARTED',
  'KYC_SUBMITTED',
  'KYC_APPROVED',
  'KYC_REJECTED',
  'ONBOARDING_STARTED',
  'ONBOARDING_COMPLETE',
  'SHARE',
  'NOTIFICATION_CLICK'
])

const SCREENS = new Set([
  'home', 'welcome', 'catalogo', 'auth', 'bids', 'payment', 'checkout', 'contract',
  'adhesion', 'contracts', 'payments', 'statement', 'kyc', 'products',
  'product_detail', 'profile'
])

const ENTITY_TYPES = new Set(['bid', 'installment', 'subscription', 'product', 'user'])

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
// IDs de produto do catálogo são slugs (ex: catalog-novo-honda-cg-160-fan-2024),
// não UUIDs — aceita os dois formatos (guestId continua UUID estrito).
const SLUG_RE = /^[a-z0-9][a-z0-9-_]{0,119}$/i

export default defineEventHandler(async (event) => {
  const body = await readBody(event)

  if (!body || !EVENTS.has(body.event)) {
    return sendHttpError(event, 400, 'Evento inválido')
  }
  if (body.screen !== undefined && body.screen !== null && !SCREENS.has(body.screen)) {
    return sendHttpError(event, 400, 'Tela inválida')
  }
  if (body.entityType !== undefined && body.entityType !== null && !ENTITY_TYPES.has(body.entityType)) {
    return sendHttpError(event, 400, 'Entidade inválida')
  }
  if (body.entityId !== undefined && body.entityId !== null && !(UUID_RE.test(String(body.entityId)) || SLUG_RE.test(String(body.entityId)))) {
    return sendHttpError(event, 400, 'entityId inválido')
  }
  if (body.guestId !== undefined && body.guestId !== null && !UUID_RE.test(String(body.guestId))) {
    return sendHttpError(event, 400, 'guestId inválido')
  }
  if (body.metadata !== undefined && body.metadata !== null) {
    if (typeof body.metadata !== 'object' || Array.isArray(body.metadata)) {
      return sendHttpError(event, 400, 'metadata inválido')
    }
    if (JSON.stringify(body.metadata).length > 2048) {
      return sendHttpError(event, 413, 'metadata muito grande')
    }
  }

  return proxyToBackend<{ success: boolean; recorded: boolean }>(event, '/api/track', {
    method: 'POST',
    body: {
      event: body.event,
      screen: body.screen ?? null,
      entityType: body.entityType ?? null,
      entityId: body.entityId ?? null,
      guestId: body.guestId ?? null,
      metadata: body.metadata ?? null
    }
  })
})
