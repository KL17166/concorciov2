import { Router } from 'express';
import { isAdmin, requireCapability } from '../../middlewares/adminAuthMiddleware';
import * as notificationsController from '../../controllers/admin/notificationsController';

const router = Router();

router.get('/notifications', isAdmin, requireCapability('notifications.view'), notificationsController.getNotifications);
router.get('/notifications/stream', isAdmin, requireCapability('notifications.view'), notificationsController.stream);
router.get('/notifications/unread-count', isAdmin, requireCapability('notifications.view'), notificationsController.unreadCount);
router.post('/notifications/:id/claim', isAdmin, requireCapability('notifications.view'), notificationsController.claim);
router.post('/notifications/:id/release', isAdmin, requireCapability('notifications.view'), notificationsController.release);
router.post('/notifications/:id/progress', isAdmin, requireCapability('notifications.view'), notificationsController.progress);
router.post('/notifications/:id/resolve', isAdmin, requireCapability('notifications.manage'), notificationsController.resolve);
router.post('/notifications/:id/dismiss', isAdmin, requireCapability('notifications.view'), notificationsController.dismiss);

export default router;
