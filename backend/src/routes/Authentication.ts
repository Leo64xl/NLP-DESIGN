import express from 'express';
import { Login, 
        Logout, 
        Me
} from '../controllers/auth/Authentication';
import { loginLimiter } from '../middlewares/limiters/LoginLimiter';

const router = express.Router();

router.get('/me', (req, res, next) => {
    Me(req, res).catch(next);
});

router.post('/login', loginLimiter, (req, res, next) => {
    Login(req, res).catch(next);
});

router.delete('/logout', (req, res, next) => {
    Logout(req, res).catch(next);
});

export default router;