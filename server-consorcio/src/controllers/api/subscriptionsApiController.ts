import { Request, Response } from 'express';
import { AuthPayload } from '../../middlewares/authMiddleware';
import { createSubscription } from '../../application/subscriptions/createSubscription';
import { cancelSubscription } from '../../application/subscriptions/cancelSubscription';
import { getUserSubscriptions } from '../../application/subscriptions/getUserSubscriptions';
import { getSubscriptionDetails } from '../../application/subscriptions/getSubscriptionDetails';
import { notifyPaymentCheck } from '../../application/payments/notifyPaymentCheck';
import { CreateClientSubscriptionSchema } from '../../schemas/subscriptionSchema';
import { handleApiError } from '../../utils/errors';
import { logger } from '../../config/logger';

export const listUserSubscriptions = async (req: Request, res: Response): Promise<void> => {
    try {
        const userId = req.params.userId as string;
        const subscriptions = await getUserSubscriptions(userId);
        res.json(subscriptions);
    } catch (error: any) {
        handleApiError(res, error, 'Erro ao buscar contratos', req);
    }
};

export const getSingleSubscription = async (req: Request, res: Response): Promise<void> => {
    const user = req.user as AuthPayload;
    try {
        const subscriptionId = req.params.subscriptionId as string;
        const sub = await getSubscriptionDetails(subscriptionId, user.userId);
        res.json(sub);
    } catch (error: any) {
        handleApiError(res, error, 'Erro ao buscar contrato', req);
    }
};

export const createClientSubscription = async (req: Request, res: Response): Promise<void> => {
    const user = req.user as AuthPayload;
    try {
        const validation = CreateClientSubscriptionSchema.safeParse(req.body);
        if (!validation.success) {
            const firstError = validation.error.issues[0]?.message || 'Dados incompletos';
            res.status(400).json({
                success: false,
                error: 'BAD_REQUEST',
                message: firstError
            });
            return;
        }

        const data = validation.data;

        // Validate ownership
        if (data.userId !== user.userId) {
            logger.warn(`Ownership mismatch: requested=${data.userId}, actual=${user.userId}`);
            res.status(403).json({
                success: false,
                error: 'FORBIDDEN',
                message: 'Acesso negado: você só pode criar contratos para si mesmo'
            });
            return;
        }

        const result = await createSubscription({
            userId: data.userId,
            planId: data.planId,
            productId: data.productId,
            termsAccepted: data.termsAccepted,
            termsIpAddress: req.ip,
            documentFrontUrl: data.documentFrontUrl,
            documentBackUrl: data.documentBackUrl,
            selfieUrl: data.selfieUrl,
            channel: 'CLIENT_APP'
        });

        const formattedInstallments = result.installments.map((inst) => ({
            ...inst,
            amount: Number(inst.amount)
        }));

        res.status(201).json({
            success: true,
            v: 2,
            message: 'Contrato solicitado com sucesso!',
            subscriptionId: result.subscription.id,
            status: 'PENDING',
            plan: {
                id: result.plan.id,
                monthlyInstallment: Number(result.subscription.creditValue) / result.plan.durationMonths
            },
            installments: formattedInstallments
        });
    } catch (error: any) {
        handleApiError(res, error, 'Erro interno ao processar solicitação de contrato', req);
    }
};

export const cancelClientSubscription = async (req: Request, res: Response): Promise<void> => {
    const user = req.user as AuthPayload;
    try {
        const subscriptionId = req.params.subscriptionId as string;
        const result = await cancelSubscription({
            subscriptionId,
            requesterUserId: user.userId,
            requesterRole: (user.role as any) || 'CLIENT'
        });

        res.json({ success: true, message: result.message });
    } catch (error: any) {
        handleApiError(res, error, 'Erro ao cancelar contrato', req);
    }
};

export const notifySubscriptionPaymentCheck = async (req: Request, res: Response): Promise<void> => {
    const user = req.user as AuthPayload;
    try {
        const subscriptionId = req.params.subscriptionId as string;
        const installmentId = (req.body?.installmentId as string) || undefined;
        const installmentIds = Array.isArray(req.body?.installmentIds)
            ? (req.body.installmentIds as unknown[]).filter((x): x is string => typeof x === 'string')
            : undefined;
        const batchId = (req.body?.batchId as string) || undefined;
        const result = await notifyPaymentCheck({
            subscriptionId,
            requesterUserId: user.userId,
            installmentId,
            installmentIds,
            batchId
        });

        res.json({ success: true, notified: result.notified });
    } catch (error: any) {
        handleApiError(res, error, 'Erro ao registrar verificação de pagamento', req);
    }
};
