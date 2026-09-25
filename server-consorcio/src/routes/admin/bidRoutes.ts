import { Router } from 'express';
import { isAdmin, requireCapability } from '../../middlewares/adminAuthMiddleware';
import * as bidsController from '../../controllers/admin/bidsController';

const router = Router();

router.get('/bids', isAdmin, requireCapability('bids.view'), bidsController.getBids);
router.get('/bids/pending', isAdmin, requireCapability('bids.view'), bidsController.getPendingBids);
router.get('/bids/payments', isAdmin, requireCapability('bids.view'), bidsController.getBidPayments);
router.post('/bids/payments/:paymentId/confirm', isAdmin, requireCapability('bids.manage'), bidsController.confirmBidPayment);
router.post('/bids/payments/:paymentId/refuse', isAdmin, requireCapability('bids.manage'), bidsController.refuseBidPayment);
router.post('/bids/payments/:paymentId/refund-request', isAdmin, requireCapability('bids.manage'), bidsController.requestBidRefund);
router.post('/bids/payments/:paymentId/refund-confirm', isAdmin, requireCapability('bids.manage'), bidsController.confirmBidRefund);
router.get('/bids/draw', isAdmin, requireCapability('bids.manage'), bidsController.getDrawPage);
router.post('/bids/draw', isAdmin, requireCapability('bids.manage'), bidsController.performDraw);
router.get('/bids/:id', isAdmin, requireCapability('bids.view'), bidsController.getBidDetails);
router.post('/bids/:id/approve', isAdmin, requireCapability('bids.manage'), bidsController.approveBid);
router.post('/bids/:id/reject', isAdmin, requireCapability('bids.manage'), bidsController.rejectBid);
router.post('/bids/notification-frequency', isAdmin, requireCapability('bids.manage'), bidsController.updateNotificationFrequency);

export default router;

