import { Router } from 'express';
import subscriptionsRoutes from './subscriptionsRoutes';
import paymentsRoutes from './paymentsRoutes';
import bidsRoutes from './bidsRoutes';
import kycRoutes from './kycRoutes';
import ticketsRoutes from './ticketsRoutes';
import profileRoutes from './profileRoutes';
import trackingRoutes from './trackingRoutes';
import notificationsRoutes from './notificationsRoutes';
import recommendationsRoutes from './recommendationsRoutes';

const router = Router();

router.use(subscriptionsRoutes);
router.use(paymentsRoutes);
router.use(bidsRoutes);
router.use(kycRoutes);
router.use(ticketsRoutes);
router.use(profileRoutes);
router.use(trackingRoutes);
router.use(notificationsRoutes);
router.use(recommendationsRoutes);

export default router;
