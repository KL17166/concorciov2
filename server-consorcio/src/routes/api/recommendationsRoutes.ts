import { Router } from 'express';
import { authenticate } from '../../middlewares/authMiddleware';
import { trackingLimiter } from '../../config/rateLimits';
import { getRecommendations } from '../../controllers/api/recommendationsController';

const router = Router();

// GET /api/recommendations - ranking que o algoritmo aprendeu para o usuário
router.get('/recommendations', authenticate, trackingLimiter, getRecommendations);

export default router;
