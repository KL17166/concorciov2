import { BidRepository } from '../../repositories/bidRepository';

export async function listUserBids(userId: string) {
    const bids = await BidRepository.findUserBids(userId);

    return bids.map((bid: any) => ({
        id: bid.id,
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
        quotaNumber: bid.subscription.quotaNumber
    }));
}
