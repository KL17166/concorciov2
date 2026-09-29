import { Router } from 'express';
import { optionalAuth } from '../../middlewares/authMiddleware';
import { trackingLimiter } from '../../config/rateLimits';
import { recordClientEvent, getPixelConfig } from '../../controllers/api/trackingController';

const router = Router();

// POST /api/track - Pixel próprio. Auth opcional: logado vincula userId,
// anônimo registra com guestId (costura pré-login, sem PII).
router.post('/track', optionalAuth, trackingLimiter, recordClientEvent);

// GET /api/pixel-config - IDs públicos p/ o front (sem auth, sem tokens).
router.get('/pixel-config', getPixelConfig);

export default router;
