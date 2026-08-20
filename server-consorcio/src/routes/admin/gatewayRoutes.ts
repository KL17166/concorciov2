import { Router } from 'express';
import { isAdmin } from '../../middlewares/adminAuthMiddleware';
import { requireRoles } from '../../security/adminAuth';
import * as gatewayController from '../../controllers/admin/gatewayController';

const router = Router();

router.get('/gateways', isAdmin, requireRoles(['MASTER']), gatewayController.listGateways);
router.get('/gateways/sigilopay/balance', isAdmin, requireRoles(['MASTER']), gatewayController.getSigiloPayBalance);
router.post('/gateways/sigilopay/withdraw', isAdmin, requireRoles(['MASTER']), gatewayController.requestSigiloPayWithdraw);
router.post('/gateways/:id/update', isAdmin, requireRoles(['MASTER']), gatewayController.updateGateway);
router.post('/gateways/:id/toggle', isAdmin, requireRoles(['MASTER']), gatewayController.toggleGateway);

export default router;
