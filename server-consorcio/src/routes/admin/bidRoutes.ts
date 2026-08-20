import { Router } from 'express';
import { isAdmin } from '../../middlewares/adminAuthMiddleware';
import { requireRoles } from '../../security/adminAuth';
import * as bidsController from '../../controllers/admin/bidsController';

const router = Router();

router.get('/bids', isAdmin, requireRoles(['MASTER', 'MANAGER']), bidsController.getBids);
router.get('/bids/pending', isAdmin, requireRoles(['MASTER', 'MANAGER']), bidsController.getPendingBids);
router.get('/bids/draw', isAdmin, requireRoles(['MASTER', 'MANAGER']), bidsController.getDrawPage);
router.post('/bids/draw', isAdmin, requireRoles(['MASTER', 'MANAGER']), bidsController.performDraw);
router.get('/bids/:id', isAdmin, requireRoles(['MASTER', 'MANAGER']), bidsController.getBidDetails);
router.post('/bids/:id/approve', isAdmin, requireRoles(['MASTER', 'MANAGER']), bidsController.approveBid);
router.post('/bids/:id/reject', isAdmin, requireRoles(['MASTER', 'MANAGER']), bidsController.rejectBid);

export default router;
