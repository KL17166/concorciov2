import { getRecommendations } from '../services/learningService';

const mockFindMany = jest.fn();

jest.mock('../config/database', () => ({
    prisma: {
        learningWeight: {
            findMany: (...args: any[]) => mockFindMany(...args),
            findUnique: jest.fn(),
            upsert: jest.fn()
        }
    }
}));

jest.mock('../config/logger', () => ({
    logger: { error: jest.fn(), info: jest.fn(), warn: jest.fn() }
}));

describe('getRecommendations (algoritmo)', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        // Desliga a exploração epsilon-greedy (Math.random < 0.15 embaralha o top)
        jest.spyOn(Math, 'random').mockReturnValue(0.99);
    });

    afterEach(() => {
        (Math.random as jest.Mock).mockRestore?.();
    });

    it('keeps admin order when there are no learned weights', async () => {
        mockFindMany.mockResolvedValue([]);
        const ranked = await getRecommendations('user-1', ['p1', 'p2', 'p3']);
        expect(ranked.map((r) => r.productId)).toEqual(['p1', 'p2', 'p3']);
        expect(ranked[0]!.reason).toBe('sugestão');
    });

    it('ranks personal affinity first', async () => {
        mockFindMany.mockResolvedValue([
            { scope: 'user-1', key: 'aff:PROD:p3', value: 5 },
            { scope: 'global', key: 'pop:PROD:p1', value: 100 }
        ]);
        // aff p3 = 2*5 = 10 vs pop p1 = ln(101) ≈ 4.6 → p3 primeiro
        const ranked = await getRecommendations('user-1', ['p1', 'p2', 'p3']);
        expect(ranked[0]!.productId).toBe('p3');
        expect(ranked[0]!.reason).toBe('baseado no seu interesse');
    });

    it('returns empty for empty catalog', async () => {
        await expect(getRecommendations('user-1', [])).resolves.toEqual([]);
    });
});
