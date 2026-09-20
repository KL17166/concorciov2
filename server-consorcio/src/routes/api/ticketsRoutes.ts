import { Router } from 'express';
import { authenticate } from '../../middlewares/authMiddleware';
import { openTicket, listTickets } from '../../controllers/api/ticketsApiController';

const router = Router();

// GET /api/tickets - Meus atendimentos
router.get('/tickets', authenticate, listTickets);

// POST /api/tickets - Abrir atendimento (ex: solicitar cancelamento)
router.post('/tickets', authenticate, openTicket);

export default router;
