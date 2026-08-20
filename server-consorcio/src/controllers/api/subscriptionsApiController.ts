import { Request, Response } from 'express';
import { AuthPayload } from '../../middlewares/authMiddleware';
import { createSubscription } from '../../application/subscriptions/createSubscription';
import { cancelSubscription } from '../../application/subscriptions/cancelSubscription';
import { getUserSubscriptions } from '../../application/subscriptions/getUserSubscriptions';
import { getSubscriptionDetails } from '../../application/subscriptions/getSubscriptionDetails';
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
        // Validate Token in body matching header token
        const authHeader = req.headers.authorization;
        const headerToken = authHeader?.split(' ')[1];
        const bodyToken = req.body?.token;

        if (!bodyToken || bodyToken !== headerToken) {
            logger.warn(`[Security] Token mismatch or missing in body. User: ${user.userId}`);
            res.status(401).json({
                success: false,
                error: 'UNAUTHORIZED',
                message: 'Token de autenticação inválido ou ausente no corpo da requisição'
            });
            return;
        }

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
