import { Router, Request, Response } from 'express';
import * as fs from 'fs';
import * as path from 'path';
import { getG2GAccessToken } from './g2g';

/**
 * CANCELAMENTO — reproduzido do tráfego real `cancelando-compra.har`
 * (Downloads, 230 entries, pedido 1788968088023DS2J-1).
 *
 * Sequência capturada (só reproduzir — sem inventar request):
 *
 *   1. GET /order/item/{itemId}/report_reasons?buyer_id={buyerId}
 *      <- 200 { code: 2000,
 *                payload: { report_item_types:
 *                  [{ report_case: "cancel",
 *                     report_reasons: ["incorrect_order_info",
 *                       "abandoned", "promised_txn_time_expired",
 *                       "seller_inform_cancel", "other_reason"] }] } }
 *      (após cancelar, report_item_types volta [] — já cancelado)
 *
 *   2. POST /order/item/{itemId}/report_case
 *      -> { "buyer_id": "1004386074", "report_case": "cancel",
 *           "report_reason": "abandoned", "buyer_refund_option": "pg" }
 *      <- 200 { code: 2000, payload: { case_id: "20260909154434" } }
 *
 * Convenção de ids: itemId = orderId + "-1"
 * (ex orderId 1788968088023DS2J -> itemId 1788968088023DS2J-1).
 *
 * CANCELAMENTO FORÇADO de to_pay (cancelamento-mapeado.har, página
 * /g2g-user/purchase — lista todos os IDs via list_my_order):
 *
 *   3. GET /order/list_my_order?buyer_id={buyerId}&status=to_pay&include_pending_proof_only=0
 *      <- 200 { code: 2000, payload: { results:
 *           [{ order_id, payment_status: "to_pay", total, items:
 *              [{ order_item_id, order_item_status, ... }] }] } }
 *   4. PUT /order/{orderId}/mark_as_cancel
 *      -> { "buyer_id": "1004386074" }   (orderId, NÃO itemId)
 *      <- 200 { code: 2000, payload: { task_id: "ORSM0001:..." } }
 *      (prova: pedido 1788977278582JCPO, R$3709, cancelado na página purchase)
 *
 * Bônus da mesma página:
 *   - GET /order/count-my-orders?buyer_id={buyerId}
 *   - PUT /order/{orderId}/mark_order_as_read  -> { buyer_id }
 *
 * REGRA DO GATEWAY (cancelamento forçado):
 *   status to_pay -> PUT mark_as_cancel (forçado, funciona sempre)
 *   status paid/pending -> POST report_case (disputa pós-pagamento)
 *
 * AUTO-CANCEL 10m: o gateway passa a agendar um cancelamento automático
 * 10 minutos após a criação do pedido (600_000 ms). Se o pagamento não
 * confirmar até lá, dispara o POST report_case com
 * report_reason "promised_txn_time_expired". O timer é desarmado quando
 * o pagamento confirma (DELETE /api/order/auto-cancel/:id).
 */

const G2G_COOKIES_FILE = path.join(__dirname, '..', 'cookies.json');
const G2G_SSR = 'https://www.g2g.com';
const G2G_SLS = 'https://sls.g2g.com';
const UA =
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

export const AUTO_CANCEL_DEFAULT_MS = 10 * 60 * 1000; // 10m

export const CANCEL_REASONS = [
  'incorrect_order_info',
  'abandoned',
  'promised_txn_time_expired',
  'seller_inform_cancel',
  'other_reason',
] as const;

export type CancelReason = (typeof CANCEL_REASONS)[number];

function loadCookieHeader(): string {
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

async function slsFetch(url: string, init: any = {}, accessToken?: string): Promise<any> {
  const headers: any = {
    'User-Agent': UA,
    Accept: 'application/json, text/plain, */*',
    'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8',
    Origin: G2G_SSR,
    Referer: G2G_SSR + '/',
    ...(init.headers || {}),
  };
  const cookie = loadCookieHeader();
  if (cookie) headers['Cookie'] = cookie;
  if (accessToken) headers['authorization'] = accessToken;
  const res = await fetch(url, { ...init, headers });
  const text = await res.text().catch(() => '');
  if (!res.ok) {
    throw new Error(`G2G ${init.method || 'GET'} ${url} -> HTTP ${res.status} ${text.slice(0, 300)}`);
  }
  try {
    return JSON.parse(text);
  } catch {
    return { raw: text };
  }
}

/** itemId "...DS2J-1" -> orderId "...DS2J". */
export function toOrderId(orderIdOrItemId: string): string {
  const s = String(orderIdOrItemId || '').trim();
  if (!s) throw new Error('orderId/itemId é obrigatório.');
  return s.replace(/-\d+$/, '');
}

/** Normaliza: aceita orderId ("...DS2J") ou itemId ("...DS2J-1"). */
export function toItemId(orderIdOrItemId: string): string {
  const s = String(orderIdOrItemId || '').trim();
  if (!s) throw new Error('orderId/itemId é obrigatório.');
  return /-\d+$/.test(s) ? s : `${s}-1`;
}

export interface CancelReasonsResult {
  reportCase: string;
  reasons: string[];
  /** report_item_types vazio = cancel indisponível NESTE status (to_pay novo ou já cancelado). */
  alreadyCancelled: boolean;
  /** Status real do item/summary — é ele que decide se o report_case passa. */
  paymentStatus: string;
  cancellable: boolean;
  raw: any;
}

/** Lê o payment_status atual do pedido (fonte da verdade p/ decidir cancelar). */
export async function getOrderPaymentStatus(
  accessToken: string,
  orderIdOrItemId: string,
  buyerId: string,
): Promise<string> {
  const orderId = toOrderId(orderIdOrItemId);
  const raw = await slsFetch(
    `${G2G_SLS}/order/${encodeURIComponent(orderId)}/summary` +
      `?include_items=1&buyer_id=${encodeURIComponent(buyerId)}&include_ga_info=1`,
    { method: 'GET' },
    accessToken,
  );
  return String(raw?.payload?.payment_status || '');
}

export async function getCancelReasons(
  accessToken: string,
  orderIdOrItemId: string,
  buyerId: string,
): Promise<CancelReasonsResult> {
  const itemId = toItemId(orderIdOrItemId);
  const raw = await slsFetch(
    `${G2G_SLS}/order/item/${encodeURIComponent(itemId)}/report_reasons?buyer_id=${encodeURIComponent(buyerId)}`,
    { method: 'GET' },
    accessToken,
  );
  const types = raw?.payload?.report_item_types || [];
  const first = types[0];
  const reasons: string[] = Array.isArray(first?.report_reasons)
    ? first.report_reasons.map(String)
    : [];
  // A G2G só aceita report_case fora de to_pay (paid/pending). Confirma o status.
  let paymentStatus = '';
  try {
    paymentStatus = await getOrderPaymentStatus(accessToken, orderIdOrItemId, buyerId);
  } catch (_) {
    // status indisponível: reasons vazio já sinaliza
  }
  return {
    reportCase: String(first?.report_case || (types.length === 0 ? 'cancel' : '')),
    reasons,
    alreadyCancelled: types.length === 0,
    paymentStatus,
    cancellable: reasons.length > 0,
    raw,
  };
}

export interface CancelOrderResult {
  code: number;
  caseId: string;
  raw: any;
}

/**
 * Cancelamento FORÇADO de pedido to_pay (cancelamento-mapeado.har).
 * PUT /order/{orderId}/mark_as_cancel -> { buyer_id }
 * <- 200 { code: 2000, payload: { task_id } }
 */
export async function markAsCancel(
  accessToken: string,
  orderIdOrItemId: string,
  buyerId: string,
): Promise<{ code: number; taskId: string; raw: any }> {
  const orderId = toOrderId(orderIdOrItemId);
  const raw = await slsFetch(
    `${G2G_SLS}/order/${encodeURIComponent(orderId)}/mark_as_cancel`,
    {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ buyer_id: String(buyerId) }),
    },
    accessToken,
  );
  if (Number(raw?.code) !== 2000) {
    throw new Error(`mark_as_cancel recusado: ${JSON.stringify(raw).slice(0, 300)}`);
  }
  return { code: Number(raw.code), taskId: String(raw?.payload?.task_id || ''), raw };
}

export interface ForceCancelResult {
  via: 'mark_as_cancel' | 'report_case';
  paymentStatus: string;
  taskId?: string;
  caseId?: string;
  code: number;
}

/**
 * Cancelamento forçado: escolhe a rota pelo status real do pedido.
 * to_pay -> mark_as_cancel | pago/pending -> report_case.
 */
export async function forceCancelOrder(
  accessToken: string,
  orderIdOrItemId: string,
  buyerId: string,
  reason: CancelReason | string = 'abandoned',
  refundOption = 'pg',
): Promise<ForceCancelResult> {
  const status = await getOrderPaymentStatus(accessToken, orderIdOrItemId, buyerId).catch(() => '');
  if (!status || status === 'to_pay') {
    const r = await markAsCancel(accessToken, orderIdOrItemId, buyerId);
    return { via: 'mark_as_cancel', paymentStatus: status || 'to_pay', taskId: r.taskId, code: r.code };
  }
  const r = await cancelOrder(accessToken, orderIdOrItemId, buyerId, reason, refundOption);
  return { via: 'report_case', paymentStatus: status, caseId: r.caseId, code: r.code };
}

export interface OrderListItem {
  orderId: string;
  paymentStatus: string;
  total: any;
  currency: string;
  itemId: string;
  itemStatus: string;
  raw: any;
}

/** Lista pedidos por status (a página /g2g-user/purchase usa status=to_pay). */
export async function listMyOrders(
  accessToken: string,
  buyerId: string,
  status = 'to_pay',
): Promise<OrderListItem[]> {
  let raw: any;
  try {
    raw = await slsFetch(
      `${G2G_SLS}/order/list_my_order?buyer_id=${encodeURIComponent(buyerId)}` +
        `&status=${encodeURIComponent(status)}&include_pending_proof_only=0`,
      { method: 'GET' },
      accessToken,
    );
  } catch (err: any) {
    // 4041 "Data was not found: result" = zero pedidos nesse status.
    if (String(err.message || '').includes('"code": 4041')) return [];
    throw err;
  }
  const results = raw?.payload?.results || [];
  return results.map((o: any) => ({
    orderId: String(o.order_id || ''),
    paymentStatus: String(o.payment_status || ''),
    total: o.total ?? o.sub_total,
    currency: String(o.checkout_currency || ''),
    itemId: String(o.items?.[0]?.order_item_id || ''),
    itemStatus: String(o.items?.[0]?.order_item_status || ''),
    raw: o,
  }));
}

export async function countMyOrders(accessToken: string, buyerId: string): Promise<any> {
  const raw = await slsFetch(
    `${G2G_SLS}/order/count-my-orders?buyer_id=${encodeURIComponent(buyerId)}`,
    { method: 'GET' },
    accessToken,
  );
  return raw?.payload ?? raw;
}

export async function cancelOrder(
  accessToken: string,
  orderIdOrItemId: string,
  buyerId: string,
  reason: CancelReason | string = 'abandoned',
  refundOption = 'pg',
): Promise<CancelOrderResult> {
  const itemId = toItemId(orderIdOrItemId);
  const raw = await slsFetch(
    `${G2G_SLS}/order/item/${encodeURIComponent(itemId)}/report_case`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        buyer_id: String(buyerId),
        report_case: 'cancel',
        report_reason: String(reason),
        buyer_refund_option: String(refundOption),
      }),
    },
    accessToken,
  );
  if (Number(raw?.code) !== 2000) {
    throw new Error(`Cancelamento recusado: ${JSON.stringify(raw).slice(0, 300)}`);
  }
  return { code: Number(raw.code), caseId: String(raw?.payload?.case_id || ''), raw };
}

// ---------------------------------------------------------------------------
// Auto-cancel 10m (timer em memória, por processo)
// ---------------------------------------------------------------------------

export interface AutoCancelHandle {
  id: string;
  itemId: string;
  buyerId: string;
  reason: string;
  firesAt: string;
  createdAt: string;
}

const timers = new Map<string, { timeout: NodeJS.Timeout; handle: AutoCancelHandle }>();

export interface ScheduleAutoCancelInput {
  orderId?: string;
  itemId?: string;
  buyerId?: string;
  /** default 600_000 (10m). */
  delayMs?: number;
  /** default 'promised_txn_time_expired' (tempo de 10m estourado). */
  reason?: CancelReason | string;
  refundOption?: string;
  onCancel?: (result: CancelOrderResult, handle: AutoCancelHandle) => void;
  onError?: (err: Error, handle: AutoCancelHandle) => void;
  /** Chamado quando o pedido ainda está to_pay (sem pagamento) — nada a cancelar, expira sozinho. */
  onSkip?: (handle: AutoCancelHandle, paymentStatus: string) => void;
}

export async function scheduleAutoCancel(
  input: ScheduleAutoCancelInput,
): Promise<AutoCancelHandle> {
  const rawId = input.itemId || input.orderId || '';
  const itemId = toItemId(rawId);
  const delayMs =
    input.delayMs !== undefined && Number(input.delayMs) > 0
      ? Number(input.delayMs)
      : AUTO_CANCEL_DEFAULT_MS;
  const reason = String(input.reason || 'promised_txn_time_expired');
  const refundOption = String(input.refundOption || 'pg');

  // buyerId pode vir depois: resolve na hora de agendar ou na hora de disparar.
  let buyerId = String(input.buyerId || '');
  if (!buyerId) {
    const auth = await getG2GAccessToken();
    buyerId = auth.userId;
  }

  const id = `${itemId}@${Date.now()}`;
  const now = Date.now();
  const handle: AutoCancelHandle = {
    id,
    itemId,
    buyerId,
    reason,
    firesAt: new Date(now + delayMs).toISOString(),
    createdAt: new Date(now).toISOString(),
  };

  const timeout = setTimeout(async () => {
    timers.delete(id);
    try {
      const auth = await getG2GAccessToken();
      const effectiveBuyer = buyerId || auth.userId;
      // Forçado: to_pay -> mark_as_cancel | pago -> report_case.
      const forced = await forceCancelOrder(
        auth.accessToken,
        itemId,
        effectiveBuyer,
        reason,
        refundOption,
      );
      console.log(`⏰ [AUTO-CANCEL] ${itemId} cancelado após ${delayMs}ms via ${forced.via}`);
      input.onCancel?.(
        { code: forced.code, caseId: forced.caseId || forced.taskId || '', raw: forced },
        handle,
      );
    } catch (err: any) {
      console.error(`⏰ [AUTO-CANCEL] ${itemId} falhou:`, err.message);
      input.onError?.(err instanceof Error ? err : new Error(String(err)), handle);
    }
  }, delayMs);
  // Não segura o processo aberto só por causa do timer.
  (timeout as any).unref?.();

  timers.set(id, { timeout, handle });
  console.log(`⏰ [AUTO-CANCEL] ${itemId} agenda em ${delayMs}ms (${handle.firesAt}) motivo=${reason}`);
  return handle;
}

export function disarmAutoCancel(id: string): boolean {
  const entry = timers.get(id);
  if (!entry) return false;
  clearTimeout(entry.timeout);
  timers.delete(id);
  return true;
}

/** Desarma todos os timers de um item (ex quando o pagamento confirma). */
export function disarmAutoCancelForItem(orderIdOrItemId: string): number {
  const itemId = toItemId(orderIdOrItemId);
  let n = 0;
  for (const [id, entry] of timers) {
    if (entry.handle.itemId === itemId) {
      clearTimeout(entry.timeout);
      timers.delete(id);
      n++;
    }
  }
  return n;
}

export function listAutoCancels(): AutoCancelHandle[] {
  return [...timers.values()].map((e) => e.handle);
}

// ---------------------------------------------------------------------------
// Rotas do gateway
// ---------------------------------------------------------------------------

export const cancelRouter = Router();

/** GET /api/order/cancel-reasons?orderId=...&itemId=... */
cancelRouter.get('/order/cancel-reasons', async (req: Request, res: Response) => {
  try {
    const orderIdOrItemId = String(req.query.itemId || req.query.orderId || '');
    if (!orderIdOrItemId) {
      return res.status(400).json({ success: false, error: 'Informe ?orderId= ou ?itemId=.' });
    }
    const { accessToken, userId } = await getG2GAccessToken();
    const buyerId = String(req.query.buyerId || userId);
    const result = await getCancelReasons(accessToken, orderIdOrItemId, buyerId);
    return res.json({ success: true, itemId: toItemId(orderIdOrItemId), ...result, raw: undefined });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

/** POST /api/order/cancel { orderId?, itemId, reason?, refundOption?, buyerId? }
 *  Forçado: to_pay -> PUT mark_as_cancel | pago -> POST report_case. */
cancelRouter.post('/order/cancel', async (req: Request, res: Response) => {
  try {
    const { orderId, itemId, reason = 'abandoned', refundOption = 'pg', buyerId } = req.body || {};
    const target = String(itemId || orderId || '');
    if (!target) {
      return res.status(400).json({ success: false, error: 'Informe itemId (ou orderId).' });
    }
    const { accessToken, userId } = await getG2GAccessToken();
    const result = await forceCancelOrder(
      accessToken,
      target,
      String(buyerId || userId),
      String(reason),
      String(refundOption),
    );
    disarmAutoCancelForItem(target);
    return res.json({ success: true, itemId: toItemId(target), orderId: toOrderId(target), ...result });
  } catch (err: any) {
    console.error('❌ [CANCEL] falhou:', err.message);
    return res.status(500).json({ success: false, error: err.message });
  }
});

/** GET /api/orders?status=to_pay — espelho da página /g2g-user/purchase. */
cancelRouter.get('/orders', async (req: Request, res: Response) => {
  try {
    const { accessToken, userId } = await getG2GAccessToken();
    const buyerId = String(req.query.buyerId || userId);
    const status = String(req.query.status || 'to_pay');
    const orders = await listMyOrders(accessToken, buyerId, status);
    return res.json({
      success: true,
      status,
      count: orders.length,
      orders: orders.map((o) => ({
        orderId: o.orderId,
        itemId: o.itemId,
        paymentStatus: o.paymentStatus,
        itemStatus: o.itemStatus,
        total: o.total,
        currency: o.currency,
      })),
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

/** GET /api/orders/count — contadores por status. */
cancelRouter.get('/orders/count', async (_req: Request, res: Response) => {
  try {
    const { accessToken, userId } = await getG2GAccessToken();
    const counts = await countMyOrders(accessToken, userId);
    return res.json({ success: true, counts });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/order/auto-cancel { orderId?, itemId, delayMs?=600000, reason?, buyerId? }
 * Agenda o cancelamento automático (default 10m, motivo promised_txn_time_expired).
 */
cancelRouter.post('/order/auto-cancel', async (req: Request, res: Response) => {
  try {
    const { orderId, itemId, delayMs, reason, refundOption, buyerId } = req.body || {};
    const target = String(itemId || orderId || '');
    if (!target) {
      return res.status(400).json({ success: false, error: 'Informe itemId (ou orderId).' });
    }
    const handle = await scheduleAutoCancel({
      orderId,
      itemId,
      buyerId: buyerId ? String(buyerId) : undefined,
      delayMs: delayMs !== undefined ? Number(delayMs) : AUTO_CANCEL_DEFAULT_MS,
      reason: reason ? String(reason) : 'promised_txn_time_expired',
      refundOption: refundOption ? String(refundOption) : 'pg',
    });
    return res.json({ success: true, ...handle, delayMs: delayMs !== undefined ? Number(delayMs) : AUTO_CANCEL_DEFAULT_MS });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

/** GET /api/order/auto-cancel — lista timers pendentes. */
cancelRouter.get('/order/auto-cancel', (_req: Request, res: Response) => {
  return res.json({ success: true, pending: listAutoCancels() });
});

/** DELETE /api/order/auto-cancel/:id — desarma um timer (pagamento confirmou). */
cancelRouter.delete('/order/auto-cancel/:id', (req: Request, res: Response) => {
  const ok = disarmAutoCancel(String(req.params.id || ''));
  if (!ok) return res.status(404).json({ success: false, error: 'Timer não encontrado.' });
  return res.json({ success: true, disarmed: String(req.params.id) });
});
