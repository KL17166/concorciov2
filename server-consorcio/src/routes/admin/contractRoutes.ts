import { Router } from 'express';
import { isAdmin } from '../../middlewares/adminAuthMiddleware';
import { requireRoles } from '../../security/adminAuth';
import * as contractsController from '../../controllers/admin/contractsController';

const router = Router();

router.get('/contracts', isAdmin, contractsController.getContracts);
router.get('/contracts/new', isAdmin, requireRoles(['MASTER', 'MANAGER']), contractsController.getNewContract);
router.post('/contracts/new', isAdmin, requireRoles(['MASTER', 'MANAGER']), contractsController.createContract);
router.get('/contracts/:id', isAdmin, contractsController.getContractDetails);
router.post('/contracts/:id/contemplate', isAdmin, requireRoles(['MASTER', 'MANAGER']), contractsController.contemplateContract);
router.post('/contracts/:id/cancel', isAdmin, requireRoles(['MASTER', 'MANAGER']), contractsController.cancelContract);

export default router;
