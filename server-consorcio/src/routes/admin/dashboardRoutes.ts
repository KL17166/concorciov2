import { Router } from 'express';
import { isAdmin, requireCapability } from '../../middlewares/adminAuthMiddleware';
import * as dashboardController from '../../controllers/admin/dashboardController';

const router = Router();

router.get('/dashboard', isAdmin, requireCapability('dashboard.view'), dashboardController.getDashboard);

export default router;
