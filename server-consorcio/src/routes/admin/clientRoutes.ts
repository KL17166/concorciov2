import { Router } from 'express';
import crypto from 'crypto';
import { isAdmin } from '../../middlewares/adminAuthMiddleware';
import { requireRoles } from '../../security/adminAuth';
import * as clientsController from '../../controllers/admin/clientsController';
import { settlePayment } from '../../application/payments/settlePayment';
import { prisma } from '../../config/database';
import { hashPassword } from '../../security/password';
import { logger } from '../../config/logger';

const router = Router();

router.get('/clients', isAdmin, clientsController.getClients);
router.get('/clients/new', isAdmin, requireRoles(['MASTER', 'MANAGER']), clientsController.getNewClient);
router.post('/clients/new', isAdmin, requireRoles(['MASTER', 'MANAGER']), clientsController.createClient);
router.get('/clients/:id', isAdmin, clientsController.getClientDetails);
router.get('/clients/:id/edit', isAdmin, requireRoles(['MASTER', 'MANAGER']), clientsController.getEditClient);
router.post('/clients/:id/edit', isAdmin, requireRoles(['MASTER', 'MANAGER']), clientsController.updateClient);
router.post('/clients/:id/delete', isAdmin, requireRoles(['MASTER', 'MANAGER']), clientsController.deleteClient);

// Mark client installment as paid (via settlePayment)
router.post('/clients/:clientId/installments/:installmentId/mark-paid', isAdmin, requireRoles(['MASTER', 'MANAGER']), async (req, res) => {
    const clientId = req.params.clientId as string;
    const installmentId = req.params.installmentId as string;
    try {
        const result = await settlePayment({
            installmentId,
            channel: 'ADMIN'
        });

        if (result.success) {
            req.flash('success_msg', result.message);
        } else {
            req.flash('error_msg', result.message);
        }
        res.redirect(`/admin/clients/${clientId}`);
    } catch (error) {
        logger.error('Mark client installment paid error:', error);
        req.flash('error_msg', 'Erro ao marcar parcela como paga.');
        res.redirect(`/admin/clients/${clientId}`);
    }
});

// Reset client password
router.post('/clients/:id/reset-password', isAdmin, requireRoles(['MASTER', 'MANAGER']), async (req, res) => {
    const id = req.params.id as string;
    try {
        const newPassword = crypto.randomBytes(12).toString('base64url').slice(0, 12);
        const hashedPassword = await hashPassword(newPassword);

        await prisma.user.update({
            where: { id },
            data: { passwordHash: hashedPassword }
        });

        req.flash('success_msg', `Senha resetada! Nova senha: ${newPassword}`);
        res.redirect(`/admin/clients/${id}`);
    } catch (error) {
        logger.error('Password reset error:', error);
        req.flash('error_msg', 'Erro ao resetar senha.');
        res.redirect(`/admin/clients/${id}`);
    }
});

export default router;
