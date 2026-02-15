import rateLimit from 'express-rate-limit';

export const registerLimiter = rateLimit({
    windowMs: 10 * 60 * 1000, 
    max: 20, 
    message: {
        msg: 'Demasiados intentos de registro. Inténtalo de nuevo más tarde.',
    },
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res) => {
        res.status(429).json({
            msg: 'Demasiados intentos de registro. Inténtalo de nuevo más tarde.',
            action: 'wait_and_retry',
            retryAfter: 10 * 60 
        });
    },
    skipSuccessfulRequests: true, 
    keyGenerator: (req) => {
        return `${req.ip}_${req.get('User-Agent') || 'unknown'}`;
    }
});