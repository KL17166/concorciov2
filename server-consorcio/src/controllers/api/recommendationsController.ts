import { Request, Response } from 'express';
import { AuthPayload } from '../../middlewares/authMiddleware';
import { prisma } from '../../config/database';
import { getRecommendations as computeRecommendations } from '../../services/learningService';
import { handleApiError } from '../../utils/errors';

// GET /api/recommendations - ranking personalizado de produtos (o algoritmo
// aprendendo: afinidade do usuário + popularidade + propensão, com exploração).
export const getRecommendations = async (req: Request, res: Response): Promise<void> => {
    try {
        const user = req.user as AuthPayload;
        const products = await prisma.product.findMany({
            where: { active: true },
            select: { id: true }
        });
        const ranked = await computeRecommendations(user?.userId ?? null, products.map((p) => p.id));
        res.json({ success: true, recommendations: ranked });
    } catch (error: any) {
        handleApiError(res, error, 'Erro ao gerar recomendações', req);
    }
};
