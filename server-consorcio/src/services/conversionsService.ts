import crypto from 'crypto';
import { logger } from '../config/logger';

/**
 * conversionsService — espelho server-side das conversões (Meta CAPI + GA4 MP).
 *
 * Por que: o pixel browser (fbq/gtag) perde 20–40% dos eventos (iOS/ATT,
 * adblock). O backend já tem o evento canônico (transaction_id + valor) —
 * reenviá-lo server-side devolve os dados que o algoritmo de campanha precisa.
 *
 * Regras duras:
 * - Fire-and-forget: nunca atrasa nem quebra a response (void + catch).
 * - Sem PII: só IDs internos hasheados (external_id = sha256(userId)),
 *   fbp/fbc/ga_client_id vindos do front, IP/UA técnicos.
 * - Sem credencial no front: tokens vivem só no env do backend.
 * - Deduplicação Meta: event_id = metadata.eid gerado no front (o mesmo
 *   valor vai no fbq via {eventID}). Sem eid, envia mesmo assim com id
 *   derivado (melhor que perder o evento).
 * - Desligado por padrão: sem META_CAPI_TOKEN / GA4_API_SECRET, no-op.
 *
 * Env:
 *   META_PIXEL_ID, META_CAPI_TOKEN, META_GRAPH_VERSION (default v23.0),
 *   META_TEST_EVENT_CODE (opcional — valida sem contar),
 *   META_CAPI_ENABLED (default true quando há credenciais),
 *   GA4_MEASUREMENT_ID, GA4_API_SECRET, GA4_MP_ENABLED (default true),
 *   GA4_MP_DEBUG (true = endpoint de validação, não grava).
 */

export interface ServerConversionInput {
    event: string;
    entityId?: string | null;
    userId?: string | null;
    metadata?: Record<string, string | number | boolean> | null;
    ipAddress?: string;
    userAgent?: string;
}

const FETCH_TIMEOUT_MS = 6000;

const META_EVENTS: Record<string, string> = {
    PAYMENT_CONFIRMED_VIEW: 'Purchase',
    REGISTER: 'CompleteRegistration',
    BEGIN_CHECKOUT: 'InitiateCheckout',
    ADD_TO_CART: 'AddToCart',
    VIEW_ITEM: 'ViewContent'
};

const GA4_EVENTS: Record<string, string> = {
    PAYMENT_CONFIRMED_VIEW: 'purchase',
    REGISTER: 'sign_up',
    BEGIN_CHECKOUT: 'begin_checkout'
};

function sha256Hex(v: string): string {
    return crypto.createHash('sha256').update(v, 'utf8').digest('hex');
}

function metaValue(meta: ServerConversionInput['metadata'], key: string): number | undefined {
    const v = meta?.[key];
    return typeof v === 'number' ? v : undefined;
}

function metaString(meta: ServerConversionInput['metadata'], key: string): string | undefined {
    const v = meta?.[key];
    return typeof v === 'string' && v ? v : undefined;
}

async function postJson(url: string, body: unknown): Promise<{ ok: boolean; status: number }> {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
    try {
        const res = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
            signal: ctrl.signal
        });
        return { ok: res.ok, status: res.status };
    } finally {
        clearTimeout(timer);
    }
}

async function sendMetaCapi(input: ServerConversionInput): Promise<void> {
    const pixelId = process.env.META_PIXEL_ID;
    const token = process.env.META_CAPI_TOKEN;
    if (process.env.META_CAPI_ENABLED === 'false') return;
    if (!pixelId || !token) return;
    const metaEvent = META_EVENTS[input.event];
    if (!metaEvent) return;

    const version = process.env.META_GRAPH_VERSION || 'v23.0';
    const eid = metaString(input.metadata, 'eid') || `${input.event}:${input.entityId || 'noid'}`;
    const value = metaValue(input.metadata, 'price') ?? 0;

    const user_data: Record<string, unknown> = {};
    if (input.ipAddress) user_data.client_ip_address = input.ipAddress;
    if (input.userAgent) user_data.client_user_agent = input.userAgent.slice(0, 512);
    const fbp = metaString(input.metadata, 'fbp');
    const fbc = metaString(input.metadata, 'fbc');
    if (fbp) user_data.fbp = fbp;
    if (fbc) user_data.fbc = fbc;
    // ID interno hasheado — match sem expor PII.
    if (input.userId) user_data.external_id = sha256Hex(input.userId);

    const custom_data: Record<string, unknown> = { currency: 'BRL', value };
    if (input.entityId) {
        custom_data.order_id = input.entityId;
        custom_data.content_ids = [input.entityId];
        custom_data.content_type = 'product';
    }

    const payload: Record<string, unknown> = {
        data: [
            {
                event_name: metaEvent,
                event_time: Math.floor(Date.now() / 1000),
                event_id: eid,
                action_source: 'server',
                user_data,
                custom_data
            }
        ]
    };
    const testCode = process.env.META_TEST_EVENT_CODE;
    if (testCode) payload.test_event_code = testCode;

    const url = `https://graph.facebook.com/${version}/${pixelId}/events?access_token=${encodeURIComponent(token)}`;
    const r = await postJson(url, payload);
    logger.info('[CAPI] Meta evento enviado', { event: metaEvent, status: r.status });
}

async function sendGa4Mp(input: ServerConversionInput): Promise<void> {
    const measurementId = process.env.GA4_MEASUREMENT_ID;
    const apiSecret = process.env.GA4_API_SECRET;
    if (process.env.GA4_MP_ENABLED === 'false') return;
    if (!measurementId || !apiSecret) return;
    const ga4Event = GA4_EVENTS[input.event];
    if (!ga4Event) return;
    // Sem client_id real, o MP poluiria a base — só envia com o cookie _ga.
    const clientId = metaString(input.metadata, 'ga_client_id');
    if (!clientId) return;

    const value = metaValue(input.metadata, 'price') ?? 0;
    const params: Record<string, unknown> = { currency: 'BRL', value };
    if (input.entityId) params.transaction_id = input.entityId;

    const debug = process.env.GA4_MP_DEBUG === 'true';
    const host = debug ? 'https://www.google-analytics.com/debug/mp/collect' : 'https://www.google-analytics.com/mp/collect';
    const url = `${host}?measurement_id=${encodeURIComponent(measurementId)}&api_secret=${encodeURIComponent(apiSecret)}`;
    const r = await postJson(url, { client_id: clientId, events: [{ name: ga4Event, params }] });
    logger.info('[CAPI] GA4 MP evento enviado', { event: ga4Event, status: r.status, debug });
}

/** Envia conversões server-side (await — quem chama decide dar void). Nunca throws. */
export async function sendServerConversions(input: ServerConversionInput): Promise<void> {
    try {
        await Promise.allSettled([sendMetaCapi(input), sendGa4Mp(input)]);
    } catch (err) {
        logger.warn('[CAPI] Falha ao enviar conversões server-side:', err);
    }
}

/** Atalho fire-and-forget para chamar dentro do fluxo de request. */
export function dispatchServerConversions(input: ServerConversionInput): void {
    void sendServerConversions(input);
}
