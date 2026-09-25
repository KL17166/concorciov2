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

// Baixa em lote: confirma N parcelas de uma vez (conferência do PIX combinado ou caixa)
router.post('/payments/bulk-mark-paid', isAdmin, requireCapability('payments.manage'), async (req, res) => {
    const adminUser = (req as any).session?.user;
    const ids = Array.isArray(req.body?.ids) ? req.body.ids.filter((x: unknown) => typeof x === 'string') : [];
    const { paymentMethod, paymentDate, motivo } = req.body;
    try {
        if (ids.length === 0 || ids.length > 12) {
            req.flash('error_msg', 'Selecione de 1 a 12 parcelas.');
            return res.redirect(req.get('Referer') || '/admin/payments');
        }
        const done: string[] = [];
        const failed: string[] = [];
        for (const id of ids) {
            const r = await settlePayment({
                installmentId: id,
                paymentMethod: paymentMethod || 'ADMIN_MANUAL',
                paymentDate: paymentDate ? new Date(paymentDate) : undefined,
                channel: 'ADMIN'
            });
            (r.success ? done : failed).push(`${id.slice(0, 8)}${r.success ? '' : `: ${r.message}`}`);
        }
        await prisma.auditLog.create({
            data: {
                userId: adminUser?.id || null,
                action: 'BULK_PAYMENT_CONFIRMED',
                resource: 'installment',
                details: JSON.stringify({ count: done.length, done, failed, adminName: adminUser?.name, motivo: motivo || null }),
                ipAddress: req.ip || 'unknown'
            }
        }).catch(() => {});
        req.flash(failed.length ? 'error_msg' : 'success_msg',
            failed.length ? `Baixadas ${done.length}, falhas ${failed.length}: ${failed.join('; ')}` : `${done.length} parcela(s) baixada(s) com sucesso.`);
        res.redirect(req.get('Referer') || '/admin/payments');
    } catch (error) {
        logger.error('Bulk mark paid error:', error);
        req.flash('error_msg', 'Erro na baixa em lote.');
        res.redirect(req.get('Referer') || '/admin/payments');
    }
});

// Confirmar lote (PIX combinado conferido no extrato → baixa as N)
router.post('/payments/batch/:batchId/confirm', isAdmin, requireCapability('payments.manage'), async (req, res) => {
    const adminUser = (req as any).session?.user;
    const batchId = req.params.batchId as string;
    try {
        const batch = await (prisma as any).paymentBatch.findUnique({ where: { id: batchId } });
        if (!batch || batch.status !== 'ACTIVE') {
            req.flash('error_msg', 'Lote não está aguardando confirmação.');
            return res.redirect('/admin/payments');
        }
        const installmentIds: string[] = JSON.parse(batch.installmentIds || '[]');
        const done: string[] = [];
        const failed: string[] = [];
        for (const instId of installmentIds) {
            const r = await settlePayment({ installmentId: instId, paymentMethod: `${batch.provider}_MANUAL`, channel: 'ADMIN' });
            (r.success ? done : failed).push(instId.slice(0, 8));
            await (prisma as any).paymentAttempt.updateMany({
                where: { batchId, installmentId: instId, status: 'ACTIVE' },
                data: { status: r.success ? 'PAID' : 'EXPIRED' }
            }).catch(() => {});
        }
        if (failed.length === 0) {
            await (prisma as any).paymentBatch.update({ where: { id: batchId }, data: { status: 'PAID', paidAt: new Date() } });
        }
        await prisma.auditLog.create({
            data: {
                userId: adminUser?.id || null,
                action: 'BATCH_PAYMENT_CONFIRMED_MANUAL',
                resource: 'payment_batch',
                details: JSON.stringify({ batchId, count: done.length, failed, adminName: adminUser?.name }),
                ipAddress: req.ip || 'unknown'
            }
        }).catch(() => {});
        await (prisma as any).systemAlert.updateMany({
            where: { status: { in: ['OPEN', 'ACK', 'IN_PROGRESS'] }, details: { contains: batchId } },
            data: { status: 'RESOLVED', read: true, readAt: new Date(), readBy: adminUser?.id || null, resolvedAt: new Date() }
        }).catch(() => {});
        req.flash(failed.length ? 'error_msg' : 'success_msg',
            failed.length ? `Lote parcial: ${done.length} baixadas, ${failed.length} com falha.` : `Lote confirmado: ${done.length} parcela(s) liquidadas.`);
        res.redirect('/admin/payments');
    } catch (error) {
        logger.error('Confirm batch error:', error);
        req.flash('error_msg', 'Erro ao confirmar lote.');
        res.redirect('/admin/payments');
    }
});

export default router;
