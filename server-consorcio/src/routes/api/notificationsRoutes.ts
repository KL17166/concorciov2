import { Router } from 'express';
import { authenticate } from '../../middlewares/authMiddleware';
import { trackingLimiter } from '../../config/rateLimits';
import { listNotifications, markNotificationRead } from '../../controllers/api/notificationsController';

const router = Router();

// GET /api/notifications - notificações in-app do próprio usuário
router.get('/notifications', authenticate, trackingLimiter, listNotifications);

// PATCH /api/notifications/:id/read - marca como lida
router.patch('/notifications/:id/read', authenticate, trackingLimiter, markNotificationRead);

export default router;
