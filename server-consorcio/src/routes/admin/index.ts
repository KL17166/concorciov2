import { Router } from 'express';
import * as csrfMiddleware from '../../middlewares/csrfMiddleware';
import { prisma } from '../../config/database';

// Domain Sub-routers
import authRoutes from './authRoutes';
import dashboardRoutes from './dashboardRoutes';
import clientRoutes from './clientRoutes';
import contractRoutes from './contractRoutes';
import paymentRoutes from './paymentRoutes';
import bidRoutes from './bidRoutes';
import productRoutes from './productRoutes';
import userRoutes from './userRoutes';
import reportRoutes from './reportRoutes';
import trackingRoutes from './trackingRoutes';
import securityRoutes from './securityRoutes';
import gatewayRoutes from './gatewayRoutes';
import kycRoutes from './kycRoutes';
import ticketsRoutes from './ticketsRoutes';
import notificationsRoutes from './notificationsRoutes';
import profileRoutes from './profileRoutes';
import peopleRoutes from './peopleRoutes';

const router = Router();

// ========================================
// GLOBAL CSRF MIDDLEWARE FOR ADMIN
// ========================================
router.use((req, res, next) => {
    if (req.path === '/login' || req.path === '/logout' || req.path === '/') {
        return next();
    }
    csrfMiddleware.generateToken(req, res, next);
});

router.use((req, res, next) => {
    if (['POST', 'PUT', 'DELETE'].includes(req.method)) {
        if (req.path === '/login') {
            return next();
        }
        return csrfMiddleware.validateToken(req, res, next);
    }
    next();
});

// ========================================
// GLOBAL ALERT BELL DATA (sininho do sidebar)
// ========================================
router.use(async (req: any, res: any, next: any) => {
    res.locals.alertBell = { unread: 0, alerts: [] };
    try {
        if (req.method === 'GET' && req.session?.user) {
            const [alerts, unread] = await Promise.all([
                (prisma as any).systemAlert.findMany({
                    where: { status: { in: ['OPEN', 'ACK', 'IN_PROGRESS'] } },
                    orderBy: { createdAt: 'desc' },
                    take: 8
                }),
                (prisma as any).systemAlert.count({ where: { status: { in: ['OPEN', 'ACK', 'IN_PROGRESS'] } } })
            ]);
            res.locals.alertBell = { unread, alerts };
        }
    } catch (_) {
        // Sem alertas — sino apagado, sem quebrar a página
    }
    next();
});

// ========================================
// MOUNT DOMAIN ROUTERS
// ========================================
router.use(authRoutes);
router.use(dashboardRoutes);
router.use(profileRoutes);
router.use(peopleRoutes);
router.use(clientRoutes);
router.use(contractRoutes);
router.use(paymentRoutes);
router.use(bidRoutes);
router.use(productRoutes);
router.use(userRoutes);
router.use(reportRoutes);
router.use(trackingRoutes);
router.use(securityRoutes);
router.use(gatewayRoutes);
router.use(kycRoutes);
router.use(ticketsRoutes);
router.use(notificationsRoutes);

export default router;
