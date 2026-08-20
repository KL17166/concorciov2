import { Router } from 'express';
import { isAdmin } from '../../middlewares/adminAuthMiddleware';
import { requireRoles } from '../../security/adminAuth';
import * as adminUserController from '../../controllers/admin/adminUserController';

const router = Router();

router.get('/users', isAdmin, requireRoles(['MASTER']), adminUserController.listUsers);
router.get('/users/new', isAdmin, requireRoles(['MASTER']), adminUserController.newUserForm);
router.post('/users/new', isAdmin, requireRoles(['MASTER']), adminUserController.createUser);
router.get('/users/:id/edit', isAdmin, requireRoles(['MASTER']), adminUserController.editUserForm);
router.post('/users/:id/edit', isAdmin, requireRoles(['MASTER']), adminUserController.updateUser);
router.post('/users/:id/delete', isAdmin, requireRoles(['MASTER']), adminUserController.deleteUser);
router.post('/users/:id/reset-password', isAdmin, requireRoles(['MASTER']), adminUserController.resetPassword);

export default router;
