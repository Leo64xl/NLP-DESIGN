import { Request, Response } from 'express';
import Design from '../../database/models/Design.model';
import DesignFile from '../../database/models/DesignFile.model';
import Message from '../../database/models/Message.model';
import db from '../../database/Configuration.db';
import { v4 as uuidv4 } from 'uuid';
import { Op } from 'sequelize';
import path from 'path';
import fs from 'fs';

import { generatePdfFile } from '../../services/FileGenerators/PdfGenerator';
import { generateDxfFile } from '../../services/FileGenerators/DxfGenerator';
import { ArchitecturalPlan } from '../../services/ai/ConfigAI';


interface FileMetadata {
  originalName: string;
  mimeType: string;
  fileSize: number; 
  resolution?: string;
  dimensions?: {
    width: number;
    height: number;
  };
  fileFormat: string; 
  quality: 'low' | 'medium' | 'high' | 'ultra';
  generatedAt: string;
  generatedBy: string;
  downloadCount: number;
  lastDownloadAt?: string;
  compressionLevel?: number;
  colorProfile?: string;
  dpi?: number;
  layers?: number;
  fileVersion: string;
  conversionSource?: {
    fromType: string;
    toType: string;
    conversionId: string;
  };
  userAgent: string;
  userIP: string;
  completedAt?: string;
}

interface GenerationOptions {
  quality: 'low' | 'medium' | 'high' | 'ultra';
  fileFormat: string;
  resolution?: string;
  includeWatermark: boolean;
  includeMetadata: boolean;
  compressionLevel?: number;
  outputFormats?: string[];
}

async function generateAndSave2DFiles(designUuid: string, planData: any, fileName: string, format: string) {
  const folder = path.join(process.cwd(), 'uploads', 'designs', designUuid);
  fs.mkdirSync(folder, { recursive: true });

  const filePath = path.join(folder, fileName);

  if (format === 'PDF') {
    await generatePdfFile(planData, filePath);
  } else if (format === 'DWG' || format === 'DXF') {
    await generateDxfFile(planData, filePath);
  }
}

async function checkAndNotifyDesignReady(designId: string) {
  const files = await DesignFile.findAll({ where: { designId } });
  const allReady = files.length > 0 && files.every(f => f.status === 'ready');
  if (allReady) {
    // Verifica si ya existe el mensaje para evitar duplicados
    const exists = await Message.findOne({
      where: {
        designId,
        role: 'assistant',
        content: { [Op.like]: '%¡Tu diseño ha sido generado con éxito!%' }
      }
    });
    if (!exists) {
      await Message.create({
        uuid: uuidv4(),
        designId,
        role: 'assistant',
        content: '🎉 ¡Tu diseño ha sido generado con éxito! Todos los archivos están listos para descargar.',
        status: 'completed',
        createdAt: new Date(),
      });
    }
  }
}

export const getDesignFiles = async (req: Request, res: Response) => {
  try {
    const { designUuid } = req.params;
    const userId = req.userId as string;
    const { type = 'all', status = 'all', format = 'all' } = req.query;

    const design = await Design.findOne({
      where: { 
        uuid: designUuid,
        userId: userId,
        status: { [Op.not]: 'deleted' }
      }
    });

    if (!design) {
      return res.status(404).json({
        success: false,
        message: "Diseño no encontrado o sin acceso",
        action: 'check_design_access'
      });
    }

    const whereClause: any = {
      designId: designUuid,
      status: { [Op.not]: 'deleted' }
    };

    if (type !== 'all') {
      whereClause.fileType = type;
    }

    if (status !== 'all') {
      whereClause.status = status;
    }

    const files = await DesignFile.findAll({
      where: whereClause,
      order: [['createdAt', 'DESC']],
      include: [
        {
          model: Design,
          as: 'design',
          attributes: ['uuid', 'title', 'type'],
          required: true
        }
      ]
    });

    let filteredFiles = files;
    if (format !== 'all') {
      filteredFiles = files.filter(file => {
        const metadata = file.metadata as FileMetadata;
        return metadata?.fileFormat === format;
      });
    }

    const groupedFiles = filteredFiles.reduce((acc, file) => {
      const metadata = file.metadata as FileMetadata;
      const fileFormat = metadata?.fileFormat || 'unknown';
      
      const fileData = {
        uuid: file.uuid,
        filename: file.filename,
        fileType: file.fileType,
        format: fileFormat, 
        status: file.status,
        size: metadata?.fileSize || 0, 
        downloadUrl: file.downloadUrl,
        downloadCount: file.downloadCount,
        createdAt: file.createdAt,
        metadata: metadata
      };

      if (!acc[file.fileType]) {
        acc[file.fileType] = {};
      }
      
      if (!acc[file.fileType][fileFormat]) {
        acc[file.fileType][fileFormat] = [];
      }
      
      acc[file.fileType][fileFormat].push(fileData);
      return acc;
    }, {} as any);

    const stats = {
      totalFiles: filteredFiles.length,
      readyFiles: filteredFiles.filter(f => f.status === 'ready').length,
      generatingFiles: filteredFiles.filter(f => f.status === 'generating').length,
      totalDownloads: filteredFiles.reduce((sum, f) => sum + (f.downloadCount || 0), 0),
      totalSize: filteredFiles.reduce((sum, f) => {
        const metadata = f.metadata as FileMetadata;
        return sum + (metadata?.fileSize || 0);
      }, 0),
      fileTypes: [...new Set(filteredFiles.map(f => f.fileType))],
      formats: [...new Set(filteredFiles.map(f => {
        const metadata = f.metadata as FileMetadata;
        return metadata?.fileFormat || 'unknown';
      }))]
    };

    return res.status(200).json({
      success: true,
      data: {
        design: {
          uuid: design.uuid,
          title: design.title,
          type: design.type
        },
        files: groupedFiles,
        allFiles: filteredFiles.map(f => {
          const metadata = f.metadata as FileMetadata;
          return {
            uuid: f.uuid,
            filename: f.filename,
            fileType: f.fileType,
            format: metadata?.fileFormat || 'unknown',
            status: f.status,
            size: metadata?.fileSize || 0,
            downloadUrl: f.downloadUrl,
            downloadCount: f.downloadCount,
            createdAt: f.createdAt
          };
        }),
        stats: stats,
        filters: {
          applied: { type, status, format },
          available: {
            types: ['2d', '3d', 'render', 'document'],
            statuses: ['ready', 'generating', 'error'],
            formats: ['PDF', 'DWG', 'DXF', 'OBJ', 'FBX', 'GLTF', 'JPG', 'PNG']
          }
        }
      },
      action: 'files_loaded'
    });

  } catch (error) {
    console.error("❌ Error obteniendo archivos:", error);
    return res.status(500).json({
      success: false,
      message: "Error al cargar archivos",
      action: 'retry_later'
    });
  }
};

export const downloadFile = async (req: Request, res: Response) => {
  try {
    const { fileUuid } = req.params;
    const userId = req.userId as string;

    const file = await DesignFile.findOne({
      where: { uuid: fileUuid },
      include: [
        {
          model: Design,
          as: 'design',
          where: { 
            userId: userId,
            status: { [Op.not]: 'deleted' }
          },
          required: true
        }
      ]
    });

    if (!file) {
      return res.status(404).json({
        success: false,
        message: "Archivo no encontrado o sin acceso",
        action: 'check_file_access'
      });
    }

    if (file.status !== 'ready') {
      return res.status(400).json({
        success: false,
        message: file.status === 'generating' ? 
          "El archivo aún se está generando" : 
          "El archivo no está disponible",
        action: file.status === 'generating' ? 'wait_generation' : 'regenerate_file',
        fileStatus: file.status
      });
    }

    const filePath = file.filePath; // Ya contiene la ruta completa desde OpenAI
    
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({
        success: false,
        message: "Archivo físico no encontrado",
        action: 'regenerate_file'
      });
    }

    const transaction = await db.transaction();

    try {
      
      const currentMetadata = file.metadata as FileMetadata;
      const updatedMetadata: FileMetadata = {
        ...currentMetadata,
        downloadCount: (currentMetadata?.downloadCount || 0) + 1,
        lastDownloadAt: new Date().toISOString()
      };

      await DesignFile.update(
        { 
          status: 'ready',
          downloadCount: (file.downloadCount || 0) + 1,
          metadata: updatedMetadata
        },
        { where: { uuid: fileUuid }, transaction }
      );

      await transaction.commit();
      await checkAndNotifyDesignReady(file.designId);

      const metadata = file.metadata as FileMetadata;
      const fileFormat = metadata?.fileFormat || 'pdf';
      const fileName = file.filename || `design_${file.fileType}.${fileFormat.toLowerCase()}`;
      
      res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
      res.setHeader('Content-Type', getMimeType(fileFormat));
      res.setHeader('Content-Length', metadata?.fileSize?.toString() || '0');
      res.setHeader('Cache-Control', 'no-cache');

      console.log(`📥 Descarga: ${fileName} por usuario ${userId}`);

      res.sendFile(filePath);

    } catch (transactionError) {
      await transaction.rollback();
      throw transactionError;
    }

  } catch (error) {
    console.error("❌ Error descargando archivo:", error);
    return res.status(500).json({
      success: false,
      message: "Error al descargar archivo",
      action: 'retry_download'
    });
  }
};

/**
 * 📐 Obtener el archivo SVG 2D generado del plano
 * Devuelve el contenido SVG para visualización en el frontend
 */
export const getSvg2DFile = async (req: Request, res: Response) => {
  try {
    const { designUuid } = req.params;
    const userId = req.userId as string;

    // Verificar que el diseño exista y pertenezca al usuario
    const design = await Design.findOne({
      where: { 
        uuid: designUuid,
        userId: userId,
        status: { [Op.not]: 'deleted' }
      }
    });

    if (!design) {
      return res.status(404).json({
        success: false,
        message: "Diseño no encontrado o sin acceso",
        action: 'check_design_access'
      });
    }

    // Buscar el archivo SVG 2D
    const svgFile = await DesignFile.findOne({
      where: {
        designId: designUuid,
        fileType: 'svg',
        status: 'ready'
      },
      order: [['createdAt', 'DESC']]
    });

    if (!svgFile) {
      // Si no existe archivo SVG registrado, intentar encontrarlo en el sistema de archivos
      const designFolder = path.join(process.cwd(), 'uploads', 'designs', designUuid);
      const svgPattern = path.join(designFolder, '*plan_2d.svg');
      
      // Buscar cualquier archivo SVG en la carpeta
      if (fs.existsSync(designFolder)) {
        const files = fs.readdirSync(designFolder);
        const svgFiles = files.filter(f => f.endsWith('.svg') && f.includes('plan_2d'));
        
        if (svgFiles.length > 0) {
          const svgPath = path.join(designFolder, svgFiles[0]);
          const svgContent = fs.readFileSync(svgPath, 'utf-8');
          
          return res.status(200).json({
            success: true,
            data: {
              svg: svgContent,
              filename: svgFiles[0],
              designUuid: designUuid
            },
            action: 'svg_loaded'
          });
        }
      }

      return res.status(404).json({
        success: false,
        message: "Archivo SVG 2D no disponible",
        action: 'generate_svg'
      });
    }

    // Leer el archivo SVG del disco
    const svgPath = svgFile.filePath;
    
    if (!fs.existsSync(svgPath)) {
      return res.status(404).json({
        success: false,
        message: "Archivo SVG no encontrado en el sistema",
        action: 'regenerate_svg'
      });
    }

    const svgContent = fs.readFileSync(svgPath, 'utf-8');

    return res.status(200).json({
      success: true,
      data: {
        svg: svgContent,
        filename: svgFile.filename,
        designUuid: designUuid,
        createdAt: svgFile.createdAt
      },
      action: 'svg_loaded'
    });

  } catch (error) {
    console.error("❌ Error obteniendo SVG 2D:", error);
    return res.status(500).json({
      success: false,
      message: "Error al obtener el archivo SVG",
      action: 'retry_later'
    });
  }
};

export const generateFile = async (req: Request, res: Response) => {
  try {
    const { designUuid } = req.params;
    const { fileType, format, options = {} } = req.body;
    const userId = req.userId as string;

    console.log("🎯 Generando archivos para diseño:", designUuid);
    console.log("📂 Tipo:", fileType, "Formato:", format);
    console.log("👤 Usuario:", userId);
    console.log("⚙️ Opciones:", options);

    // Validaciones
    if (!fileType || !format) {
      return res.status(400).json({
        success: false,
        message: "Tipo de archivo y formato son obligatorios",
        action: 'provide_required_fields',
        requiredFields: ['fileType', 'format']
      });
    }

    const validFileTypes = ['2d', '3d', 'render', 'document'];
    const validFormats = ['PDF', 'DWG', 'DXF', 'OBJ', 'FBX', 'GLTF', 'SKP', 'JPG', 'PNG'];

    if (!validFileTypes.includes(fileType)) {
      return res.status(400).json({
        success: false,
        message: "Tipo de archivo inválido",
        action: 'select_valid_file_type',
        validTypes: validFileTypes
      });
    }

    if (!validFormats.includes(format)) {
      return res.status(400).json({
        success: false,
        message: "Formato inválido",
        action: 'select_valid_format',
        validFormats: validFormats
      });
    }

    const design = await Design.findOne({
      where: { 
        uuid: designUuid,
        userId: userId,
        status: { [Op.in]: ['active', 'completed'] }
      }
    });

    if (!design) {
      return res.status(404).json({
        success: false,
        message: "Diseño no encontrado o inaccesible",
        action: 'check_design_access'
      });
    }

    const existingFiles = await DesignFile.findAll({
      where: {
        designId: designUuid,
        fileType: fileType,
        status: { [Op.in]: ['ready', 'generating'] }
      }
    });

    const existingFile = existingFiles.find(file => {
      const metadata = file.metadata as FileMetadata;
      return metadata?.fileFormat === format;
    });

    if (existingFile) {
      if (existingFile.status === 'ready') {
        const metadata = existingFile.metadata as FileMetadata;
        return res.status(200).json({
          success: true,
          message: "El archivo ya está disponible",
          data: {
            file: {
              uuid: existingFile.uuid,
              filename: existingFile.filename,
              fileType: existingFile.fileType,
              format: metadata?.fileFormat,
              status: existingFile.status,
              downloadUrl: existingFile.downloadUrl
            }
          },
          action: 'file_ready'
        });
      } else {
        return res.status(202).json({
          success: true,
          message: "El archivo se está generando",
          data: {
            file: {
              uuid: existingFile.uuid,
              status: existingFile.status
            }
          },
          action: 'file_generating'
        });
      }
    }

    const transaction = await db.transaction();

    try {
      
      const generationOptions: GenerationOptions = {
        quality: options.quality || 'high',
        fileFormat: format,
        resolution: options.resolution,
        includeWatermark: options.includeWatermark || false,
        includeMetadata: options.includeMetadata || true,
        compressionLevel: options.compressionLevel,
        outputFormats: options.outputFormats || [format]
      };

      const fileMetadata: FileMetadata = {
        originalName: `${design.title}_${fileType}.${format.toLowerCase()}`,
        mimeType: getMimeType(format),
        fileSize: 0, 
        fileFormat: format,
        quality: generationOptions.quality,
        generatedAt: new Date().toISOString(),
        generatedBy: userId,
        downloadCount: 0,
        fileVersion: '1.0',
        userAgent: req.get('User-Agent') || 'unknown',
        userIP: req.ip || 'unknown'
      };

      const fileName = `${design.title.replace(/[^a-zA-Z0-9]/g, '_')}_${fileType}_${Date.now()}.${format.toLowerCase()}`;
      const filePath = `${designUuid}/${fileName}`;
      const originalName = `${design.title}_${fileType}.${format.toLowerCase()}`;

      const newFile = await DesignFile.create({
        uuid: uuidv4(),
        designId: designUuid,
        filename: fileName,
        filePath: filePath,
        fileType: fileType,
        status: 'generating',
        downloadUrl: `/api/designs/files/${uuidv4()}/download`,
        downloadCount: 0,
        originalName: fileMetadata.originalName, 
        fileSize: fileMetadata.fileSize, 
        metadata: fileMetadata
      }, { transaction });

      await transaction.commit();

      console.log("✅ Archivo creado en DB:", newFile.uuid);
      console.log("📄 Nombre del archivo:", fileName);
      console.log("🔄 Iniciando generación en segundo plano...");

      setImmediate(async () => {
  try {
    if (fileType === '2d' && (format === 'PDF' || format === 'DWG' || format === 'DXF')) {
      // Aquí debes obtener los datos del plan (planData) para el diseño
      // Supón que tienes una función para obtener el planData por designUuid:
      
      const planPath = path.join(process.cwd(), 'uploads', 'designs', designUuid, 'architecturalPlan.json');
if (!fs.existsSync(planPath)) {
  throw new Error('No se encontró el archivo architecturalPlan.json');
}
const planData: ArchitecturalPlan = JSON.parse(fs.readFileSync(planPath, 'utf-8'));

      await generateAndSave2DFiles(designUuid, planData, fileName, format);
      console.log("✅ Archivo generado y guardado:", fileName);

      // Actualiza el estado del archivo en la base de datos a 'ready'
      await DesignFile.update(
        { status: 'ready' },
        { where: { uuid: newFile.uuid } }
      );
      await checkAndNotifyDesignReady(designUuid);
    } else {
      console.error("❌ Tipo de archivo o formato no soportado para generación 2D");
    }
  } catch (error) {
    console.error("❌ Error en generación real:", error);
    await DesignFile.update(
      { status: 'error' },
      { where: { uuid: newFile.uuid } }
    );
  }
});      

      console.log("📤 Respuesta enviada al cliente");
      console.log("📂 Detalles del archivo:", {
        uuid: newFile.uuid,
        filename: newFile.filename,
        fileType: newFile.fileType,
        format: format,
        status: newFile.status,
        estimatedTime: getEstimatedGenerationTime(fileType, format),
        generationOptions: generationOptions
      });
      return res.status(202).json({
        success: true,
        message: "Generación de archivo iniciada",
        data: {
          file: {
            uuid: newFile.uuid,
            filename: newFile.filename,
            fileType: newFile.fileType,
            format: format,
            status: newFile.status,
            estimatedTime: getEstimatedGenerationTime(fileType, format),
            generationOptions: generationOptions
          }
        },
        action: 'generation_started'
      });

    } catch (transactionError) {
      await transaction.rollback();
      throw transactionError;
    }

  } catch (error) {
    console.error("❌ Error generando archivo:", error);
    return res.status(500).json({
      success: false,
      message: "Error al generar archivo",
      action: 'retry_generation'
    });
  }
};

export const regenerateFile = async (req: Request, res: Response) => {
  try {
    const { fileUuid } = req.params;
    const { options = {} } = req.body;
    const userId = req.userId as string;

    const file = await DesignFile.findOne({
      where: { uuid: fileUuid },
      include: [
        {
          model: Design,
          as: 'design',
          where: { 
            userId: userId,
            status: { [Op.not]: 'deleted' }
          },
          required: true
        }
      ]
    });

    if (!file) {
      return res.status(404).json({
        success: false,
        message: "Archivo no encontrado",
        action: 'check_file_access'
      });
    }

    if (file.status === 'generating') {
      return res.status(400).json({
        success: false,
        message: "El archivo ya se está generando",
        action: 'wait_current_generation'
      });
    }

    const transaction = await db.transaction();

    try {
      
      const currentMetadata = file.metadata as FileMetadata;
      const updatedMetadata: FileMetadata = {
        ...currentMetadata,
        generatedAt: new Date().toISOString(),
        generatedBy: userId,
        fileVersion: incrementVersion(currentMetadata?.fileVersion || '1.0.0')
      };

      await DesignFile.update(
        { 
          status: 'generating',
          metadata: updatedMetadata
        },
        { where: { uuid: fileUuid }, transaction }
      );

      await transaction.commit();

      setTimeout(async () => {
        await generateAndSave2DFiles(file.designId, 
          JSON.parse(fs.readFileSync(path.join(process.cwd(), 'uploads', 'designs', file.designId, 'architecturalPlan.json'), 'utf-8')),
          file.filename,
          options
        );
      }, 1000);

      const metadata = file.metadata as FileMetadata;
      
      return res.status(202).json({
        success: true,
        message: "Regeneración iniciada",
        data: {
          file: {
            uuid: file.uuid,
            status: 'generating',
            estimatedTime: getEstimatedGenerationTime(file.fileType, metadata?.fileFormat || 'PDF')
          }
        },
        action: 'regeneration_started'
      });

    } catch (transactionError) {
      await transaction.rollback();
      throw transactionError;
    }

  } catch (error) {
    console.error("❌ Error regenerando archivo:", error);
    return res.status(500).json({
      success: false,
      message: "Error al regenerar archivo",
      action: 'retry_regeneration'
    });
  }
};

export const deleteFile = async (req: Request, res: Response) => {
  try {
    const { fileUuid } = req.params;
    const userId = req.userId as string;

    const file = await DesignFile.findOne({
      where: { uuid: fileUuid },
      include: [
        {
          model: Design,
          as: 'design',
          where: { 
            userId: userId,
            status: { [Op.not]: 'deleted' }
          },
          required: true
        }
      ]
    });

    if (!file) {
      return res.status(404).json({
        success: false,
        message: "Archivo no encontrado",
        action: 'check_file_access'
      });
    }

    const transaction = await db.transaction();

    try {
      await DesignFile.update(
        { status: 'deleted' },
        { where: { uuid: fileUuid }, transaction }
      );

      const filePath = path.join(process.cwd(), 'uploads', 'designs', file.filePath);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }

      await transaction.commit();

      return res.status(200).json({
        success: true,
        message: "Archivo eliminado exitosamente",
        action: 'file_deleted'
      });

    } catch (transactionError) {
      await transaction.rollback();
      throw transactionError;
    }

  } catch (error) {
    console.error("❌ Error eliminando archivo:", error);
    return res.status(500).json({
      success: false,
      message: "Error al eliminar archivo",
      action: 'retry_deletion'
    });
  }
};

export const getFileStats = async (req: Request, res: Response) => {
  try {
    const { designUuid } = req.params;
    const userId = req.userId as string;

    // Verificar acceso
    const design = await Design.findOne({
      where: { 
        uuid: designUuid,
        userId: userId,
        status: { [Op.not]: 'deleted' }
      }
    });

    if (!design) {
      return res.status(404).json({
        success: false,
        message: "Diseño no encontrado",
        action: 'check_design_access'
      });
    }

    const files = await DesignFile.findAll({
      where: {
        designId: designUuid,
        status: { [Op.not]: 'deleted' }
      }
    });

    const stats = {
      totalFiles: files.length,
      filesByType: files.reduce((acc, file) => {
        acc[file.fileType] = (acc[file.fileType] || 0) + 1;
        return acc;
      }, {} as any),
      filesByFormat: files.reduce((acc, file) => {
        const metadata = file.metadata as FileMetadata;
        const format = metadata?.fileFormat || 'unknown';
        acc[format] = (acc[format] || 0) + 1;
        return acc;
      }, {} as any),
      filesByStatus: files.reduce((acc, file) => {
        acc[file.status] = (acc[file.status] || 0) + 1;
        return acc;
      }, {} as any),
      totalDownloads: files.reduce((sum, f) => sum + (f.downloadCount || 0), 0),
      totalSize: files.reduce((sum, f) => {
        const metadata = f.metadata as FileMetadata;
        return sum + (metadata?.fileSize || 0);
      }, 0),
      averageSize: files.length > 0 ? files.reduce((sum, f) => {
        const metadata = f.metadata as FileMetadata;
        return sum + (metadata?.fileSize || 0);
      }, 0) / files.length : 0,
      mostDownloaded: files.sort((a, b) => (b.downloadCount || 0) - (a.downloadCount || 0))[0] || null,
      recentFiles: files.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).slice(0, 5)
    };

    return res.status(200).json({
      success: true,
      data: {
        design: {
          uuid: design.uuid,
          title: design.title,
          type: design.type
        },
        stats: stats
      },
      action: 'stats_loaded'
    });

  } catch (error) {
    console.error("❌ Error obteniendo estadísticas:", error);
    return res.status(500).json({
      success: false,
      message: "Error al cargar estadísticas",
      action: 'retry_later'
    });
  }
};

function getMimeType(format: string): string {
  const mimeTypes: { [key: string]: string } = {
    'PDF': 'application/pdf',
    'DWG': 'application/acad',
    'DXF': 'application/dxf',
    'OBJ': 'application/x-tgif',
    'FBX': 'application/octet-stream',
    'GLTF': 'model/gltf+json',
    'SKP': 'application/vnd.sketchup.skp',
    'JPG': 'image/jpeg',
    'JPEG': 'image/jpeg',
    'PNG': 'image/png'
  };
  return mimeTypes[format.toUpperCase()] || 'application/octet-stream';
}

function getEstimatedGenerationTime(fileType: string, format: string): string {
  const times: { [key: string]: { [key: string]: string } } = {
    '2d': {
      'PDF': '30-60 segundos',
      'DWG': '45-90 segundos',
      'DXF': '30-75 segundos',
      'JPG': '15-30 segundos',
      'PNG': '15-30 segundos'
    },
    '3d': {
      'OBJ': '60-120 segundos',
      'FBX': '75-150 segundos',
      'GLTF': '45-90 segundos',
      'SKP': '60-120 segundos'
    },
    'render': {
      'JPG': '30-90 segundos',
      'PNG': '30-90 segundos'
    },
    'document': {
      'PDF': '45-120 segundos'
    }
  };
  return times[fileType]?.[format] || '60-120 segundos';
}

function incrementVersion(currentVersion: string): string {
  const parts = currentVersion.split('.');
  const patch = parseInt(parts[2] || '0') + 1;
  return `${parts[0]}.${parts[1]}.${patch}`;
}

