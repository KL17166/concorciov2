import { Router } from 'express';
import { isAdmin, requireCapability } from '../../middlewares/adminAuthMiddleware';
import * as trackingController from '../../controllers/admin/trackingController';

const router = Router();

router.get('/tracking', isAdmin, requireCapability('reports.view'), trackingController.getTracking);

export default router;
