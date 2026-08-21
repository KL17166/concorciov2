import { Router } from 'express';
import { isAdmin, requireCapability } from '../../middlewares/adminAuthMiddleware';
import * as gatewayController from '../../controllers/admin/gatewayController';

const router = Router();

router.get('/gateways', isAdmin, requireCapability('integrations.view'), gatewayController.listGateways);
router.get('/gateways/sigilopay/balance', isAdmin, requireCapability('integrations.view'), gatewayController.getSigiloPayBalance);
router.post('/gateways/sigilopay/withdraw', isAdmin, requireCapability('integrations.manage'), gatewayController.requestSigiloPayWithdraw);
router.post('/gateways/:id/update', isAdmin, requireCapability('integrations.manage'), gatewayController.updateGateway);
router.post('/gateways/:id/toggle', isAdmin, requireCapability('integrations.manage'), gatewayController.toggleGateway);

export default router;
