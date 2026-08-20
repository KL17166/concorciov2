import { Router } from 'express';
import { authenticate } from '../../middlewares/authMiddleware';
import { checkOwnership } from '../../middlewares/idorMiddleware';
import { transactionRateLimiter } from '../../middlewares/rateLimitMiddleware';
import { createClientBid, listClientBids } from '../../controllers/api/bidsApiController';

const router = Router();

// POST /api/bids - Criar lance
router.post('/bids', authenticate, transactionRateLimiter, createClientBid);

// GET /api/bids/:userId - Listar lances do usuário
router.get('/bids/:userId', authenticate, checkOwnership('user', 'userId'), listClientBids);

export default router;
