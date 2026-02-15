import { Request, Response } from 'express';
import Users from '../../database/models/User.model';
import { TokenResetPasswordService } from '../../services/tokens/TokenResetPassword';
import { sendPasswordResetEmail } from '../../services/email/reset-password-request/NewPassword';
import { sendPasswordChangedNotification } from '../../services/email/reset-password-success/ResetPassword'
import db from '../../database/Configuration.db';
import jwt from 'jsonwebtoken';
import argon2 from 'argon2';

export const forgotPassword = async (req: Request, res: Response) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ 
        success: false,
        message: "El email es obligatorio",
        action: 'provide_email' 
      });
    }

    const user = await Users.findOne({
      where: { email: email.toLowerCase() }
    });
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "No se encontró una cuenta con este correo electrónico",
        action: 'check_email_or_register'
      });
    }

    if (user.verified !== 'true') {
      return res.status(400).json({
        success: false,
        message: "Tu cuenta no está verificada. Verifica tu correo antes de cambiar la contraseña.",
        action: 'verify_account'
      });
    }

    try {
      const resetToken = await TokenResetPasswordService.createPasswordResetToken(user.uuid, user.email);
      
      const userIP = req.ip || req.socket?.remoteAddress || 'unknown';
      await sendPasswordResetEmail(user.email, resetToken, user.username, userIP);
      
      return res.status(200).json({
        success: true,
        message: "Enlace de recuperación enviado correctamente a tu correo",
        action: 'check_email'
      });
      
    } catch (error) {
      console.error('Error en forgot password:', error);
      return res.status(500).json({
        success: false,
        message: "Error al enviar el correo. Intenta nuevamente.",
        action: 'retry'
      });
    }

  } catch (error) {
    console.error("Error en forgot password:", error);
    return res.status(500).json({
      success: false,
      message: "Error interno del servidor",
      action: 'retry_later'
    });
  }
};

export const validateResetToken = async (req: Request, res: Response) => {
  try {
    const { token } = req.query;

    if (!token || typeof token !== 'string') {
      return res.redirect(`${process.env.CLIENT_URL}/reset-password-error?type=invalid&message=${encodeURIComponent('Token inválido')}`);
    }

    const validation = await TokenResetPasswordService.validatePasswordResetToken(token);

    if (!validation.valid) {
      if (validation.reason === 'TOKEN_EXPIRED') {
        return res.redirect(`${process.env.CLIENT_URL}/reset-password-error?type=expired&message=${encodeURIComponent('El enlace ha expirado')}`);
      }
      return res.redirect(`${process.env.CLIENT_URL}/reset-password-error?type=invalid&message=${encodeURIComponent('Token inválido')}`);
    }

    try {
      const decodedToken = jwt.verify(
        token, 
        process.env.JWT_SECRET || 'fallback-secret',
        {
          issuer: 'ai-design',
          audience: 'password-reset'
        }
      ) as any;

      return res.redirect(`${process.env.CLIENT_URL}/reset-password-form?token=${encodeURIComponent(token)}`);

    } catch (jwtError) {
      return res.redirect(`${process.env.CLIENT_URL}/reset-password-error?type=invalid&message=${encodeURIComponent('Token inválido')}`);
    }

  } catch (error) {
    console.error("Error validando token:", error);
    return res.redirect(`${process.env.CLIENT_URL}/reset-password-error?type=error&message=${encodeURIComponent('Error interno del servidor')}`);
  }
};

export const resetPassword = async (req: Request, res: Response) => {
  try {
    const { token, newPassword, confirmPassword } = req.body;

    if (!token || !newPassword || !confirmPassword) {
      return res.status(400).json({
        success: false,
        message: "Todos los campos son obligatorios",
        action: 'retry'
      });
    }
    
    if (typeof token !== 'string' || typeof newPassword !== 'string' || typeof confirmPassword !== 'string') {
      return res.status(400).json({
        success: false,
        message: "Datos inválidos",
        action: 'retry'
      });
    }

    if (newPassword === "" || newPassword === null) {
      return res.status(400).json({
        success: false,
        message: "La contraseña no puede estar vacía",
        action: 'retry'
      });
    }

    if (newPassword !== confirmPassword) {
      return res.status(400).json({
        success: false,
        message: "Las contraseñas no coinciden",
        action: 'retry'
      });
    }
   
    if (!/^[a-zA-Z0-9]+$/.test(newPassword)) {
      return res.status(400).json({
        success: false,
        message: "La contraseña solo puede contener letras y números",
        action: 'retry'
      });
    }

    if (newPassword.length < 3 || newPassword.length > 16) {
      return res.status(400).json({
        success: false,
        message: "La contraseña debe tener entre 3 y 16 caracteres",
        action: 'retry'
      });
    }

    const validation = await TokenResetPasswordService.validatePasswordResetToken(token);
    
    if (!validation.valid) {
      return res.status(400).json({
        success: false,
        message: validation.reason === 'TOKEN_EXPIRED' 
          ? "El enlace de recuperación ha expirado. Solicita uno nuevo."
          : "Enlace de recuperación inválido.",
        action: validation.reason === 'TOKEN_EXPIRED' ? 'request_new' : 'go_login'
      });
    }

    const { tokenRecord } = validation;
    if (!tokenRecord?.user) {
      return res.status(400).json({
        success: false,
        message: "Usuario no encontrado",
        action: 'go_login'
      });
    }

    const transaction = await db.transaction();

    try {
      
      const hashedPassword = await argon2.hash(newPassword);

      await Users.update(
        { password: hashedPassword },
        { 
          where: { uuid: tokenRecord.userId },
          transaction 
        }
      );

      await TokenResetPasswordService.markTokenAsUsed(token);

      await transaction.commit();

      try {
        const userIP = req.ip || req.socket?.remoteAddress || 'unknown';
        await sendPasswordChangedNotification(
          tokenRecord.user.email, 
          tokenRecord.user.username, 
          userIP
        );
      } catch (emailError) {
        console.error('❌ Error enviando notificación de cambio de contraseña:', emailError);
      }

      return res.status(200).json({
        success: true,
        message: "Contraseña actualizada exitosamente. Puedes iniciar sesión con tu nueva contraseña.",
        action: 'go_succes',
        redirectUrl: `${process.env.CLIENT_URL}/reset-password-success?email=${encodeURIComponent(tokenRecord.user.email)}&message=${encodeURIComponent('Contraseña actualizada exitosamente')}` 
      });

    } catch (error) {
      await transaction.rollback();
      console.error('Error al resetear contraseña:', error);
      
      return res.status(500).json({
        success: false,
        message: "Error interno. Intenta nuevamente.",
        action: 'retry'
      });
    }

  } catch (error) {
    console.error("Error en reset password:", error);
    return res.status(500).json({
      success: false,
      message: "Error interno del servidor",
      action: 'retry'
    });
  }
};