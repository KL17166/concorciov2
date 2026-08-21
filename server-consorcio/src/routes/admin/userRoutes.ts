import { Router } from 'express';
import { isAdmin, requireCapability } from '../../middlewares/adminAuthMiddleware';
import * as peopleController from '../../controllers/admin/peopleController';

const router = Router();

// Compatibilidade para integrações e formulários antigos: a regra real fica em Pessoas.
router.post('/users/new', isAdmin, requireCapability('people.create'), peopleController.createPerson);
router.post('/users/:id/edit', isAdmin, requireCapability('people.edit_profile'), peopleController.updateProfile);
router.post('/users/:id/delete', isAdmin, requireCapability('people.delete'), peopleController.deletePerson);
router.post('/users/:id/reset-password', isAdmin, requireCapability('people.change_password'), peopleController.resetPassword);

export default router;
