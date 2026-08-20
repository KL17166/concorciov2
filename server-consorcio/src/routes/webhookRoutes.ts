import { Router, Request, Response } from 'express';
import { prisma } from '../config/database';
import crypto from 'crypto';
import { env } from '../config/env';
import { processPaymentWebhook } from '../application/payments/processPaymentWebhook';
import { logger } from '../config/logger';

const router = Router();

// POST /webhooks/pixgo - Tratamento de webhook do PixGo
router.post('/pixgo', async (req: Request, res: Response) => {
    try {
        const signature = req.headers['x-pixgo-signature'] as string;

        // Dynamic secret loading
        const config = await prisma.gatewayConfig.findUnique({ where: { name: 'pixgo' } });
        const webhookSecret = config?.webhookSecret || env.PIXGO_WEBHOOK_SECRET;

        if (webhookSecret) {
            if (!signature) {
                return res.status(401).json({
                    error: 'Assinatura ausente',
                    message: 'O header x-pixgo-signature é obrigatório para autenticar webhooks.'
                });
            }

            const payload = (req as any).rawBody ? (req as any).rawBody.toString('utf8') : JSON.stringify(req.body);
            const expectedSignature = crypto
                .createHmac('sha256', webhookSecret)
                .update(payload)
                .digest('hex');

            const sigBuffer = Buffer.from(signature, 'hex');
            const expectedBuffer = Buffer.from(expectedSignature, 'hex');

            if (sigBuffer.length !== expectedBuffer.length || !crypto.timingSafeEqual(sigBuffer, expectedBuffer)) {
                return res.status(401).json({
                    error: 'Assinatura inválida',
                    message: 'A assinatura do webhook não corresponde.'
                });
            }

            // Timestamp Validation (5 min tolerance)
            const timestampHeader = req.headers['x-pixgo-timestamp'] as string;
            if (timestampHeader) {
                const requestTime = parseInt(timestampHeader, 10);
                const currentTime = Math.floor(Date.now() / 1000);
                const tolerance = 300;

                if (isNaN(requestTime) || Math.abs(currentTime - requestTime) > tolerance) {
                    return res.status(401).json({
                        error: 'Timestamp inválido ou expirado',
                        message: 'A requisição é muito antiga ou está no futuro.'
                    });
                }
            }
        }

        if (!signature) {
            logger.warn('[Webhook PixGo] No signature header and no secret configured — rejecting');
            return res.status(401).json({ error: 'Assinatura ausente' });
        }

        const { event, data } = req.body;
        logger.info(`[Webhook PixGo] Event: ${event}, ID: ${data?.external_id || 'unknown'}`);

        if (event === 'payment.completed') {
            const installmentId = data?.external_id;
            const paidAmount = data?.amount ? parseFloat(data.amount) : undefined;
            const providerEventId = data?.id || data?.payment_id || undefined;

            if (!installmentId) {
                return res.status(400).json({
                    error: 'BAD_REQUEST',
                    message: 'Campo external_id ausente no payload.'
                });
            }

            const result = await processPaymentWebhook({
                provider: 'pixgo',
                installmentId,
                paidAmount,
                paymentMethod: 'PIX-PIXGO',
                eventSignature: signature,
                providerEventId,
                rawPayload: req.body
            });

            return res.status(result.statusCode).json({
                success: result.success,
                message: result.message
            });
        }

        res.status(200).send('Event received');
    } catch (error: any) {
        logger.error('[Webhook PixGo] Error processing webhook:', error);
        res.status(500).json({
            error: 'INTERNAL_ERROR',
            message: 'Erro interno ao processar webhook'
        });
    }
});

// POST /webhooks/sigilopay - Webhook for SigiloPay
router.post('/sigilopay', async (req: Request, res: Response) => {
    try {
        const authHeader = req.headers.authorization;

        const config = await prisma.gatewayConfig.findUnique({ where: { name: 'sigilopay' } });
        if (!config) {
            logger.error('[SigiloPay Webhook] Configuration not found');
            return res.status(500).send('Configuration Error');
        }

        const validSecret = config.webhookSecret || config.apiSecret;
        if (!validSecret) {
            logger.error('[SigiloPay Webhook] No secret configured for validation');
            return res.status(500).send('Configuration Error');
        }

        const expectedAuth = `Bearer ${validSecret}`;
        let isValidAuth = false;

        if (authHeader && authHeader.length === expectedAuth.length) {
            isValidAuth = crypto.timingSafeEqual(
                Buffer.from(authHeader, 'utf8'),
                Buffer.from(expectedAuth, 'utf8')
            );
        }

        if (!isValidAuth) {
            logger.warn('[SigiloPay Webhook] Invalid Authorization token');
            return res.status(401).json({ error: 'Unauthorized' });
        }

        const { status, reference, amount, id: transactionId } = req.body;
        logger.info(`[SigiloPay Webhook] Status=${status}, Ref=${reference}, ID=${transactionId || 'none'}`);

        if (!reference || !status || typeof reference !== 'string' || typeof status !== 'string') {
            return res.status(400).json({ error: 'Campos obrigatórios ausentes: reference, status' });
        }

        const providerEventId = transactionId || `${reference}:${status}`;
        const sigiloReplayKey = crypto
            .createHash('sha256')
            .update(`sigilopay:${providerEventId}:${status}`)
            .digest('hex');

        if (status === 'completed' || status === 'paid' || status === 'approved') {
            const paidAmount = amount ? parseFloat(amount) : undefined;

            const result = await processPaymentWebhook({
                provider: 'sigilopay',
                installmentId: reference,
                paidAmount,
                paymentMethod: 'PIX-SIGILOPAY',
                eventSignature: sigiloReplayKey,
                providerEventId: String(providerEventId),
                rawPayload: req.body
            });

            return res.status(result.statusCode).json({
                success: result.success,
                message: result.message
            });
        }

        res.status(200).send('Event received');
    } catch (error: any) {
        logger.error('[SigiloPay Webhook] Error:', error);
        res.status(500).send('Internal Server Error');
    }
});

export default router;
