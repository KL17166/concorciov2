import { Router } from 'express';
import { authenticate } from '../../middlewares/authMiddleware';
import {
    submitClientKyc,
    getClientKycStatus,
    getKycDocument
} from '../../controllers/api/kycApiController';

const router = Router();

// POST /api/kyc/submit — Client submits KYC documents
router.post('/kyc/submit', authenticate, submitClientKyc);

// GET /api/kyc/status — Check KYC status
router.get('/kyc/status', authenticate, getClientKycStatus);

// GET /api/kyc/documents/:userId/:fileName — Secure authorized document retrieval
router.get('/kyc/documents/:userId/:fileName', authenticate, getKycDocument);

export default router;
