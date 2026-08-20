import { prisma } from '../config/database';

export class BidRepository {
    static async findById(id: string) {
        return prisma.bid.findUnique({
            where: { id },
            include: {
                subscription: {
                    include: {
                        user: true,
                        plan: {
                            include: {
                                product: true
                            }
                        }
                    }
                }
            }
        });
    }

    static async findUserBids(userId: string) {
        return prisma.bid.findMany({
            where: {
                subscription: {
                    userId
                }
            },
            include: {
                subscription: {
                    include: {
                        plan: {
                            include: {
                                product: true
                            }
                        }
                    }
                }
            },
            orderBy: { createdAt: 'desc' }
        });
    }

    static async findPendingBySubscription(subscriptionId: string) {
        return prisma.bid.findFirst({
            where: {
                subscriptionId,
                status: 'PENDING'
            }
        });
    }
}
