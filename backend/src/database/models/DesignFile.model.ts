import { DataTypes, Model } from 'sequelize';
import db from '../Configuration.db';

export type FileType = 'image' | 'pdf' | 'dwg' | 'dxf' | 'skp' | 'obj' | 'fbx' | 'gltf' | 'json' | 'mtl' | 'svg' | 'stl';
export type FileStatus = 'generating' | 'ready' | 'error' | 'deleted';

export interface DesignFileAttributes {
  id?: number;
  uuid: string;
  designId: string;
  messageId?: string;
  filename: string;
  originalName: string;
  fileType: FileType;
  fileSize: number;
  filePath: string;
  downloadUrl?: string;
  status: FileStatus;
  downloadCount?: number;     
  lastDownloadAt?: Date;       
  metadata?: object;
  createdAt?: Date;
  updatedAt?: Date;
}

export class DesignFile extends Model<DesignFileAttributes> implements DesignFileAttributes {
  public id!: number;
  public uuid!: string;
  public designId!: string;
  public messageId?: string;
  public filename!: string;
  public originalName!: string;
  public fileType!: FileType;
  public fileSize!: number;
  public filePath!: string;
  public downloadUrl?: string;
  public status!: FileStatus;
  public downloadCount!: number;    
  public lastDownloadAt?: Date;   
  public metadata?: object;
  
  public readonly createdAt!: Date;  
  public readonly updatedAt!: Date;  
}

DesignFile.init(
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
    
    messageId: {
      type: DataTypes.STRING(36),
      allowNull: true,
      references: {
        model: 'messages',
        key: 'uuid'
      },
      onDelete: 'SET NULL',
      validate: {
        isUUID: 4
      }
    },
    
    filename: {
      type: DataTypes.STRING(255),
      allowNull: false,
      validate: {
        notEmpty: true,
        len: [1, 255]
      }
    },
    
    originalName: {
      type: DataTypes.STRING(255),
      allowNull: false,
      validate: {
        notEmpty: true,
        len: [1, 255]
      }
    },
    
    // 🎯 ACTUALIZAR ENUM PARA INCLUIR TODOS LOS TIPOS
    fileType: {
      type: DataTypes.ENUM('image', 'pdf', 'dwg', 'dxf', 'skp', 'obj', 'fbx', 'gltf', 'json', 'mtl'),
      allowNull: false,
      validate: {
        isIn: [['image', 'pdf', 'dwg', 'dxf', 'skp', 'obj', 'fbx', 'gltf', 'json', 'mtl']]
      }
    },
    
    fileSize: {
      type: DataTypes.INTEGER,
      allowNull: false,
      validate: {
        min: 1,
        max: 100 * 1024 * 1024
      }
    },
    
    filePath: {
      type: DataTypes.STRING(500),
      allowNull: false,
      validate: {
        notEmpty: true,
        len: [1, 500]
      }
    },
    
    downloadUrl: {
      type: DataTypes.STRING(500),
      allowNull: true,
      validate: {
        len: [1, 500]
      }
    },
    
    status: {
      type: DataTypes.ENUM('generating', 'ready', 'error', 'deleted'),
      defaultValue: 'generating',
      allowNull: false,
      validate: {
        isIn: [['generating', 'ready', 'error', 'deleted']]
      }
    },
    
    downloadCount: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
      allowNull: false,
      validate: {
        min: 0
      },
      comment: 'Número de veces que se ha descargado este archivo'
    },
    
    lastDownloadAt: {
      type: DataTypes.DATE,
      allowNull: true,
      comment: 'Fecha y hora de la última descarga'
    },
    
    metadata: {
      type: DataTypes.JSON,
      allowNull: true,
      comment: 'Información adicional: dimensiones, versión, configuraciones específicas'
    }
  },
  {
    sequelize: db,
    tableName: 'design_files',
    timestamps: true,                    
    freezeTableName: true,
    indexes: [
      {
        fields: ['designId']
      },
      {
        fields: ['messageId']
      },
      {
        fields: ['fileType']
      },
      {
        fields: ['status']
      },
      {
        fields: ['downloadCount']        
      },
      {
        fields: ['lastDownloadAt']       
      }
    ]
  }
);

export default DesignFile;