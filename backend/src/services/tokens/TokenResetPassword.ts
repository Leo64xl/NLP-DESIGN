import Token from '../../database/models/Token.model';
import jwt from 'jsonwebtoken';
import db from '../../database/Configuration.db';

interface TokenValidationResult {
  valid: boolean;
  reason?: 'TOKEN_NOT_FOUND' | 'TOKEN_EXPIRED';
  tokenRecord?: Token;
}

export class TokenResetPasswordService {
  
  static async createPasswordResetToken(
    userId: string, 
    email: string
  ): Promise<string> {
    const jwtToken = jwt.sign(
      {
        userId,
        email,
        purpose: 'password_reset',
        timestamp: Date.now()
      },
      process.env.JWT_SECRET || 'fallback-secret',
      { 
        expiresIn: '15m', 
        issuer: 'ai-design',
        audience: 'password-reset'
      }
    );

    const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

    const transaction = await db.transaction();

    try {
 
      await Token.update(
        { state: 'expired' },
        { 
          where: { 
            userId, 
            type: 'password_reset',
            state: 'pending'
          },
          transaction 
        }
      );

      await Token.create({
        userId,
        token: jwtToken,
        type: 'password_reset',
        state: 'pending',
        expiresAt
      }, { transaction });

      await transaction.commit();
      return jwtToken;

    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }

  static async validatePasswordResetToken(token: string): Promise<TokenValidationResult> {
    const tokenRecord = await Token.findOne({
      where: { 
        token,
        type: 'password_reset',
        state: 'pending'
      },
      include: [{
        model: require('../../database/models/User.model').default,
        as: 'user',
        attributes: ['uuid', 'email', 'username', 'verified']
      }]
    });

    if (!tokenRecord) {
      return { valid: false, reason: 'TOKEN_NOT_FOUND' };
    }

    if (tokenRecord.expiresAt && new Date() > tokenRecord.expiresAt) {
      await tokenRecord.update({ state: 'expired' });
      return { valid: false, reason: 'TOKEN_EXPIRED', tokenRecord };
    }

    return { valid: true, tokenRecord };
  }

  static async markTokenAsUsed(token: string): Promise<void> {
    await Token.update(
      { state: 'used' },
      { where: { token } }
    );
  }

  static async cleanExpiredPasswordTokens(): Promise<void> {
    await Token.update(
      { state: 'expired' },
      { 
        where: { 
          type: 'password_reset',
          state: 'pending',
          expiresAt: {
            [require('sequelize').Op.lt]: new Date()
          }
        }
      }
    );
  }
}