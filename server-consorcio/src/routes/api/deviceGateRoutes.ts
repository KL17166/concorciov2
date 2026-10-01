import { Router } from 'express';
import { deviceGateLimiter } from '../../config/rateLimits';
import { recordGateEvent } from '../../controllers/api/deviceGateController';

const router = Router();

// POST /api/device-gate/event - Log de evasão do porteiro (desktop,
// devtools, resize-spoof). Sem auth (pré-login), com rate limit por IP.
router.post('/device-gate/event', deviceGateLimiter, recordGateEvent);

export default router;
