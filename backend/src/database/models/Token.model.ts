import { DataTypes, Model } from 'sequelize';
import db from '../Configuration.db';

export type TokenState = 'pending' | 'used' | 'expired';
export type TokenType = 'email_verification' | 'password_reset' | 'account_recovery';

export interface TokenAttributes {
  id?: number;
  userId: string;
  token: string;         
  type: TokenType;
  state: TokenState;
  expiresAt?: Date;
  createdAt?: Date;
  updatedAt?: Date;
}

export class Token extends Model<TokenAttributes> implements TokenAttributes {
  public id!: number;
  public userId!: string;
  public token!: string;
  public type!: TokenType;
  public state!: TokenState;
  public expiresAt!: Date;
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;

  public user?: any;
}

Token.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },

    userId: {
      type: DataTypes.STRING,
      allowNull: false,
      references: {
        model: 'users',
        key: 'uuid'
      },
      onDelete: 'CASCADE',
    },

    token: {
      type: DataTypes.TEXT,
      allowNull: false,
      unique: true,
    },

    type: {
      type: DataTypes.ENUM('email_verification', 'password_reset', 'account_recovery'),
      allowNull: false,
      defaultValue: 'email_verification'
    },

    state: {
      type: DataTypes.ENUM('pending', 'used', 'expired'),
      allowNull: false,
      defaultValue: 'pending'
    },

    expiresAt: {
      type: DataTypes.DATE,
      allowNull: true,
      get() {
        const value = this.getDataValue('expiresAt');
        return value ? new Date(value) : null;
      }
    }
  },
  
  {
    sequelize: db,
    tableName: 'tokens',
    timestamps: true,
    freezeTableName: true,
    indexes: [
      {
        fields: ['token'],
        unique: true
      },
      {
        fields: ['userId', 'type'],
        name: 'idx_user_token_type'
      },
      {
        fields: ['state'],
        name: 'idx_token_state'
      },
      {
        fields: ['expiresAt'],
        name: 'idx_token_expires'
      }
    ]
  }
);

export default Token;