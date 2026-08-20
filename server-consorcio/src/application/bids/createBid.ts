import { prisma } from '../../config/database';
import { logger } from '../../config/logger';

export interface CreateBidInput {
    subscriptionId: string;
    requesterUserId: string;
    type: 'FREE' | 'FIXED';
    percentage: number;
    amount: number;
}

export async function createBid(input: CreateBidInput) {
    const { subscriptionId, requesterUserId, type, percentage, amount } = input;

    const subscription = await prisma.subscription.findUnique({
        where: { id: subscriptionId }
    });

    if (!subscription) {
        throw Object.assign(new Error('Contrato não encontrado'), { statusCode: 404 });
    }

    if (subscription.userId !== requesterUserId) {
        throw Object.assign(new Error('Acesso negado: você só pode criar lances para seus próprios contratos'), { statusCode: 403 });
    }

    if (subscription.status !== 'ACTIVE') {
        throw Object.assign(new Error('Lances só podem ser realizados em contratos ativos.'), { statusCode: 400 });
    }

    const expectedAmount = Number(subscription.creditValue) * percentage / 100;
    if (Math.abs(amount - expectedAmount) > 0.05) {
        throw Object.assign(new Error(
            `Valor do lance inválido. Para ${percentage}% o valor esperado é R$${expectedAmount.toFixed(2)}`
        ), { statusCode: 400 });
    }

    // Atomic creation with Serializable isolation to prevent duplicate pending bids
    const bid = await prisma.$transaction(async (tx) => {
        const existing = await tx.bid.findFirst({
            where: {
                subscriptionId,
                status: 'PENDING'
            }
        });

        if (existing) {
            throw Object.assign(new Error('Já existe um lance pendente para este contrato'), { statusCode: 400 });
        }

        return tx.bid.create({
            data: {
                subscriptionId,
                type,
                percentage,
                amount,
                status: 'PENDING'
            }
        });
    }, { isolationLevel: 'Serializable' });

    logger.info(`Bid ${bid.id} created for subscription ${subscriptionId} by user ${requesterUserId}`);

    return {
        id: bid.id,
        type: bid.type,
        percentage: Number(bid.percentage),
        amount: Number(bid.amount),
        status: bid.status,
        createdAt: bid.createdAt
    };
}
