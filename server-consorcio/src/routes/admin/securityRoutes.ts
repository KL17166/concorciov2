import { Router } from 'express';
import { isAdmin, requireCapability } from '../../middlewares/adminAuthMiddleware';
import * as securityController from '../../controllers/admin/securityController';

const router = Router();

router.get('/security', isAdmin, requireCapability('security.view'), securityController.getSecurityDashboard);
router.post('/security/unblock/:id', isAdmin, requireCapability('security.manage'), securityController.unblockDevice);

export default router;
