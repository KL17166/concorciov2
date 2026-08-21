import { Router } from 'express';
import { isAdmin, requireCapability } from '../../middlewares/adminAuthMiddleware';
import * as profileController from '../../controllers/admin/profileController';

const router = Router();

router.get('/profile/2fa', isAdmin, requireCapability('account.security'), profileController.get2FASetup);
router.post('/profile/2fa/enable', isAdmin, requireCapability('account.security'), profileController.enable2FA);
router.post('/profile/2fa/disable', isAdmin, requireCapability('account.security'), profileController.disable2FA);

export default router;
