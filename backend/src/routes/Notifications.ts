import express from 'express';
import { NotificationController } from '../controllers/notifications/NotificationController';
import { verifyUser } from '../middlewares/auth/Authentication';
import { RequestHandler } from 'express';

const router = express.Router();

function asyncHandler(fn: (...args: any[]) => Promise<any>): RequestHandler {
    return (req, res, next) => {
        Promise.resolve(fn(req, res, next)).catch(next);
    };
}

router.get('/notifications', asyncHandler(verifyUser), asyncHandler(NotificationController.getUserNotifications));

router.patch('/notifications/read', asyncHandler(verifyUser), asyncHandler(NotificationController.markAsRead));

router.post('/notifications', asyncHandler(verifyUser), asyncHandler(NotificationController.createNotification));

export default router;