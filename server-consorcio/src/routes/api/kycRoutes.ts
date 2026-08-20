import { Router } from 'express';
import { authenticate } from '../../middlewares/authMiddleware';
import { submitClientKyc, getClientKycStatus } from '../../controllers/api/kycApiController';

const router = Router();

// POST /api/kyc/submit — Client submits KYC documents
router.post('/kyc/submit', authenticate, submitClientKyc);

// GET /api/kyc/status — Check KYC status
router.get('/kyc/status', authenticate, getClientKycStatus);

export default router;
