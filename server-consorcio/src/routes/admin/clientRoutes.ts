import { Router } from 'express';
import { isAdmin, requireCapability } from '../../middlewares/adminAuthMiddleware';
import * as peopleController from '../../controllers/admin/peopleController';
import { settlePayment } from '../../application/payments/settlePayment';
import { logger } from '../../config/logger';

const router = Router();

// Os GETs legados são resolvidos por peopleRoutes antes deste router.
// Estes POSTs permanecem apenas como compatibilidade e delegam para Pessoas.
router.post('/clients/new', isAdmin, requireCapability('people.create'), peopleController.createPerson);
router.post('/clients/:id/edit', isAdmin, requireCapability('people.edit_profile'), peopleController.updateProfile);
router.post('/clients/:id/delete', isAdmin, requireCapability('people.delete'), peopleController.deletePerson);
router.post('/clients/:id/reset-password', isAdmin, requireCapability('people.change_password'), peopleController.resetPassword);

// A ação financeira continua no domínio Financeiro, mas retorna para o perfil unificado.
router.post('/clients/:clientId/installments/:installmentId/mark-paid', isAdmin, requireCapability('payments.manage'), async (req, res) => {
    const clientId = req.params.clientId as string;
    const installmentId = req.params.installmentId as string;
    try {
        const result = await settlePayment({ installmentId, channel: 'ADMIN' });
        req.flash(result.success ? 'success_msg' : 'error_msg', result.message);
    } catch (error) {
        logger.error('Mark client installment paid error:', error);
        req.flash('error_msg', 'Erro ao marcar parcela como paga.');
    }
    res.redirect(`/admin/people/${clientId}`);
});

export default router;
