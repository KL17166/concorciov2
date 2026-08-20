import { allocateGroupAndQuota } from '../domain/calculations/groupQuotaAllocator';

describe('groupQuotaAllocator', () => {
    it('should allocate requested group and quota if available', async () => {
        const mockTx = {
            subscription: {
                findFirst: jest.fn().mockResolvedValue(null)
            }
        };

        const result = await allocateGroupAndQuota(mockTx as any, 'plan-1', '2001', '050');

        expect(result).toEqual({
            groupNumber: '2001',
            quotaNumber: '050'
        });
        expect(mockTx.subscription.findFirst).toHaveBeenCalledWith({
            where: {
                groupNumber: '2001',
                quotaNumber: '050',
                status: { notIn: ['CANCELLED'] }
            }
        });
    });

    it('should throw error if requested group and quota are already occupied', async () => {
        const mockTx = {
            subscription: {
                findFirst: jest.fn().mockResolvedValue({ id: 'sub-existing' })
            }
        };

        await expect(allocateGroupAndQuota(mockTx as any, 'plan-1', '2001', '050'))
            .rejects
            .toThrow('A cota 050 do grupo 2001 já está ocupada');
    });

    it('should sequentially allocate next available quota in active group', async () => {
        const mockTx = {
            subscription: {
                findFirst: jest.fn().mockResolvedValue({ groupNumber: '1001' }),
                count: jest.fn().mockResolvedValue(2),
                findMany: jest.fn().mockResolvedValue([
                    { quotaNumber: '001' },
                    { quotaNumber: '002' }
                ])
            }
        };

        const result = await allocateGroupAndQuota(mockTx as any, 'plan-1');

        expect(result).toEqual({
            groupNumber: '1001',
            quotaNumber: '003'
        });
    });

    it('should advance to next group when current group has 999 quotas', async () => {
        const mockTx = {
            subscription: {
                findFirst: jest.fn().mockResolvedValue({ groupNumber: '1001' }),
                count: jest.fn().mockResolvedValue(999),
                findMany: jest.fn().mockResolvedValue([])
            }
        };

        const result = await allocateGroupAndQuota(mockTx as any, 'plan-1');

        expect(result).toEqual({
            groupNumber: '1002',
            quotaNumber: '001'
        });
    });
});
