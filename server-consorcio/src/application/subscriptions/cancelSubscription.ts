import { prisma } from '../../config/database';
import { logger } from '../../config/logger';

export interface CancelSubscriptionInput {
    subscriptionId: string;
    requesterUserId: string;
    requesterRole: 'CLIENT' | 'MASTER' | 'MANAGER' | 'SUPPORT';
}

export interface CancelSubscriptionResult {
    success: boolean;
    message: string;
}

export async function cancelSubscription(input: CancelSubscriptionInput): Promise<CancelSubscriptionResult> {
    const { subscriptionId, requesterUserId, requesterRole } = input;

    const sub = await prisma.subscription.findUnique({
        where: { id: subscriptionId }
    });

    if (!sub) {
        throw Object.assign(new Error('Contrato não encontrado'), { statusCode: 404 });
    }

    const isAdmin = ['MASTER', 'MANAGER', 'SUPPORT'].includes(requesterRole);

    // Client ownership & status policy
    if (!isAdmin) {
        if (sub.userId !== requesterUserId) {
            throw Object.assign(new Error('Acesso negado'), { statusCode: 403 });
        }

        if (sub.status !== 'PENDING') {
            throw Object.assign(new Error(
                'Apenas contratos pendentes podem ser cancelados pelo cliente. Para cancelar um contrato ativo, entre em contato com o suporte.'
            ), { statusCode: 400 });
        }
    }

    if (sub.status === 'CANCELLED') {
        return { success: true, message: 'Contrato já está cancelado.' };
    }

    await prisma.$transaction(async (tx) => {
        await tx.subscription.update({
            where: { id: subscriptionId },
            data: { status: 'CANCELLED', balanceDue: 0 }
        });

        await tx.installment.updateMany({
            where: {
                subscriptionId,
                status: { in: ['PENDING', 'OVERDUE'] }
            },
            data: { status: 'CANCELLED' }
        });
    });

    logger.info(`Subscription ${subscriptionId} cancelled by ${requesterRole} (${requesterUserId})`);

    return {
        success: true,
        message: 'Contrato cancelado com sucesso.'
    };
}
