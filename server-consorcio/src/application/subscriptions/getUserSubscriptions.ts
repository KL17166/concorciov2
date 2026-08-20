import { SubscriptionRepository } from '../../repositories/subscriptionRepository';
import { safeParseImageUrls } from '../../mappers/productMapper';
import { calculateInstallmentValue } from '../../domain/calculations/installmentCalculator';

export async function getUserSubscriptions(userId: string) {
    // Fetch active subscriptions with all relations as a pure read query
    const subscriptions = await SubscriptionRepository.findUserSubscriptions(userId);

    return subscriptions
        .filter((sub: any) => sub.plan?.product)
        .map((sub: any) => {
            // Next unpaid installment index
            const paidIndices = new Set(
                sub.installments
                    .filter((i: any) => i.status === 'PAID')
                    .map((i: any) => i.number)
            );

            let nextIndex = sub.totalInstallments + 1;
            for (let i = 1; i <= sub.totalInstallments; i++) {
                if (!paidIndices.has(i)) {
                    nextIndex = i;
                    break;
                }
            }

            return {
                id: sub.id,
                groupNumber: sub.groupNumber,
                quotaNumber: sub.quotaNumber,
                creditValue: Number(sub.creditValue),
                balanceDue: Number(sub.balanceDue),
                status: sub.status,
                contemplated: sub.contemplated,
                contemplationDate: sub.contemplationDate,
                contemplationType: sub.contemplationType,
                paidInstallments: sub.paidInstallments,
                totalInstallments: sub.totalInstallments,
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
                installments: sub.installments.map((inst: any) => ({
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
                bids: sub.bids.map((bid: any) => ({
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
