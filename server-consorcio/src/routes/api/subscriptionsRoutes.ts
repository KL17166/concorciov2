import { Router } from 'express';
import { authenticate } from '../../middlewares/authMiddleware';
import { checkOwnership } from '../../middlewares/idorMiddleware';
import { transactionRateLimiter } from '../../middlewares/rateLimitMiddleware';
import {
    listUserSubscriptions,
    getSingleSubscription,
    createClientSubscription,
    cancelClientSubscription
} from '../../controllers/api/subscriptionsApiController';

const router = Router();

// GET /api/subscriptions/:userId - Listar contratos do usuário
router.get('/subscriptions/:userId', authenticate, checkOwnership('user', 'userId'), listUserSubscriptions);

// GET /api/subscription/:subscriptionId - Detalhes de um único contrato
router.get('/subscription/:subscriptionId', authenticate, getSingleSubscription);

// POST /api/subscriptions - Criar novo contrato
router.post('/subscriptions', authenticate, transactionRateLimiter, createClientSubscription);

// POST /api/subscriptions/:subscriptionId/cancel - Cancelar contrato
router.post('/subscriptions/:subscriptionId/cancel', authenticate, transactionRateLimiter, cancelClientSubscription);

export default router;
