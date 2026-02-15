import express from 'express';
import { AdminDashboardController } from '../controllers/dashboards/admin/AdminDashboard';
import { verifyUser, adminOnly } from '../middlewares/auth/Authentication';
import { RequestHandler } from 'express';

const router = express.Router();

function asyncHandler(fn: (...args: any[]) => Promise<any>): RequestHandler {
    return (req, res, next) => {
        Promise.resolve(fn(req, res, next)).catch(next);
    };
}

router.get('/admin/overview', asyncHandler(verifyUser), asyncHandler(adminOnly), asyncHandler(AdminDashboardController.getOverview));

router.get('/admin/metrics', asyncHandler(verifyUser), asyncHandler(adminOnly), asyncHandler(AdminDashboardController.getMetrics));

router.post('/admin/actions', asyncHandler(verifyUser), asyncHandler(adminOnly), asyncHandler(AdminDashboardController.performActions));

export default router;