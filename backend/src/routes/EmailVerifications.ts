import express from 'express';
import { resendLimiter } from '../middlewares/limiters/ResendLimiter';
import { verifyEmail, resendVerification } from '../controllers/auth/EmailVerification';

const router = express.Router();

router.get('/verify-email', (req, res, next) => {
  verifyEmail(req, res).catch(next);
});

router.post('/resend-verification', resendLimiter, (req, res, next) => {
    resendVerification(req, res).catch(next);
});

export default router;