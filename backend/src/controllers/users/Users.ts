import Users from '../../database/models/User.model';
import { Request, Response } from 'express';
import { sendVerificationEmail } from '../../services/email/verify-email/Emailer'; 
import { TokenService } from '../../services/tokens/TokenEmailVerification'; 
import { Op } from 'sequelize';
import argon2 from 'argon2';
import crypto from 'crypto';
import db from '../../database/Configuration.db';

// Crud de usuarios

export const getUsers = async (req: Request, res: Response) => {
    try { 
        const response = await Users.findAll({
            attributes: ['uuid', 'username', 'email', 'role', 'verified']
        });
        res.status(200).json(response);
    } catch (error) {
        res.status(500).json({ msg: "Error interno del servidor" });
    }
};

export const getUserById = async (req: Request, res: Response) => {
    try {
        const user = await Users.findOne({
            attributes: ['uuid', 'username', 'email', 'role', 'verified'],
            where: { uuid: req.params.id }
        });
        if (!user) return res.status(404).json({ msg: "Usuario no encontrado" });
        res.status(200).json(user);
    } catch (error) {
        res.status(500).json({ msg: "Error interno del servidor" });
    }
};

export const createUser = async (req: Request, res: Response) => {
    const { username, email, password, confPassword } = req.body; 

    // Validaciones iniciales
    if(!username || !email || !password || !confPassword ) {
        return res.status(400).json({ msg: "Todos los campos son obligatorios" });
    }

    if(password === "" || password === null) {
        return res.status(400).json({ msg: "La contraseña no puede estar vacía" });
    }

    if(password !== confPassword) {
        return res.status(400).json({ msg: "Las contraseñas no coinciden" });
    }

    if(!/^[a-zA-Z0-9]+$/.test(password)) {
        return res.status(400).json({ msg: "La contraseña solo puede contener letras y números"});
    }

    if(password.length < 3 || password.length > 16) {
        return res.status(400).json({ msg: "La contraseña debe tener entre 3 y 16 caracteres" });
    }
        
    if(username.length < 3 || username.length > 100) {
        return res.status(400).json({ msg: "El nombre de usuario debe tener entre 3 y 100 caracteres" });
    }

    if(!/^[a-zA-Z0-9_]+$/.test(username)) {
        return res.status(400).json({ msg: "El nombre de usuario solo puede contener letras, números y guiones bajos" });
    }

    if(!/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(email)) {
        return res.status(400).json({ msg: "El correo electrónico no es válido" });
    }

    try {
     
        const existingUser = await Users.findOne({
          where: {
            [Op.or]: [                
                 { username },
                 { email }
                ]
            }
        });

        if (existingUser) {
          const msg = existingUser.username === username
            ? `Nombre de usuario ${username} no disponible`
            : 'Error al completar el registro';
            return res.status(400).json({ msg });
        }

        const hashedPassword = await argon2.hash(password);
        const userUuid = crypto.randomUUID();

        const transaction = await db.transaction();

        try {
            
            const newUser = await Users.create({
                uuid: userUuid,
                username: username,
                email: email,
                password: hashedPassword,
                role: 'user', 
                verified: 'pending' 
            }, { transaction });

            const jwtToken = await TokenService.createEmailVerificationToken(userUuid, email, transaction);

            await transaction.commit();

            const userIP = req.ip || req.socket?.remoteAddress || 'unknown';
            await sendVerificationEmail(email, jwtToken, username, userIP);

            res.status(201).json({ 
                msg: "Usuario creado correctamente. Revisa tu correo para verificar tu cuenta (válido por 10 minutos).",
                requiresVerificacion: true 
            });
        
        } catch (transactionError) {
            await transaction.rollback();
            console.error("Error en la transacción:", transactionError);
            throw transactionError;
        }

    } catch (error) {
        console.error("Error al crear el usuario:", error);
        res.status(500).json({ msg: "Error al crear el usuario" }); 
    }
};

export const updateUser = async (req: Request, res: Response) => {
    const user = await Users.findOne({
        where: { uuid: req.params.id }
    });
    
    if (!user) return res.status(404).json({ msg: "Usuario no encontrado" });
    
    const { username, email, password, confPassword, role } = req.body;
    
    let hashedPassword;
   
    if (password) {
        if (!/^[a-zA-Z0-9]+$/.test(password)) {
            return res.status(400).json({ msg: "La contraseña solo puede contener letras y números" });
        }
        if (password.length < 3 || password.length > 16) { 
            return res.status(400).json({ msg: "La contraseña debe tener entre 3 y 16 caracteres" });
        }
        if (password !== confPassword) return res.status(400).json({ msg: "Las contraseñas no coinciden" });
        hashedPassword = await argon2.hash(password);
    } else {
        hashedPassword = user.password;
    }
   
    if(username.length < 3 || username.length > 100) {
        return res.status(400).json({ msg: "El nombre de usuario debe tener entre 3 y 100 caracteres" });
    }

    if(!/^[a-zA-Z0-9_]+$/.test(username)) {
        return res.status(400).json({ msg: "El nombre de usuario solo puede contener letras, números y guiones bajos" });
    }

    if(!/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(email)) {
        return res.status(400).json({ msg: "El correo electrónico no es válido" });
    }
    
    if(!['user', 'admin', 'superadmin', 'banned'].includes(role)) {
        return res.status(400).json({ msg: "Ha ocurrido un Error" });
    }
    
    try {
        await Users.update({
            username: username,
            email: email,
            password: hashedPassword,
            role: role 
        }, {
            where: { uuid: user.uuid }
        });
        res.status(200).json({ msg: "Usuario actualizado correctamente" });
    } catch (error) {
        console.error(error);
        res.status(400).json({ msg: "Error al actualizar el usuario" });
    }
};

export const deleteUser = async (req: Request, res: Response) => {
    const user = await Users.findOne({
        where: { uuid: req.params.id }
    });
    
    if (!user) return res.status(404).json({ msg: "Usuario no encontrado" });
    
    try {
        await Users.destroy({
            where: { uuid: user.uuid }
        });
        res.status(200).json({ msg: "Usuario eliminado correctamente" });
    } catch (error) {
        console.error(error);
        res.status(400).json({ msg: "Error al eliminar el usuario" });
    }
};