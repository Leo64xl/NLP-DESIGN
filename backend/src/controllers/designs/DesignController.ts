import { Request, Response } from "express";
import Design from "../../database/models/Design.model";
import Message from "../../database/models/Message.model";
import DesignFile from "../../database/models/DesignFile.model";
import Users from "../../database/models/User.model";
import db from "../../database/Configuration.db";
import MainAIService from "../../services/ai/MainAIService";
import { ArchitecturalPrompt } from "../../services/ai/ConfigAI";
import { sanitizePlan } from '../../services/ai/planSanitizer';
import crypto from "crypto";
import { v4 as uuidv4 } from "uuid";
import { Op } from "sequelize";
import fs from 'fs';
import path from 'path';

interface FormatHistory {
  from: string;
  to: string;
  conversionType: string;
  convertedAt: string;
  convertedBy: string;
  messageId: string;
  reason: string;
  options: any;
}

interface DesignMetadata {
  createdFromPrompt: string;
  initialType: string;
  userIP: string;
  userAgent: string;
  formatCapabilities: {
    canGenerate2D: boolean;
    canGenerate3D: boolean;
    allowFormatConversion: boolean;
    availableFormats: string[];
    supportedConversions: string[];
  };
  typeSpecificSettings: any;
  estimatedComplexity: string;
  estimatedTime: string;
  formatHistory: FormatHistory[];
  currentFormat?: string;
  conversionInProgress?: boolean;
  lastConversion?: {
    type: string;
    at: string;
    estimatedCompletion: string;
  };
  lastMessageAt?: string;
  totalMessages?: number;
  statusChangedAt?: string;
  statusChangedBy?: string;
  deletedAt?: string;
  deletedBy?: string;
  planData?: any;
}

interface MessageMetadata {
  isSystemMessage?: boolean;
  messageType?: string;
  formatInfo?: {
    selectedType: string;
    conversionOptions: string[];
  };
  isFirstMessage?: boolean;
  timestamp: string;
  selectedType?: string;
  isConversion?: boolean;
  isOptimization?: boolean;
  conversionType?: string;
  originalFormat?: string;
  targetFormat?: string;
  conversionOptions?: any;
  reason?: string;
  userIP?: string;
  userAgent?: string;
  actionType?: string;
}

// Interfaces para AI Service
interface ArchitecturalPlanResult {
  plan: {
    metadata: {
      title: string;
      totalArea: number;
      dimensions: { width: number; length: number };
      style: string;
    };
    description: string;
    rooms: Array<{
      name: string;
      area: number;
      purpose: string;
    }>;
    estimatedCost?: {
      total: number;
      currency: string;
    };
  };
  analysis: {
    feasibilityScore: number;
    estimatedTime: string;
    recommendations: string[];
  };
}

// Mock Advanced AI Service
class AdvancedAIService {
  static async generateDetailedPlan(
    prompt: ArchitecturalPrompt
  ): Promise<ArchitecturalPlanResult> {
    // Simular procesamiento de IA
    await new Promise((resolve) => setTimeout(resolve, 1000));

    const totalArea = prompt.requirements.totalArea || 100;
    const rooms = prompt.requirements.rooms || [
      { type: "habitación", count: 2 },
    ];

    return {
      plan: {
        metadata: {
          title: `Diseño Arquitectónico ${
            prompt.requirements.style || "Moderno"
          }`,
          totalArea: totalArea,
          dimensions: {
            width: Math.sqrt(totalArea * 1.2),
            length: Math.sqrt(totalArea * 0.8),
          },
          style: prompt.requirements.style || "moderno",
        },
        description: `Diseño arquitectónico ${
          prompt.requirements.style || "moderno"
        } de ${totalArea}m² con distribución optimizada de espacios.`,
        rooms: rooms.map((room, index) => ({
          name: `${room.type} ${index + 1}`,
          area: Math.floor(totalArea / rooms.length),
          purpose: room.type === "habitación" ? "descanso" : "servicio",
        })),
        estimatedCost: {
          total: totalArea * 800,
          currency: "USD",
        },
      },
      analysis: {
        feasibilityScore: 0.85,
        estimatedTime: "2-3 meses",
        recommendations: [
          "Considerar orientación solar",
          "Optimizar distribución de espacios",
          "Evaluar materiales locales",
        ],
      },
    };
  }
}

export const getDesignByUuid = async (req: Request, res: Response) => {
  try {
    const { designUuid } = req.params;
    const userId = req.userId;

    const design = await Design.findOne({
      where: {
        uuid: designUuid,
        userId: userId,
      },
      include: [
        {
          model: DesignFile,
          as: "files",
          attributes: [
            "uuid",
            "filename",
            "fileType",
            "fileSize",
            "filePath",
            "downloadUrl",
            "status",
            "downloadCount",
            "createdAt",
          ],
        },
        {
          model: Message,
          as: "messages",
          attributes: ["uuid", "role", "content", "status", "createdAt"],
          order: [["createdAt", "ASC"]],
        },
      ],
    });

    if (!design) {
      return res.status(404).json({
        success: false,
        message: "Diseño no encontrado",
      });
    }

    const response = {
      design: {
        uuid: design.uuid,
        title: design.title,
        description: design.description,
        type: design.type,
        status: design.status,
        metadata: design.metadata,
        createdAt: design.createdAt,
        updatedAt: design.updatedAt,
        files:
          design.files?.map((file: any) => ({
            uuid: file.uuid,
            filename: file.filename,
            fileType: file.fileType,
            fileSize: file.fileSize,
            downloadUrl: file.downloadUrl,
            status: file.status,
            downloadCount: file.downloadCount,
            createdAt: file.createdAt,
          })) || [],
        messages:
          design.messages?.map((message: any) => ({
            uuid: message.uuid,
            role: message.role,
            content: message.content,
            status: message.status,
            createdAt: message.createdAt,
          })) || [],
      },
    };

    res.status(200).json({
      success: true,
      data: response,
      message: "Diseño obtenido exitosamente",
    });
  } catch (error) {
    console.error("Error obteniendo diseño:", error);
    res.status(500).json({
      success: false,
      message: "Error interno del servidor",
    });
  }
};

export const createDesign = async (req: Request, res: Response) => {
  try {
    const { prompt } = req.body;

    if (!prompt?.userDescription) {
      return res.status(400).json({
        success: false,
        message: "Descripción del diseño es requerida",
      });
    }

    console.log("🚀 Generando plan con IA...");

    // Generar plan usando Groq
    const plan = await MainAIService.generatePlan(prompt);

    console.log("✅ Plan generado exitosamente");

    // Crear diseño en base de datos
    const design = await Design.create({
      uuid: crypto.randomUUID(),
      userId: req.userId || "",
      title: plan.metadata.title,
      description: plan.description,
      type: prompt.context.designType,
      status: "active",
      metadata: {
        createdFromPrompt: prompt.userDescription,
        initialType: prompt.context.designType,
        userIP: req.ip || "unknown",
        userAgent: req.get("User-Agent") || "unknown",
        formatCapabilities: {
          canGenerate2D: true,
          canGenerate3D: true,
          allowFormatConversion: true,
          availableFormats: ["2d", "3d", "both"],
          supportedConversions: ["2d", "3d", "both"],
        },
        typeSpecificSettings: getTypeSpecificSettings(
          prompt.context.designType || "2d"
        ),
        estimatedComplexity: getComplexity(prompt.context.designType || "2d"),
        estimatedTime: getEstimatedTime(prompt.context.designType || "2d"),
        formatHistory: [],
        totalMessages: 0,
        planData: plan,
      },
    });

    console.log("💾 Diseño guardado en base de datos");

    // Crear mensaje inicial del asistente
    const initialMessage = await Message.create({
      uuid: crypto.randomUUID(),
      designId: design.uuid,
      role: "assistant",
      content: `✅ He analizado tu solicitud y he generado un ${
        plan.metadata.title
      }. 

📋 **Características del diseño:**
- Área total: ${plan.metadata.totalArea}m²
- Estilo: ${plan.metadata.style}
- Tipo: ${prompt.context.designType.toUpperCase()}

🚀 Estoy generando los archivos técnicos. Los tendrás listos en unos minutos.`,
      status: "completed",
      metadata: {
        isSystemMessage: true,
        messageType: "design_created",
        isFirstMessage: true,
        timestamp: new Date().toISOString(),
      },
    });

    console.log("💬 Mensaje inicial creado");

    // 🚫 GENERACIÓN AUTOMÁTICA DESHABILITADA - Solo generamos SVG y STL con NLP
    // generateDesignFiles(design.uuid, design.type).catch((error) => {
    //   console.error("❌ Error generando archivos:", error);
    // });

    console.log("🗂️ Generación de archivos automática deshabilitada - Solo NLP SVG/STL");

    // 🔥 ESTRUCTURA CORRECTA PARA EL FRONTEND
    res.status(201).json({
      success: true,
      message: "Diseño creado exitosamente",
      data: {
        design: {
          uuid: design.uuid,
          title: design.title,
          type: design.type,
          status: design.status,
          metadata: design.metadata,
        },
        firstMessage: {
          uuid: initialMessage.uuid,
          role: initialMessage.role,
          content: initialMessage.content,
          status: initialMessage.status,
          createdAt: initialMessage.createdAt,
        },
        typeInfo: {
          type: design.type,
          label: design.type.toUpperCase(),
          features: getExpectedOutputs(design.type),
        },
        plan: plan, // Incluir el plan generado
      },
    });
  } catch (error) {
    console.error("❌ Error creando diseño:", error);
    res.status(500).json({
      success: false,
      message: "Error generando diseño con IA",
      error: error instanceof Error ? error.message : "Error desconocido",
    });
  }
};

export const convertDesignFormat = async (req: Request, res: Response) => {
  try {
    const { designUuid } = req.params;
    const { targetFormat, options = {}, reason = "user_request" } = req.body;
    const userId = req.userId as string;

    if (!["2d", "3d", "both"].includes(targetFormat)) {
      return res.status(400).json({
        success: false,
        message: "Formato de conversión inválido",
        action: "select_valid_format",
        validFormats: ["2d", "3d", "both"],
      });
    }

    const design = await Design.findOne({
      where: {
        uuid: designUuid,
        userId: userId,
        status: { [Op.in]: ["active", "completed"] },
      },
    });

    if (!design) {
      return res.status(404).json({
        success: false,
        message: "Diseño no encontrado o inaccesible",
        action: "check_design_access",
      });
    }

    const currentFormat = design.type;
    const conversionKey = `${currentFormat}_to_${targetFormat}`;

    const conversionInfo = getConversionInfo(currentFormat, targetFormat);

    if (!conversionInfo.allowed) {
      return res.status(400).json({
        success: false,
        message: conversionInfo.message,
        action: conversionInfo.action,
      });
    }

    const transaction = await db.transaction();

    try {
      const actionType = conversionInfo.isOptimization
        ? "optimization"
        : "conversion";

      const conversionMessageMetadata: MessageMetadata = {
        isConversion: !conversionInfo.isOptimization,
        isOptimization: conversionInfo.isOptimization,
        conversionType: conversionKey,
        originalFormat: currentFormat,
        targetFormat: targetFormat,
        conversionOptions: options,
        reason: reason,
        timestamp: new Date().toISOString(),
        actionType: actionType,
      };

      const conversionMessage = await Message.create(
        {
          uuid: uuidv4(),
          designId: design.uuid,
          role: "user",
          content: conversionInfo.description,
          status: "processing",
          metadata: conversionMessageMetadata,
        },
        { transaction }
      );

      const currentMetadata = design.metadata as DesignMetadata;

      const newFormatHistory: FormatHistory = {
        from: currentFormat,
        to: targetFormat,
        conversionType: conversionKey,
        convertedAt: new Date().toISOString(),
        convertedBy: userId,
        messageId: conversionMessage.uuid,
        reason: reason,
        options: {
          ...options,
          actionType: actionType,
          isOptimization: conversionInfo.isOptimization,
        },
      };

      const updatedMetadata: DesignMetadata = {
        ...currentMetadata,
        formatHistory: [
          ...(currentMetadata.formatHistory || []),
          newFormatHistory,
        ],
        currentFormat: targetFormat,
        conversionInProgress: true,
        lastConversion: {
          type: conversionKey,
          at: new Date().toISOString(),
          estimatedCompletion: new Date(
            Date.now() + conversionInfo.estimatedTimeMs
          ).toISOString(),
        },
      };

      const updateData: any = {
        metadata: updatedMetadata,
      };

      if (conversionInfo.isConversion && currentFormat !== targetFormat) {
        updateData.type = targetFormat;
      }

      await Design.update(updateData, {
        where: { uuid: designUuid },
        transaction,
      });

      await transaction.commit();

      return res.status(200).json({
        success: true,
        message: conversionInfo.successMessage,
        data: {
          conversionId: conversionMessage.uuid,
          actionType: actionType,
          conversionType: conversionKey,
          originalFormat: currentFormat,
          targetFormat: targetFormat,
          estimatedTime: conversionInfo.estimatedTime,
          estimatedTimeMs: conversionInfo.estimatedTimeMs,
          complexity: conversionInfo.complexity,
          expectedOutputs: getExpectedOutputs(targetFormat),
          benefits: conversionInfo.benefits || [],
          conversionDetails: conversionInfo,
        },
        action: conversionInfo.isOptimization
          ? "optimization_started"
          : "conversion_started",
      });
    } catch (transactionError) {
      await transaction.rollback();
      throw transactionError;
    }
  } catch (error) {
    console.error("❌ Error convirtiendo formato:", error);
    return res.status(500).json({
      success: false,
      message: "Error al convertir formato",
      action: "retry_conversion",
    });
  }
};

export const addMessage = async (req: Request, res: Response) => {
  try {
    const { designUuid } = req.params;
    const { content, role = "user" } = req.body;
    const userId = req.userId as string;

    if (!content || content.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: "El contenido del mensaje es obligatorio",
        action: "provide_message_content",
      });
    }

    if (content.length > 2000) {
      return res.status(400).json({
        success: false,
        message: "El mensaje no puede exceder 2000 caracteres",
        action: "reduce_message_length",
      });
    }

    if (!["user", "assistant"].includes(role)) {
      return res.status(400).json({
        success: false,
        message: "Rol de mensaje inválido",
        action: "use_valid_role",
      });
    }

    const design = await Design.findOne({
      where: {
        uuid: designUuid,
        userId: userId,
        status: "active",
      },
    });

    if (!design) {
      return res.status(404).json({
        success: false,
        message: "Diseño no encontrado o inaccesible",
        action: "check_design_access",
      });
    }

    const transaction = await db.transaction();

    try {
      const startTime = Date.now();

      const messageMetadata: MessageMetadata = {
        userIP: req.ip || "unknown",
        userAgent: req.get("User-Agent") || "unknown",
        timestamp: new Date().toISOString(),
      };

      const newMessage = await Message.create(
        {
          uuid: uuidv4(),
          designId: design.uuid,
          role: role,
          content: content.trim(),
          status: role === "user" ? "completed" : "processing",
          metadata: messageMetadata,
        },
        { transaction }
      );

      const currentMetadata = design.metadata as DesignMetadata;
      const updatedMetadata: DesignMetadata = {
        ...currentMetadata,
        lastMessageAt: new Date().toISOString(),
        totalMessages: (currentMetadata?.totalMessages || 0) + 1,
      };

      await Design.update(
        {
          updatedAt: new Date(),
          metadata: updatedMetadata,
        },
        { where: { uuid: design.uuid }, transaction }
      );

      await transaction.commit();

      const processingTime = Date.now() - startTime;

      if (role === "user") {
        processAIResponse(design.uuid, content).catch((error) => {
          console.error("❌ Error procesando respuesta AI:", error);
        });
      }

      return res.status(201).json({
        success: true,
        message: "Mensaje agregado exitosamente",
        data: {
          message: {
            uuid: newMessage.uuid,
            content: newMessage.content,
            role: newMessage.role,
            status: newMessage.status,
            createdAt: newMessage.createdAt,
          },
          processingTime: processingTime,
        },
        action: role === "user" ? "processing_ai_response" : "message_added",
      });
    } catch (transactionError) {
      await transaction.rollback();
      throw transactionError;
    }
  } catch (error) {
    console.error("❌ Error agregando mensaje:", error);
    return res.status(500).json({
      success: false,
      message: "Error al agregar mensaje",
      action: "retry_message",
    });
  }
};

export const getUserDesigns = async (req: Request, res: Response) => {
  try {
    const userId = req.userId as string;
    const {
      page = 1,
      limit = 10,
      status = "all",
      type = "all",
      search = "",
    } = req.query;

    const pageNum = parseInt(page as string) || 1;
    const limitNum = parseInt(limit as string) || 10;
    const offset = (pageNum - 1) * limitNum;

    const whereClause: any = {
      userId: userId,
      status: { [Op.not]: "deleted" },
    };

    if (status !== "all") {
      whereClause.status = status;
    }

    if (type !== "all") {
      whereClause.type = type;
    }

    if (search) {
      whereClause[Op.or] = [
        { title: { [Op.like]: `%${search}%` } },
        { description: { [Op.like]: `%${search}%` } },
      ];
    }

    const { count, rows: designs } = await Design.findAndCountAll({
      where: whereClause,
      include: [
        {
          model: Message,
          as: "messages",
          attributes: ["uuid"],
          required: false,
        },
        {
          model: DesignFile,
          as: "files",
          attributes: ["uuid", "fileType", "status", "downloadCount"],
          where: { status: { [Op.not]: "deleted" } },
          required: false,
        },
      ],
      order: [["updatedAt", "DESC"]],
      limit: limitNum,
      offset: offset,
      distinct: true,
    });

    const designsWithMetrics = designs.map((design) => {
      const designMetadata = design.metadata as DesignMetadata;

      return {
        uuid: design.uuid,
        title: design.title,
        description: design.description?.substring(0, 100) + "...",
        status: design.status,
        type: design.type,
        createdAt: design.createdAt,
        updatedAt: design.updatedAt,
        metrics: {
          totalMessages: design.messages?.length || 0,
          totalFiles: design.files?.length || 0,
          totalDownloads:
            design.files?.reduce(
              (sum, file) => sum + (file.downloadCount || 0),
              0
            ) || 0,
          filesReady:
            design.files?.filter((f) => f.status === "ready").length || 0,
          totalConversions: designMetadata?.formatHistory?.length || 0,
        },
      };
    });

    const pagination = {
      currentPage: pageNum,
      totalPages: Math.ceil(count / limitNum),
      totalItems: count,
      itemsPerPage: limitNum,
      hasNextPage: pageNum < Math.ceil(count / limitNum),
      hasPreviousPage: pageNum > 1,
    };

    return res.status(200).json({
      success: true,
      data: {
        designs: designsWithMetrics,
        pagination: pagination,
        filters: {
          applied: { status, type, search },
          available: {
            statuses: ["active", "completed", "archived"],
            types: ["2d", "3d", "both"],
          },
        },
      },
      action: "designs_loaded",
    });
  } catch (error) {
    console.error("❌ Error obteniendo designs del usuario:", error);
    return res.status(500).json({
      success: false,
      message: "Error al cargar tus diseños",
      action: "retry_later",
    });
  }
};

export const updateDesignStatus = async (req: Request, res: Response) => {
  try {
    const { designUuid } = req.params;
    const { status } = req.body;
    const userId = req.userId as string;

    if (!["active", "completed", "archived"].includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Status inválido",
        action: "use_valid_status",
      });
    }

    const design = await Design.findOne({
      where: { uuid: designUuid, userId: userId },
    });

    if (!design) {
      return res.status(404).json({
        success: false,
        message: "Diseño no encontrado",
        action: "check_design_uuid",
      });
    }

    const currentMetadata = design.metadata as DesignMetadata;
    const updatedMetadata: DesignMetadata = {
      ...currentMetadata,
      statusChangedAt: new Date().toISOString(),
      statusChangedBy: userId,
    };

    await Design.update(
      {
        status: status,
        metadata: updatedMetadata,
      },
      { where: { uuid: designUuid } }
    );

    return res.status(200).json({
      success: true,
      message: `Diseño ${
        status === "archived"
          ? "archivado"
          : status === "completed"
          ? "completado"
          : "activado"
      } exitosamente`,
      data: { status: status },
      action: "status_updated",
    });
  } catch (error) {
    console.error("❌ Error actualizando status:", error);
    return res.status(500).json({
      success: false,
      message: "Error al actualizar el estado",
      action: "retry_later",
    });
  }
};

export const deleteDesign = async (req: Request, res: Response) => {
  try {
    const { designUuid } = req.params;
    const userId = req.userId as string;

    const design = await Design.findOne({
      where: {
        uuid: designUuid,
        userId: userId,
        status: { [Op.not]: "deleted" },
      },
    });

    if (!design) {
      return res.status(404).json({
        success: false,
        message: "Diseño no encontrado",
        action: "check_design_uuid",
      });
    }

    const transaction = await db.transaction();

    try {
      const currentMetadata = design.metadata as DesignMetadata;
      const updatedMetadata: DesignMetadata = {
        ...currentMetadata,
        deletedAt: new Date().toISOString(),
        deletedBy: userId,
      };

      await Design.update(
        {
          status: "deleted",
          metadata: updatedMetadata,
        },
        { where: { uuid: designUuid }, transaction }
      );

      await DesignFile.update(
        { status: "deleted" },
        { where: { designId: designUuid }, transaction }
      );

      await transaction.commit();

      return res.status(200).json({
        success: true,
        message: "Diseño eliminado exitosamente",
        action: "design_deleted",
      });
    } catch (transactionError) {
      await transaction.rollback();
      throw transactionError;
    }
  } catch (error) {
    console.error("❌ Error eliminando design:", error);
    return res.status(500).json({
      success: false,
      message: "Error al eliminar el diseño",
      action: "retry_later",
    });
  }
};

export const getDesignTypes = async (req: Request, res: Response) => {
  try {
    const designTypes = {
      "2d": {
        id: "2d",
        name: "Diseño 2D",
        description: "Planos arquitectónicos tradicionales",
        features: [
          "Planos de planta detallados",
          "Elevaciones de fachadas",
          "Secciones arquitectónicas",
          "Detalles constructivos",
        ],
        estimatedTime: "1-3 minutos",
        complexity: "Básica",
        price: "Gratuito",
        icon: "📐",
        downloadFormats: ["PDF", "DWG", "DXF", "JPG", "PNG"],
        conversionOptions: getAllowedConversions("2d"),
      },
      "3d": {
        id: "3d",
        name: "Diseño 3D",
        description: "Modelos tridimensionales y renders",
        features: [
          "Modelo 3D completo",
          "Renders fotorrealistas",
          "Vistas aéreas",
          "Diferentes ángulos",
        ],
        estimatedTime: "3-6 minutos",
        complexity: "Intermedia",
        price: "Premium",
        icon: "🏗️",
        downloadFormats: ["OBJ", "FBX", "GLTF", "SKP", "JPG", "PNG", "PDF"],
        conversionOptions: getAllowedConversions("3d"),
      },
      both: {
        id: "both",
        name: "Diseño Completo",
        description: "Experiencia completa 2D + 3D",
        features: [
          "Todos los planos 2D",
          "Modelo 3D avanzado",
          "Renders de alta calidad",
          "Recorrido virtual",
          "Análisis de espacios",
        ],
        estimatedTime: "5-8 minutos",
        complexity: "Avanzada",
        price: "Premium Plus",
        icon: "🎯",
        recommended: true,
        downloadFormats: [
          "PDF",
          "DWG",
          "DXF",
          "OBJ",
          "FBX",
          "GLTF",
          "SKP",
          "JPG",
          "PNG",
        ],
        conversionOptions: getAllowedConversions("both"),
      },
    };

    return res.status(200).json({
      success: true,
      data: {
        types: designTypes,
        defaultType: "2d",
        recommendedType: "both",
        conversionMatrix: getAllConversionMatrix(),
      },
      action: "types_loaded",
    });
  } catch (error) {
    console.error("❌ Error obteniendo tipos:", error);
    return res.status(500).json({
      success: false,
      message: "Error al cargar tipos de diseño",
      action: "retry_later",
    });
  }
};

export const getDesignMessages = async (req: Request, res: Response) => {
  try {
    const { designUuid } = req.params;
    const userId = req.userId;

    const design = await Design.findOne({
      where: {
        uuid: designUuid,
        userId: userId,
      },
      include: [
        {
          model: Message,
          as: "messages",
          attributes: [
            "uuid",
            "role",
            "content",
            "status",
            "createdAt",
            "metadata",
          ],
          order: [["createdAt", "ASC"]],
        },
      ],
    });

    if (!design) {
      return res.status(404).json({
        success: false,
        message: "Diseño no encontrado",
      });
    }

    res.status(200).json({
      success: true,
      data: {
        messages:
          design.messages?.map((message: any) => ({
            uuid: message.uuid,
            role: message.role,
            content: message.content,
            status: message.status,
            createdAt: message.createdAt,
          })) || [],
      },
      message: "Mensajes obtenidos exitosamente",
    });
  } catch (error) {
    console.error("❌ Error obteniendo mensajes:", error);
    res.status(500).json({
      success: false,
      message: "Error interno del servidor",
    });
  }
};

function getAllowedConversions(fromType: string): string[] {
  return ["2d", "3d", "both"];
}

function getAllConversionMatrix() {
  return {
    "2d": {
      "2d": {
        type: "optimize",
        description: "Mejorar calidad y detalles",
        icon: "✨",
      },
      "3d": { type: "generate", description: "Generar modelo 3D", icon: "🏗️" },
      both: { type: "expand", description: "Experiencia completa", icon: "🎯" },
    },
    "3d": {
      "2d": {
        type: "extract",
        description: "Crear planos técnicos",
        icon: "📐",
      },
      "3d": { type: "enhance", description: "Mejorar modelo 3D", icon: "✨" },
      both: {
        type: "complement",
        description: "Agregar planos 2D",
        icon: "📋",
      },
    },
    both: {
      "2d": { type: "focus", description: "Solo planos 2D", icon: "📐" },
      "3d": { type: "focus", description: "Solo modelo 3D", icon: "🏗️" },
      both: { type: "refine", description: "Refinar todo", icon: "✨" },
    },
  };
}

function getConversionInfo(from: string, to: string) {
  const matrix: { [key: string]: any } = {
    "2d_to_2d": {
      allowed: true,
      isOptimization: true,
      description: "Mejorar y optimizar los planos 2D actuales",
      successMessage: "Optimizando diseño 2D...",
      estimatedTime: "30-90 segundos",
      estimatedTimeMs: 60 * 1000,
      complexity: "Baja",
      action: "optimize_2d",
      benefits: [
        "Mejor calidad",
        "Detalles mejorados",
        "Corrección de errores",
      ],
    },
    "3d_to_3d": {
      allowed: true,
      isOptimization: true,
      description: "Mejorar calidad y detalles del modelo 3D actual",
      successMessage: "Optimizando modelo 3D...",
      estimatedTime: "45-120 segundos",
      estimatedTimeMs: 90 * 1000,
      complexity: "Media",
      action: "enhance_3d",
      benefits: ["Renders mejorados", "Mayor detalle", "Mejor iluminación"],
    },
    both_to_both: {
      allowed: true,
      isOptimization: true,
      description: "Refinar y mejorar todo el diseño completo",
      successMessage: "Refinando experiencia completa...",
      estimatedTime: "60-150 segundos",
      estimatedTimeMs: 120 * 1000,
      complexity: "Media",
      action: "refine_complete",
      benefits: ["Coherencia 2D-3D", "Calidad premium", "Detalles perfectos"],
    },

    "2d_to_3d": {
      allowed: true,
      isConversion: true,
      description: "Generar modelo 3D desde los planos 2D",
      successMessage: "Generando modelo 3D...",
      estimatedTime: "2-4 minutos",
      estimatedTimeMs: 3 * 60 * 1000,
      complexity: "Alta",
      action: "generate_3d_from_2d",
      benefits: ["Visualización 3D", "Renders realistas", "Recorrido virtual"],
    },
    "2d_to_both": {
      allowed: true,
      isConversion: true,
      description: "Crear experiencia completa agregando modelo 3D",
      successMessage: "Expandiendo a experiencia completa...",
      estimatedTime: "3-5 minutos",
      estimatedTimeMs: 4 * 60 * 1000,
      complexity: "Alta",
      action: "expand_to_complete",
      benefits: [
        "Experiencia completa",
        "Máxima flexibilidad",
        "Todos los formatos",
      ],
    },
    "3d_to_2d": {
      allowed: true,
      isConversion: true,
      description: "Extraer planos técnicos 2D del modelo 3D",
      successMessage: "Extrayendo planos 2D...",
      estimatedTime: "90-180 segundos",
      estimatedTimeMs: 2 * 60 * 1000,
      complexity: "Media",
      action: "extract_2d_from_3d",
      benefits: [
        "Planos técnicos",
        "Documentación profesional",
        "Listo para construcción",
      ],
    },
    "3d_to_both": {
      allowed: true,
      isConversion: true,
      description: "Complementar modelo 3D con planos técnicos 2D",
      successMessage: "Creando planos complementarios...",
      estimatedTime: "2-3 minutos",
      estimatedTimeMs: 150 * 1000,
      complexity: "Media",
      action: "complement_with_2d",
      benefits: [
        "Documentación completa",
        "Planos + 3D",
        "Presentación profesional",
      ],
    },
    both_to_2d: {
      allowed: true,
      isConversion: true,
      description: "Enfocarse únicamente en los planos 2D",
      successMessage: "Enfocando en planos 2D...",
      estimatedTime: "30-60 segundos",
      estimatedTimeMs: 45 * 1000,
      complexity: "Baja",
      action: "focus_on_2d",
      benefits: ["Planos optimizados", "Menor complejidad", "Descarga rápida"],
    },
    both_to_3d: {
      allowed: true,
      isConversion: true,
      description: "Enfocarse únicamente en el modelo 3D",
      successMessage: "Enfocando en modelo 3D...",
      estimatedTime: "45-90 segundos",
      estimatedTimeMs: 60 * 1000,
      complexity: "Baja",
      action: "focus_on_3d",
      benefits: [
        "Modelo optimizado",
        "Mejor rendimiento",
        "Visualización pura",
      ],
    },
  };

  const key = `${from}_to_${to}`;
  return (
    matrix[key] || {
      allowed: false,
      message: "Conversión no válida",
      action: "select_valid_conversion",
    }
  );
}

function getSystemPromptByType(type: string): string {
  const prompts: { [key: string]: string } = {
    "2d": "Soy un asistente especializado en planos arquitectónicos 2D. Puedo crear planos detallados y convertirlos a otros formatos según necesites.",
    "3d": "Soy un asistente especializado en modelado 3D arquitectónico. Puedo crear modelos tridimensionales y adaptarlos a diferentes formatos.",
    both: "Soy un asistente especializado en diseño arquitectónico completo. Trabajo tanto con planos 2D como modelos 3D con total flexibilidad.",
  };
  return prompts[type] || prompts["2d"];
}

function getTypeDescription(type: string): string {
  const descriptions: { [key: string]: string } = {
    "2d": "Planos arquitectónicos tradicionales - Convertibles a cualquier formato",
    "3d": "Modelos tridimensionales realistas - Adaptables a cualquier necesidad",
    both: "Diseño completo con máxima flexibilidad de formatos",
  };
  return descriptions[type] || descriptions["2d"];
}

function getExpectedOutputs(type: string): string[] {
  const outputs: { [key: string]: string[] } = {
    "2d": ["Plano de planta", "Elevaciones", "Secciones", "Detalles técnicos"],
    "3d": ["Modelo 3D", "Renders realistas", "Vistas aéreas", "Perspectivas"],
    both: [
      "Planos técnicos",
      "Modelo 3D",
      "Renders fotorrealistas",
      "Documentación completa",
    ],
  };
  return outputs[type] || outputs["2d"];
}

function getConversionOptions(type: string): string[] {
  return getAllowedConversions(type);
}

function getTypeSpecificSettings(type: string) {
  const settings: { [key: string]: any } = {
    "2d": {
      includeFloorPlan: true,
      includeElevations: true,
      includeSections: true,
      includeDetails: true,
    },
    "3d": {
      includeExteriorRender: true,
      includeInteriorRender: true,
      includeAerialView: true,
      includeWalkthrough: false,
    },
    both: {
      include2D: true,
      include3D: true,
      includeAllViews: true,
      includeDocumentation: true,
    },
  };
  return settings[type] || settings["2d"];
}

function getComplexity(type: string): string {
  const complexity: { [key: string]: string } = {
    "2d": "Básica",
    "3d": "Intermedia",
    both: "Avanzada",
  };
  return complexity[type] || "Básica";
}

function getEstimatedTime(type: string): string {
  const times: { [key: string]: string } = {
    "2d": "1-3 minutos",
    "3d": "3-6 minutos",
    both: "5-8 minutos",
  };
  return times[type] || "1-3 minutos";
}

async function processAIResponse(
  designUuid: string,
  userMessage: string
): Promise<void> {
  try {
    console.log("🤖 Procesando mensaje del usuario con IA...");

    const design = await Design.findOne({
      where: { uuid: designUuid },
      include: [
        {
          model: Message,
          as: "messages",
          order: [["createdAt", "ASC"]],
          limit: 10,
        },
      ],
    });

    if (!design) {
      console.error("❌ Diseño no encontrado para procesar IA");
      return;
    }

    const requestType = analyzeUserRequest(userMessage, design.type);

    let aiResponse: string;
    let shouldGenerateFiles = false;

    switch (requestType.category) {
      case "generate_plan":
        aiResponse = await generateArchitecturalPlan(design, userMessage);
        shouldGenerateFiles = true;
        break;

      case "modify_design":
        aiResponse = await modifyExistingDesign(design, userMessage);
        shouldGenerateFiles = true;
        break;

      case "request_info":
        aiResponse = await provideDesignInformation(design, userMessage);
        break;

      case "convert_format":
        aiResponse = await handleFormatConversion(design, userMessage);
        shouldGenerateFiles = true;
        break;

      default:
        aiResponse = await generateGenericResponse(design, userMessage);
    }

    await Message.create({
      uuid: uuidv4(),
      designId: design.uuid,
      role: "assistant",
      content: aiResponse,
      status: "completed",
      metadata: {
        responseType: requestType.category,
        processingTime: Date.now(),
        timestamp: new Date().toISOString(),
        confidence: requestType.confidence,
      },
    });

    if (shouldGenerateFiles) {
      // 🚫 GENERACIÓN AUTOMÁTICA DESHABILITADA - Solo generamos SVG y STL con NLP
      // generateDesignFiles(design.uuid, design.type).catch((error) => {
      //   console.error("❌ Error generando archivos:", error);
      // });
      console.log("🗂️ Generación automática deshabilitada - Solo NLP SVG/STL");
    }

    console.log("✅ Respuesta de IA procesada exitosamente");
  } catch (error) {
    console.error("❌ Error en processAIResponse:", error);

    await Message.create({
      uuid: uuidv4(),
      designId: designUuid,
      role: "assistant",
      content:
        "Disculpa, hubo un problema procesando tu solicitud. Por favor intenta nuevamente o contacta soporte.",
      status: "error",
      metadata: {
        error: error instanceof Error ? error.message : "Unknown error",
        timestamp: new Date().toISOString(),
      },
    });
  }
}

function analyzeUserRequest(
  message: string,
  designType: string
): {
  category:
    | "generate_plan"
    | "modify_design"
    | "request_info"
    | "convert_format"
    | "general";
  confidence: number;
  keywords: string[];
} {
  const messageLower = message.toLowerCase();

  const generateKeywords = [
    "genera",
    "crea",
    "diseña",
    "nuevo",
    "plano",
    "casa",
    "edificio",
    "habitaciones",
  ];
  const generateCount = generateKeywords.filter((keyword) =>
    messageLower.includes(keyword)
  ).length;

  const modifyKeywords = [
    "modifica",
    "cambia",
    "ajusta",
    "mejora",
    "agrega",
    "quita",
    "reduce",
    "amplia",
  ];
  const modifyCount = modifyKeywords.filter((keyword) =>
    messageLower.includes(keyword)
  ).length;

  const infoKeywords = [
    "¿",
    "?",
    "cuánto",
    "cómo",
    "cuál",
    "explica",
    "información",
    "detalles",
  ];
  const infoCount = infoKeywords.filter((keyword) =>
    messageLower.includes(keyword)
  ).length;

  const convertKeywords = [
    "convierte",
    "cambia formato",
    "3d",
    "2d",
    "render",
    "modelo",
  ];
  const convertCount = convertKeywords.filter((keyword) =>
    messageLower.includes(keyword)
  ).length;

  const scores = {
    generate_plan: generateCount,
    modify_design: modifyCount,
    request_info: infoCount,
    convert_format: convertCount,
  };

  const maxScore = Math.max(...Object.values(scores));
  const category = Object.keys(scores).find(
    (key) => scores[key as keyof typeof scores] === maxScore
  ) as keyof typeof scores;

  return {
    category: maxScore > 0 ? category : "general",
    confidence: Math.min(maxScore / 3, 1),
    keywords: generateKeywords
      .concat(modifyKeywords, infoKeywords, convertKeywords)
      .filter((keyword) => messageLower.includes(keyword)),
  };
}

async function generateArchitecturalPlan(
  design: any,
  userMessage: string
): Promise<string> {
  try {
    const designMetadata = design.metadata as DesignMetadata;

    const prompt: ArchitecturalPrompt = {
      userDescription: userMessage,
      requirements: {
        totalArea: extractAreaFromMessage(userMessage) || 100,
        rooms: extractRoomsFromMessage(userMessage),
        style: extractStyleFromMessage(userMessage) || "moderno",
        specialFeatures: extractFeaturesFromMessage(userMessage),
      },
      context: {
        designType: design.type,
        complexity: design.type === "both" ? "complex" : "medium",
        priority: "quality",
      },
    };

    const result = await AdvancedAIService.generateDetailedPlan(prompt);

    return `🏗️ **Plano Arquitectónico Generado**

**${result.plan.metadata.title}**

${result.plan.description}

📏 **Especificaciones:**
- Área total: ${result.plan.metadata.totalArea}m²
- Dimensiones: ${result.plan.metadata.dimensions.width}m x ${
      result.plan.metadata.dimensions.length
    }m
- Habitaciones: ${result.plan.rooms.length}
- Estilo: ${result.plan.metadata.style}

🏠 **Distribución de espacios:**
${result.plan.rooms
  .map(
    (room: any, index: number) =>
      `${index + 1}. **${room.name}** (${room.area}m²) - ${room.purpose}`
  )
  .join("\n")}

💰 **Estimación de costos:**
- Total: $${result.plan.estimatedCost?.total.toLocaleString()} ${
      result.plan.estimatedCost?.currency
    }
- Por m²: $${Math.round(
      (result.plan.estimatedCost?.total || 0) / result.plan.metadata.totalArea
    ).toLocaleString()}

📊 **Análisis del proyecto:**
- Factibilidad: ${(result.analysis.feasibilityScore * 100).toFixed(1)}%
- Tiempo estimado: ${result.analysis.estimatedTime}

💡 **Recomendaciones principales:**
${result.analysis.recommendations
  .slice(0, 3)
  .map((rec: string, i: number) => `${i + 1}. ${rec}`)
  .join("\n")}

🎯 Estoy generando los archivos técnicos. Los tendrás listos en unos minutos.`;
  } catch (error) {
    console.error("Error generando plano:", error);
    return "Hubo un problema generando el plano arquitectónico. Usando método de respaldo...";
  }
}

async function modifyExistingDesign(
  design: any,
  userMessage: string
): Promise<string> {
  return `🔧 **Modificación en Progreso**

Entiendo que quieres modificar el diseño actual. Estoy analizando tu solicitud:

"${userMessage}"

📋 **Cambios identificados:**
- Analizando modificaciones solicitadas
- Verificando viabilidad técnica
- Calculando nuevas dimensiones

⏳ Te tendré una propuesta actualizada en unos minutos. Los archivos se regenerarán automáticamente.`;
}

async function provideDesignInformation(
  design: any,
  userMessage: string
): Promise<string> {
  const designMetadata = design.metadata as DesignMetadata;

  return `ℹ️ **Información del Diseño**

📋 **Detalles generales:**
- Título: ${design.title}
- Tipo: ${design.type.toUpperCase()}
- Estado: ${design.status}
- Complejidad: ${designMetadata.estimatedComplexity}

⏰ **Tiempo estimado:** ${designMetadata.estimatedTime}

🔄 **Conversiones disponibles:**
${getAllowedConversions(design.type)
  .map((format) => `- A ${format.toUpperCase()}`)
  .join("\n")}

💬 **Historial:**
- Total de mensajes: ${designMetadata.totalMessages || 0}
- Última actividad: ${
    designMetadata.lastMessageAt
      ? new Date(designMetadata.lastMessageAt).toLocaleString()
      : "N/A"
  }

¿Hay algo específico que te gustaría saber sobre este proyecto?`;
}

async function handleFormatConversion(
  design: any,
  userMessage: string
): Promise<string> {
  return `🔄 **Conversión de Formato**

Proceso de conversión iniciado basado en tu solicitud:

"${userMessage}"

📊 **Estado actual:** ${design.type.toUpperCase()}

🎯 **Opciones disponibles:**
- 2D: Planos técnicos detallados
- 3D: Modelos tridimensionales
- BOTH: Experiencia completa

⏳ La conversión tomará entre 1-5 minutos dependiendo del formato objetivo.

¿Podrías especificar exactamente a qué formato quieres convertir?`;
}

async function generateGenericResponse(
  design: any,
  userMessage: string
): Promise<string> {
  return `👋 Hola! Soy tu asistente de diseño arquitectónico.

He recibido tu mensaje: "${userMessage}"

🎯 **Puedo ayudarte con:**
- Generar nuevos planos arquitectónicos
- Modificar el diseño actual
- Convertir entre formatos (2D/3D)
- Proporcionar información técnica
- Estimar costos y tiempos

💡 **Sugerencias:**
- "Genera una casa de 120m² con 3 habitaciones"
- "Modifica la cocina para que sea más grande"
- "Convierte este diseño a 3D"
- "¿Cuánto costaría construir esto?"

¿En qué te gustaría que trabaje?`;
}

function extractAreaFromMessage(message: string): number | null {
  const areaMatch = message.match(/(\d+)\s*(m²|metros|m2|metro)/i);
  return areaMatch ? parseInt(areaMatch[1]) : null;
}

function extractRoomsFromMessage(
  message: string
): Array<{ type: string; count: number }> {
  const rooms = [];

  const habitacionMatch = message.match(
    /(\d+)\s*(habitacion|dormitorio|cuarto)/i
  );
  if (habitacionMatch) {
    rooms.push({ type: "habitación", count: parseInt(habitacionMatch[1]) });
  }

  const bañoMatch = message.match(/(\d+)\s*(baño|aseo)/i);
  if (bañoMatch) {
    rooms.push({ type: "baño", count: parseInt(bañoMatch[1]) });
  }

  return rooms.length > 0 ? rooms : [{ type: "habitación", count: 2 }];
}

function extractStyleFromMessage(message: string): string {
  const styles = [
    "moderno",
    "clásico",
    "minimalista",
    "contemporáneo",
    "tradicional",
  ];
  return (
    styles.find((style) => message.toLowerCase().includes(style)) || "moderno"
  );
}

function extractFeaturesFromMessage(message: string): string[] {
  const features = [];

  if (message.toLowerCase().includes("cocina abierta"))
    features.push("cocina abierta");
  if (message.toLowerCase().includes("terraza")) features.push("terraza");
  if (message.toLowerCase().includes("jardín")) features.push("jardín");
  if (message.toLowerCase().includes("garaje")) features.push("garaje");
  if (message.toLowerCase().includes("piscina")) features.push("piscina");

  return features;
}

// ELIMINAR la función generateDesignFiles que está en las líneas 1444-1490 (la primera)
// Y REEMPLAZAR la función generateDesignFiles que está en las líneas 1540-1600 (la segunda) con esta versión mejorada:

// 🔥 GENERAR ARCHIVOS AUTOMÁTICAMENTE - VERSIÓN MEJORADA
// Cambiar la función generateDesignFiles para usar los tipos correctos:

// 🔥 GENERAR ARCHIVOS AUTOMÁTICAMENTE - VERSIÓN CORREGIDA
import { generatePdfFile } from '../../services/FileGenerators/PdfGenerator';
import { generateDxfFile } from '../../services/FileGenerators/DxfGenerator';

async function generateDesignFiles(designUuid: string, designType: string) {
  console.log(`🔄 Generando archivos para el diseño ${designUuid} (${designType})`);

  // Usa el plan real generado por la IA
  const design = await Design.findOne({ where: { uuid: designUuid } });
if (!design) throw new Error('Diseño no encontrado');
if (!design.metadata) throw new Error('El diseño no tiene metadata');

let metadata = design.metadata;
if (typeof metadata === "string") {
  try {
    metadata = JSON.parse(metadata) as DesignMetadata;
  } catch (e) {
    throw new Error("No se pudo parsear metadata");
  }
}
const planData = (metadata as DesignMetadata).planData;
if (!planData) throw new Error('No hay planData en el diseño');
  // Crea la carpeta de destino para los archivos 
  const fs = require('fs');
  const path = require('path');
  const { v4: uuidv4 } = require('uuid');
  // Asegúrate de que la carpeta de uploads exista
  if (!fs.existsSync(path.join(process.cwd(), 'uploads', 'designs'))) {
    fs.mkdirSync(path.join(process.cwd(), 'uploads', 'designs'), { recursive: true });
  }

  // Crea una carpeta específica para el diseño
  if (!designUuid) throw new Error('UUID del diseño no proporcionado');
  if (!fs.existsSync(path.join(process.cwd(), 'uploads', 'designs', designUuid))) {
    fs.mkdirSync(path.join(process.cwd(), 'uploads', 'designs', designUuid), { recursive: true });
  }

  const folder = path.join(process.cwd(), 'uploads', 'designs', designUuid);
  fs.mkdirSync(folder, { recursive: true });

  // Asegúrate de que el planData tenga la estructura correcta
  if (!planData || !planData.metadata || !planData.rooms) {
    throw new Error('Plan data incompleto o inválido');
  }

 
  // Generar PDF
  const pdfName = `planos_${Date.now()}.pdf`;
  const pdfPath = path.join(folder, pdfName);
  console.log(`Generando PDF en: ${pdfPath}`);
  // Sanitizacion antes de generar el PDF
  const sanitizedPlan = sanitizePlan(planData);
  console.log('Habitaciones que se enviarán al PDF:', sanitizedPlan.rooms);
  if (!sanitizedPlan) {
    throw new Error('No se pudo sanitizar el plan');
  }
  const sanitizedPlanWithUuid = { ...sanitizedPlan, uuid: designUuid };

  // Asegura que el PDF reciba las habitaciones del layout
  const pdfPlanData = {
    ...sanitizedPlanWithUuid,
    threeJSData: {
      ...sanitizedPlanWithUuid.threeJSData,
      rooms: sanitizedPlanWithUuid.rooms // <-- Aquí pasas las habitaciones correctas
    }
  };

  await generatePdfFile(pdfPlanData, pdfPath);
  console.log(`PDF generado: ${pdfName}`);

  // Registrar en la base de datos
  await DesignFile.create({
    uuid: uuidv4(),
    designId: designUuid,
    filename: pdfName,
    filePath: `${designUuid}/${pdfName}`,
    fileType: 'pdf',
    status: 'ready',
    downloadUrl: `/api/designs/files/${uuidv4()}/download`,
    fileSize: fs.statSync(pdfPath).size,
    originalName: pdfName,
    metadata: { generatedAt: new Date().toISOString() },
  });

  // Repite para DWG/DXF y otros formatos reales
}

// Función auxiliar para obtener MIME type
function getMimeType(format: string): string {
  const mimeTypes: { [key: string]: string } = {
    PDF: "application/pdf",
    DWG: "application/acad",
    DXF: "application/dxf",
    OBJ: "application/wavefront-obj",
    FBX: "application/fbx",
    JPG: "image/jpeg",
    PNG: "image/png",
    GLTF: "model/gltf+json",
    SKP: "application/skp",
  };
  return mimeTypes[format.toUpperCase()] || "application/octet-stream";
}
