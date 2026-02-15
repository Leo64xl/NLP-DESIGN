import Users from '../../database/models/User.model';
import { Request, Response } from 'express';
import { sendVerificationEmail } from '../../services/email/verify-email/Emailer'; 
import { TokenService } from '../../services/tokens/TokenEmailVerification';
import db from '../../database/Configuration.db';
import jwt from 'jsonwebtoken';

export const verifyEmail = async (req: Request, res: Response) => {
  try {
    const { token } = req.query;
    if (!token || typeof token !== 'string') {
        return res.redirect(`${process.env.CLIENT_URL}/email-verification-error?type=invalid&message=${encodeURIComponent('Token inválido')}`);
    }

    const validation = await TokenService.validateToken(token, 'email_verification');
    
    if (!validation.valid) {
      if (validation.reason === 'TOKEN_EXPIRED' && validation.tokenRecord) {
        const user = validation.tokenRecord.user;
        if (user && user.verified === 'true') {
          return res.redirect(`${process.env.CLIENT_URL}/email-verified-success?already=true`);
        }
        
        await Users.update(
          { verified: 'expired' },
          { where: { uuid: validation.tokenRecord.userId } }
        );
        
        return res.redirect(`${process.env.CLIENT_URL}/email-verification-error?type=expired&message=${encodeURIComponent('El enlace de verificación ha expirado, genera uno nuevo')}`);
      }
      
      return res.redirect(`${process.env.CLIENT_URL}/email-verification-error?type=invalid&message=${encodeURIComponent('Token inválido o ya utilizado')}`);
    }

    const { tokenRecord } = validation;
    if (!tokenRecord) {
      return res.redirect(`${process.env.CLIENT_URL}/email-verification-error?type=invalid&message=${encodeURIComponent('Token inválido')}`);
    }

    const user = tokenRecord.user;
    if (!user) {
      return res.redirect(`${process.env.CLIENT_URL}/email-verification-error?type=invalid&message=${encodeURIComponent('Usuario no encontrado')}`);
    }

    try {
      const decodedToken = jwt.verify(
        token, 
        process.env.JWT_SECRET || 'fallback-secret',
        {
          issuer: 'ai-design',
          audience: 'email-verification'
        }
      ) as any;

      if (user.email !== decodedToken.email || tokenRecord.userId !== decodedToken.userId) {
        return res.redirect(`${process.env.CLIENT_URL}/email-verification-error?type=invalid&message=${encodeURIComponent('Token inválido')}`);
      }
    } catch (jwtError) {
      return res.redirect(`${process.env.CLIENT_URL}/email-verification-error?type=invalid&message=${encodeURIComponent('Token inválido')}`);
    }

    if (user.verified === 'true') {
      return res.redirect(`${process.env.CLIENT_URL}/email-verified-success?already=true`);
    }

    const transaction = await db.transaction();
    try {
      await Users.update(
        { verified: 'true' },
        { where: { uuid: tokenRecord.userId }, transaction }
      );

      await TokenService.markTokenAsUsed(token);

      await transaction.commit();
      return res.redirect(`${process.env.CLIENT_URL}/email-verified-success`);

    } catch (transactionError) {
      await transaction.rollback();
      throw transactionError;
    }

  } catch (error) {
    return res.redirect(`${process.env.CLIENT_URL}/email-verification-error?type=error&message=${encodeURIComponent('Error interno del servidor')}`);
  }
};

export const resendVerification = async (req: Request, res: Response) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ 
        msg: "El email es obligatorio",
        action: 'provide_email' 
      });
    }

    const user = await Users.findOne({
      where: { 
        email: email.toLowerCase()
      }
    });

    if (!user) {
      return res.status(404).json({ 
        msg: "No se encontró una cuenta con este correo. Verifica el email o regístrate.",
        action: 'check_email_or_register'
      });
    }

    if (user.verified === 'true') {
      return res.status(400).json({ 
        msg: "Tu cuenta ya está verificada. Puedes iniciar sesión normalmente.",
        action: 'login',
        verified: true
      });
    }

    if (user.verified === 'pending' || user.verified === 'expired') {
      
      const newToken = await TokenService.createEmailVerificationToken(user.uuid, user.email);

      await Users.update(
        { verified: 'pending' },
        { where: { uuid: user.uuid } }
      );

      const userIP = req.ip || req.socket?.remoteAddress || 'unknown';
      await sendVerificationEmail(user.email, newToken, user.username, userIP);

      return res.status(200).json({ 
        msg: "Nuevo enlace de verificación enviado. Revisa tu correo.",
        email: user.email,
        action: 'check_email'
      });
    }

    return res.status(400).json({
      msg: "Estado de verificación inválido. Contacta soporte.",
      action: 'contact_support',
      verified: user.verified
    });

  } catch (error) {
    console.error("Error al reenviar verificación:", error);
    res.status(500).json({
      msg: "Error interno del servidor",
      action: 'retry_later'
    });
  }
};