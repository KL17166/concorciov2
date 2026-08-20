import { Router } from 'express';
import { isAdmin } from '../../middlewares/adminAuthMiddleware';
import { requireRoles } from '../../security/adminAuth';
import * as kycController from '../../controllers/admin/kycController';

const router = Router();

router.get('/kyc', isAdmin, requireRoles(['MASTER', 'MANAGER', 'SUPPORT']), kycController.getKycQueue);
router.get('/kyc/:userId', isAdmin, requireRoles(['MASTER', 'MANAGER', 'SUPPORT']), kycController.getKycDetail);
router.get('/kyc/:userId/documents/:fileName', isAdmin, requireRoles(['MASTER', 'MANAGER', 'SUPPORT']), kycController.getAdminKycDocument);
router.post('/kyc/:userId/approve', isAdmin, requireRoles(['MASTER', 'MANAGER']), kycController.approveKyc);
router.post('/kyc/:userId/reject', isAdmin, requireRoles(['MASTER', 'MANAGER']), kycController.rejectKyc);
router.post('/kyc/:userId/override', isAdmin, requireRoles(['MASTER', 'MANAGER']), kycController.overrideKyc);
router.post('/kyc/:userId/retrigger', isAdmin, requireRoles(['MASTER', 'MANAGER']), kycController.retriggerKyc);

export default router;
