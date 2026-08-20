import { prisma } from '../config/database';

export class ProductRepository {
    static async findById(id: string) {
        return prisma.product.findUnique({
            where: { id },
            include: {
                plans: {
                    where: { active: true },
                    orderBy: { durationMonths: 'asc' }
                }
            }
        });
    }

    static async findActiveProducts(type?: string) {
        const where: any = { active: true };
        if (type) {
            where.type = type.toUpperCase();
        }

        return prisma.product.findMany({
            where,
            include: {
                plans: {
                    where: { active: true },
                    orderBy: { durationMonths: 'asc' }
                }
            },
            orderBy: { createdAt: 'desc' }
        });
    }

    static async findPlanById(planId: string) {
        return prisma.consortiumPlan.findUnique({
            where: { id: planId },
            include: {
                product: true
            }
        });
    }
}
