import rateLimit from 'express-rate-limit';

export const passwordRecoveryLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, 
    max: 3, 
    message: {
        success: false,
        message: "Demasiados intentos de recuperación. Espera 15 minutos antes de intentar nuevamente.",
        action: 'wait'
    },
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res) => {
        res.status(429).json({
            success: false,
            message: 'Demasiados intentos de recuperación. Espera 15 minutos antes de intentar nuevamente.',
            action: 'wait',
            retryAfter: 15 * 60
        });
    },
    skipSuccessfulRequests: true,
    keyGenerator: (req) => {
        return req.ip || 'unknown';
    }
});