import { Router } from 'express';
import { isAdmin, requireCapability } from '../../middlewares/adminAuthMiddleware';
import * as paymentsController from '../../controllers/admin/paymentsController';
import { settlePayment } from '../../application/payments/settlePayment';
import { prisma } from '../../config/database';
import { logger } from '../../config/logger';

const router = Router();

router.get('/payments', isAdmin, requireCapability('payments.view'), paymentsController.getPayments);
router.get('/payments/calendar', isAdmin, requireCapability('payments.view'), paymentsController.getPaymentsCalendar);
router.get('/payments/overdue', isAdmin, requireCapability('payments.view'), paymentsController.getOverduePayments);
router.post('/payments/:id/update', isAdmin, requireCapability('payments.manage'), paymentsController.updatePayment);

router.post('/payments/:id/mark-paid', isAdmin, requireCapability('payments.manage'), async (req, res) => {
    const id = req.params.id as string;
    const { paymentMethod, paymentDate } = req.body;

    try {
        const result = await settlePayment({
            installmentId: id,
            paymentMethod: paymentMethod || undefined,
            paymentDate: paymentDate ? new Date(paymentDate) : undefined,
            channel: 'ADMIN'
        });

        req.flash(result.success ? 'success_msg' : 'error_msg', result.message);

        const installment = await prisma.installment.findUnique({ where: { id } });
        res.redirect(installment ? `/admin/contracts/${installment.subscriptionId}` : '/admin/contracts');
    } catch (error) {
        logger.error('Mark contract installment paid error:', error);
        req.flash('error_msg', 'Erro ao marcar parcela como paga.');
        res.redirect('/admin/contracts');
    }
});

export default router;
