import { Router } from 'express';
import subscriptionsRoutes from './subscriptionsRoutes';
import paymentsRoutes from './paymentsRoutes';
import bidsRoutes from './bidsRoutes';
import kycRoutes from './kycRoutes';

const router = Router();

router.use(subscriptionsRoutes);
router.use(paymentsRoutes);
router.use(bidsRoutes);
router.use(kycRoutes);

export default router;
