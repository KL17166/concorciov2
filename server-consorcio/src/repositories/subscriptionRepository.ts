import { prisma } from '../config/database';

export class SubscriptionRepository {
    static async findById(id: string) {
        return prisma.subscription.findUnique({
            where: { id },
            include: {
                user: true,
                plan: {
                    include: {
                        product: true
                    }
                },
                installments: {
                    orderBy: { number: 'asc' }
                },
                bids: {
                    orderBy: { createdAt: 'desc' }
                }
            }
        });
    }

    static async findUserSubscriptions(userId: string) {
        return prisma.subscription.findMany({
            where: {
                userId,
                status: { not: 'CANCELLED' }
            },
            include: {
                plan: {
                    include: {
                        product: true
                    }
                },
                installments: {
                    orderBy: { number: 'asc' }
                },
                bids: {
                    orderBy: { createdAt: 'desc' }
                }
            },
            orderBy: { createdAt: 'desc' }
        });
    }

    static async countActiveByUser(userId: string): Promise<number> {
        return prisma.subscription.count({
            where: {
                userId,
                status: { in: ['ACTIVE', 'PENDING_KYC', 'CONTEMPLATED'] }
            }
        });
    }

    static async autoCancelPendingOlderThan(days: number, userId?: string) {
        const thresholdDate = new Date();
        thresholdDate.setDate(thresholdDate.getDate() - days);

        const whereClause: any = {
            status: 'PENDING',
            createdAt: { lt: thresholdDate }
        };

        if (userId) {
            whereClause.userId = userId;
        }

        return prisma.subscription.updateMany({
            where: whereClause,
            data: { status: 'CANCELLED', balanceDue: 0 }
        });
    }

    static async autoCancelOrphans(orphanIds: string[]) {
        if (!orphanIds || orphanIds.length === 0) return;
        return prisma.subscription.updateMany({
            where: { id: { in: orphanIds } },
            data: { status: 'CANCELLED', balanceDue: 0 }
        });
    }
}
