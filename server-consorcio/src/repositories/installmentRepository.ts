import { prisma } from '../config/database';

export class InstallmentRepository {
    static async findById(id: string) {
        return prisma.installment.findUnique({
            where: { id },
            include: {
                subscription: {
                    include: {
                        user: true,
                        installments: true
                    }
                }
            }
        });
    }

    static async findByToken(idTokenPay: string) {
        return prisma.installment.findUnique({
            where: { idTokenPay },
            include: {
                subscription: {
                    include: {
                        user: true
                    }
                }
            }
        });
    }

    static async findSubscriptionInstallments(subscriptionId: string) {
        return prisma.installment.findMany({
            where: { subscriptionId },
            orderBy: { number: 'asc' }
        });
    }

    static async countPriorUnpaid(subscriptionId: string, installmentNumber: number): Promise<number> {
        return prisma.installment.count({
            where: {
                subscriptionId,
                number: { lt: installmentNumber },
                status: { notIn: ['PAID', 'CANCELLED'] }
            }
        });
    }

    static async countUnpaid(subscriptionId: string): Promise<number> {
        return prisma.installment.count({
            where: {
                subscriptionId,
                status: { notIn: ['PAID', 'CANCELLED'] }
            }
        });
    }
}
