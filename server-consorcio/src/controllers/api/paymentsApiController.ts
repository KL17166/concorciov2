import { Request, Response } from 'express';
import { AuthPayload } from '../../middlewares/authMiddleware';
import { listSubscriptionPayments as listPaymentsUseCase } from '../../application/payments/listSubscriptionPayments';
import { generatePayment } from '../../application/payments/generatePayment';
import { generateBatchPayment } from '../../application/payments/generateBatchPayment';
import { GeneratePaymentSchema, GenerateBatchPaymentSchema } from '../../schemas/paymentSchema';
import { handleApiError } from '../../utils/errors';

export const listSubscriptionPayments = async (req: Request, res: Response): Promise<void> => {
    const user = req.user as AuthPayload;
    try {
        const subscriptionId = req.params.subscriptionId as string;
        const formattedInstallments = await listPaymentsUseCase({
            subscriptionId,
            requesterUserId: user.userId,
            isAdmin: false
        });

        res.json(formattedInstallments);
    } catch (error: any) {
        handleApiError(res, error, 'Erro ao buscar parcelas');
    }
};

export const generatePixPayment = async (req: Request, res: Response): Promise<void> => {
    const user = req.user as AuthPayload;
    try {
        const installmentId = req.params.installmentId as string;
        const validation = GeneratePaymentSchema.safeParse(req.body);

        if (!validation.success) {
            res.status(400).json({ success: false, error: 'BAD_REQUEST', message: 'Token de pagamento ausente (idTokenPay)' });
            return;
        }

        const result = await generatePayment({
            installmentId,
            idTokenPay: validation.data.idTokenPay,
            requesterUserId: user.userId,
            method: 'PIX',
            anticipate: validation.data.anticipate ?? false
        });

        res.json({
            success: true,
            ...(process.env.NODE_ENV !== 'production' && { provider: result.provider }),
            paymentId: result.paymentId,
            qrCode: result.qrCode,
            copyPaste: result.copyPaste,
            amount: result.amount,
            requestedAmount: result.requestedAmount ?? result.amount,
            expirationDate: result.expirationDate || new Date(Date.now() + 30 * 60 * 1000).toISOString(),
            ...(result.message && { message: result.message })
        });
    } catch (error: any) {
        handleApiError(res, error, 'Erro ao gerar Pix');
    }
};

export const generateBoletoPayment = async (req: Request, res: Response): Promise<void> => {
    const user = req.user as AuthPayload;
    try {
        const installmentId = req.params.installmentId as string;
        const validation = GeneratePaymentSchema.safeParse(req.body);

        if (!validation.success) {
            res.status(400).json({ success: false, error: 'BAD_REQUEST', message: 'Token de pagamento ausente (idTokenPay)' });
            return;
        }

        const result = await generatePayment({
            installmentId,
            idTokenPay: validation.data.idTokenPay,
            requesterUserId: user.userId,
            method: 'BOLETO',
            anticipate: validation.data.anticipate ?? false
        });

        res.json({
            success: true,
            ...(process.env.NODE_ENV !== 'production' && { provider: result.provider }),
            paymentId: result.paymentId,
            qrCode: result.qrCode,
            copyPaste: result.copyPaste,
            amount: result.amount,
            requestedAmount: result.requestedAmount ?? result.amount,
            expirationDate: result.expirationDate,
            ...(result.message && { message: result.message })
        });
    } catch (error: any) {
        handleApiError(res, error, 'Erro ao gerar Boleto');
    }
};

export const directPayDisabled = (_req: Request, res: Response): void => {
    res.status(403).json({
        success: false,
        error: 'FORBIDDEN',
        message: 'Funcionalidade desativada para usuários. Pagamentos devem ser processados via gateway.'
    });
};

// POST /api/payments/batch/pix - 1 PIX combinado somando N parcelas
export const generateBatchPixPayment = async (req: Request, res: Response): Promise<void> => {
    const user = req.user as AuthPayload;
    try {
        const validation = GenerateBatchPaymentSchema.safeParse(req.body);
        if (!validation.success) {
            res.status(400).json({ success: false, error: 'BAD_REQUEST', message: 'Informe o contrato e ao menos 1 parcela com token' });
            return;
        }
        const result = await generateBatchPayment({
            subscriptionId: validation.data.subscriptionId,
            items: validation.data.items,
            requesterUserId: user.userId,
            method: 'PIX'
        });
        res.json({ success: true, message: `${result.items.length} parcelas em 1 PIX`, ...result });
    } catch (error: any) {
        handleApiError(res, error, 'Erro ao gerar PIX combinado');
    }
};
