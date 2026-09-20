import { Router } from 'express';
import { isAdmin, requireCapability } from '../../middlewares/adminAuthMiddleware';
import * as ticketsController from '../../controllers/admin/ticketsController';

const router = Router();

router.get('/tickets', isAdmin, requireCapability('support.view'), ticketsController.listTickets);
router.post('/tickets/:id/reply', isAdmin, requireCapability('support.manage'), ticketsController.replyTicket);
router.post('/tickets/:id/close', isAdmin, requireCapability('support.manage'), ticketsController.closeTicket);

export default router;
