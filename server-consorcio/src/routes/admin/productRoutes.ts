import { Router } from 'express';
import { isAdmin, requireCapability } from '../../middlewares/adminAuthMiddleware';
import * as adminProductController from '../../controllers/admin/adminProductController';

const router = Router();

router.get('/products', isAdmin, requireCapability('catalog.view'), adminProductController.listProducts);
router.get('/products/new', isAdmin, requireCapability('catalog.manage'), adminProductController.newProductForm);
router.post('/products/new', isAdmin, requireCapability('catalog.manage'), adminProductController.createProduct);
router.get('/products/:id/edit', isAdmin, requireCapability('catalog.manage'), adminProductController.editProductForm);
router.post('/products/:id/edit', isAdmin, requireCapability('catalog.manage'), adminProductController.updateProduct);
router.post('/products/:id/delete', isAdmin, requireCapability('catalog.manage'), adminProductController.deleteProduct);

export default router;
