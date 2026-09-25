import { Router } from 'express';
import { authenticate } from '../../middlewares/authMiddleware';
import { checkOwnership } from '../../middlewares/idorMiddleware';
import { transactionRateLimiter } from '../../middlewares/rateLimitMiddleware';
import {
    createClientBid,
    listClientBids,
    cancelClientBid,
    generateClientBidPix,
    notifyClientBidPaymentCheck
} from '../../controllers/api/bidsApiController';

const router = Router();

// POST /api/bids - Criar lance
router.post('/bids', authenticate, transactionRateLimiter, createClientBid);

// GET /api/bids/:userId - Listar lances do usuário
router.get('/bids/:userId', authenticate, checkOwnership('user', 'userId'), listClientBids);

// POST /api/bids/:id/cancel - Cancelar lance
router.post('/bids/:id/cancel', authenticate, transactionRateLimiter, cancelClientBid);

// POST /api/bids/:id/pix - Gerar PIX para pagamento de lance aprovado
router.post('/bids/:id/pix', authenticate, transactionRateLimiter, generateClientBidPix);

// POST /api/bids/:id/payment-check - Cliente clicou em "Já paguei" no PIX do lance
router.post('/bids/:id/payment-check', authenticate, transactionRateLimiter, notifyClientBidPaymentCheck);

export default router;

