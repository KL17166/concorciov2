import { prisma } from '../../config/database';
import { markInstallmentAsPaid } from '../../services/installmentService';
import { logger } from '../../config/logger';

export interface ProcessWebhookInput {
    provider: 'pixgo' | 'sigilopay';
    installmentId: string;
    paidAmount?: number;
    paymentMethod: string;
    eventSignature: string;
    providerEventId?: string;
    rawPayload: any;
}

export interface ProcessWebhookResult {
    success: boolean;
    alreadyProcessed?: boolean;
    message: string;
    statusCode: number;
}

/**
 * Idempotent use case to process payment webhooks from gateways.
 */
export async function processPaymentWebhook(input: ProcessWebhookInput): Promise<ProcessWebhookResult> {
    const { provider, installmentId, paidAmount, paymentMethod, eventSignature, providerEventId, rawPayload } = input;

    // 1. Check idempotency / replay log
    const existingLog = await prisma.webhookLog.findUnique({
        where: { signature: eventSignature }
    });

    if (existingLog && existingLog.status === 'PROCESSED') {
        logger.warn(`[Webhook] Event ${eventSignature} already processed for ${provider}. Skipping.`);
        return {
            success: true,
            alreadyProcessed: true,
            message: 'Webhook já processado anteriormente.',
            statusCode: 200
        };
    }

    // 2. Validate installment existence & amount
    const installment = await prisma.installment.findUnique({
        where: { id: installmentId },
        include: { subscription: true }
    });

    if (!installment) {
        logger.error(`[Webhook] Installment ${installmentId} not found for ${provider}`);
        return {
            success: false,
            message: 'Parcela informada no webhook não encontrada.',
            statusCode: 404
        };
    }

    // If already paid, mark webhook log and return 200 idempotently
    if (installment.status === 'PAID') {
        logger.info(`[Webhook] Installment ${installmentId} is already PAID. Acknowledging webhook.`);
        try {
            await prisma.webhookLog.upsert({
                where: { signature: eventSignature },
                create: {
                    signature: eventSignature,
                    provider,
                    providerEventId,
                    status: 'PROCESSED',
                    payload: JSON.stringify(rawPayload).substring(0, 1000)
                },
                update: {
                    status: 'PROCESSED',
                    processedAt: new Date()
                }
            });
        } catch { /* ignore race log insert */ }

        return {
            success: true,
            alreadyProcessed: true,
            message: 'Parcela já liquidada.',
            statusCode: 200
        };
    }

    // Amount cross-validation (if provided by gateway)
    if (typeof paidAmount === 'number' && paidAmount > 0) {
        const expectedAmount = Number(installment.amount);
        // Allow up to 1 real / 1% tolerance for gateway discount/fee rounding
        if (paidAmount < expectedAmount * 0.95) {
            logger.error(`[Webhook] Paid amount (R$ ${paidAmount}) is significantly lower than installment amount (R$ ${expectedAmount})`);
            return {
                success: false,
                message: 'Valor pago divergente do valor da parcela.',
                statusCode: 400
            };
        }
    }

    // 3. Atomically settle payment via serializable transaction
    const settleResult = await markInstallmentAsPaid(installmentId, {
        paymentMethod,
        paymentDate: new Date()
    });

    if (!settleResult.success) {
        logger.error(`[Webhook] markInstallmentAsPaid failed for ${installmentId}: ${settleResult.message}`);
        // Record failed attempt in WebhookLog
        try {
            await prisma.webhookLog.upsert({
                where: { signature: eventSignature },
                create: {
                    signature: eventSignature,
                    provider,
                    providerEventId,
                    status: 'FAILED',
                    errorMessage: settleResult.message,
                    payload: JSON.stringify(rawPayload).substring(0, 1000)
                },
                update: {
                    status: 'FAILED',
                    errorMessage: settleResult.message,
                    attempts: { increment: 1 }
                }
            });
        } catch { /* ignore */ }

        return {
            success: false,
            message: settleResult.message || 'Falha ao liquidar parcela.',
            statusCode: 500
        };
    }

    // 4. Record/update successful webhook log
    try {
        await prisma.webhookLog.upsert({
            where: { signature: eventSignature },
            create: {
                signature: eventSignature,
                provider,
                providerEventId,
                status: 'PROCESSED',
                payload: JSON.stringify(rawPayload).substring(0, 1000)
            },
            update: {
                status: 'PROCESSED',
                processedAt: new Date()
            }
        });
    } catch (logErr) {
        logger.warn(`[Webhook] Non-critical webhook log insertion collision: ${eventSignature}`);
    }

    logger.info(`[Webhook] Successfully processed payment confirmation for installment ${installmentId} via ${provider}`);

    return {
        success: true,
        message: 'Pagamento confirmado e liquidado com sucesso.',
        statusCode: 200
    };
}
