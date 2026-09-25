import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import * as http from 'http';
import * as crypto from 'crypto';
import { findBestOffer } from './optimizer';
import {
  getG2GAccessToken,
  searchG2GOffers,
  validateG2GOffer,
  getProductSettings,
  collectDeliveryFields,
  buildBuyNowBody,
  postBuyNow,
  waitForOrder,
  getOrderSummary,
} from './g2g';
import { pixRouter, runPixFlow } from './routes/pix';
import { cardRouter, runCardFlow } from './routes/card';
import { cancelRouter, scheduleAutoCancel } from './cancel';

const app = express();
// B9: CORS restrito ao backend — chamadas são server-to-server (fetch com
// X-Gateway-Token), nunca de browser de terceiros. Antes `cors()` aberto
// permitia que qualquer site lesse BR Code / orderId das respostas.
const GATEWAY_ALLOWED_ORIGINS = (process.env.G2G_ALLOWED_ORIGINS || 'http://127.0.0.1:3030,http://localhost:3030')
    .split(',').map((o) => o.trim()).filter(Boolean);
app.use(cors({ origin: GATEWAY_ALLOWED_ORIGINS }));
app.use(express.json({ limit: '1mb' }));

// ── Auth das rotas /api (token compartilhado com o server-consorcio) ──
// SOMENTE header X-Gateway-Token. B9: removido o fallback `?token=` — token em
// query vaza em access.log, histórico e logs de proxy. /health (raiz) fica
// aberto p/ monitoramento.
// Sem G2G_API_TOKEN, aceita tudo (só em localhost/dev).
const G2G_API_TOKEN = process.env.G2G_API_TOKEN || '';
if (!G2G_API_TOKEN) {
    console.warn('⚠️ [G2G] G2G_API_TOKEN vazio — /api sem autenticação (só use em localhost).');
}
function gatewayAuth(req: Request, res: Response, next: NextFunction) {
    if (!G2G_API_TOKEN) return next();
    const h = req.headers['x-gateway-token'];
    const given = typeof h === 'string' ? h : '';
    const a = Buffer.from(given);
    const b = Buffer.from(G2G_API_TOKEN);
    if (a.length === b.length && a.length > 0 && crypto.timingSafeEqual(a, b)) return next();
    return res.status(401).json({ success: false, error: 'token inválido (X-Gateway-Token)' });
}
app.use('/api', gatewayAuth);

// Rotas fisicamente separadas: PIX (8b–11), Cartão (airwallex/3DS) e Cancel (HAR).
app.use('/api', pixRouter);
app.use('/api', cardRouter);
app.use('/api', cancelRouter);

const PORT = process.env.PORT || 3001;
const server = http.createServer(app);

app.get('/health', (_req: Request, res: Response) => {
    res.json({ status: 'online', service: 'g2g-optimizer', timestamp: new Date().toISOString() });
});

/**
 * POST /api/optimize-g2g
 * Body: { budget=3500, seoTerm='wow-gold', currency='BRL', country='BR', minRating=0, verifiedOnly=false, allowOverspend=false, validateTop=3 }
 * Requer cookies.json da G2G (export do navegador) na raiz do projeto.
 */
app.post('/api/optimize-g2g', async (req: Request, res: Response) => {
    const {
        budget = 3500,
        seoTerm = 'wow-gold',
        currency = 'BRL',
        country = 'BR',
        minRating = 0,
        verifiedOnly = false,
        allowOverspend = false,
        validateTop = 3
    } = req.body || {};

    const numBudget = Number(budget);
    if (!numBudget || isNaN(numBudget) || numBudget <= 0) {
        return res.status(400).json({ success: false, error: 'Orçamento inválido. Ex: {"budget": 3500, "seoTerm": "wow-gold"}' });
    }

    try {
        console.log(`\n📥 [G2G] R$ ${numBudget.toFixed(2)} | ${seoTerm} ${currency}/${country}`);
        const { accessToken, userId } = await getG2GAccessToken();
        const rawOffers = await searchG2GOffers(accessToken, String(seoTerm), String(currency), String(country));
        console.log(`✔ [G2G] ${rawOffers.length} ofertas (userId=${userId})`);

        if (rawOffers.length === 0) {
            return res.status(404).json({ success: false, error: `Nenhuma oferta para seoTerm=${seoTerm}` });
        }

        const { best, all } = findBestOffer(rawOffers, numBudget, Number(minRating) || 0, Boolean(verifiedOnly), Boolean(allowOverspend), 0, 0);
        if (!best) {
            return res.status(404).json({ success: false, error: 'Nenhuma oferta atendeu minQty/estoque.', totalOffersAnalyzed: rawOffers.length });
        }

        const topN = all.filter(r => r.isValid).slice(0, Math.max(1, Math.min(5, Number(validateTop) || 3)));
        for (const cand of topN) {
            try {
                const v = await validateG2GOffer(accessToken, userId, cand.offer as any);
                cand.offer.inStock = v.availableQty;
            } catch (e: any) {
                console.warn(`⚠️ [G2G] validar ${cand.offer.sellerName}: ${e.message}`);
            }
        }

        const g: any = best.offer;
        console.log(`🏆 [G2G] ${g.sellerName} ${g.offerId} ${best.unitsToBuy}un = R$${best.totalCost.toFixed(2)}`);

        return res.json({
            success: true,
            source: 'G2G sls API (sem browser)',
            targetBudget: numBudget,
            seoTerm, currency, country,
            feePercent: 0,
            fixedFee: 0,
            bestSeller: {
                sellerName: g.sellerName,
                sellerId: g.sellerId,
                offerId: g.offerId,
                relationId: g.relationId,
                isVerified: best.offer.isVerified,
                ratingPercent: best.offer.ratingPercent,
                reviewCount: best.offer.reviewCount,
                deliveryTime: best.offer.deliveryTime,
                pricePerUnit: best.offer.pricePerUnit,
                inStock: best.offer.inStock,
                minQty: best.offer.minQty,
                unitsToBuy: best.unitsToBuy,
                itemSubtotal: best.itemSubtotal,
                feeAmount: best.feeAmount,
                totalCostWithFee: best.totalCost,
                difference: best.difference,
                precisionPercent: best.precisionPercent
            },
            totalOffersAnalyzed: rawOffers.length,
            ranking: all.filter(r => r.isValid).slice(0, 5).map((r, i) => {
                const o: any = r.offer;
                return { rank: i + 1, sellerName: o.sellerName, offerId: o.offerId, pricePerUnit: o.pricePerUnit, unitsToBuy: r.unitsToBuy, totalCostWithFee: r.totalCost, precisionPercent: r.precisionPercent };
            })
        });
    } catch (err: any) {
        console.error('❌ [G2G] Erro:', err.message);
        return res.status(500).json({ success: false, error: 'Falha no optimize-g2g: ' + err.message });
    }
});

/**
 * POST /api/buy-g2g — FLUXO COMPLETO até a criação do pedido (passos 1-8).
 * ATENÇÃO: cria um pedido REAL com status `to_pay` (expira em ~2h via
 * auto_cancel_at). NÃO executa pagamento; o pagamento acontece no
 * redirect_url (pipwave) fora desta API.
 *
 * Body: {
 *   offerId?: string,            // se omitido, escolhe o melhor por budget
 *   budget?: number,             // default 3500 (ignorado se quantity vier)
 *   quantity?: number,           // unidades na métrica da oferta (ex K Gold)
 *   characterName: string,       // OBRIGATÓRIO: 'World Of Warcraft - Character Name'
 *   deliveryMethodCode?: string, // default 'mail'
 *   deliveryValuesByCollection?: Record<string,string>,
 *   seoTerm?: string, currency?: string, country?: string,
 *   wsTimeoutMs?: number         // default 30000
 * }
 */
app.post('/api/buy-g2g', async (req: Request, res: Response) => {
    const {
        offerId,
        budget = 3500,
        quantity,
        characterName,
        deliveryMethodCode = 'mail',
        deliveryValuesByCollection,
        seoTerm = 'wow-gold',
        currency = 'BRL',
        country = 'BR',
        wsTimeoutMs = 30000,
    } = req.body || {};

    if (!characterName || typeof characterName !== 'string') {
        return res.status(400).json({ success: false, error: 'characterName é obrigatório (nome do personagem p/ entrega).' });
    }

    try {
        const { accessToken, userId } = await getG2GAccessToken();
        const rawOffers = await searchG2GOffers(accessToken, String(seoTerm), String(currency), String(country));
        if (rawOffers.length === 0) {
            return res.status(404).json({ success: false, error: `Nenhuma oferta para seoTerm=${seoTerm}` });
        }

        let picked: any;
        if (offerId) {
            picked = rawOffers.find((o: any) => o.offerId === String(offerId));
            if (!picked) return res.status(404).json({ success: false, error: `offerId ${offerId} fora da busca atual.` });
        } else {
            const { best } = findBestOffer(rawOffers, Number(budget) || 3500, 0, false, false, 0, 0);
            if (!best) return res.status(404).json({ success: false, error: 'Nenhuma oferta atendeu minQty/estoque.' });
            picked = best.offer;
        }

        const v = await validateG2GOffer(accessToken, userId, picked);
        const price = v.convertedUnitPrice || picked.pricePerUnit;
        let qty = quantity !== undefined ? Number(quantity) : Math.floor((Number(budget) || 3500) / price);
        if (!qty || isNaN(qty) || qty <= 0) {
            return res.status(400).json({ success: false, error: 'Quantidade inválida.' });
        }
        if (qty < v.minQty) {
            return res.status(400).json({ success: false, error: `Quantidade ${qty} abaixo do mínimo ${v.minQty}.` });
        }
        if (qty > v.availableQty) qty = v.availableQty;

        const method = v.deliveryMethods.find((m) => m.code === String(deliveryMethodCode))
            || v.deliveryMethods[0];
        if (!method) return res.status(400).json({ success: false, error: 'Oferta sem delivery methods.' });

        const settings = await getProductSettings(accessToken, v.serviceId, v.brandId);
        const fields = collectDeliveryFields(settings, method.id);
        const byLabel: Record<string, string> = {};
        if (fields.length > 0 && !deliveryValuesByCollection) {
            byLabel[fields[0].label] = String(characterName);
        }

        const body = buildBuyNowBody({
            userId, offerId: picked.offerId, sellerId: v.sellerId,
            quantity: qty, unitPrice: v.unitPrice, offerCurrency: v.offerCurrency,
            currency: String(currency), deliveryMethodId: method.id,
            deliveryFields: fields, deliveryValuesByLabel: byLabel,
            deliveryValuesByCollection,
        });

        const { authToken } = await postBuyNow(accessToken, body);
        console.log(`⏳ [G2G] buy-now ok, aguardando order via WS...`);
        const order = await waitForOrder(authToken, Number(wsTimeoutMs) || 30000);
        const summary = await getOrderSummary(accessToken, order.orderId, userId);
        const mask = (s: string) => (s && s.length > 8 ? `${s.slice(0, 4)}...${s.slice(-4)}` : s);
        console.log(`🧾 [G2G] order=${order.orderId} total=${summary.total} ${summary.checkoutCurrency} status=${summary.paymentStatus} token=${mask(order.pipwaveToken)}`);

        // Auto-cancel 10m do gateway (src/cancel.ts). Não falha a compra se não agendar.
        try {
            await scheduleAutoCancel({ orderId: order.orderId, buyerId: userId });
        } catch (e: any) {
            console.warn('[G2G] auto-cancel não agendado:', e.message);
        }

        return res.json({
            success: true,
            orderId: order.orderId,
            paymentStatus: summary.paymentStatus,
            total: summary.total,
            checkoutCurrency: summary.checkoutCurrency,
            subTotal: summary.subTotal,
            purchasedQty: summary.purchasedQty,
            autoCancelAt: summary.autoCancelAt,
            sellerId: summary.sellerId,
            offerId: picked.offerId,
            quantity: qty,
            unitPrice: v.unitPrice,
            pipwaveToken: order.pipwaveToken,
            pipwaveApiKey: order.pipwaveApiKey,
            redirectUrl: order.redirectUrl,
            wsCode: order.code,
        });
    } catch (err: any) {
        console.error('❌ [G2G] buy falhou:', err.message);
        return res.status(500).json({ success: false, error: 'Falha no buy-g2g: ' + err.message });
    }
});

/**
 * POST /api/pay/pix-direct — PIX direto por VALOR (usado pelo server-consorcio).
 * Body: { amount (BRL), cpf (11 dígitos), characterName?, seoTerm?='wow-gold',
 *         currency?='BRL', country?='BR', wsTimeoutMs?=30000 }
 * Roda o fluxo completo (passos 1–8 + 8b–11) e devolve o BR Code copia-e-cola.
 * ⚠️ Cria um pedido REAL `to_pay` (expira sozinho em ~2h).
 */
app.post('/api/pay/pix-direct', async (req: Request, res: Response) => {
    const {
        amount,
        cpf,
        characterName,
        seoTerm = 'wow-gold',
        currency = 'BRL',
        country = 'BR',
        wsTimeoutMs = 30000,
    } = req.body || {};

    const numAmount = Number(amount);
    if (!numAmount || isNaN(numAmount) || numAmount <= 0) {
        return res.status(400).json({ success: false, error: 'amount inválido (BRL).' });
    }
    const cleanCpf = String(cpf || '').replace(/\D/g, '');
    if (cleanCpf.length !== 11) {
        return res.status(400).json({ success: false, error: 'cpf precisa ter 11 dígitos.' });
    }
    const charName = String(characterName || process.env.G2G_CHARACTER_NAME || '');
    if (!charName) {
        return res.status(400).json({ success: false, error: 'characterName ausente (nome do personagem p/ entrega).' });
    }

    try {
        const { accessToken, userId } = await getG2GAccessToken();
        const rawOffers = await searchG2GOffers(accessToken, String(seoTerm), String(currency), String(country));
        if (rawOffers.length === 0) {
            return res.status(404).json({ success: false, error: `Nenhuma oferta para seoTerm=${seoTerm}` });
        }
        const { best } = findBestOffer(rawOffers, numAmount, 0, false, false, 0, 0);
        if (!best) {
            return res.status(404).json({ success: false, error: 'Nenhuma oferta atendeu minQty/estoque para este valor.' });
        }
        const picked: any = best.offer;

        const v = await validateG2GOffer(accessToken, userId, picked);
        const unitPrice = v.convertedUnitPrice || picked.pricePerUnit;
        let qty = Math.floor(numAmount / unitPrice);
        if (!qty || isNaN(qty) || qty <= 0) {
            return res.status(400).json({ success: false, error: 'Valor baixo demais para a quantidade mínima.' });
        }
        if (qty < v.minQty) {
            return res.status(400).json({ success: false, error: `Quantidade ${qty} abaixo do mínimo ${v.minQty}.` });
        }
        if (qty > v.availableQty) qty = v.availableQty;

        const method = v.deliveryMethods.find((m) => m.code === 'mail') || v.deliveryMethods[0];
        if (!method) return res.status(400).json({ success: false, error: 'Oferta sem delivery methods.' });

        const settings = await getProductSettings(accessToken, v.serviceId, v.brandId);
        const fields = collectDeliveryFields(settings, method.id);
        const byLabel: Record<string, string> = {};
        if (fields.length > 0) byLabel[fields[0].label] = charName;

        const body = buildBuyNowBody({
            userId, offerId: picked.offerId, sellerId: v.sellerId,
            quantity: qty, unitPrice: v.unitPrice, offerCurrency: v.offerCurrency,
            currency: String(currency), deliveryMethodId: method.id,
            deliveryFields: fields, deliveryValuesByLabel: byLabel,
        });

        const { authToken } = await postBuyNow(accessToken, body);
        const order = await waitForOrder(authToken, Number(wsTimeoutMs) || 30000);
        const summary = await getOrderSummary(accessToken, order.orderId, userId);

        try {
            await scheduleAutoCancel({ orderId: order.orderId, buyerId: userId });
        } catch (e: any) {
            console.warn('[G2G] auto-cancel não agendado:', e.message);
        }

        const pix = await runPixFlow({
            pipwaveToken: order.pipwaveToken,
            pipwaveApiKey: order.pipwaveApiKey,
            orderId: order.orderId,
            total: summary.total,
            currency: summary.checkoutCurrency,
            cpf: cleanCpf,
        });

        return res.json({
            success: true,
            brCode: pix.brCode,
            checkoutUrl: pix.checkoutUrl,
            orderId: order.orderId,
            total: summary.total,
            currency: summary.checkoutCurrency,
            pixExpiryDate: pix.pixExpiryDate,
            paymentAttemptId: pix.paymentAttemptId,
            pspReferenceId: pix.pspReferenceId,
        });
    } catch (err: any) {
        console.error('❌ [G2G] pix-direct falhou:', err.message);
        return res.status(500).json({ success: false, error: 'Falha no pix-direct: ' + err.message });
    }
});

/**
 * GET /api/optimize-g2g/live — mesmo fluxo de cotação (passos 1-5 + ranking),
 * mas transmitido em tempo real via Server-Sent Events para demonstração.
 * Somente leitura: NÃO cria pedido. Ex: /api/optimize-g2g/live?budget=3500
 * Eventos: {type:'start'} {type:'step',step,name,status,ms,data} {type:'done',...} {type:'error',error}
 */
app.get('/api/optimize-g2g/live', async (req: Request, res: Response) => {
    const budget = Number(req.query.budget) || 3500;
    const seoTerm = String(req.query.seoTerm || 'wow-gold');
    const currency = String(req.query.currency || 'BRL');
    const country = String(req.query.country || 'BR');

    res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-transform',
        Connection: 'keep-alive',
        // B9: SSE atrás do mesmo gatewayAuth; origem restrita (antes `*`).
        'Access-Control-Allow-Origin': GATEWAY_ALLOWED_ORIGINS[0] || 'http://127.0.0.1:3030',
    });
    const send = (event: any) => res.write(`data: ${JSON.stringify(event)}\n\n`);
    const t0 = Date.now();

    try {
        send({ type: 'start', budget, seoTerm, currency, country });

        let t = Date.now();
        const { accessToken, userId } = await getG2GAccessToken();
        send({ type: 'step', step: 1, name: 'authenticate-user', status: 'ok', ms: Date.now() - t, data: { userId } });

        t = Date.now();
        const rawOffers = await searchG2GOffers(accessToken, seoTerm, currency, country);
        send({ type: 'step', step: 2, name: 'offer-search', status: 'ok', ms: Date.now() - t, data: { ofertas: rawOffers.length } });

        const { best, all } = findBestOffer(rawOffers, budget, 0, false, false, 0, 0);
        if (!best) {
            send({ type: 'error', error: 'Nenhuma oferta atendeu minQty/estoque.' });
            res.end();
            return;
        }
        const g: any = best.offer;
        send({
            type: 'step', step: 'rank', name: 'ranking-por-unidade', status: 'ok', ms: 0,
            data: { vencedor: g.sellerName, offerId: g.offerId, units: best.unitsToBuy, totalEstimado: best.totalCost },
        });

        t = Date.now();
        const v = await validateG2GOffer(accessToken, userId, g);
        send({
            type: 'step', step: 3, name: 'offer-detail + checkout-histories', status: 'ok', ms: Date.now() - t,
            data: { estoque: v.availableQty, unitPrice: v.unitPrice, offerCurrency: v.offerCurrency, histories: '[] (pode comprar)' },
        });

        t = Date.now();
        try {
            const settings = await getProductSettings(accessToken, v.serviceId, v.brandId);
            const method = v.deliveryMethods.find((m) => m.code === 'mail') || v.deliveryMethods[0];
            const fields = collectDeliveryFields(settings, method?.id);
            send({
                type: 'step', step: '4b', name: 'product-settings', status: 'ok', ms: Date.now() - t,
                data: { deliveryMethod: method?.code, campos: fields.map((f) => f.label || f.collection_id) },
            });
        } catch (e: any) {
            send({ type: 'step', step: '4b', name: 'product-settings', status: 'warn', ms: Date.now() - t, data: { aviso: e.message } });
        }

        send({
            type: 'done', totalMs: Date.now() - t0,
            best: {
                sellerName: g.sellerName, offerId: g.offerId, pricePerUnit: price(g),
                unitsToBuy: best.unitsToBuy, totalCost: best.totalCost,
                inStock: v.availableQty, minQty: v.minQty,
            },
            ranking: all.filter((r) => r.isValid).slice(0, 3).map((r, i) => {
                const o: any = r.offer;
                return { rank: i + 1, seller: o.sellerName, units: r.unitsToBuy, total: r.totalCost };
            }),
        });
        res.end();
    } catch (err: any) {
        send({ type: 'error', error: String(err.message || err) });
        res.end();
    }

    function price(o: any): number {
        return Number(o.pricePerUnit);
    }
});

/**
 * GET /api/buy-g2g/live — FLUXO COMPLETO ao vivo via SSE, incluindo os passos
 * 6 (buy-now), 7 (ws) e 8 (summary). ⚠️ CRIA UM PEDIDO REAL `to_pay`
 * (expira em ~2h, sem executar pagamento).
 * Query: characterName (obrigatório), quantity?, offerId?, budget?=3500,
 * deliveryMethodCode?=mail, seoTerm?, currency?, country?, wsTimeoutMs?
 */
app.get('/api/buy-g2g/live', async (req: Request, res: Response) => {
    const characterName = String(req.query.characterName || '');
    const offerId = req.query.offerId ? String(req.query.offerId) : undefined;
    const budget = Number(req.query.budget) || 3500;
    const quantity = req.query.quantity !== undefined && req.query.quantity !== '' ? Number(req.query.quantity) : undefined;
    const deliveryMethodCode = String(req.query.deliveryMethodCode || 'mail');
    const seoTerm = String(req.query.seoTerm || 'wow-gold');
    const currency = String(req.query.currency || 'BRL');
    const country = String(req.query.country || 'BR');
    const wsTimeoutMs = Number(req.query.wsTimeoutMs) || 30000;

    const paymentMethod = String(req.query.paymentMethod || req.query.payMethod || 'pix').trim().toLowerCase();
    // B9/LGPD: sem CPF default hardcoded (antes caía um CPF real de homologação
    // no fluxo de produção). Quem chama informa o CPF do cliente.
    const cpf = String(req.query.cpf || '').replace(/\D/g, '').trim();
    if (cpf.length !== 11) {
        return res.status(400).json({ success: false, error: 'cpf do cliente (11 dígitos) é obrigatório.' });
    }

    res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-transform',
        Connection: 'keep-alive',
        // B9: origem restrita (antes `*`).
        'Access-Control-Allow-Origin': GATEWAY_ALLOWED_ORIGINS[0] || 'http://127.0.0.1:3030',
    });
    const send = (event: any) => res.write(`data: ${JSON.stringify(event)}\n\n`);
    const mask = (s: string) => (s && s.length > 8 ? `${s.slice(0, 4)}...${s.slice(-4)}` : s);
    const t0 = Date.now();

    try {
        if (!characterName) {
            send({ type: 'error', error: 'characterName é obrigatório.' });
            res.end();
            return;
        }
        send({ type: 'start', modo: 'compra-real', aviso: 'cria pedido to_pay e avança para o checkout PIX', budget, seoTerm, paymentMethod });

        let t = Date.now();
        const { accessToken, userId } = await getG2GAccessToken();
        send({ type: 'step', step: 1, name: 'authenticate-user', status: 'ok', ms: Date.now() - t, data: { userId } });

        t = Date.now();
        const rawOffers = await searchG2GOffers(accessToken, seoTerm, currency, country);
        send({ type: 'step', step: 2, name: 'offer-search', status: 'ok', ms: Date.now() - t, data: { ofertas: rawOffers.length } });

        let picked: any;
        if (offerId) {
            picked = rawOffers.find((o: any) => o.offerId === String(offerId));
            if (!picked) {
                send({ type: 'error', error: `offerId ${offerId} fora da busca atual.` });
                res.end();
                return;
            }
        } else {
            let evalBudget = budget;
            if (quantity && (!evalBudget || evalBudget < 50)) {
                evalBudget = Math.max(evalBudget, Number(quantity) * 0.35);
            }
            const { best } = findBestOffer(rawOffers, evalBudget, 0, false, false, 0, 0);
            if (!best) {
                send({ type: 'error', error: 'Nenhuma oferta atendeu minQty/estoque.' });
                res.end();
                return;
            }
            picked = best.offer;
        }

        t = Date.now();
        const v = await validateG2GOffer(accessToken, userId, picked);
        let qty = quantity !== undefined ? quantity : Math.floor(budget / (v.convertedUnitPrice || picked.pricePerUnit));
        if (!qty || isNaN(qty) || qty <= 0) {
            send({ type: 'error', error: 'Quantidade inválida.' });
            res.end();
            return;
        }
        if (qty < v.minQty) {
            send({ type: 'error', error: `Quantidade ${qty} abaixo do mínimo ${v.minQty}.` });
            res.end();
            return;
        }
        if (qty > v.availableQty) qty = v.availableQty;
        const estimado = Number((qty * (v.convertedUnitPrice || picked.pricePerUnit)).toFixed(2));
        send({
            type: 'step', step: 3, name: 'offer-detail + checkout-histories', status: 'ok', ms: Date.now() - t,
            data: { offerId: picked.offerId, qty, unitPrice: v.unitPrice, estimado },
        });

        t = Date.now();
        const method = v.deliveryMethods.find((m) => m.code === String(deliveryMethodCode)) || v.deliveryMethods[0];
        if (!method) {
            send({ type: 'error', error: 'Oferta sem delivery methods.' });
            res.end();
            return;
        }
        const settings = await getProductSettings(accessToken, v.serviceId, v.brandId);
        const fields = collectDeliveryFields(settings, method.id);
        const byLabel: Record<string, string> = {};
        if (fields.length > 0) byLabel[fields[0].label] = characterName;
        send({
            type: 'step', step: '4b', name: 'product-settings', status: 'ok', ms: Date.now() - t,
            data: { deliveryMethod: method.code, personagem: characterName },
        });

        t = Date.now();
        const body = buildBuyNowBody({
            userId, offerId: picked.offerId, sellerId: v.sellerId,
            quantity: qty, unitPrice: v.unitPrice, offerCurrency: v.offerCurrency,
            currency, deliveryMethodId: method.id,
            deliveryFields: fields, deliveryValuesByLabel: byLabel,
        });
        const { authToken } = await postBuyNow(accessToken, body);
        send({ type: 'step', step: 6, name: 'buy-now', status: 'ok', ms: Date.now() - t, data: { authToken: mask(authToken) } });

        t = Date.now();
        const order = await waitForOrder(authToken, wsTimeoutMs);
        send({
            type: 'step', step: 7, name: 'websocket-order', status: 'ok', ms: Date.now() - t,
            data: { orderId: order.orderId, code: order.code },
        });

        t = Date.now();
        const summary = await getOrderSummary(accessToken, order.orderId, userId);
        send({
            type: 'step', step: 8, name: 'order-summary (TOTAL REAL)', status: 'ok', ms: Date.now() - t,
            data: {
                orderId: summary.orderId, total: summary.total, currency: summary.checkoutCurrency,
                paymentStatus: summary.paymentStatus, purchasedQty: summary.purchasedQty,
                autoCancelAt: summary.autoCancelAt,
            },
        });

        let checkoutUrl = order.redirectUrl;
        let pixCopiaECola = '';
        let pixExpiryDate = '';

        // Rota PIX fisicamente separada (src/routes/pix.ts, passos 8b–11).
        if (paymentMethod === 'pix' || paymentMethod === 'tazapay') {
            t = Date.now();
            try {
                const pix = await runPixFlow(
                    {
                        pipwaveToken: order.pipwaveToken,
                        pipwaveApiKey: order.pipwaveApiKey,
                        orderId: order.orderId,
                        total: summary.total,
                        currency: summary.checkoutCurrency,
                        cpf,
                    },
                    (step, data) => send({ type: 'step', step, name: step, status: 'ok', ms: 0, data }),
                );
                checkoutUrl = pix.checkoutUrl || checkoutUrl;
                pixCopiaECola = pix.brCode || '';
                pixExpiryDate = pix.pixExpiryDate || '';
                send({ type: 'step', step: 'pix', name: 'pix-fluxo-completo (8b–11)', status: 'ok', ms: Date.now() - t, data: { checkoutUrl } });
            } catch (payErr: any) {
                console.error('[G2G] Erro no fluxo Pix/Pipwave:', payErr.message);
                send({
                    type: 'step', step: '8b-warn', name: 'pipwave-pix-warning', status: 'warn', ms: Date.now() - t,
                    data: { aviso: 'Falha na transição automática do gateway', erro: payErr.message, fallbackUrl: order.redirectUrl },
                });
            }
        }

        // Rota CARTÃO fisicamente separada (src/routes/card.ts, airwallex + 3DS).
        if (paymentMethod === 'card' || paymentMethod === 'cartao' || paymentMethod === 'visa' || paymentMethod === 'mastercard') {
            t = Date.now();
            try {
                const brand = paymentMethod === 'visa' ? 'visa' : 'mastercard';
                const card = await runCardFlow(
                    {
                        pipwaveToken: order.pipwaveToken,
                        pipwaveApiKey: order.pipwaveApiKey,
                        orderId: order.orderId,
                        brand,
                        total: summary.total,
                        currency: summary.checkoutCurrency,
                    },
                    (step, data) => send({ type: 'step', step, name: step, status: 'ok', ms: 0, data }),
                );
                checkoutUrl = card.redirectUrl || checkoutUrl;
                send({
                    type: 'step', step: 'card', name: 'card-ate-3ds', status: 'ok', ms: Date.now() - t,
                    data: { brand: card.brand, methodCode: card.methodCode, challenge: card.challenge ? 'presente (3DS)' : null, next: card.next },
                });
            } catch (payErr: any) {
                console.error('[G2G] Erro no fluxo Cartão/Airwallex:', payErr.message);
                send({
                    type: 'step', step: '8b-warn', name: 'airwallex-card-warning', status: 'warn', ms: Date.now() - t,
                    data: { aviso: 'Falha na transição automática do gateway (cartão)', erro: payErr.message, fallbackUrl: order.redirectUrl },
                });
            }
        }

        // Ensina o gateway a cancelar sozinho se passar 10m sem confirmação
        // (src/cancel.ts — reproduzido de cancelando-compra.har).
        try {
            await scheduleAutoCancel({ orderId: order.orderId, buyerId: userId });
        } catch (e: any) {
            console.warn('[G2G] auto-cancel não agendado:', e.message);
        }

        send({
            type: 'done', totalMs: Date.now() - t0,
            estimado, real: summary.total, currency: summary.checkoutCurrency,
            paymentStatus: summary.paymentStatus, orderId: summary.orderId,
            pipwaveToken: mask(order.pipwaveToken), redirectUrl: order.redirectUrl,
            checkoutUrl: checkoutUrl,
            pixCopiaECola: pixCopiaECola,
            pixExpiryDate: pixExpiryDate,
            paymentMethod: paymentMethod || 'pix',
        });
        res.end();
    } catch (err: any) {
        send({ type: 'error', error: String(err.message || err) });
        res.end();
    }
});

server.listen(PORT, () => {    console.log(`
================================================================================
🚀 G2G Optimizer Online
📡 API: http://localhost:${PORT}
   • GET  /health
   • POST /api/optimize-g2g  {"budget":3500,"seoTerm":"wow-gold"}
   • POST /api/pay/pix   {pipwaveToken,pipwaveApiKey,orderId,cpf?}      (8b–11)
   • POST /api/pay/card  {pipwaveToken,pipwaveApiKey,orderId,brand?}    (airwallex/3DS)
   • GET  /api/order/cancel-reasons?orderId=
   • POST /api/order/cancel          {itemId|orderId,reason?,refundOption?}
   • POST /api/order/auto-cancel     {itemId|orderId,delayMs?=600000}   (10m)
   • GET  /api/order/auto-cancel     (timers pendentes)
   • DELETE /api/order/auto-cancel/:id  (desarma — pagamento confirmou)
   Requer ./cookies.json com os cookies da G2G (mesmo formato do export).
================================================================================
    `);
});
