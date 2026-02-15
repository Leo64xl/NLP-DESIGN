import { DataTypes, Model } from 'sequelize';
import db from '../Configuration.db';

export type DesignStatus = 'active' | 'completed' | 'archived' | 'deleted';
export type DesignType = '2d' | '3d' | 'both';

export interface DesignAttributes {
  id?: number;
  uuid: string;
  userId: string;           
  title: string;           
  description?: string;    
  status: DesignStatus;
  type: DesignType;
  metadata?: object;       
  createdAt?: Date;
  updatedAt?: Date;
}

export class Design extends Model<DesignAttributes> implements DesignAttributes {
  public id!: number;
  public uuid!: string;
  public userId!: string;
  public title!: string;
  public description?: string;
  public status!: DesignStatus;
  public type!: DesignType;
  public metadata?: object;
  
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
  
  public messages?: any[];
  public files?: any[];
}

Design.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    
    uuid: {
      type: DataTypes.STRING(36),
      defaultValue: DataTypes.UUIDV4,
      unique: true,
      allowNull: false,
      validate: {
        isUUID: 4
      }
    },
    
    userId: {
      type: DataTypes.STRING(36),
      allowNull: false,
      references: {
        model: 'users',
        key: 'uuid'
      },
      onDelete: 'CASCADE',
      validate: {
        notEmpty: true,
        isUUID: 4
      }
    },
    
    title: {
      type: DataTypes.STRING(200),
      allowNull: false,
      validate: {
        notEmpty: true,
        len: [1, 200]
      }
    },
    
    description: {
      type: DataTypes.TEXT,
      allowNull: true,
      validate: {
        len: [0, 2000]
      }
    },
    
    status: {
      type: DataTypes.ENUM('active', 'completed', 'archived', 'deleted'),
      defaultValue: 'active',
      allowNull: false,
      validate: {
        isIn: [['active', 'completed', 'archived', 'deleted']]
      }
    },
    
    type: {
      type: DataTypes.ENUM('2d', '3d', 'both'),
      defaultValue: '2d',
      allowNull: false,
      validate: {
        isIn: [['2d', '3d', 'both']]
      }
    },
    
    metadata: {
      type: DataTypes.JSON,
      allowNull: true,
      comment: 'Configuraciones específicas del diseño: dimensiones, estilo, etc.'
    }
  },
  {
    sequelize: db,
    tableName: 'designs',
    timestamps: true,
    freezeTableName: true,
    indexes: [
      {
        fields: ['userId']
      },
      {
        fields: ['status']
      },
      {
        fields: ['createdAt']
      }
    ]
  }
);

export default Design;