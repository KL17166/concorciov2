import { SubscriptionRepository } from '../../repositories/subscriptionRepository';
import { safeParseImageUrls } from '../../mappers/productMapper';
import { calculateInstallmentValue } from '../../domain/calculations/installmentCalculator';
import { Installment, Bid } from '@prisma/client';

export async function getUserSubscriptions(userId: string) {
    // Fetch active subscriptions with all relations as a pure read query
    const subscriptions = await SubscriptionRepository.findUserSubscriptions(userId);

    return subscriptions
        .filter((sub) => sub.plan?.product)
        .map((sub) => {
            // Next unpaid installment index
            const paidIndices = new Set(
                sub.installments
                    .filter((i: Installment) => i.status === 'PAID')
                    .map((i: Installment) => i.number)
            );

            let nextIndex = sub.totalInstallments + 1;
            for (let i = 1; i <= sub.totalInstallments; i++) {
                if (!paidIndices.has(i)) {
                    nextIndex = i;
                    break;
                }
            }

            const isAdesaoPaid = sub.status === 'ACTIVE' || (sub.installments.find((i: Installment) => i.number === 1)?.status === 'PAID');
            const nextInstallment = sub.installments.find((i: Installment) => i.number === nextIndex);
            const nextPaymentAmount = nextInstallment ? Number(nextInstallment.amount) : 0;
            const dueDate = nextInstallment?.dueDate
                ? new Date(nextInstallment.dueDate).toLocaleDateString('pt-BR', { timeZone: 'UTC' })
                : '15/09/2026';
            const progressPercentage = sub.totalInstallments > 0
                ? Math.round((sub.paidInstallments / sub.totalInstallments) * 100)
                : 0;

            const installmentValues: Record<number, number> = {};
            const installmentIds: Record<number, string> = {};
            const installmentDueDates: Record<number, string> = {};
            const installmentTokens: Record<number, string> = {};

            for (const inst of sub.installments) {
                installmentValues[inst.number] = Number(inst.amount);
                installmentIds[inst.number] = inst.id;
                if (inst.dueDate) {
                    installmentDueDates[inst.number] = new Date(inst.dueDate).toLocaleDateString('pt-BR', { timeZone: 'UTC' });
                }
                if (inst.idTokenPay) {
                    installmentTokens[inst.number] = inst.idTokenPay;
                }
            }

            return {
                id: sub.id,
                userId: sub.userId,
                productId: sub.plan.product.id,
                planId: sub.plan.id,
                groupNumber: sub.groupNumber,
                quotaNumber: sub.quotaNumber,
                creditValue: Number(sub.creditValue),
                balanceDue: Number(sub.balanceDue),
                status: sub.status.toLowerCase(),
                isAdesaoPaid: Boolean(isAdesaoPaid),
                currentInstallment: nextIndex,
                totalInstallments: sub.totalInstallments,
                paidInstallments: Array.from(paidIndices),
                nextPaymentAmount,
                dueDate,
                progressPercentage,
                installmentValues,
                installmentIds,
                installmentDueDates,
                installmentTokens,
                contemplated: sub.contemplated,
                contemplationDate: sub.contemplationDate,
                contemplationType: sub.contemplationType,
                createdAt: sub.createdAt,
                plan: {
                    id: sub.plan.id,
                    name: sub.plan.name,
                    durationMonths: sub.plan.durationMonths,
                    adminFeeRate: Number(sub.plan.adminFeeRate),
                    fundRate: Number(sub.plan.fundRate),
                    monthlyInstallment: Number(sub.creditValue) / sub.plan.durationMonths
                },
                product: {
                    id: sub.plan.product.id,
                    name: sub.plan.product.name,
                    imageUrl: sub.plan.product.imageUrl,
                    imageUrls: safeParseImageUrls(sub.plan.product.imageUrls),
                    price: Number(sub.plan.product.price),
                    category: sub.plan.product.category
                },
                installments: sub.installments.map((inst: Installment) => ({
                    id: inst.id,
                    idTokenPay: inst.idTokenPay,
                    number: inst.number,
                    amount: Number(inst.amount),
                    valueToPay: calculateInstallmentValue(Number(inst.amount), inst.number, nextIndex),
                    dueDate: inst.dueDate,
                    status: inst.status,
                    paymentDate: inst.paymentDate,
                    paymentMethod: inst.paymentMethod
                })),
                bids: sub.bids.map((bid: Bid) => ({
                    id: bid.id,
                    type: bid.type,
                    percentage: Number(bid.percentage),
                    amount: Number(bid.amount),
                    status: bid.status,
                    isWinner: bid.isWinner,
                    createdAt: bid.createdAt
                }))
            };
        });
}
