import { DataTypes, Model } from 'sequelize';
import db from '../Configuration.db';

export type UserVerifiedStatus = 'pending' | 'true' | 'expired';

export interface UserAttributes {
  id?: number;
  uuid: string;
  username: string;
  verified?: UserVerifiedStatus;    
  email: string;
  password: string;
  role: string;
}

export class User extends Model<UserAttributes> implements UserAttributes {
  public id!: number;             
  public uuid!: string;            
  public username!: string;        
  public verified!: UserVerifiedStatus;  
  public email!: string;           
  public password!: string;       
  public role!: string;           

  public tokens?: any[];
}

User.init(
  {
    
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
      allowNull: false,
    },

    uuid: {
      type: DataTypes.STRING,
      defaultValue: DataTypes.UUIDV4,
      unique: true,
      allowNull: false,
    },

    username: {
      type: DataTypes.STRING(100),
      allowNull: false,
      unique: true,          
      validate: {
        notEmpty: true,
        len: [3, 100],
        is: /^[a-zA-Z0-9_]+$/i,
      },
    },

    verified: {
      type: DataTypes.ENUM('pending', 'true', 'expired'),
      defaultValue: 'pending',
      allowNull: false,
      validate: {
        isIn: [['pending', 'true', 'expired']]
      }
    },

    email: {
      type: DataTypes.STRING(150),
      allowNull: false,
      unique: true,
      validate: {
        isEmail: true,
      },
    },

    password: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    
    role: {
      type: DataTypes.STRING,
      allowNull: false,
      validate: {
        isIn: [['user', 'admin', 'superadmin', 'banned']], 
      },
    },
  },
  
  {
    sequelize: db,
    tableName: 'users',
    timestamps: true,
    freezeTableName: true,
  }
);

export default User;