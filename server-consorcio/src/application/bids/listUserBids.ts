import { BidRepository } from '../../repositories/bidRepository';

export async function listUserBids(userId: string) {
    const bids = await BidRepository.findUserBids(userId);

    return bids.map((bid: any) => {
        const lastPayment = bid.payments?.[0] || null;
        return {
            id: bid.id,
            subscriptionId: bid.subscriptionId,
            type: bid.type,
            percentage: Number(bid.percentage),
            amount: Number(bid.amount),
            status: bid.status,
            isWinner: bid.isWinner,
            createdAt: bid.createdAt,
            product: {
                id: bid.subscription.plan.product.id,
                name: bid.subscription.plan.product.name,
                imageUrl: bid.subscription.plan.product.imageUrl
            },
            groupNumber: bid.subscription.groupNumber,
            quotaNumber: bid.subscription.quotaNumber,
            // Último voucher PIX (p/ UI exibir "aguardando confirmação" vs "pago")
            payment: lastPayment ? {
                id: lastPayment.id,
                provider: lastPayment.provider,
                status: lastPayment.status,
                expiresAt: lastPayment.expiresAt,
                paidAt: lastPayment.paidAt
            } : null
        };
    });
}
