import { Request, Response } from 'express';
import { Op } from 'sequelize';
import Users from '../../database/models/User.model';
import Design from '../../database/models/Design.model';
import DesignFile from '../../database/models/DesignFile.model';
import Message from '../../database/models/Message.model';
import { v4 as uuidv4 } from 'uuid';

interface Notification {
  uuid: string;
  userId: string;
  type: 'design_ready' | 'ai_limit_warning' | 'system_update';
  title: string;
  message: string;
  data?: any;
  read: boolean;
  createdAt: string;
  expiresAt?: string;
}

interface NotificationSummary {
  total: number;
  unread: number;
  byType: {
    design_ready: number;
    ai_limit_warning: number;
    system_update: number;
  };
  recent: Notification[];
}

// Base de datos en memoria para notificaciones (en producción usarías una DB real)
const notificationsDB = new Map<string, any[]>();

// Función para inicializar notificaciones por usuario
function initializeUserNotifications(userId: string) {
  if (!notificationsDB.has(userId)) {
    notificationsDB.set(userId, [
      {
        id: 'notif-1',
        title: '¡Tu diseño está listo!',
        message: 'Los archivos de "Casa Moderna" han sido generados exitosamente',
        type: 'design_complete',
        isRead: false,
        createdAt: new Date(Date.now() - 30000).toISOString(),
        data: {
          designId: 'design-123',
          designTitle: 'Casa Moderna'
        }
      },
      {
        id: 'notif-2',
        title: 'Nuevo template disponible',
        message: 'Explora el nuevo template "Loft Industrial" en nuestra galería',
        type: 'new_template',
        isRead: true,
        createdAt: new Date(Date.now() - 3600000).toISOString(),
        data: {
          templateId: 'template-loft-industrial'
        }
      },
      {
        id: 'notif-3',
        title: 'Conversión completada',
        message: 'Tu archivo DWG ha sido convertido a PDF exitosamente',
        type: 'conversion_complete',
        isRead: false,
        createdAt: new Date(Date.now() - 7200000).toISOString(),
        data: {
          designId: 'design-456',
          fromFormat: 'dwg',
          toFormat: 'pdf'
        }
      }
    ]);
  }
  return notificationsDB.get(userId) || [];
}

export class NotificationController {
  static async getUserNotifications(req: Request, res: Response) {
    try {
      const userId = req.userId;
      if (!userId) {
        return res.status(401).json({
          success: false,
          message: "Usuario no autenticado"
        });
      }

      const { page = 1, limit = 10, unreadOnly = false } = req.query;

      // Inicializar notificaciones del usuario si no existen
      const notifications = initializeUserNotifications(userId);

      const filteredNotifications = unreadOnly === 'true' 
        ? notifications.filter(n => !n.isRead)
        : notifications;

      res.json({
        success: true,
        data: {
          notifications: filteredNotifications,
          unreadCount: notifications.filter(n => !n.isRead).length,
          pagination: {
            currentPage: Number(page),
            totalPages: 1,
            totalItems: filteredNotifications.length
          }
        },
        message: "Notificaciones obtenidas exitosamente"
      });
    } catch (error) {
      console.error('Error obteniendo notificaciones:', error);
      res.status(500).json({
        success: false,
        message: "Error interno del servidor"
      });
    }
  }

  static async markAsRead(req: Request, res: Response) {
    try {
      const { notificationIds } = req.body;
      const userId = req.userId;

      if (!userId) {
        return res.status(401).json({
          success: false,
          message: "Usuario no autenticado"
        });
      }

      if (!notificationIds || !Array.isArray(notificationIds)) {
        return res.status(400).json({
          success: false,
          message: "notificationIds debe ser un array"
        });
      }

      // Obtener notificaciones del usuario
      const notifications = notificationsDB.get(userId) || [];
      
      // Marcar como leídas las notificaciones especificadas
      const markedAsRead: string[] = [];
      notifications.forEach(notification => {
        if (notificationIds.includes(notification.id) && !notification.isRead) {
          notification.isRead = true;
          markedAsRead.push(notification.id);
        }
      });

      // Actualizar en la base de datos en memoria
      notificationsDB.set(userId, notifications);

      res.json({
        success: true,
        data: {
          markedAsRead,
          timestamp: new Date().toISOString()
        },
        message: `${markedAsRead.length} notificaciones marcadas como leídas`
      });
    } catch (error) {
      console.error('Error marcando notificaciones como leídas:', error);
      res.status(500).json({
        success: false,
        message: "Error interno del servidor"
      });
    }
  }

  static async createNotification(req: Request, res: Response) {
    try {
      const { title, message, type, data } = req.body;
      const userId = req.userId;

      const notification = {
        id: `notif-${Date.now()}`,
        title,
        message,
        type,
        isRead: false,
        createdAt: new Date().toISOString(),
        data
      };

      res.json({
        success: true,
        data: { notification },
        message: "Notificación creada exitosamente"
      });
    } catch (error) {
      console.error('Error creando notificación:', error);
      res.status(500).json({
        success: false,
        message: "Error interno del servidor"
      });
    }
  }
}

export async function notifyDesignReady(designId: string, fileType: string) {
  try {
    const design = await Design.findOne({ where: { uuid: designId } });
    if (!design) return;

    const fileTypeNames: Record<string, string> = {
      'pdf': 'Planos PDF',
      'dwg': 'Archivo DWG',
      'obj': 'Modelo 3D',
      'jpg': 'Render'
    };

    const notification = await createNotification(
      'design_ready',
      design.userId,
      '🎉 ¡Tu diseño está listo!',
      `${fileTypeNames[fileType] || 'Archivo'} generado para "${design.title}". ¡Descárgalo ahora!`,
      {
        designId: design.uuid,
        designTitle: design.title,
        fileType,
        downloadUrl: `/api/designs/${design.uuid}/files`
      }
    );

    console.log(`✅ Notificación de diseño listo enviada: ${design.title} - ${fileType}`);
    return notification;

  } catch (error) {
    console.error('Error notificando diseño listo:', error);
  }
}

export async function notifyAILimitReached(userId: string, limitType: 'daily' | 'monthly', usage: number, limit: number) {
  try {
    const user = await Users.findOne({ where: { uuid: userId } });
    if (!user) return;

    const limitMessages = {
      daily: {
        title: '⚠️ Límite diario de IA alcanzado',
        message: `Has usado ${usage}/${limit} consultas de IA hoy. El límite se renueva mañana a las 00:00.`
      },
      monthly: {
        title: '🚨 Límite mensual de IA alcanzado',
        message: `Has usado ${usage}/${limit} consultas de IA este mes. Considera upgrading tu plan.`
      }
    };

    const notification = await createNotification(
      'ai_limit_warning',
      userId,
      limitMessages[limitType].title,
      limitMessages[limitType].message,
      {
        limitType,
        usage,
        limit,
        renewsAt: limitType === 'daily' ? getNextMidnight() : getNextMonth(),
        upgradeUrl: '/upgrade'
      }
    );

    console.log(`⚠️ Notificación de límite IA enviada: ${user.username} - ${limitType}`);
    return notification;

  } catch (error) {
    console.error('Error notificando límite IA:', error);
  }
}

export async function notifySystemUpdate(updateType: 'maintenance' | 'feature' | 'security', details: any) {
  try {
    const updateMessages = {
      maintenance: {
        title: '🔧 Mantenimiento programado',
        message: `El sistema estará en mantenimiento ${details.date} de ${details.startTime} a ${details.endTime}. Los servicios no estarán disponibles.`
      },
      feature: {
        title: '🚀 Nueva funcionalidad disponible',
        message: `¡Hemos agregado "${details.featureName}"! ${details.description}`
      },
      security: {
        title: '🔒 Actualización de seguridad',
        message: `Hemos implementado mejoras de seguridad. ${details.action || 'No se requiere acción de tu parte.'}`
      }
    };

    const activeUsers = await Users.findAll({
      where: { verified: 'true', role: { [Op.ne]: 'banned' } },
      attributes: ['uuid']
    });

    const notifications = [];
    for (const user of activeUsers) {
      const notification = await createNotification(
        'system_update',
        user.uuid,
        updateMessages[updateType].title,
        updateMessages[updateType].message,
        {
          updateType,
          ...details,
          broadcastAt: new Date().toISOString()
        }
      );
      notifications.push(notification);
    }

    console.log(`📢 Notificación de sistema enviada a ${activeUsers.length} usuarios: ${updateType}`);
    return notifications;

  } catch (error) {
    console.error('Error notificando actualización del sistema:', error);
  }
}

const notificationsStore = new Map<string, Notification[]>();

async function getStoredNotifications(userId: string): Promise<Notification[]> {
  return notificationsStore.get(userId) || [];
}

async function createNotification(
  type: 'design_ready' | 'ai_limit_warning' | 'system_update',
  userId: string,
  title: string,
  message: string,
  data?: any
): Promise<Notification> {
  
  const notification: Notification = {
    uuid: uuidv4(),
    userId,
    type,
    title,
    message,
    data,
    read: false,
    createdAt: new Date().toISOString(),
    expiresAt: getExpirationDate(type)
  };

  const userNotifications = notificationsStore.get(userId) || [];
  
  userNotifications.unshift(notification);
  
  if (userNotifications.length > 100) {
    userNotifications.splice(100);
  }
  
  notificationsStore.set(userId, userNotifications);
  
  return notification;
}

async function markNotificationsAsRead(userId: string, notificationIds: string[]) {
  const userNotifications = notificationsStore.get(userId) || [];
  
  userNotifications.forEach(notification => {
    if (notificationIds.includes(notification.uuid)) {
      notification.read = true;
    }
  });
  
  notificationsStore.set(userId, userNotifications);
}

async function markAllNotificationsAsRead(userId: string) {
  const userNotifications = notificationsStore.get(userId) || [];
  
  userNotifications.forEach(notification => {
    notification.read = true;
  });
  
  notificationsStore.set(userId, userNotifications);
}

function getExpirationDate(type: string): string {
  const now = new Date();
  const expirationHours = {
    'design_ready': 72, 
    'ai_limit_warning': 24,
    'system_update': 168 
  };
  
  now.setHours(now.getHours() + (expirationHours[type as keyof typeof expirationHours] || 24));
  return now.toISOString();
}

function getNextMidnight(): string {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(0, 0, 0, 0);
  return tomorrow.toISOString();
}

function getNextMonth(): string {
  const nextMonth = new Date();
  nextMonth.setMonth(nextMonth.getMonth() + 1);
  nextMonth.setDate(1);
  nextMonth.setHours(0, 0, 0, 0);
  return nextMonth.toISOString();
}

export async function triggerDesignReadyNotification(designId: string, fileType: string) {
  await notifyDesignReady(designId, fileType);
}

export async function triggerAILimitNotification(userId: string, limitType: 'daily' | 'monthly', usage: number, limit: number) {
  await notifyAILimitReached(userId, limitType, usage, limit);
}

export async function triggerSystemUpdateNotification(updateType: 'maintenance' | 'feature' | 'security', details: any) {
  await notifySystemUpdate(updateType, details);
}

export default NotificationController;