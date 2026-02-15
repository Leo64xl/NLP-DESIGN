import express from 'express';
import { forgotPassword, validateResetToken, resetPassword } from '../controllers/auth/ResetPassword';
import { passwordRecoveryLimiter } from '../middlewares/limiters/PasswordLimiter';

const router = express.Router();

router.post('/forgot-password', passwordRecoveryLimiter, (req, res, next) => {
    forgotPassword(req, res).catch(next);
});

router.get('/reset-password', (req, res, next) => {
    validateResetToken(req, res).catch(next);
});

router.post('/reset-password', (req, res, next) => {
    resetPassword(req, res).catch(next);
});

export default router;