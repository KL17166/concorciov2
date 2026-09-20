import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import WebSocket from 'ws';
import { Offer } from './types';

const G2G_COOKIES_FILE = path.join(__dirname, '..', 'cookies.json');
const G2G_SSR = 'https://www.g2g.com';
const G2G_SLS = 'https://sls.g2g.com';
const UA = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

export interface G2GOffer extends Offer {
  offerId: string;
  relationId: string;
  sellerId: string;
  convertedUnitPrice: number;
  offerCurrency: string;
  displayPrice: string;
}

function loadG2GCookieHeader(): string {
  try {
    if (!fs.existsSync(G2G_COOKIES_FILE)) return '';
    const parsed = JSON.parse(fs.readFileSync(G2G_COOKIES_FILE, 'utf-8'));
    const arr = Array.isArray(parsed) ? parsed : [];
    return arr
      .filter((c: any) => c && c.name && c.value !== undefined)
      .map((c: any) => `${c.name}=${c.value}`)
      .join('; ');
  } catch {
    return '';
  }
}

async function g2gFetch(url: string, init: any = {}, accessToken?: string): Promise<any> {
  const headers: any = {
    'User-Agent': UA,
    'Accept': 'application/json, text/plain, */*',
    'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8',
    ...(init.headers || {}),
  };
  const cookie = loadG2GCookieHeader();
  if (cookie) headers['Cookie'] = cookie;
  if (accessToken) headers['authorization'] = accessToken;
  if (url.startsWith(G2G_SLS)) {
    headers['Origin'] = G2G_SSR;
    headers['Referer'] = G2G_SSR + '/';
  }
  const res = await fetch(url, { ...init, headers });
  if (!res.ok) throw new Error(`G2G ${init.method || 'GET'} ${url} -> HTTP ${res.status}`);
  return res.json();
}

let cachedAuth: { accessToken: string; userId: string; expMs: number } | null = null;

function jwtExpMs(token: string): number {
  try {
    const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString('utf-8'));
    return Number(payload.exp || 0) * 1000;
  } catch {
    return 0;
  }
}

export async function getG2GAccessToken(force = false): Promise<{ accessToken: string; userId: string }> {
  // Reusa o JWT até ~60s antes de expirar: o endpoint responde 429 se martelado.
  if (!force && cachedAuth && Date.now() < cachedAuth.expMs - 60000) {
    return { accessToken: cachedAuth.accessToken, userId: cachedAuth.userId };
  }
  const data = await g2gFetch(`${G2G_SSR}/api/authenticate-user`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({}),
  });
  const accessToken = data?.payload?.user?.accessToken;
  const userId = data?.payload?.user?.userInfo?.userId;
  if (!accessToken || !userId) throw new Error('Falha no authenticate-user: token/userId ausente. Exporte os cookies da G2G para cookies.json.');
  cachedAuth = { accessToken, userId, expMs: jwtExpMs(accessToken) || Date.now() + 14 * 60 * 1000 };
  return { accessToken, userId };
}

export async function searchG2GOffers(
  accessToken: string,
  seoTerm = 'wow-gold',
  currency = 'BRL',
  country = 'BR',
  pageSize = 100
): Promise<G2GOffer[]> {
  const url =
    `${G2G_SLS}/v3/offer/search?seo_term=${encodeURIComponent(seoTerm)}` +
    `&country=${country}&currency=${currency}&page_size=${pageSize}&page=1&sort=recommended_v2&v=v2`;
  const data = await g2gFetch(url, { method: 'GET' }, accessToken);
  const results = data?.payload?.results || [];
  return results
    .map((o: any): G2GOffer | null => {
      const price = Number(o.converted_unit_price);
      if (!price || price <= 0 || !o.offer_id) return null;
      const verified = String(o.verified_seller || '').toLowerCase() === 'verified';
      const rating = typeof o.satisfaction_rate === 'number' ? Math.round(o.satisfaction_rate * 100) : verified ? 100 : 95;
      return {
        sellerName: String(o.username || o.seller_id || 'unknown'),
        pricePerUnit: price,
        inStock: Number(o.available_qty || 0),
        minQty: Number(o.min_qty || 1),
        deliveryTime: String(o.delivery_speed || ''),
        ratingPercent: rating,
        reviewCount: Number(o.total_success_order ?? o.total_rating ?? 0),
        isVerified: verified,
        isMainOffer: false,
        elementIndex: 0,
        offerId: String(o.offer_id),
        relationId: String(o.relation_id || ''),
        sellerId: String(o.seller_id || ''),
        convertedUnitPrice: price,
        offerCurrency: String(o.offer_currency || ''),
        displayPrice: String(o.display_price || ''),
      };
    })
    .filter((x: G2GOffer | null): x is G2GOffer => !!x);
}

export interface DeliveryMethod {
  code: string;
  id: string;
}

export interface ValidatedOffer {
  availableQty: number;
  relationId: string;
  sellerId: string;
  unitPrice: number;
  offerCurrency: string;
  convertedUnitPrice: number;
  serviceId: string;
  brandId: string;
  minQty: number;
  deliveryMethods: DeliveryMethod[];
}

export async function validateG2GOffer(
  accessToken: string,
  userId: string,
  offer: G2GOffer
): Promise<ValidatedOffer> {
  const detail = await g2gFetch(
    `${G2G_SLS}/v3/offer/${offer.offerId}?currency=BRL&country=BR&include_out_of_stock=1&is_precheckout_page=1&setState=false&tree_version=v2`,
    { method: 'GET' },
    accessToken
  );
  const p = detail?.payload || {};
  const relationId = String(p.relation_id || offer.relationId);
  if (relationId) {
    try {
      await g2gFetch(
        `${G2G_SLS}/gcart/${userId}/product/${relationId}/checkout_histories`,
        { method: 'GET' },
        accessToken
      );
    } catch (_) {
      // histórico indisponível não bloqueia; estoque abaixo é o que importa
    }
  }
  const methods: DeliveryMethod[] = Array.isArray(p.delivery_method_details)
    ? p.delivery_method_details
        .filter((d: any) => d && d.delivery_method_id)
        .map((d: any) => ({ code: String(d.delivery_method_code || ''), id: String(d.delivery_method_id) }))
    : [];
  return {
    availableQty: Number(p.available_qty ?? offer.inStock),
    relationId,
    sellerId: String(p.seller_id || offer.sellerId),
    unitPrice: Number(p.unit_price ?? offer.pricePerUnit),
    offerCurrency: String(p.offer_currency || offer.offerCurrency || 'USD'),
    convertedUnitPrice: Number(p.converted_unit_price ?? offer.pricePerUnit),
    serviceId: String(p.service_id || ''),
    brandId: String(p.brand_id || ''),
    minQty: Number(p.min_qty ?? offer.minQty),
    deliveryMethods: methods,
  };
}

/**
 * Passo 4b — product_settings: de onde sai o `collection_id` do delivery_info.
 * GET /offer/product_settings/service/{serviceId}/brand/{brandId}/product_settings
 * Resposta: payload.results[] agrupado por product_settings_type:
 *   - 'delivery_method': results[] com product_settings_id == delivery_method_id
 *     do offer detail; cada um traz form_attributes[] (ex delivery_info_1 /
 *     'World Of Warcraft - Character Name' -> collection_id).
 *   - 'purchase_form': form adicional opcional (ex additional_info_1 / note).
 * Retorna o payload cru para o chamador extrair o que precisa.
 */
export async function getProductSettings(
  accessToken: string,
  serviceId: string,
  brandId: string
): Promise<any> {
  if (!serviceId || !brandId) throw new Error('getProductSettings: serviceId/brandId ausentes (vem do offer detail).');
  const data = await g2gFetch(
    `${G2G_SLS}/offer/product_settings/service/${encodeURIComponent(serviceId)}` +
      `/brand/${encodeURIComponent(brandId)}/product_settings`,
    { method: 'GET' },
    accessToken
  );
  return data?.payload ?? data;
}

export interface DeliveryField {
  collection_id: string;
  attribute_key: string;
  label: string;
}

/**
 * Extrai os campos delivery_info_* do método de entrega escolhido.
 * Se deliveryMethodId não for achado, usa a união dos grupos delivery_method
 * (na prática todos repetem o mesmo collection_id, ex Character Name).
 */
export function collectDeliveryFields(productSettingsPayload: any, deliveryMethodId?: string): DeliveryField[] {
  const groups: any[] = productSettingsPayload?.results || [];
  const out: DeliveryField[] = [];
  const seen = new Set<string>();
  for (const g of groups) {
    if (g?.product_settings_type && g.product_settings_type !== 'delivery_method') continue;
    for (const r of g?.results || []) {
      if (deliveryMethodId && r?.product_settings_id !== deliveryMethodId) continue;
      const fas: any[] = r?.product_settings?.form_attributes || [];
      for (const fa of fas) {
        const key = String(fa?.attribute_key || '');
        const cid = String(fa?.collection_id || '');
        if (!key.startsWith('delivery_info_') || !cid || seen.has(cid)) continue;
        seen.add(cid);
        out.push({ collection_id: cid, attribute_key: key, label: String(fa?.label?.en || '') });
      }
    }
  }
  return out;
}

export interface BuyNowInput {
  userId: string;
  offerId: string;
  sellerId: string;
  /** unidades na métrica da oferta (ex K Gold): o que o summary chama de purchased_qty */
  quantity: number;
  /** unit_price FRESCO do offer detail, na moeda da oferta (offer_currency) */
  unitPrice: number;
  offerCurrency: string;
  currency?: string; // default 'BRL'
  language?: string; // default 'pt'
  deliveryMethodId: string;
  /** valores digitados pelo comprador, ex { 'World Of Warcraft - Character Name': 'LEA' } por label ou { '<collection_id>': '...' } */
  deliveryValuesByLabel?: Record<string, string>;
  deliveryValuesByCollection?: Record<string, string>;
  deliveryFields?: DeliveryField[]; // se omitido, delivery_info vai vazio
}

/**
 * Monta o body EXATO do POST /gcart/buy-now (captura real: 467B p/ 1 campo).
 * Ordem de chaves igual à do frontend. Função pura (testável offline).
 */
export function buildBuyNowBody(input: BuyNowInput): Record<string, any> {
  const deliveryInfo = (input.deliveryFields || []).map((f) => ({
    collection_id: f.collection_id,
    value:
      input.deliveryValuesByCollection?.[f.collection_id] ??
      (f.label ? input.deliveryValuesByLabel?.[f.label] : undefined) ??
      '',
  }));
  return {
    product_type: 'Offer',
    product: {
      offer_id: input.offerId,
      quantity: input.quantity,
      unit_price: input.unitPrice,
      currency: input.offerCurrency,
      seller_id: input.sellerId,
    },
    currency: input.currency || 'BRL',
    language: input.language || 'pt',
    user_id: input.userId,
    checkout_info: {
      delivery_method_details: {
        delivery_method_id: input.deliveryMethodId,
        delivery_info: deliveryInfo,
        remember: false,
      },
      gp_checkout_info: {
        buyer_gp_balance: 0,
        gp_used: 0,
        gp_used_in_checkout_currency: 0,
      },
    },
  };
}

/**
 * Passo 6 — POST /gcart/buy-now.
 * Frontend lê `resp.data.payload.auth_token` (axios); aqui o fetch já é o JSON:
 * aceita `payload.auth_token` ou `auth_token` na raiz. Rejeita sem token
 * (igual ao frontend: 'Invalid auth token received').
 */
export async function postBuyNow(
  accessToken: string,
  body: Record<string, any>
): Promise<{ authToken: string; payload: any; raw: any }> {
  const raw = await g2gFetch(
    `${G2G_SLS}/gcart/buy-now`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    },
    accessToken
  );
  const payload = raw?.payload ?? raw ?? {};
  const authToken = String(payload?.auth_token || '');
  if (!/^[0-9a-f]{32}$/.test(authToken)) {
    const msgs = JSON.stringify(raw?.messages ?? raw).slice(0, 300);
    throw new Error(`Invalid auth token received. Resposta buy-now: ${msgs}`);
  }
  return { authToken, payload, raw };
}

export interface WsOrder {
  orderId: string;
  pipwaveToken: string;
  pipwaveApiKey: string;
  redirectUrl: string;
  code: number;
  paymentStatus: string;
}

/**
 * Passo 7 — WSS do carrinho. URL EXATA do frontend (sem path, só query):
 *   wss://gcart-ws.g2g.com?token={auth_token}
 * Lógica espelhada do frontend (connectWebSocket/onmessage):
 *   - frame com message_code -> erro {code, params}
 *   - frame com order_id -> resolve + fecha (para payment_status 'paid' o
 *     browser iria p/ /secure/payment/success; aqui só repassamos o status)
 *   - frames sem order_id nem message_code -> ignorados até o timeout
 *   - close prematuro (fora GoingAway/NoStatusReceived) -> erro
 */
export function waitForOrder(authToken: string, timeoutMs = 30000): Promise<WsOrder> {
  return new Promise((resolve, reject) => {
    let settled = false;
    const done = (fn: () => void) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      fn();
    };
    const ws = new WebSocket(`wss://gcart-ws.g2g.com?token=${authToken}`);
    const timer = setTimeout(() => {
      done(() => {
        try { ws.close(); } catch (_) { /* noop */ }
        reject(new Error(`WS gcart timeout após ${timeoutMs}ms sem order_id (auth_token expirado ou buy-now sem efeito).`));
      });
    }, timeoutMs);
    ws.on('message', (data: any) => {
      let msg: any;
      try {
        msg = JSON.parse(String(data));
      } catch (_) {
        return; // frame não-JSON: ignora
      }
      if (msg && msg.message_code !== undefined && msg.message_code !== null && msg.message_code !== '') {
        done(() => {
          try { ws.close(); } catch (_) { /* noop */ }
          reject(new Error(`WS gcart recusou: code=${msg.message_code} params=${JSON.stringify(msg.params || {})}`));
        });
        return;
      }
      if (msg && msg.order_id) {
        const out: WsOrder = {
          orderId: String(msg.order_id),
          pipwaveToken: String(msg.pipwave_token || ''),
          pipwaveApiKey: String(msg.pipwave_api_key || ''),
          redirectUrl: String(msg.redirect_url || ''),
          code: Number(msg.code ?? 0),
          paymentStatus: String(msg.payment_status || ''),
        };
        done(() => {
          try { ws.close(); } catch (_) { /* noop */ }
          resolve(out);
        });
      }
      // sem order_id e sem message_code: ignora (ruído), segue esperando
    });
    ws.on('error', (err: Error) => {
      done(() => reject(new Error(`WS gcart erro de conexão: ${err.message}`)));
    });
    ws.on('close', (code: number) => {
      // 1001 GoingAway / 1005 NoStatusReceived são fechamentos normais pós-order
      if (!settled && code !== 1001 && code !== 1005) {
        done(() => reject(new Error(`WS Connection closed unexpectedly (code ${code}) antes do order_id.`)));
      }
    });
  });
}

export interface OrderSummary {
  orderId: string;
  paymentStatus: string;
  total: string;
  checkoutCurrency: string;
  subTotal: string;
  sellerId: string;
  purchasedQty: number;
  autoCancelAt: number;
  raw: any;
}

/**
 * Passo 8 — total REAL (fonte da verdade p/ a meta; não o estimado da busca).
 * GET /order/{order_id}/summary?include_items=1&buyer_id={userId}&include_ga_info=1
 */
export async function getOrderSummary(
  accessToken: string,
  orderId: string,
  buyerId: string
): Promise<OrderSummary> {
  const raw = await g2gFetch(
    `${G2G_SLS}/order/${encodeURIComponent(orderId)}/summary` +
      `?include_items=1&buyer_id=${encodeURIComponent(buyerId)}&include_ga_info=1`,
    { method: 'GET' },
    accessToken
  );
  const p = raw?.payload ?? {};
  const item = p?.order_items?.[0]?.items?.[0] ?? {};
  return {
    orderId: String(p.order_id || orderId),
    paymentStatus: String(p.payment_status || ''),
    total: String(p.total ?? p.checkout_total_amount ?? ''),
    checkoutCurrency: String(p.checkout_currency || ''),
    subTotal: String(p.sub_total ?? ''),
    sellerId: String(item.seller_id || p?.order_items?.[0]?.seller_id || ''),
    purchasedQty: Number(item.purchased_qty ?? 0),
    autoCancelAt: Number(p.auto_cancel_at ?? 0),
    raw,
  };
}

export interface PipwaveConfigResult {
  status: number;
  message: any;
  payableAmount?: string;
  categories?: any[];
  raw: any;
}

/**
 * Passo 8b — POST /payment/sdk/{pipwave_token}/get-config
 * Menu de opções de pagamento (cardápio) emitido pelo Pipwave HPP.
 */
export async function getPipwaveConfig(
  pipwaveToken: string,
  pipwaveApiKey: string,
  orderId: string
): Promise<PipwaveConfigResult> {
  const timestamp = Math.floor(Date.now() / 1000);
  const body = JSON.stringify({
    timestamp,
    api_key: pipwaveApiKey,
    version: 'pipwave HPP v1.0 pwsdk v2.1.0',
    referrer_url: 'https://www.g2g.com//categories/wow-gold',
    location_url: `https://www.g2g.com/secure/payment?order_id=${encodeURIComponent(orderId)}&pipwave_token=${encodeURIComponent(pipwaveToken)}&pipwave_api_key=${encodeURIComponent(pipwaveApiKey)}`,
  });

  const res = await fetch(`https://api.pipwave.com/payment/sdk/${encodeURIComponent(pipwaveToken)}/get-config`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Origin': 'https://www.g2g.com',
      'Referer': 'https://www.g2g.com/',
      'User-Agent': UA,
    },
    body,
  });
  const data = await res.json().catch(() => ({ status: res.status, message: 'Invalid response' }));
  return {
    status: data.status ?? res.status,
    message: data.message,
    payableAmount: data.payable_amount || data.message?.payable_amount,
    categories: data.categories || data.message?.categories,
    raw: data,
  };
}

export interface PaymentMethodDetailsResult {
  status: number;
  amount?: {
    surcharge?: number;
    tax?: number;
    total?: number;
    total_formatted?: string;
    currency?: string;
    final_total?: string;
  };
  raw: any;
}

/**
 * Passo 9a — POST /payment/sdk/{pipwave_token}/get-payment-method-details
 * Obtém detalhes e sobretaxa do método de pagamento (ex: tazapay.PIX-QR).
 */
export async function getPipwavePaymentMethodDetails(
  pipwaveToken: string,
  pipwaveApiKey: string,
  paymentMethodCode = 'tazapay.PIX-QR'
): Promise<PaymentMethodDetailsResult> {
  const timestamp = Math.floor(Date.now() / 1000);
  const body = JSON.stringify({
    timestamp,
    api_key: pipwaveApiKey,
    version: 'pipwave HPP v1.0 pwsdk v2.1.0',
    payment_method_code: paymentMethodCode,
  });

  const res = await fetch(`https://api.pipwave.com/payment/sdk/${encodeURIComponent(pipwaveToken)}/get-payment-method-details`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Origin': 'https://www.g2g.com',
      'Referer': 'https://www.g2g.com/',
      'User-Agent': UA,
    },
    body,
  });
  const data = await res.json().catch(() => ({ status: res.status, message: 'Invalid response' }));
  return {
    status: data.status ?? res.status,
    amount: data.message?.amount,
    raw: data,
  };
}

export interface SubmitPaymentResult {
  status: number;
  redirectUrl: string;
  raw: any;
}

/**
 * Passo 9b — POST /payment/sdk/{pipwave_token}/submit-payment
 * Submete a intenção com tazapay_session_id e obtém a URL de checkout/redirect.
 */
export async function submitPipwavePayment(
  pipwaveToken: string,
  pipwaveApiKey: string,
  paymentMethodCode = 'tazapay.PIX-QR',
  tazapaySessionId?: string
): Promise<SubmitPaymentResult> {
  const timestamp = Math.floor(Date.now() / 1000);
  const sessionId = tazapaySessionId || crypto.randomUUID().replace(/-/g, '');
  const body = JSON.stringify({
    timestamp,
    api_key: pipwaveApiKey,
    version: 'pipwave HPP v1.0 pwsdk v2.1.0',
    payment_method_code: paymentMethodCode,
    user_input: {
      'pw-phone-verification-token': '',
      'disclaimer_message_agreement': '1',
      'tazapay_session_id': sessionId,
    },
  });

  const res = await fetch(`https://api.pipwave.com/payment/sdk/${encodeURIComponent(pipwaveToken)}/submit-payment`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Origin': 'https://www.g2g.com',
      'Referer': 'https://www.g2g.com/',
      'User-Agent': UA,
    },
    body,
  });
  const data = await res.json().catch(() => ({ status: res.status, message: 'Invalid response' }));
  return {
    status: data.status ?? res.status,
    redirectUrl: data.redirect_url || '',
    raw: data,
  };
}

export interface PrepaymentCheckResult {
  status: number;
  redirectUrl: string;
  challenge: any;
  pmId: number;
  raw: any;
}

/**
 * Passo 9c — POST /payment/sdk/{pipwave_token}/prepayment-check
 * Checagem pré-pagamento (challenge: null para Pix).
 */
export async function prepaymentCheck(
  pipwaveToken: string,
  pipwaveApiKey: string
): Promise<PrepaymentCheckResult> {
  const timestamp = Math.floor(Date.now() / 1000);
  const body = JSON.stringify({
    timestamp,
    api_key: pipwaveApiKey,
    version: 'pipwave HPP v1.0 pwsdk v2.1.0',
  });

  const res = await fetch(`https://api.pipwave.com/payment/sdk/${encodeURIComponent(pipwaveToken)}/prepayment-check`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Origin': 'https://www.g2g.com',
      'Referer': 'https://www.g2g.com/',
      'User-Agent': UA,
    },
    body,
  });
  const data = await res.json().catch(() => ({ status: res.status, message: 'Invalid response' }));
  return {
    status: data.status ?? res.status,
    redirectUrl: data.redirect_url || '',
    challenge: data.challenge,
    pmId: data.pm_id,
    raw: data,
  };
}

/**
 * Passo 10 — Resolve o redirect 302 do Pipwave (/load?token=)
 * Retorna a URL final da tela hospedada Tazapay para solicitação de CPF.
 */
export async function getTazapayCheckoutUrl(pipwaveToken: string): Promise<string> {
  const loadUrl = `https://secure.pipwave.com/load?token=${encodeURIComponent(pipwaveToken)}`;
  try {
    const res = await fetch(loadUrl, {
      method: 'GET',
      redirect: 'manual',
      headers: {
        'User-Agent': UA,
        'Referer': 'https://www.g2g.com/',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
    });
    const location = res.headers.get('location');
    if (location) {
      try {
        const checkoutRes = await fetch(location, {
          method: 'GET',
          headers: {
            'User-Agent': UA,
            'Referer': 'https://www.g2g.com/',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          },
        });
        const html = await checkoutRes.text();
        const tazaMatch = html.match(/https:\/\/checkout\.tazapay\.com\/transaction\/[a-zA-Z0-9_\-=]+/);
        if (tazaMatch) {
          return tazaMatch[0];
        }
      } catch (_) {
        // Se leitura do HTML falhar, devolve a location
      }
      return location;
    }
  } catch (err: any) {
    console.error('[G2G] Erro ao resolver redirect Tazapay:', err.message);
  }
  return loadUrl;
}

export interface TazapayPixResult {
  payinId: string;
  paymentAttemptId: string;
  rawQrCode: string;
  brCode: string; // Decodificado base64
  expiryDate: string;
  pspReferenceId: string;
  raw: any;
}

/**
 * Passo 11 — Submissão do CPF e obtenção do Pix Copia-e-Cola real.
 * 11a: GET /v3/payin/session/{token} -> payin_id
 * 11b: POST /v3/payin/attempt -> qr_code em Base64
 * Decodificação: base64 -> BR Code puro (00020101...)
 */
export async function getTazapayPix(tazapayCheckoutUrl: string, cpf: string): Promise<TazapayPixResult> {
  const tokenMatch = tazapayCheckoutUrl.match(/transaction\/([a-zA-Z0-9_\-+=]+)/);
  if (!tokenMatch) {
    throw new Error(`URL Tazapay inválida (sem token de transação): ${tazapayCheckoutUrl}`);
  }
  const sessionToken = tokenMatch[1];

  // 11a: Resolução da sessão para obter o payin_id
  const sessionUrl = `https://service.tazapay.com/v3/payin/session/${encodeURIComponent(sessionToken)}`;
  const sessionRes = await fetch(sessionUrl, {
    method: 'GET',
    headers: {
      'x-session-token': sessionToken,
      'Origin': 'https://checkout.tazapay.com',
      'Referer': 'https://checkout.tazapay.com/',
      'User-Agent': UA,
    },
  });
  const sessionData = await sessionRes.json().catch(() => ({}));
  const payinId = sessionData?.data?.payin_id;
  if (!payinId) {
    throw new Error(`Falha ao obter payin_id da sessão Tazapay: ${JSON.stringify(sessionData)}`);
  }

  // 11b: Emissão do Pix com CPF
  const cleanCpf = String(cpf).replace(/\D/g, '') || '21275117783';
  const attemptBody = JSON.stringify({
    payin_id: payinId,
    payment_method_type: 'pix_brl',
    forter_info: {
      token: null,
      user_agent: UA,
    },
    redirect_url: `https://checkout.tazapay.com/transaction/${sessionToken}`,
    abort_url: `https://checkout.tazapay.com/transaction/${sessionToken}`,
    pending_url: `https://checkout.tazapay.com/payment/awaiting-confirmation?provider=I7HWC&token=${sessionToken}`,
    psp_metadata: {
      referrer_url: '',
      document_id: cleanCpf,
      document_type: 'cpf',
    },
    metadata: {},
    device_fingerprint: crypto.randomUUID().replace(/-/g, ''),
    billing_details: null,
  });

  const attemptRes = await fetch('https://service.tazapay.com/v3/payin/attempt', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-session-token': sessionToken,
      'Origin': 'https://checkout.tazapay.com',
      'Referer': 'https://checkout.tazapay.com/',
      'User-Agent': UA,
    },
    body: attemptBody,
  });
  const attemptData = await attemptRes.json().catch(() => ({}));
  const qrCodeB64 = attemptData?.data?.qr_code || attemptData?.data?.instrument?.qr_code || '';
  if (!qrCodeB64) {
    throw new Error(`Tazapay attempt não retornou qr_code: ${JSON.stringify(attemptData)}`);
  }

  let brCode = qrCodeB64;
  try {
    brCode = Buffer.from(qrCodeB64, 'base64').toString('utf-8');
  } catch (_) {
    // mantém valor se falhar decode
  }

  return {
    payinId,
    paymentAttemptId: attemptData?.data?.payment_attempt_id || '',
    rawQrCode: qrCodeB64,
    brCode,
    expiryDate: attemptData?.data?.instrument?.expiry_date || '',
    pspReferenceId: attemptData?.data?.psp_reference_id || '',
    raw: attemptData,
  };
}


