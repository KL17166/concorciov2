import { Router } from 'express';
import { isAdmin, requireCapability } from '../../middlewares/adminAuthMiddleware';
import * as dashboardController from '../../controllers/admin/dashboardController';

const router = Router();

router.get('/dashboard', isAdmin, requireCapability('dashboard.view'), dashboardController.getDashboard);
router.post('/alerts/:id/read', isAdmin, requireCapability('dashboard.view'), dashboardController.markAlertAsRead);
router.post('/alerts/read-all', isAdmin, requireCapability('dashboard.view'), dashboardController.markAllAlertsAsRead);

export default router;
