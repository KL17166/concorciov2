import { Router } from 'express';
import { isAdmin } from '../../middlewares/adminAuthMiddleware';
import * as profileController from '../../controllers/admin/profileController';

const router = Router();

router.get('/profile/2fa', isAdmin, profileController.get2FASetup);
router.post('/profile/2fa/enable', isAdmin, profileController.enable2FA);
router.post('/profile/2fa/disable', isAdmin, profileController.disable2FA);

export default router;
