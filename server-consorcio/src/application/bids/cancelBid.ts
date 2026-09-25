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

    const { updatedBid, invalidatedVouchers } = await prisma.$transaction(async (tx) => {
        const updated = await tx.bid.update({
            where: { id: bidId },
            data: {
                status: 'CANCELLED'
            }
        });

        // B5: invalida vouchers PIX pendentes — a cobrança já emitida na gateway
        // externa não se cancela sozinha; sem isso o cliente pagaria um lance morto
        // e o valor cairia no limbo (webhook marcaria PAID sem dono válido).
        const invalidated = await tx.bidPayment.updateMany({
            where: { bidId, status: { in: ['ACTIVE', 'RESERVED'] } },
            data: { status: 'CANCELLED' }
        });

        return { updatedBid: updated, invalidatedVouchers: invalidated.count };
    }, { isolationLevel: 'Serializable', timeout: 10000 });

    // Auditoria best-effort (fora da tx: nunca quebra o cancelamento por causa de log)
    try {
        await prisma.auditLog.create({
            data: {
                userId: requesterUserId,
                action: 'BID_CANCELLED',
                resource: 'bid',
                details: JSON.stringify({
                    bidId,
                    cancelledBy: isAdmin ? `ADMIN:${requesterUserId}` : requesterUserId,
                    invalidatedVouchers
                })
            }
        });
    } catch (auditErr) {
        logger.warn(`Bid ${bidId} cancelled but audit log failed:`, auditErr);
    }

    logger.info(`Bid ${bidId} cancelled by ${isAdmin ? 'ADMIN' : `USER ${requesterUserId}`}`);

    return {
        id: updatedBid.id,
        status: updatedBid.status,
        message: 'Lance cancelado com sucesso'
    };
}
