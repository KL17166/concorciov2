import { Router } from 'express';
import * as csrfMiddleware from '../../middlewares/csrfMiddleware';

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
import securityRoutes from './securityRoutes';
import gatewayRoutes from './gatewayRoutes';
import kycRoutes from './kycRoutes';
import profileRoutes from './profileRoutes';

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
// MOUNT DOMAIN ROUTERS
// ========================================
router.use(authRoutes);
router.use(dashboardRoutes);
router.use(profileRoutes);
router.use(clientRoutes);
router.use(contractRoutes);
router.use(paymentRoutes);
router.use(bidRoutes);
router.use(productRoutes);
router.use(userRoutes);
router.use(reportRoutes);
router.use(securityRoutes);
router.use(gatewayRoutes);
router.use(kycRoutes);

export default router;
