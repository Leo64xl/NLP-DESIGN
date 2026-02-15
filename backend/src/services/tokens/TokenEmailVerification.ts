import Token from '../../database/models/Token.model';
import jwt from 'jsonwebtoken';
import db from '../../database/Configuration.db';
import { Transaction } from 'sequelize'; 

export class TokenService {
  
  static async createEmailVerificationToken(
    userId: string, 
    email: string, 
    transaction?: Transaction 
  ): Promise<string> {
    const jwtToken = jwt.sign(
      {
        userId,
        email,
        purpose: 'email_verification',
        timestamp: Date.now()
      },
      process.env.JWT_SECRET || 'fallback-secret',
      { 
        expiresIn: '10m',
        issuer: 'ai-design',
        audience: 'email-verification'
      }
    );

    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

    const trans = transaction || await db.transaction();
    const shouldCommit = !transaction; 

    try {
      
      await Token.update(
        { state: 'expired' },
        { 
          where: { 
            userId, 
            type: 'email_verification',
            state: 'pending'
          },
          transaction: trans 
        }
      );

      await Token.create({
        userId,
        token: jwtToken,
        type: 'email_verification',
        state: 'pending',
        expiresAt
      }, { transaction: trans });

      if (shouldCommit) {
        await trans.commit();
      }
      
      return jwtToken;

    } catch (error) {
      
      if (shouldCommit) {
        await trans.rollback();
      }
      throw error;
    }
  }

  static async validateToken(token: string, type: 'email_verification' | 'password_reset' = 'email_verification') {
    const tokenRecord = await Token.findOne({
      where: { 
        token,
        type,
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

  static async cleanExpiredTokens(): Promise<void> {
    await Token.update(
      { state: 'expired' },
      { 
        where: { 
          state: 'pending',
          expiresAt: {
            [require('sequelize').Op.lt]: new Date()
          }
        }
      }
    );
  }
}