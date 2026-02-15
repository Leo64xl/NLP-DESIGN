import rateLimit from 'express-rate-limit'; 

export const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 10,
    message: {
        msg: 'Demasiados intentos de inicio de sesión. Inténtalo de nuevo más tarde.'
    },
    standardHeaders: true,
    legacyHeaders: false, 
    handler: (req, res) => {
        res.status(429).json({ 
            msg: 'Demasiados intentos de inicio de sesión. Inténtalo de nuevo más tarde.',
            action: 'wait_and_retry', 
            retryAfter: 15 * 60
        });
    },
    skipSuccessfulRequests: true, 
    keyGenerator: (req) => {
        const email = req.body?.email || 'no-email';
        return `${req.ip}_${email}`;  
    }
});