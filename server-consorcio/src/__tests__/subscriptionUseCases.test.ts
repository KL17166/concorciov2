import { cancelSubscription } from '../application/subscriptions/cancelSubscription';

const mockSubscriptionFindUnique = jest.fn();
const mockSubscriptionUpdate = jest.fn();
const mockInstallmentUpdateMany = jest.fn();

jest.mock('../config/database', () => ({
    prisma: {
        subscription: {
            findUnique: (...args: any[]) => mockSubscriptionFindUnique(...args),
        },
        $transaction: (fn: (tx: any) => Promise<any>) => fn({
            subscription: {
                update: (...args: any[]) => mockSubscriptionUpdate(...args),
            },
            installment: {
                updateMany: (...args: any[]) => mockInstallmentUpdateMany(...args),
            }
        })
    }
}));

jest.mock('../config/logger', () => ({
    logger: {
        error: jest.fn(),
        info: jest.fn(),
        warn: jest.fn(),
    }
}));

describe('cancelSubscription Use Case', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('should allow client to cancel their own PENDING subscription', async () => {
        mockSubscriptionFindUnique.mockResolvedValue({
            id: 'sub-1',
            userId: 'user-1',
            status: 'PENDING'
        });

        const result = await cancelSubscription({
            subscriptionId: 'sub-1',
            requesterUserId: 'user-1',
            requesterRole: 'CLIENT'
        });

        expect(result.success).toBe(true);
        expect(mockSubscriptionUpdate).toHaveBeenCalledWith({
            where: { id: 'sub-1' },
            data: { status: 'CANCELLED', balanceDue: 0 }
        });
        expect(mockInstallmentUpdateMany).toHaveBeenCalledWith({
            where: {
                subscriptionId: 'sub-1',
                status: { in: ['PENDING', 'OVERDUE'] }
            },
            data: { status: 'CANCELLED' }
        });
    });

    it('should reject client cancelling another users subscription', async () => {
        mockSubscriptionFindUnique.mockResolvedValue({
            id: 'sub-1',
            userId: 'user-1',
            status: 'PENDING'
        });

        await expect(cancelSubscription({
            subscriptionId: 'sub-1',
            requesterUserId: 'user-2',
            requesterRole: 'CLIENT'
        })).rejects.toThrow('Acesso negado');
    });

    it('should reject client cancelling an ACTIVE subscription', async () => {
        mockSubscriptionFindUnique.mockResolvedValue({
            id: 'sub-1',
            userId: 'user-1',
            status: 'ACTIVE'
        });

        await expect(cancelSubscription({
            subscriptionId: 'sub-1',
            requesterUserId: 'user-1',
            requesterRole: 'CLIENT'
        })).rejects.toThrow('Apenas contratos pendentes podem ser cancelados');
    });

    it('should allow admin to cancel an ACTIVE subscription', async () => {
        mockSubscriptionFindUnique.mockResolvedValue({
            id: 'sub-1',
            userId: 'user-1',
            status: 'ACTIVE'
        });

        const result = await cancelSubscription({
            subscriptionId: 'sub-1',
            requesterUserId: 'admin-1',
            requesterRole: 'MASTER'
        });

        expect(result.success).toBe(true);
        expect(mockSubscriptionUpdate).toHaveBeenCalled();
    });
});
