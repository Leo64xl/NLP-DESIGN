import rateLimit from 'express-rate-limit';

export const resendLimiter = rateLimit({
    windowMs: 5 * 60 * 1000, 
    max: 2, 
    message: {
        msg: 'Demasiados intentos de reenvío. Espera 5 minutos antes de intentar nuevamente.'
    },
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res) => {
        res.status(429).json({
            msg: 'Demasiados intentos de reenvío. Espera 5 minutos antes de intentar nuevamente.',
            action: 'wait_and_retry',
            retryAfter: 5 * 60
        });
    },
    skipSuccessfulRequests: true,
    keyGenerator: (req) => {
        const email = req.body?.email || 'no-email';
        return `${req.ip}_${email}`;
    }
});