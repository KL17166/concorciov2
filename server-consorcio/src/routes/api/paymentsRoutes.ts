import { Router } from 'express';
import { authenticate } from '../../middlewares/authMiddleware';
import { transactionRateLimiter } from '../../middlewares/rateLimitMiddleware';
import {
    directPayDisabled,
    listSubscriptionPayments,
    generatePixPayment,
    generateBoletoPayment
} from '../../controllers/api/paymentsApiController';

const router = Router();

// POST /api/payments/:installmentId/pay - Desativado para usuário direto
router.post('/payments/:installmentId/pay', authenticate, transactionRateLimiter, directPayDisabled);

// GET /api/payments/:subscriptionId - Listar parcelas de um contrato
router.get('/payments/:subscriptionId', authenticate, listSubscriptionPayments);

// POST /api/payments/:installmentId/pix - Gerar Pix
router.post('/payments/:installmentId/pix', authenticate, transactionRateLimiter, generatePixPayment);

// POST /api/payments/:installmentId/boleto - Gerar Boleto
router.post('/payments/:installmentId/boleto', authenticate, transactionRateLimiter, generateBoletoPayment);

export default router;
