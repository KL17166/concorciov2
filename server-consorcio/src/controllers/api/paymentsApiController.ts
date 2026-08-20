import { Request, Response } from 'express';
import { AuthPayload } from '../../middlewares/authMiddleware';
import { prisma } from '../../config/database';
import { generatePayment } from '../../application/payments/generatePayment';
import { calculateInstallmentValue } from '../../domain/calculations/installmentCalculator';
import { GeneratePaymentSchema } from '../../schemas/paymentSchema';
import { logger } from '../../config/logger';

export const listSubscriptionPayments = async (req: Request, res: Response): Promise<void> => {
    const user = req.user as AuthPayload;
    try {
        const subscriptionId = req.params.subscriptionId as string;
        const subscription = await prisma.subscription.findUnique({
            where: { id: subscriptionId }
        });

        if (!subscription) {
            res.status(404).json({ error: 'Contrato não encontrado' });
            return;
        }

        if (subscription.userId !== user.userId) {
            res.status(403).json({ error: 'Acesso negado' });
            return;
        }

        const installments = await prisma.installment.findMany({
            where: { subscriptionId },
            orderBy: { number: 'asc' }
        });

        const paidIndices = new Set(
            installments.filter((i: any) => i.status === 'PAID').map((i: any) => i.number)
        );
        let nextIndex = subscription.totalInstallments + 1;
        for (let i = 1; i <= subscription.totalInstallments; i++) {
            if (!paidIndices.has(i)) {
                nextIndex = i;
                break;
            }
        }

        const formattedInstallments = installments.map((inst: any) => ({
            id: inst.id,
            idTokenPay: inst.idTokenPay,
            number: inst.number,
            amount: Number(inst.amount),
            valueToPay: calculateInstallmentValue(Number(inst.amount), inst.number, nextIndex),
            dueDate: inst.dueDate,
            status: inst.status,
            paymentDate: inst.paymentDate,
            paymentMethod: inst.paymentMethod
        }));

        res.json(formattedInstallments);
    } catch (error: any) {
        logger.error('Error fetching installments:', error);
        res.status(500).json({ error: 'Erro ao buscar parcelas' });
    }
};

export const generatePixPayment = async (req: Request, res: Response): Promise<void> => {
    const user = req.user as AuthPayload;
    try {
        const installmentId = req.params.installmentId as string;
        const validation = GeneratePaymentSchema.safeParse(req.body);

        if (!validation.success) {
            res.status(400).json({ error: 'Token de pagamento ausente (idTokenPay)' });
            return;
        }

        const result = await generatePayment({
            installmentId,
            idTokenPay: validation.data.idTokenPay,
            requesterUserId: user.userId,
            method: 'PIX'
        });

        res.json({
            success: true,
            provider: result.provider,
            paymentId: result.paymentId,
            qrCode: result.qrCode,
            copyPaste: result.copyPaste,
            amount: result.amount,
            expirationDate: result.expirationDate || new Date(Date.now() + 30 * 60 * 1000).toISOString(),
            ...(result.message && { message: result.message })
        });
    } catch (error: any) {
        logger.error('Error generating PIX:', error.message);
        if (error.code === 'GATEWAY_UNAVAILABLE') {
            res.status(503).json({
                success: false,
                error: 'GATEWAY_UNAVAILABLE',
                message: error.message,
                retryable: true
            });
            return;
        }
        res.status(error.statusCode || 500).json({
            error: error.message || 'Erro ao gerar Pix',
            details: error.message
        });
    }
};

export const generateBoletoPayment = async (req: Request, res: Response): Promise<void> => {
    const user = req.user as AuthPayload;
    try {
        const installmentId = req.params.installmentId as string;
        const validation = GeneratePaymentSchema.safeParse(req.body);

        if (!validation.success) {
            res.status(400).json({ error: 'Token de pagamento ausente (idTokenPay)' });
            return;
        }

        const result = await generatePayment({
            installmentId,
            idTokenPay: validation.data.idTokenPay,
            requesterUserId: user.userId,
            method: 'BOLETO'
        });

        res.json({
            success: true,
            provider: result.provider,
            paymentId: result.paymentId,
            qrCode: result.qrCode,
            copyPaste: result.copyPaste,
            amount: result.amount,
            expirationDate: result.expirationDate,
            ...(result.message && { message: result.message })
        });
    } catch (error: any) {
        logger.error('Error generating Boleto:', error.message);
        if (error.code === 'GATEWAY_UNAVAILABLE') {
            res.status(503).json({
                success: false,
                error: 'GATEWAY_UNAVAILABLE',
                message: error.message,
                retryable: true
            });
            return;
        }
        res.status(error.statusCode || 500).json({
            error: error.message || 'Erro ao gerar Boleto',
            details: error.message
        });
    }
};

export const directPayDisabled = (_req: Request, res: Response): void => {
    res.status(403).json({ error: 'Funcionalidade desativada para usuários. Pagamentos devem ser processados via gateway.' });
};
