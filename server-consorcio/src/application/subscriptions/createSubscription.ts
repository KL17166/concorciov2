import { Subscription, Installment, ConsortiumPlan, Product } from '@prisma/client';
import { prisma } from '../../config/database';
import { logger } from '../../config/logger';
import { generatePaymentToken } from '../../security/paymentToken';
import { calculatePlanFinancials } from '../../domain/calculations/installmentCalculator';
import { allocateGroupAndQuota } from '../../domain/calculations/groupQuotaAllocator';

export interface CreateSubscriptionInput {
    userId: string;
    planId: string;
    productId?: string;
    groupNumber?: string;
    quotaNumber?: string;
    termsAccepted?: boolean;
    termsIpAddress?: string;
    documentFrontUrl?: string | null;
    documentBackUrl?: string | null;
    selfieUrl?: string | null;
    channel: 'CLIENT_APP' | 'ADMIN_PANEL';
}

export interface CreateSubscriptionResult {
    success: boolean;
    subscription: Subscription;
    installments: Installment[];
    plan: ConsortiumPlan & { product: Product };
}

export async function createSubscription(input: CreateSubscriptionInput): Promise<CreateSubscriptionResult> {
    const { userId, planId, productId, channel } = input;

    // 1. User KYC check (Fast-fail)
    const userRecord = await prisma.user.findUnique({
        where: { id: userId },
        select: { kycStatus: true }
    });

    if (!userRecord) {
        throw Object.assign(new Error('Usuário não encontrado'), { statusCode: 404 });
    }

    if (userRecord.kycStatus === 'REJECTED') {
        throw Object.assign(new Error('KYC_REJECTED'), { statusCode: 403 });
    }

    // 2. Active subscriptions cap (for clients)
    if (channel === 'CLIENT_APP') {
        const MAX_ACTIVE = 5;
        const activeCount = await prisma.subscription.count({
            where: {
                userId,
                status: { in: ['ACTIVE', 'PENDING_KYC', 'CONTEMPLATED'] }
            }
        });

        if (activeCount >= MAX_ACTIVE) {
            throw Object.assign(new Error(`Limite de contratos ativos atingido (máximo: ${MAX_ACTIVE})`), { statusCode: 400 });
        }
    }

    // 3. Plan & Product validation
    const plan = await prisma.consortiumPlan.findUnique({
        where: { id: planId },
        include: { product: true }
    });

    if (!plan) {
        throw Object.assign(new Error('Plano de consórcio não encontrado'), { statusCode: 404 });
    }

    if (!plan.active) {
        throw Object.assign(new Error('O plano selecionado não está mais disponível.'), { statusCode: 400 });
    }

    if (productId && plan.productId !== productId) {
        throw Object.assign(new Error('O plano selecionado não corresponde ao produto informado'), { statusCode: 400 });
    }

    const minDuration = plan.product.minDuration || 12;
    const maxDuration = plan.product.maxDuration || 60;
    if (plan.durationMonths < minDuration || plan.durationMonths > maxDuration) {
        throw Object.assign(new Error(`Duração do plano (${plan.durationMonths} meses) fora dos limites permitidos (${minDuration}–${maxDuration} meses)`), { statusCode: 400 });
    }

    // 4. Financial Calculations
    const financials = calculatePlanFinancials({
        productPrice: Number(plan.product.price),
        adminFeeRate: Number(plan.adminFeeRate),
        fundRate: Number(plan.fundRate),
        durationMonths: plan.durationMonths
    });

    // 5. Atomic Creation Transaction with Retry on Concurrency Collisions
    const MAX_RETRIES = 3;
    let attempt = 0;
    let lastError: any = null;

    while (attempt < MAX_RETRIES) {
        try {
            const { subscription, createdInstallments } = await prisma.$transaction(async (tx) => {
                // Re-check KYC inside transaction to eliminate TOCTOU race
                const latestUser = await tx.user.findUnique({
                    where: { id: userId },
                    select: { kycStatus: true }
                });
                if (latestUser?.kycStatus === 'REJECTED') {
                    throw Object.assign(new Error('KYC_REJECTED'), { statusCode: 403 });
                }

                // Allocate group and quota atomically
                const { groupNumber, quotaNumber } = await allocateGroupAndQuota(
                    tx,
                    planId,
                    input.groupNumber,
                    input.quotaNumber
                );

                const sub = await tx.subscription.create({
                    data: {
                        userId,
                        planId,
                        groupNumber,
                        quotaNumber,
                        creditValue: financials.creditValue,
                        balanceDue: financials.creditValue,
                        totalInstallments: financials.totalInstallments,
                        status: 'PENDING',
                        paidInstallments: 0,
                        contemplated: false,
                        termsAccepted: input.termsAccepted === true,
                        termsAcceptedAt: input.termsAccepted ? new Date() : null,
                        termsIpAddress: input.termsIpAddress || null
                    }
                });

                // Auto-submit KYC if docs provided
                if (input.documentFrontUrl && input.documentBackUrl && input.selfieUrl) {
                    await tx.user.update({
                        where: { id: userId },
                        data: {
                            documentFrontUrl: input.documentFrontUrl,
                            documentBackUrl: input.documentBackUrl,
                            selfieUrl: input.selfieUrl,
                            kycStatus: 'SUBMITTED'
                        }
                    });
                    logger.info(`KYC auto-submitted with contract creation: user ${userId}`);
                }

                const today = new Date();
                const installmentsData: any[] = [];

                // Installment #1 (Adesão)
                installmentsData.push({
                    subscriptionId: sub.id,
                    idTokenPay: generatePaymentToken(sub.id, 1, userId),
                    number: 1,
                    amount: financials.monthlyInstallment,
                    dueDate: today,
                    status: 'PENDING'
                });

                // Installments #2 to #N
                for (let i = 2; i <= plan.durationMonths; i++) {
                    const dueDate = new Date(today);
                    dueDate.setMonth(dueDate.getMonth() + (i - 1));
                    dueDate.setDate(10);

                    installmentsData.push({
                        subscriptionId: sub.id,
                        idTokenPay: generatePaymentToken(sub.id, i, userId),
                        number: i,
                        amount: financials.monthlyInstallment,
                        dueDate,
                        status: 'PENDING'
                    });
                }

                await tx.installment.createMany({ data: installmentsData });

                const instList = await tx.installment.findMany({
                    where: { subscriptionId: sub.id },
                    orderBy: { number: 'asc' }
                });

                return { subscription: sub, createdInstallments: instList };
            }, { isolationLevel: 'Serializable', timeout: 15000 });

            logger.info(`Subscription ${subscription.id} created successfully via ${channel} (Group: ${subscription.groupNumber}, Quota: ${subscription.quotaNumber})`);

            return {
                success: true,
                subscription,
                installments: createdInstallments,
                plan
            };
        } catch (error: any) {
            lastError = error;
            attempt++;

            // If a specific group/quota was manually requested by admin or if error is business validation (KYC, etc.), do not retry
            if ((input.groupNumber && input.quotaNumber) || error.statusCode === 403 || error.statusCode === 400 || error.statusCode === 404) {
                throw error;
            }

            if (attempt >= MAX_RETRIES) {
                logger.error(`[createSubscription] Failed after ${MAX_RETRIES} attempts. Error:`, error);
                throw error;
            }

            logger.warn(`[createSubscription] Serialization/allocation conflict on attempt ${attempt}. Retrying in ${attempt * 50}ms...`);
            await new Promise((resolve) => setTimeout(resolve, attempt * 50));
        }
    }

    throw lastError;
}
