import { Request, Response } from 'express';
import { AuthPayload } from '../../middlewares/authMiddleware';
import { listSubscriptionPayments as listPaymentsUseCase } from '../../application/payments/listSubscriptionPayments';
import { generatePayment } from '../../application/payments/generatePayment';
import { GeneratePaymentSchema } from '../../schemas/paymentSchema';
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
