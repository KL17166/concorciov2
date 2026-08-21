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
        where: { id: subscriptionId },
        include: {
            installments: {
                where: { number: 1 },
                select: { status: true }
            }
        }
    });

    if (!subscription) {
        throw Object.assign(new Error('Contrato não encontrado'), { statusCode: 404 });
    }

    if (subscription.userId !== requesterUserId) {
        throw Object.assign(new Error('Acesso negado: você só pode criar lances para seus próprios contratos'), { statusCode: 403 });
    }

    const isAdesaoPaid = subscription.status === 'ACTIVE' && subscription.installments[0]?.status === 'PAID';
    if (!isAdesaoPaid) {
        throw Object.assign(new Error('É necessário realizar o pagamento da taxa de adesão para poder ofertar lances neste consórcio.'), { statusCode: 403 });
    }

    const expectedAmount = Number(subscription.creditValue) * percentage / 100;
    if (Math.abs(amount - expectedAmount) > 0.05) {
        throw Object.assign(new Error(
            `Valor do lance inválido. Para ${percentage}% o valor esperado é R$${expectedAmount.toFixed(2)}`
        ), { statusCode: 400 });
    }

    // Atomic creation with Serializable isolation to prevent duplicate pending or approved bids
    const bid = await prisma.$transaction(async (tx) => {
        const existing = await tx.bid.findFirst({
            where: {
                subscriptionId,
                status: { in: ['PENDING', 'APPROVED'] }
            }
        });

        if (existing) {
            if (existing.status === 'APPROVED') {
                throw Object.assign(new Error('Você já possui um lance aprovado para este contrato. Realize o pagamento ou cancele-o para ofertar outro.'), { statusCode: 400 });
            }
            throw Object.assign(new Error('Já existe um lance pendente aguardando a assembleia para este contrato.'), { statusCode: 400 });
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
