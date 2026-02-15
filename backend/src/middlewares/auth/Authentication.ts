import Users from "../../database/models/User.model";
import { Request, Response, NextFunction } from "express";

export const verifyUser = async (req: Request, res: Response, next: NextFunction) => {
    if (!req.session.userId) {
        return res.status(401).json({ msg: "No estás autenticado" });
    };

    const user = await Users.findOne({
        where: { uuid: req.session.userId },
    });

    if (!user) {
        return res.status(404).json({ msg: "Usuario no encontrado" });
    };

    if (user.verified !== 'true') {
        const statusMessages: Record<string, string> = {
            'pending': 'Debes verificar tu correo electrónico',
            'expired': 'Tu verificación ha expirado. Regístrate nuevamente'
        };
        
        const status = user.verified || 'pending';
        
        return res.status(403).json({ 
            msg: statusMessages[status] || "Estado de verificación inválido",
            verified: status 
        });
    }

    if (user.role === 'banned') {
        return res.status(403).json({ 
            msg: "Tu cuenta ha sido baneada",
            role: 'banned'
        });
    }

    req.userId = user.uuid;
    req.role = user.role;
    next();
};

export const adminOnly = async (req: Request, res: Response, next: NextFunction) => {
    const user = await Users.findOne({
        where: { uuid: req.session.userId }
    });

    if (!user) {
        return res.status(404).json({ msg: "Usuario no encontrado" });
    };

    if (user.role !== 'admin' && user.role !== 'superadmin') {
        return res.status(403).json({ msg: "Acceso denegado" });
    };

    next();
};