import { Router } from 'express';
import { isAdmin } from '../../middlewares/adminAuthMiddleware';
import { requireRoles } from '../../security/adminAuth';
import * as reportsController from '../../controllers/admin/reportsController';

const router = Router();

router.get('/reports', isAdmin, requireRoles(['MASTER', 'MANAGER']), reportsController.getReports);

export default router;
