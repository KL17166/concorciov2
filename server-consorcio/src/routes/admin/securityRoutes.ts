import { Router } from 'express';
import { isAdmin } from '../../middlewares/adminAuthMiddleware';
import { requireRoles } from '../../security/adminAuth';
import * as securityController from '../../controllers/admin/securityController';

const router = Router();

router.get('/security', isAdmin, requireRoles(['MASTER']), securityController.getSecurityDashboard);
router.post('/security/unblock/:id', isAdmin, requireRoles(['MASTER']), securityController.unblockDevice);

export default router;
