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

// Aprovar PIX com baixa manual (qualquer gateway *_WAITING_APPROVAL)
router.post('/payments/:id/approve', isAdmin, requireCapability('payments.manage'), async (req, res) => {
    const id = req.params.id as string;
    try {
        const inst = await prisma.installment.findUnique({ where: { id } });
        if (!inst || inst.status !== 'PENDING' || !(inst.paymentMethod || '').endsWith('_WAITING_APPROVAL')) {
            req.flash('error_msg', 'Parcela não está aguardando aprovação.');
            return res.redirect('/admin/payments');
        }
        const result = await settlePayment({ installmentId: id, paymentMethod: 'PIX', channel: 'ADMIN' });
        req.flash(result.success ? 'success_msg' : 'error_msg', result.message);
        res.redirect('/admin/payments');
    } catch (error) {
        logger.error('Approve payment error:', error);
        req.flash('error_msg', 'Erro ao aprovar pagamento.');
        res.redirect('/admin/payments');
    }
});

// Expirar PIX manual (QR vencido — cliente precisa gerar outro)
router.post('/payments/:id/expire', isAdmin, requireCapability('payments.manage'), async (req, res) => {
    const id = req.params.id as string;
    try {
        const inst = await prisma.installment.findUnique({ where: { id } });
        if (!inst || inst.status !== 'PENDING') {
            req.flash('error_msg', 'Parcela não está pendente.');
            return res.redirect('/admin/payments');
        }
        await prisma.installment.update({
            where: { id },
            data: { paymentMethod: (inst.paymentMethod || '').endsWith('_WAITING_APPROVAL') ? null : inst.paymentMethod }
        });
        try {
            await (prisma as any).paymentAttempt.updateMany({
                where: { installmentId: id, status: 'ACTIVE' },
                data: { status: 'EXPIRED' }
            });
        } catch (_) {}
        req.flash('success_msg', 'PIX marcado como expirado. O cliente pode gerar um novo.');
        res.redirect('/admin/payments');
    } catch (error) {
        logger.error('Expire payment error:', error);
        req.flash('error_msg', 'Erro ao expirar pagamento.');
        res.redirect('/admin/payments');
    }
});
// Rejeitar PIX com baixa manual (volta a PENDENTE limpo p/ gerar de novo)
router.post('/payments/:id/reject', isAdmin, requireCapability('payments.manage'), async (req, res) => {
    const id = req.params.id as string;
    try {
        const inst = await prisma.installment.findUnique({ where: { id } });
        if (!inst || inst.status !== 'PENDING' || !(inst.paymentMethod || '').endsWith('_WAITING_APPROVAL')) {
            req.flash('error_msg', 'Parcela não está aguardando aprovação.');
            return res.redirect('/admin/payments');
        }
        await prisma.installment.update({ where: { id }, data: { paymentMethod: null } });
        req.flash('success_msg', 'Pagamento rejeitado. O cliente pode gerar um novo PIX.');
        res.redirect('/admin/payments');
    } catch (error) {
        logger.error('Reject payment error:', error);
        req.flash('error_msg', 'Erro ao rejeitar pagamento.');
        res.redirect('/admin/payments');
    }
});

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
