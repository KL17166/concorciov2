import { Router } from 'express';
import { isAdmin } from '../../middlewares/adminAuthMiddleware';
import { requireRoles } from '../../security/adminAuth';
import * as paymentsController from '../../controllers/admin/paymentsController';
import { settlePayment } from '../../application/payments/settlePayment';
import { prisma } from '../../config/database';
import { logger } from '../../config/logger';

const router = Router();

router.get('/payments', isAdmin, requireRoles(['MASTER', 'MANAGER']), paymentsController.getPayments);
router.get('/payments/calendar', isAdmin, requireRoles(['MASTER', 'MANAGER']), paymentsController.getPaymentsCalendar);
router.get('/payments/overdue', isAdmin, requireRoles(['MASTER', 'MANAGER']), paymentsController.getOverduePayments);
router.post('/payments/:id/update', isAdmin, requireRoles(['MASTER', 'MANAGER']), paymentsController.updatePayment);

// Mark payment as paid (via settlePayment)
router.post('/payments/:id/mark-paid', isAdmin, requireRoles(['MASTER', 'MANAGER']), async (req, res) => {
    const id = req.params.id as string;
    const { paymentMethod, paymentDate } = req.body;

    try {
        const result = await settlePayment({
            installmentId: id,
            paymentMethod: paymentMethod || undefined,
            paymentDate: paymentDate ? new Date(paymentDate) : undefined,
            channel: 'ADMIN'
        });

        if (result.success) {
            req.flash('success_msg', result.message);
        } else {
            req.flash('error_msg', result.message);
        }

        const installment = await prisma.installment.findUnique({ where: { id } });
        if (installment) {
            res.redirect(`/admin/contracts/${installment.subscriptionId}`);
        } else {
            res.redirect('/admin/contracts');
        }
    } catch (error) {
        logger.error('Mark contract installment paid error:', error);
        req.flash('error_msg', 'Erro ao marcar parcela como paga.');
        res.redirect('/admin/contracts');
    }
});

export default router;
