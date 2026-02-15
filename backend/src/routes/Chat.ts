import express from 'express';
import { sendArchitecturalMessage, generateNLP2D3DFiles } from '../controllers/messages/MessageController';
import { verifyUser } from '../middlewares/auth/Authentication';
import { RequestHandler } from 'express';

const router = express.Router();

function asyncHandler(fn: (...args: any[]) => Promise<any>): RequestHandler {
    return (req, res, next) => {
        Promise.resolve(fn(req, res, next)).catch(next);
    };
}

// Ruta existente
router.post('/design/:designUuid/messages', asyncHandler(verifyUser), asyncHandler(sendArchitecturalMessage));

// 🆕 Nueva ruta para generación NLP to 2D/3D
router.post('/design/:designUuid/nlp-files', asyncHandler(verifyUser), asyncHandler(generateNLP2D3DFiles));

router.get('/design/:designUuid/messages', asyncHandler(verifyUser), asyncHandler(async (req, res) => {
    res.json({ success: true, messages: [] });
}));

export default router;