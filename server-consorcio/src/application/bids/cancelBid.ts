import { prisma } from '../../config/database';
import { logger } from '../../config/logger';

export interface CancelBidInput {
    bidId: string;
    requesterUserId: string;
    isAdmin?: boolean;
}

export async function cancelBid(input: CancelBidInput) {
    const { bidId, requesterUserId, isAdmin = false } = input;

    const bid = await prisma.bid.findUnique({
        where: { id: bidId },
        include: {
            subscription: {
                select: {
                    id: true,
                    userId: true
                }
            }
        }
    });

    if (!bid) {
        throw Object.assign(new Error('Lance não encontrado'), { statusCode: 404 });
    }

    if (!isAdmin && bid.subscription.userId !== requesterUserId) {
        throw Object.assign(new Error('Acesso negado: você só pode cancelar lances dos seus próprios contratos'), { statusCode: 403 });
    }

    if (bid.status === 'CONTEMPLATED') {
        throw Object.assign(new Error('Não é possível cancelar um lance já contemplado e liquidado'), { statusCode: 400 });
    }

    if (bid.status === 'CANCELLED') {
        throw Object.assign(new Error('Este lance já foi cancelado'), { statusCode: 400 });
    }

    const updatedBid = await prisma.bid.update({
        where: { id: bidId },
        data: {
            status: 'CANCELLED'
        }
    });

    logger.info(`Bid ${bidId} cancelled by ${isAdmin ? 'ADMIN' : `USER ${requesterUserId}`}`);

    return {
        id: updatedBid.id,
        status: updatedBid.status,
        message: 'Lance cancelado com sucesso'
    };
}
