import { cancelBid } from '../application/bids/cancelBid';

const mockBidFindUnique = jest.fn();
const mockBidUpdate = jest.fn();
const mockBidPaymentUpdateMany = jest.fn();
const mockAuditCreate = jest.fn();

// Simula prisma.$transaction executando o callback com um client transacional
const mockTransaction = jest.fn(async (cb: any, _opts?: any) => cb({
    bid: { update: (...args: any[]) => mockBidUpdate(...args) },
    bidPayment: { updateMany: (...args: any[]) => mockBidPaymentUpdateMany(...args) },
}));

jest.mock('../config/database', () => ({
    prisma: {
        bid: {
            findUnique: (...args: any[]) => mockBidFindUnique(...args),
        },
        bidPayment: {
            updateMany: (...args: any[]) => mockBidPaymentUpdateMany(...args),
        },
        auditLog: {
            create: (...args: any[]) => mockAuditCreate(...args),
        },
        $transaction: (cb: any, opts?: any) => mockTransaction(cb, opts),
    }
}));

jest.mock('../config/logger', () => ({
    logger: {
        error: jest.fn(),
        info: jest.fn(),
        warn: jest.fn(),
    }
}));

describe('cancelBid Use Case', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockBidPaymentUpdateMany.mockResolvedValue({ count: 1 });
        mockAuditCreate.mockResolvedValue({});
    });

    it('should allow user to cancel their own PENDING or APPROVED bid', async () => {
        mockBidFindUnique.mockResolvedValue({
            id: 'bid-1',
            status: 'APPROVED',
            subscription: {
                id: 'sub-1',
                userId: 'user-1'
            }
        });

        mockBidUpdate.mockResolvedValue({
            id: 'bid-1',
            status: 'CANCELLED'
        });

        const result = await cancelBid({
            bidId: 'bid-1',
            requesterUserId: 'user-1',
            isAdmin: false
        });

        expect(result.status).toBe('CANCELLED');
        expect(mockBidUpdate).toHaveBeenCalledWith({
            where: { id: 'bid-1' },
            data: { status: 'CANCELLED' }
        });
    });

    it('should invalidate pending bid vouchers on cancel (B5)', async () => {
        mockBidFindUnique.mockResolvedValue({
            id: 'bid-1',
            status: 'APPROVED',
            subscription: { id: 'sub-1', userId: 'user-1' }
        });
        mockBidUpdate.mockResolvedValue({ id: 'bid-1', status: 'CANCELLED' });

        await cancelBid({ bidId: 'bid-1', requesterUserId: 'user-1', isAdmin: false });

        expect(mockBidPaymentUpdateMany).toHaveBeenCalledWith({
            where: { bidId: 'bid-1', status: { in: ['ACTIVE', 'RESERVED'] } },
            data: { status: 'CANCELLED' }
        });
    });

    it('should reject cancelling another users bid if not admin', async () => {
        mockBidFindUnique.mockResolvedValue({
            id: 'bid-1',
            status: 'APPROVED',
            subscription: {
                id: 'sub-1',
                userId: 'user-1'
            }
        });

        await expect(cancelBid({
            bidId: 'bid-1',
            requesterUserId: 'user-2',
            isAdmin: false
        })).rejects.toThrow('Acesso negado');
    });

    it('should reject cancelling a CONTEMPLATED bid', async () => {
        mockBidFindUnique.mockResolvedValue({
            id: 'bid-1',
            status: 'CONTEMPLATED',
            subscription: {
                id: 'sub-1',
                userId: 'user-1'
            }
        });

        await expect(cancelBid({
            bidId: 'bid-1',
            requesterUserId: 'user-1',
            isAdmin: false
        })).rejects.toThrow('Não é possível cancelar um lance já contemplado e liquidado');
    });
});
