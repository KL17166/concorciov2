import { Router } from 'express';
import jwt from 'jsonwebtoken';
import { prisma } from '../../config/database';
import { logger } from '../../config/logger';
import { verifyPassword } from '../../security/password';
import { isAdmin } from '../../middlewares/adminAuthMiddleware';
const { authenticator } = require('otplib');

const router = Router();

function setupAdminSession(req: any, res: any, user: any, rememberMe: boolean) {
    req.session.regenerate((err: any) => {
        if (err) {
            logger.error('Session regeneration error:', err);
            req.flash('error', 'Erro interno ao processar login.');
            return res.redirect('/admin/login');
        }

        req.session.user = {
            id: user.id,
            name: user.name,
            email: user.email,
            role: user.role
        };

        const adminToken = jwt.sign(
            { userId: user.id, role: user.role, type: 'admin_panel' },
            process.env.JWT_SECRET as string,
            { algorithm: 'HS256', expiresIn: '2h' } as any
        );
        req.session.adminToken = adminToken;

        if (rememberMe) {
            req.session.cookie.maxAge = 30 * 24 * 60 * 60 * 1000; // 30 days
        } else {
            req.session.cookie.maxAge = 24 * 60 * 60 * 1000; // 24 hours
        }

        req.session.save((saveErr: any) => {
            if (saveErr) {
                logger.error('Session save error:', saveErr);
                req.flash('error', 'Erro interno ao processar login.');
                return res.redirect('/admin/login');
            }
            res.redirect('/admin/dashboard');
        });
    });
}

router.get('/', (_req, res) => {
    res.redirect('/admin/login');
});

router.get('/login', (_req, res) => {
    res.render('pages/auth/login');
});

router.post('/login', async (req, res) => {
    const { email, password } = req.body;

    try {
        const user = await prisma.user.findFirst({ where: { email } });

        if (!user || !['MASTER', 'MANAGER', 'SUPPORT'].includes(user.role)) {
            req.flash('error', 'Credenciais inválidas ou sem permissão.');
            return res.redirect('/admin/login');
        }

        const validPassword = await verifyPassword(password, user.passwordHash);
        if (!validPassword) {
            req.flash('error', 'Credenciais inválidas.');
            return res.redirect('/admin/login');
        }

        if (user.twoFactorEnabled && user.twoFactorSecret) {
            (req.session as any).pending2FAUserId = user.id;
            (req.session as any).rememberMe = req.body.remember === 'on';
            return res.redirect('/admin/login/2fa');
        }

        setupAdminSession(req, res, user, req.body.remember === 'on');
    } catch (error) {
        logger.error('Admin login error:', error);
        req.flash('error', 'Erro interno ao processar login.');
        res.redirect('/admin/login');
    }
});

router.get('/login/2fa', (req, res) => {
    if (!(req.session as any).pending2FAUserId) return res.redirect('/admin/login');
    res.render('pages/auth/login-2fa');
});

router.post('/login/2fa', async (req, res) => {
    const userId = (req.session as any).pending2FAUserId;
    if (!userId) return res.redirect('/admin/login');

    const { token } = req.body;
    try {
        const user = await prisma.user.findUnique({ where: { id: userId } });
        if (!user || !user.twoFactorSecret) return res.redirect('/admin/login');

        const isValid = authenticator.verify({ token, secret: user.twoFactorSecret });
        if (!isValid) {
            req.flash('error', 'Código 2FA inválido.');
            return res.redirect('/admin/login/2fa');
        }

        delete (req.session as any).pending2FAUserId;
        setupAdminSession(req, res, user, (req.session as any).rememberMe);
    } catch (err) {
        logger.error('2FA verification error:', err);
        req.flash('error', 'Erro interno ao validar 2FA.');
        res.redirect('/admin/login');
    }
});

router.get('/logout', (req, res) => {
    req.session.destroy(() => {
        res.redirect('/admin/login');
    });
});

router.get('/token', isAdmin, (req, res) => {
    const token = (req.session as any).adminToken;
    if (!token) {
        return res.status(401).json({ error: 'Token não disponível. Faça login novamente.' });
    }
    res.json({ token });
});

export default router;
