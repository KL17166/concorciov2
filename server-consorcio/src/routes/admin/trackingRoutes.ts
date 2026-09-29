import { Router, Request, Response, NextFunction } from 'express';
import { isAdmin, requireCapability } from '../../middlewares/adminAuthMiddleware';
import * as trackingController from '../../controllers/admin/trackingController';

const router = Router();

// Pixels: só MASTER (capability genérica não separa mestre de gerente).
const requireMaster = (req: Request, res: Response, next: NextFunction) => {
    if ((req.session as any)?.user?.role !== 'MASTER') {
        req.flash('error_msg', 'Apenas o usuário mestre pode alterar os pixels.');
        return res.redirect('/admin/tracking');
    }
    return next();
};

router.get('/tracking', isAdmin, requireCapability('reports.view'), trackingController.getTracking);
router.post('/tracking/pixels', isAdmin, requireMaster, trackingController.updatePixels);

export default router;
