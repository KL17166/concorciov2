import { prisma } from '../../config/database';
import { logger } from '../../config/logger';
import { parseBidExternalId } from '../bids/generateBidPix';

export interface ProcessBidWebhookInput {
    provider: 'pixgo' | 'sigilopay';
    /** external_id recebido da gateway — formato `bid-<uuid>`. */
    bidExternalId: string;
    paidAmount?: number;
    eventSignature: string;
    providerEventId?: string;
    rawPayload: any;
}

export interface ProcessBidWebhookResult {
    success: boolean;
    alreadyProcessed?: boolean;
    message: string;
    statusCode: number;
}

/**
 * Liquidação de PIX de lance (B5).
 * Antes: o webhook procurava `installment.id = 'bid-<uuid>'` → 404 sempre,
 * então o dinheiro entrava e nenhuma baixa existia. Agora o pagamento é
 * registrado em `bid_payments` e vinculado ao lance.
 */
export async function processBidPaymentWebhook(input: ProcessBidWebhookInput): Promise<ProcessBidWebhookResult> {
    const { provider, bidExternalId: externalId, paidAmount, eventSignature, providerEventId, rawPayload } = input;

    // 1. Idempotência (mesmo log compartilhado dos webhooks de parcela)
    const existingLog = await prisma.webhookLog.findUnique({ where: { signature: eventSignature } });
    if (existingLog && existingLog.status === 'PROCESSED') {
        return { success: true, alreadyProcessed: true, message: 'Webhook já processado anteriormente.', statusCode: 200 };
    }

    // 2. Resolve o lance
    const bidId = parseBidExternalId(externalId);
    if (!bidId) {
        return { success: false, message: 'Referência de lance inválida.', statusCode: 400 };
    }
    const bid = await prisma.bid.findUnique({
        where: { id: bidId },
        include: { subscription: { select: { id: true, userId: true, status: true } } }
    });
    if (!bid) {
        logger.error(`[Webhook:bid] Bid ${bidId} not found for ${provider}`);
        return { success: false, message: 'Lance informado no webhook não encontrado.', statusCode: 404 };
    }

    // 3. Localiza o voucher (o mais recente ACTIVE do lance)
    const payment = await prisma.bidPayment.findFirst({
        where: { bidId, status: 'ACTIVE' },
        orderBy: { createdAt: 'desc' }
    });
    if (!payment) {
        const paid = await prisma.bidPayment.findFirst({
            where: { bidId, status: 'PAID' },
            orderBy: { createdAt: 'desc' }
        });
        if (paid) {
            await recordBidWebhookLog(eventSignature, provider, providerEventId, rawPayload);
            return { success: true, alreadyProcessed: true, message: 'Lance já liquidado.', statusCode: 200 };
        }
        logger.error(`[Webhook:bid] No ACTIVE payment for bid ${bidId} (${provider})`);
        return { success: false, message: 'Nenhuma cobrança ativa para este lance.', statusCode: 404 };
    }

    // 4. Validação de valor (simétrica: rejeita pago a menor E a maior)
    if (typeof paidAmount === 'number' && paidAmount > 0) {
        const expected = Number(payment.amount);
        if (paidAmount < expected * 0.95 || paidAmount > expected * 1.05) {
            logger.error(`[Webhook:bid] Paid amount R$ ${paidAmount} diverges from bid payment R$ ${expected} (bid ${bidId})`);
            return { success: false, message: 'Valor pago divergente do valor do lance.', statusCode: 400 };
        }
    }

    // 5. Voucher vencido → não liquida (cliente deve gerar outro)
    if (payment.expiresAt && payment.expiresAt.getTime() < Date.now()) {
        await prisma.bidPayment.update({ where: { id: payment.id }, data: { status: 'EXPIRED' } });
        return { success: false, message: 'Cobrança do lance expirada. Gere um novo PIX.', statusCode: 410 };
    }

    // 6. Liquida atomicamente
    const result = await prisma.$transaction(async (tx) => {
        const current = await tx.bidPayment.findUnique({ where: { id: payment.id } });
        if (!current || current.status !== 'ACTIVE') {
            return { ok: false as const, message: 'Cobrança já processada.' };
        }
        await tx.bidPayment.update({
            where: { id: payment.id },
            data: { status: 'PAID', paidAt: new Date() }
        });
        // Invalida demais vouchers pendentes do mesmo lance (só vale o que pagou)
        await tx.bidPayment.updateMany({
            where: { bidId, status: 'ACTIVE', id: { not: payment.id } },
            data: { status: 'EXPIRED' }
        });
        await tx.auditLog.create({
            data: {
                userId: bid.subscription.userId,
                action: 'BID_PAYMENT_CONFIRMED',
                resource: 'bid_payment',
                details: JSON.stringify({
                    bidId, bidPaymentId: payment.id, provider,
                    amount: Number(payment.amount), providerEventId: providerEventId ?? null
                })
            }
        });
        return { ok: true as const };
    }, { isolationLevel: 'Serializable', timeout: 10000 });

    if (!result.ok) {
        return { success: true, alreadyProcessed: true, message: result.message, statusCode: 200 };
    }

    // 7. Lance/contrato cancelado após o pagamento → alerta p/ tratar o valor
    // (dinheiro real entrou: estornar ou reaproveitar, nunca ignorar).
    if (bid.status === 'CANCELLED' || bid.subscription.status === 'CANCELLED') {
        await (prisma as any).systemAlert.create({
            data: {
                type: 'BID_ORPHAN_PAYMENT',
                severity: 'CRITICAL',
                title: 'PIX de lance cancelado recebido',
                message: `Lance ${bidId} (contrato ${bid.subscription.id}) recebeu R$ ${Number(payment.amount).toFixed(2)} via ${provider} após cancelamento. Contatar cliente p/ estorno ou reaproveitamento.`,
                details: JSON.stringify({ bidId, bidPaymentId: payment.id, provider, amount: Number(payment.amount), providerEventId: providerEventId ?? null })
            }
        }).catch(() => {});
    }

    await recordBidWebhookLog(eventSignature, provider, providerEventId, rawPayload);
    logger.info(`[Webhook:bid] Bid payment ${payment.id} (bid ${bidId}) confirmed via ${provider}`);
    return { success: true, message: 'Pagamento do lance confirmado.', statusCode: 200 };
}

async function recordBidWebhookLog(
    eventSignature: string, provider: string, providerEventId: string | undefined, rawPayload: any
) {
    try {
        await prisma.webhookLog.upsert({
            where: { signature: eventSignature },
            create: {
                signature: eventSignature, provider, providerEventId,
                status: 'PROCESSED', payload: JSON.stringify(rawPayload).substring(0, 1000)
            },
            update: { status: 'PROCESSED', processedAt: new Date() }
        });
    } catch { /* colisão de log é não-crítica */ }
}
