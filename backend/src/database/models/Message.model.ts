import { DataTypes, Model } from 'sequelize';
import db from '../Configuration.db';

export type MessageRole = 'user' | 'assistant' | 'system';
export type MessageStatus = 'pending' | 'processing' | 'completed' | 'error';

export interface MessageAttributes {
  id?: number;
  uuid: string;
  designId: string;        
  role: MessageRole;
  content: string;
  status: MessageStatus;
  metadata?: object;       
  processingTime?: number;  
  createdAt?: Date;
  updatedAt?: Date;
}

export class Message extends Model<MessageAttributes> implements MessageAttributes {
  public id!: number;
  public uuid!: string;
  public designId!: string;
  public role!: MessageRole;
  public content!: string;
  public status!: MessageStatus;
  public metadata?: object;
  public processingTime?: number;
  
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

Message.init(
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
    
    designId: {
      type: DataTypes.STRING(36),
      allowNull: false,
      references: {
        model: 'designs',
        key: 'uuid'
      },
      onDelete: 'CASCADE',
      validate: {
        notEmpty: true,
        isUUID: 4
      }
    },
    
    role: {
      type: DataTypes.ENUM('user', 'assistant', 'system'),
      allowNull: false,
      validate: {
        isIn: [['user', 'assistant', 'system']]
      }
    },
    
    content: {
      type: DataTypes.TEXT,
      allowNull: false,
      validate: {
        notEmpty: true,
        len: [1, 10000]
      }
    },
    
    status: {
      type: DataTypes.ENUM('pending', 'processing', 'completed', 'error'),
      defaultValue: 'pending',
      allowNull: false,
      validate: {
        isIn: [['pending', 'processing', 'completed', 'error']]
      }
    },
    
    metadata: {
      type: DataTypes.JSON,
      allowNull: true,
      comment: 'Datos adicionales: archivos adjuntos, configuraciones específicas, etc.'
    },
    
    processingTime: {
      type: DataTypes.INTEGER,
      allowNull: true,
      comment: 'Tiempo en milisegundos que tardó procesar este mensaje'
    }
  },
  {
    sequelize: db,
    tableName: 'messages',
    timestamps: true,
    freezeTableName: true,
    indexes: [
      {
        fields: ['designId']
      },
      {
        fields: ['role']
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

export default Message;