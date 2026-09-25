import { Router } from 'express';
import { authenticate } from '../../middlewares/authMiddleware';
import { trackingLimiter } from '../../config/rateLimits';
import { recordClientEvent } from '../../controllers/api/trackingController';

const router = Router();

// POST /api/track - Pixel próprio (SCREEN_VIEW, GENERATE_QR_CLICK, etc.)
router.post('/track', authenticate, trackingLimiter, recordClientEvent);

export default router;
