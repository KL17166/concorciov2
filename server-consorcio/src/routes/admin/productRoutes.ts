import { Router } from 'express';
import { isAdmin } from '../../middlewares/adminAuthMiddleware';
import { requireRoles } from '../../security/adminAuth';
import * as adminProductController from '../../controllers/admin/adminProductController';

const router = Router();

router.get('/products', isAdmin, requireRoles(['MASTER', 'MANAGER']), adminProductController.listProducts);
router.get('/products/new', isAdmin, requireRoles(['MASTER', 'MANAGER']), adminProductController.newProductForm);
router.post('/products/new', isAdmin, requireRoles(['MASTER', 'MANAGER']), adminProductController.createProduct);
router.get('/products/:id/edit', isAdmin, requireRoles(['MASTER', 'MANAGER']), adminProductController.editProductForm);
router.post('/products/:id/edit', isAdmin, requireRoles(['MASTER', 'MANAGER']), adminProductController.updateProduct);
router.post('/products/:id/delete', isAdmin, requireRoles(['MASTER', 'MANAGER']), adminProductController.deleteProduct);

export default router;
