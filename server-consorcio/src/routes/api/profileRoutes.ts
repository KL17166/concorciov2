import { Router } from 'express';
import { authenticate } from '../../middlewares/authMiddleware';
import { updateProfile } from '../../controllers/api/profileApiController';

const router = Router();

// PATCH /api/profile - Atualizar e-mail/telefone do próprio cadastro
router.patch('/profile', authenticate, updateProfile);

export default router;
