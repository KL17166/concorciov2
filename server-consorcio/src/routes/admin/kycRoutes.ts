import { Router } from 'express';
import { isAdmin, requireCapability } from '../../middlewares/adminAuthMiddleware';
import * as kycController from '../../controllers/admin/kycController';

const router = Router();

router.get('/kyc', isAdmin, requireCapability('compliance.view'), kycController.getKycQueue);
router.get('/kyc/:userId', isAdmin, requireCapability('compliance.view'), kycController.getKycDetail);
router.get('/kyc/:userId/documents/:fileName', isAdmin, requireCapability('compliance.view'), kycController.getAdminKycDocument);
router.post('/kyc/:userId/approve', isAdmin, requireCapability('compliance.review'), kycController.approveKyc);
router.post('/kyc/:userId/reject', isAdmin, requireCapability('compliance.review'), kycController.rejectKyc);
router.post('/kyc/:userId/override', isAdmin, requireCapability('compliance.review'), kycController.overrideKyc);
router.post('/kyc/:userId/retrigger', isAdmin, requireCapability('compliance.review'), kycController.retriggerKyc);

export default router;
