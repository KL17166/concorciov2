import { Router } from 'express';
import { isAdmin, requireCapability } from '../../middlewares/adminAuthMiddleware';
import * as contractsController from '../../controllers/admin/contractsController';

const router = Router();

router.get('/contracts', isAdmin, requireCapability('contracts.view'), contractsController.getContracts);
router.get('/contracts/new', isAdmin, requireCapability('contracts.manage'), contractsController.getNewContract);
router.post('/contracts/new', isAdmin, requireCapability('contracts.manage'), contractsController.createContract);
router.get('/contracts/:id', isAdmin, requireCapability('contracts.view'), contractsController.getContractDetails);
router.post('/contracts/:id/contemplate', isAdmin, requireCapability('contracts.manage'), contractsController.contemplateContract);
router.post('/contracts/:id/cancel', isAdmin, requireCapability('contracts.manage'), contractsController.cancelContract);

export default router;
