import Users from '../../database/models/User.model';
import { Request, Response } from 'express';
import argon2 from 'argon2';

export const Login = async (req: Request, res: Response) => {
   try {
    
    if (!req.body.email || !req.body.password) {
        return res.status(400).json({ msg: "Todos los campos son obligatorios" });
    }
    
    const user = await Users.findOne({
        where: { email: req.body.email }
    });

    if(!user) {
        return res.status(404).json({msg: "Credenciales incorrectas"});
    }

    const match = await argon2.verify(user.password, req.body.password);

    if(!match) {
        return res.status(404).json({ msg: "Credenciales incorrectas" });
    }

    if (user.verified !== 'true') {
        switch(user.verified) {
            case 'pending':
                return res.status(403).json({
                    msg: "Debes verificar tu correo antes de iniciar sesión.",
                    verified: 'pending',
                    action: 'verify_email',
                    email: user.email  
                });
            case 'expired':
                return res.status(403).json({
                    msg: "Tu enlace de verificación ha expirado. Genera uno nuevo.",
                    verified: 'expired',
                    action: 'resend_verification',
                    email: user.email  
                });
            default:
                return res.status(403).json({
                    msg: "Estado de verificación inválido.",
                    verified: user.verified,
                    action: 'contact_support'
                });
        }
    }

    if(user.role === 'banned') {
        return res.status(403).json({ 
            msg: "Tu cuenta ha sido baneada permanentemente.",
            role: 'banned',
            action: 'contact_support'
        });
    }

    const loginUser = () => {
        req.session.userId = user.uuid;
        const { id, uuid, username, verified, email, role } = user;
        res.status(200).json({ uuid, username, verified, email, role });
    };

    if(req.session.userId) {        
        req.session.regenerate((err) => {
            if (err) {
                return res.status(500).json({ msg: "Error al crear nueva sesión" });
            }
            loginUser();
        });
    } else {
        loginUser();
    }
    
    } catch (error) {
        console.error("Error al iniciar sesión:", error);
        res.status(500).json({ msg: "Error interno del servidor" });
    };
};

export const Logout = async (req: Request, res: Response) => {
    req.session.destroy((err) => {
        if (err) {
            return res.status(400).json({ msg: "No se pudo cerrar la sesión" });
        }
        res.status(200).json({ msg: "Sesión cerrada correctamente" });
    });
};

export const Me = async (req: Request, res: Response) => {
    if (!req.session.userId) {
        return res.status(401).json({ msg: "No estás autenticado" });
    }

    try {
        const user = await Users.findOne({
            attributes: ['uuid', 'username', 'email', 'role', 'verified'], 
            where: { uuid: req.session.userId }
        });

        if (!user) {
            return res.status(404).json({ msg: "Usuario no encontrado" });
        }

        res.status(200).json(user);
    } catch (error) {
        console.error("Error en Me:", error);
        res.status(500).json({ msg: "Error interno del servidor" });
    }
};