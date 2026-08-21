import { cancelBid } from '../application/bids/cancelBid';

const mockBidFindUnique = jest.fn();
const mockBidUpdate = jest.fn();

jest.mock('../config/database', () => ({
    prisma: {
        bid: {
            findUnique: (...args: any[]) => mockBidFindUnique(...args),
            update: (...args: any[]) => mockBidUpdate(...args),
        }
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
