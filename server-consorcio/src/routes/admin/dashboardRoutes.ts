import { Router } from 'express';
import { isAdmin } from '../../middlewares/adminAuthMiddleware';
import * as dashboardController from '../../controllers/admin/dashboardController';

const router = Router();

router.get('/dashboard', isAdmin, dashboardController.getDashboard);

export default router;
