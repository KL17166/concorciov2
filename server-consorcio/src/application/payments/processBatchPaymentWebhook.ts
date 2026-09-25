import { prisma } from '../../config/database';
import { markInstallmentAsPaid } from '../../services/installmentService';
import { logger } from '../../config/logger';
import { parseBatchExternalId } from './generateBatchPayment';

export interface ProcessBatchWebhookInput {
    provider: 'pixgo' | 'sigilopay';
    batchExternalId: string;
    paidAmount?: number;
    paymentMethod: string;
    eventSignature: string;
    providerEventId?: string;
    rawPayload: any;
}

/**
 * Liquida 1 PIX combinado: valida o total (±5%) e dá baixa nas N parcelas
 * em UMA transação. Idempotente por webhook_logs.signature.
 */
export async function processBatchPaymentWebhook(input: ProcessBatchWebhookInput) {
    const { provider, batchExternalId, paidAmount, paymentMethod, eventSignature, providerEventId, rawPayload } = input;

    const existingLog = await prisma.webhookLog.findUnique({ where: { signature: eventSignature } });
    if (existingLog && existingLog.status === 'PROCESSED') {
        return { success: true, alreadyProcessed: true, message: 'Webhook já processado anteriormente.', statusCode: 200 };
    }

    const batchId = parseBatchExternalId(batchExternalId);
    const batch = batchId ? await (prisma as any).paymentBatch.findUnique({ where: { id: batchId } }) : null;
    if (!batch) {
        logger.error(`[Webhook] Batch ${batchExternalId} not found for ${provider}`);
        return { success: false, message: 'Cobrança combinada não encontrada.', statusCode: 404 };
    }
    if (batch.status === 'PAID') {
        await prisma.webhookLog.upsert({
            where: { signature: eventSignature },
            create: { signature: eventSignature, provider, providerEventId, status: 'PROCESSED', payload: JSON.stringify(rawPayload).substring(0, 1000) },
            update: { status: 'PROCESSED', processedAt: new Date() }
        }).catch(() => {});
        return { success: true, alreadyProcessed: true, message: 'Lote já liquidado.', statusCode: 200 };
    }
    if (batch.status !== 'ACTIVE') {
        return { success: false, message: `Cobrança está ${batch.status} — gere um novo PIX.`, statusCode: 410 };
    }

    const expectedTotal = Number(batch.totalAmount);
    if (typeof paidAmount === 'number' && paidAmount > 0) {
        if (paidAmount < expectedTotal * 0.95 || paidAmount > expectedTotal * 1.05) {
            logger.error(`[Webhook] Batch ${batch.id}: pago R$ ${paidAmount} vs esperado R$ ${expectedTotal}`);
            return { success: false, message: 'Valor pago divergente do total combinado.', statusCode: 400 };
        }
    }

    const installmentIds: string[] = JSON.parse(batch.installmentIds || '[]');
    try {
        await prisma.$transaction(async (tx: any) => {
            for (const instId of installmentIds) {
                const r = await markInstallmentAsPaid(instId, { paymentMethod, paymentDate: new Date() });
                if (!r.success && r.message !== 'Esta parcela já está paga.') {
                    throw new Error(`Parcela ${instId}: ${r.message}`);
                }
                await tx.paymentAttempt.updateMany({
                    where: { batchId: batch.id, installmentId: instId, status: 'ACTIVE' },
                    data: { status: 'PAID' }
                });
            }
            await tx.paymentBatch.update({ where: { id: batch.id }, data: { status: 'PAID', paidAt: new Date() } });
            await tx.auditLog.create({
                data: {
                    userId: null,
                    action: 'BATCH_PAYMENT_CONFIRMED',
                    resource: 'payment_batch',
                    details: JSON.stringify({ batchId: batch.id, subscriptionId: batch.subscriptionId, count: installmentIds.length, total: expectedTotal, provider }),
                    ipAddress: 'webhook'
                }
            });
        }, { isolationLevel: 'Serializable', timeout: 15000 });
    } catch (e: any) {
        logger.error(`[Webhook] Batch settle failed for ${batch.id}: ${e.message}`);
        await prisma.webhookLog.upsert({
            where: { signature: eventSignature },
            create: { signature: eventSignature, provider, providerEventId, status: 'FAILED', errorMessage: e.message, payload: JSON.stringify(rawPayload).substring(0, 1000) },
            update: { status: 'FAILED', errorMessage: e.message, attempts: { increment: 1 } }
        }).catch(() => {});
        return { success: false, message: e.message || 'Falha ao liquidar lote.', statusCode: 500 };
    }

    await prisma.webhookLog.upsert({
        where: { signature: eventSignature },
        create: { signature: eventSignature, provider, providerEventId, status: 'PROCESSED', payload: JSON.stringify(rawPayload).substring(0, 1000) },
        update: { status: 'PROCESSED', processedAt: new Date() }
    }).catch(() => {});

    logger.info(`[Webhook] Batch ${batch.id} liquidado: ${installmentIds.length} parcelas via ${provider}`);
    return { success: true, message: `${installmentIds.length} parcelas liquidadas com sucesso.`, statusCode: 200 };
}
