import { Router } from 'express';
import { isAdmin, requireCapability } from '../../middlewares/adminAuthMiddleware';
import * as reportsController from '../../controllers/admin/reportsController';

const router = Router();

router.get('/reports', isAdmin, requireCapability('reports.view'), reportsController.getReports);

export default router;
