import { prisma } from '../../config/database';
import { logger } from '../../config/logger';

export interface ReviewKycInput {
    userId: string;
    reviewerAdminId: string;
    action: 'approve' | 'reject';
    reason?: string | null;
}

export async function reviewKyc(input: ReviewKycInput) {
    const { userId, reviewerAdminId, action, reason } = input;

    const user = await prisma.user.findUnique({
        where: { id: userId }
    });

    if (!user) {
        throw Object.assign(new Error('Usuário não encontrado'), { statusCode: 404 });
    }

    if (action === 'approve') {
        await prisma.$transaction(async (tx) => {
            await tx.user.update({
                where: { id: userId },
                data: {
                    kycStatus: 'APPROVED',
                    kycReviewedAt: new Date(),
                    kycReviewedBy: reviewerAdminId,
                    kycRejectReason: null
                }
            });

            // Activate any subscriptions waiting on KYC approval
            await tx.subscription.updateMany({
                where: {
                    userId,
                    status: 'PENDING_KYC'
                },
                data: {
                    status: 'ACTIVE'
                }
            });
        });

        logger.info(`KYC APPROVED for user ${userId} by admin ${reviewerAdminId}`);
        return { success: true, message: 'KYC aprovado com sucesso!' };
    } else {
        await prisma.user.update({
            where: { id: userId },
            data: {
                kycStatus: 'REJECTED',
                kycReviewedAt: new Date(),
                kycReviewedBy: reviewerAdminId,
                kycRejectReason: reason || 'Documentação não aprovada pelo administrador'
            }
        });

        logger.info(`KYC REJECTED for user ${userId} by admin ${reviewerAdminId}`);
        return { success: true, message: 'KYC reprovado.' };
    }
}
