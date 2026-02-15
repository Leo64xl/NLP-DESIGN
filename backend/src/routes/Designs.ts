import express from "express";
import {
  createDesign,
  getDesignByUuid,
  getUserDesigns,
  updateDesignStatus,
  deleteDesign,
  convertDesignFormat,
  addMessage,
  getDesignTypes,
  getDesignMessages
} from "../controllers/designs/DesignController";
import { downloadFile } from "../controllers/files/DesignFileController";
import Message from "../database/models/Message.model";
import MainAIService from '../services/ai/MainAIService';
import { DesignFileService } from "../services/ai/DesignFileService";
import { verifyUser } from "../middlewares/auth/Authentication";
import { RequestHandler, Request, Response } from "express";
import { Op } from "sequelize";

const router = express.Router();

function asyncHandler(fn: (...args: any[]) => Promise<any>): RequestHandler {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

// 🎯 EXTENDER EL TIPO Request PARA INCLUIR userId
declare global {
  namespace Express {
    interface Request {
      userId?: string;
    }
  }
}

router.get('/ai/status', asyncHandler(async (req: Request, res: Response) => {
  try {
    const status = await MainAIService.getServiceStatus();
    res.json(status);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Error desconocido';
    res.status(500).json({
      status: 'error',
      error: errorMessage
    });
  }
}));

router.post("/designs", asyncHandler(verifyUser), asyncHandler(createDesign));
router.get(
  "/designs/:designUuid",
  asyncHandler(verifyUser),
  asyncHandler(getDesignByUuid)
);
router.get("/designs", asyncHandler(verifyUser), asyncHandler(getUserDesigns));
router.put(
  "/designs/:designUuid/status",
  asyncHandler(verifyUser),
  asyncHandler(updateDesignStatus)
);
router.get('/designs/:designUuid/messages', asyncHandler(verifyUser), asyncHandler(getDesignMessages)); // 🔥 AGREGAR ESTA LÍNEA
router.delete("/designs/:designUuid", asyncHandler(deleteDesign));

router.post(
  "/designs/:designUuid/convert",
  asyncHandler(verifyUser),
  asyncHandler(convertDesignFormat)
);

router.post(
  "/designs/:designUuid/messages",
  asyncHandler(verifyUser),
  asyncHandler(async (req, res) => {
    try {
      const { designUuid } = req.params;
      const { content, role = "user" } = req.body;
      const userId = req.userId;

      // Validar contenido del mensaje
      if (!content || typeof content !== "string") {
        return res.status(400).json({
          success: false,
          message: "El contenido del mensaje es requerido",
          action: "check_message_content",
        });
      }

      // Verificar que el diseño existe y pertenece al usuario
      const Design = require("../database/models/Design.model").default;
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
          message: "Diseño no encontrado o sin acceso",
          action: "check_design_access",
        });
      }

      // Crear el mensaje del usuario
      const Message = require("../database/models/Message.model").default;
      const userMessage = await Message.create({
        uuid: require("uuid").v4(),
        designId: designUuid,
        role: role,
        content: content,
        status: "completed",
        metadata: {},
      });

      // Generar respuesta de la IA
      setTimeout(async () => {
        try {
          const DesignController = require("../controllers/designs/DesignController");

          // Crear un objeto req simulado con todas las propiedades necesarias
          const mockReq = {
            params: { designUuid },
            body: { content },
            userId,
            ip: "unknown",
            get: (header: string) =>
              header === "User-Agent" ? "Cliente web" : null,
          };

          // Crear un objeto res simulado
          const mockRes = {
            status: () => ({
              json: () => ({}),
            }),
          };

          await DesignController.addMessage(mockReq, mockRes);
        } catch (aiError) {
          const aiErrorMessage = aiError instanceof Error ? aiError.message : 'Error desconocido en IA';
          console.error("Error en procesamiento de IA:", aiErrorMessage);
        }
      }, 1000);
      console.log("Mensaje enviado:", userMessage);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Error desconocido';
      console.error("Error enviando mensaje:", errorMessage);
      return res.status(500).json({
        success: false,
        message: "Error interno del servidor",
        action: "retry_send",
      });
    }
  })
);

router.get(
  "/designs/:designUuid/messages",
  asyncHandler(verifyUser),
  asyncHandler(async (req, res) => {
    try {
      const { designUuid } = req.params;
      const userId = req.userId;

      const messages = await Message.findAll({
        where: { designId: designUuid },
        order: [["createdAt", "ASC"]],
        attributes: [
          "uuid",
          "role",
          "content",
          "status",
          "createdAt",
          "metadata",
        ],
      });

      res.status(200).json({
        success: true,
        data: { messages },
        message: "Mensajes obtenidos correctamente",
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Error desconocido';
      console.error("Error obteniendo mensajes:", errorMessage);
      res.status(500).json({
        success: false,
        message: "Error interno del servidor",
      });
    }
  })
);

router.get(
  "/design-types",
  asyncHandler(verifyUser),
  asyncHandler(getDesignTypes)
);

// 🎯 RUTA DE DESCARGA DE ARCHIVOS - USANDO DESIGNFILECONTROLLER
router.get(
  "/api/files/download/:fileUuid",
  asyncHandler(verifyUser),
  asyncHandler(downloadFile)
);

router.post(
  '/designs/:designUuid/generate-file',
  asyncHandler(verifyUser),
  asyncHandler(async (req: Request, res: Response) => {
    try {
      const { designUuid } = req.params;
      const { fileType, format, options = {} } = req.body;
      const userId = req.userId;

      // Validar parámetros
      if (!fileType || !format) {
        return res.status(400).json({
          success: false,
          message: "fileType y format son requeridos",
        });
      }

      // Validar que el diseño existe y pertenece al usuario
      const Design = require("../database/models/Design.model").default;
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
          message: "Diseño no encontrado o sin acceso",
        });
      }

      // Validar que el fileType es permitido
      const allowedTypes = ['image', 'pdf', 'dwg', 'dxf', 'skp', 'obj', 'fbx', 'gltf', 'json', 'mtl'];
      if (!allowedTypes.includes(fileType)) {
        return res.status(400).json({
          success: false,
          message: `fileType inválido. Debe ser uno de: ${allowedTypes.join(', ')}`,
        });
      }

      // Llamar al controlador de archivos
      const { generateFile } = require('../controllers/files/DesignFileController');
      await generateFile(req, res);

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Error desconocido';
      console.error("Error en generación de archivo:", errorMessage);
      return res.status(500).json({
        success: false,
        message: "Error interno al generar archivo",
      });
    }
  })
);

export default router;