import { PrismaClient, Prisma } from '@prisma/client';

export interface GroupQuotaResult {
    groupNumber: string;
    quotaNumber: string;
}

/**
 * Allocates the next available group and quota sequentially and atomically.
 * Ensures no duplicate (groupNumber, quotaNumber) collisions exist.
 */
export async function allocateGroupAndQuota(
    tx: Prisma.TransactionClient | PrismaClient,
    planId: string,
    requestedGroup?: string,
    requestedQuota?: string
): Promise<GroupQuotaResult> {
    // If specific group and quota were provided by admin
    if (requestedGroup && requestedQuota) {
        const existing = await tx.subscription.findFirst({
            where: {
                groupNumber: requestedGroup,
                quotaNumber: requestedQuota,
                status: { notIn: ['CANCELLED'] }
            }
        });

        if (existing) {
            throw new Error(`A cota ${requestedQuota} do grupo ${requestedGroup} já está ocupada`);
        }

        return {
            groupNumber: requestedGroup,
            quotaNumber: requestedQuota
        };
    }

    // Default base group number
    const DEFAULT_BASE_GROUP = 1001;
    const MAX_QUOTAS_PER_GROUP = 999;

    // Find the latest active group for this plan
    const latestSubForPlan = await tx.subscription.findFirst({
        where: { planId },
        orderBy: { createdAt: 'desc' },
        select: { groupNumber: true }
    });

    let currentGroupNum = latestSubForPlan?.groupNumber
        ? parseInt(latestSubForPlan.groupNumber, 10)
        : DEFAULT_BASE_GROUP;

    if (isNaN(currentGroupNum) || currentGroupNum < 1000) {
        currentGroupNum = DEFAULT_BASE_GROUP;
    }

    // Check count of subscriptions in currentGroupNum
    const subsInGroup = await tx.subscription.count({
        where: {
            groupNumber: String(currentGroupNum),
            status: { notIn: ['CANCELLED'] }
        }
    });

    // If current group is full, advance to next group
    if (subsInGroup >= MAX_QUOTAS_PER_GROUP) {
        currentGroupNum += 1;
    }

    // Find existing quotas in this group to get next available sequential quota
    const existingQuotas = await tx.subscription.findMany({
        where: {
            groupNumber: String(currentGroupNum),
            status: { notIn: ['CANCELLED'] }
        },
        select: { quotaNumber: true }
    });

    const usedQuotaNumbers = new Set(existingQuotas.map((s) => parseInt(s.quotaNumber, 10)).filter((n) => !isNaN(n)));

    let nextQuotaNum = 1;
    while (usedQuotaNumbers.has(nextQuotaNum) && nextQuotaNum <= MAX_QUOTAS_PER_GROUP) {
        nextQuotaNum++;
    }

    if (nextQuotaNum > MAX_QUOTAS_PER_GROUP) {
        // Fallback to next group
        currentGroupNum += 1;
        nextQuotaNum = 1;
    }

    const groupStr = String(currentGroupNum).padStart(4, '0');
    const quotaStr = String(nextQuotaNum).padStart(3, '0');

    return {
        groupNumber: groupStr,
        quotaNumber: quotaStr
    };
}
