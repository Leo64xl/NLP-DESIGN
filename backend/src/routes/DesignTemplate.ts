import express from 'express';
import { DesignTemplateController } from '../controllers/designs/DesignTemplateController';
import { verifyUser } from '../middlewares/auth/Authentication';
import { RequestHandler } from 'express';

const router = express.Router();

function asyncHandler(fn: (...args: any[]) => Promise<any>): RequestHandler {
    return (req, res, next) => {
        Promise.resolve(fn(req, res, next)).catch(next);
    };
}

router.get('/templates', asyncHandler(DesignTemplateController.getTemplates));

router.get('/templates/popular', asyncHandler(DesignTemplateController.getPopularTemplates));

router.post('/templates/:templateId/customize', asyncHandler(verifyUser), asyncHandler(DesignTemplateController.customizeTemplate));

router.post('/templates/:templateId/generate', asyncHandler(verifyUser), asyncHandler(DesignTemplateController.generateFromTemplate));

export default router;