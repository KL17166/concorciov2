import { Router } from 'express';
import { isAdmin, requireCapability } from '../../middlewares/adminAuthMiddleware';
import { catalogUpload } from '../../middlewares/uploadMiddleware';
import * as adminProductController from '../../controllers/admin/adminProductController';

const router = Router();

router.get('/products', isAdmin, requireCapability('catalog.view'), adminProductController.listProducts);
router.get('/products/new', isAdmin, requireCapability('catalog.manage'), adminProductController.newProductForm);
router.post('/products/new', isAdmin, requireCapability('catalog.manage'), adminProductController.createProduct);
router.post('/products/reorder', isAdmin, requireCapability('catalog.manage'), adminProductController.reorderProducts);
router.post('/products/upload', isAdmin, requireCapability('catalog.manage'), (req, res, next) => {
    catalogUpload.single('photo')(req, res, (err: any) => {
        if (err) return res.status(400).json({ ok: false, message: err.message || 'Arquivo rejeitado.' });
        next();
    });
}, adminProductController.uploadCatalogImage);
router.get('/products/:id/preview', isAdmin, requireCapability('catalog.view'), adminProductController.previewProduct);
router.get('/products/:id/edit', isAdmin, requireCapability('catalog.manage'), adminProductController.editProductForm);
router.post('/products/:id/edit', isAdmin, requireCapability('catalog.manage'), adminProductController.updateProduct);
router.post('/products/:id/move', isAdmin, requireCapability('catalog.manage'), adminProductController.moveProduct);
router.post('/products/:id/toggle', isAdmin, requireCapability('catalog.manage'), adminProductController.toggleProductFlag);
router.post('/products/:id/delete', isAdmin, requireCapability('catalog.manage'), adminProductController.deleteProduct);
router.post('/products/:id/verify-image', isAdmin, requireCapability('catalog.manage'), adminProductController.verifyProductImage);

export default router;
