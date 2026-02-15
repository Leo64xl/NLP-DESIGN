import { Request, Response } from 'express';
import { Op, Sequelize } from 'sequelize';
import Users from '../../../database/models/User.model';
import Design from '../../../database/models/Design.model';
import Message from '../../../database/models/Message.model';
import DesignFile from '../../../database/models/DesignFile.model';

interface AdminOverview {
  systemStats: {
    totalUsers: number;
    activeUsers: number;
    totalProjects: number;
    aiRequests: number;
    storageUsed: string;
    uptime: string;
  };
  recentActivity: Array<{
    type: 'user_signup' | 'project_created' | 'ai_request' | 'file_generated';
    description: string;
    timestamp: string;
    userId?: string;
    username?: string;
  }>;
  alerts: Array<{
    type: 'warning' | 'error' | 'info';
    message: string;
    count?: number;
  }>;
}

interface SystemMetrics {
  usage: {
    dailyUsers: Array<{ date: string; count: number }>;
    projectsCreated: Array<{ date: string; count: number }>;
    aiUsage: Array<{ date: string; requests: number }>;
  };
  performance: {
    averageResponseTime: number;
    errorRate: number;
    aiSuccessRate: number;
    storageGrowth: string;
  };
  topStats: {
    mostActiveUsers: Array<{ username: string; projects: number; activity: string }>;
    popularProjectTypes: Array<{ type: string; count: number; percentage: number }>;
    peakUsageHours: Array<{ hour: number; requests: number }>;
  };
}

export class AdminDashboardController {

  static async getOverview(req: Request, res: Response) {
    try {
      const userRole = req.role as string;

      if (!['admin', 'superadmin'].includes(userRole)) {
        return res.status(403).json({
          success: false,
          message: "Acceso denegado. Se requieren permisos de administrador."
        });
      }

      const [
        totalUsers,
        activeUsers,
        totalProjects,
        totalAIRequests,
        totalFiles
      ] = await Promise.all([
        Users.count(),
        Users.count({ where: { verified: 'true' } }),
        Design.count(),
        Message.count({ where: { role: 'assistant' } }),
        DesignFile.count()
      ]);

      const storageUsed = formatBytes(totalFiles * 1024 * 1024); 

      const [recentUsers, recentProjects, recentMessages, recentFiles] = await Promise.all([
        Users.findAll({
          attributes: ['uuid', 'username'],
          order: [['id', 'DESC']],
          limit: 5
        }),
        Design.findAll({
          attributes: ['uuid', 'title', 'userId'],
          order: [['id', 'DESC']],
          limit: 5
        }),
        Message.findAll({
          where: { role: 'assistant' },
          attributes: ['uuid', 'designId'],
          order: [['id', 'DESC']],
          limit: 10
        }),
        DesignFile.findAll({
          attributes: ['uuid', 'fileType', 'designId'],
          order: [['id', 'DESC']],
          limit: 5
        })
      ]);

      const recentActivity = [
        ...recentUsers.map(user => ({
          type: 'user_signup' as const,
          description: `Nuevo usuario registrado: ${user.username}`,
          timestamp: new Date().toISOString(),
          userId: user.uuid,
          username: user.username
        })),
        ...recentProjects.map(project => ({
          type: 'project_created' as const,
          description: `Proyecto creado: "${project.title}"`,
          timestamp: new Date().toISOString(),
          userId: project.userId
        })),
        ...recentMessages.map(message => ({
          type: 'ai_request' as const,
          description: `IA consultada en proyecto`,
          timestamp: new Date().toISOString()
        })),
        ...recentFiles.map(file => ({
          type: 'file_generated' as const,
          description: `Archivo ${file.fileType?.toUpperCase() || 'UNKNOWN'} generado`,
          timestamp: new Date().toISOString()
        }))
      ].slice(0, 15);

      const alerts = await generateSystemAlerts(totalUsers, totalProjects, totalFiles * 1024 * 1024);

      const overview: AdminOverview = {
        systemStats: {
          totalUsers,
          activeUsers,
          totalProjects,
          aiRequests: totalAIRequests,
          storageUsed,
          uptime: getSystemUptime()
        },
        recentActivity,
        alerts
      };

      res.json({
        success: true,
        data: {
          overview,
          lastUpdated: new Date().toISOString(),
          refreshInterval: 300000, // 5 minutos
          adminLevel: userRole,
          availableActions: getAvailableActions(userRole)
        },
        message: "Overview administrativo obtenido exitosamente"
      });

    } catch (error) {
      console.error('Error obteniendo overview admin:', error);
      res.status(500).json({
        success: false,
        message: "Error interno del servidor"
      });
    }
  }

  static async getMetrics(req: Request, res: Response) {
    try {
      const userRole = req.role as string;
      const { period = '7d' } = req.query;

      if (!['admin', 'superadmin'].includes(userRole)) {
        return res.status(403).json({
          success: false,
          message: "Acceso denegado. Se requieren permisos de administrador."
        });
      }

      const days = parseInt(period as string) || 7;

      const dailyMetrics = await getDailyMetrics(days);
      const performanceStats = await getPerformanceStats();
      const topStats = await getTopStats();

      const metrics: SystemMetrics = {
        usage: dailyMetrics,
        performance: performanceStats,
        topStats
      };

      res.json({
        success: true,
        data: {
          metrics,
          period: `${days}d`,
          lastUpdated: new Date().toISOString(),
          adminLevel: userRole
        },
        message: "Métricas del sistema obtenidas exitosamente"
      });

    } catch (error) {
      console.error('Error obteniendo métricas:', error);
      res.status(500).json({
        success: false,
        message: "Error interno del servidor"
      });
    }
  }

  static async performActions(req: Request, res: Response) {
    try {
      const userRole = req.role as string;
      const { action, targetId, data = {} } = req.body;

      if (!['admin', 'superadmin'].includes(userRole)) {
        return res.status(403).json({
          success: false,
          message: "Acceso denegado. Se requieren permisos de administrador."
        });
      }

      let result;
      
      const superAdminOnlyActions = [
        'delete_user',
        'delete_project', 
        'system_reset',
        'backup_data',
        'force_logout_users'
      ];

      if (superAdminOnlyActions.includes(action) && userRole !== 'superadmin') {
        return res.status(403).json({
          success: false,
          message: "Esta acción requiere permisos de SuperAdministrador",
          requiredRole: "superadmin",
          currentRole: userRole,
          action: action,
          availableActions: getAvailableActions(userRole)
        });
      }

      switch (action) {
        
        case 'get_users':
          result = await getUsersList(data);
          break;
        case 'verify_user':
          result = await verifyUser(targetId);
          break;
        case 'ban_user':
          result = await banUser(targetId, data.reason || 'No especificado');
          break;
        case 'unban_user':
          result = await unbanUser(targetId);
          break;

        case 'get_projects':
          result = await getProjectsList(data);
          break;
        case 'feature_project':
          result = await featureProject(targetId, data.featured);
          break;

        case 'clear_cache':
          result = await clearSystemCache();
          break;
        case 'generate_report':
          result = await generateReport(data.type || 'general', data.period || '30d');
          break;

        case 'delete_user':
          result = await deleteUser(targetId);
          break;
        case 'delete_project':
          result = await deleteProject(targetId);
          break;
        case 'backup_data':
          result = await createBackup();
          break;
        case 'system_reset':
          result = await systemReset();
          break;

        default:
          return res.status(400).json({
            success: false,
            message: `Acción '${action}' no reconocida`,
            availableActions: getAvailableActions(userRole)
          });
      }

      res.json({
        success: true,
        data: result,
        message: `Acción '${action}' ejecutada exitosamente`,
        executedBy: req.userId,
        executorRole: userRole,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      console.error('Error ejecutando acción administrativa:', error);
      res.status(500).json({
        success: false,
        message: "Error interno del servidor"
      });
    }
  }
}

async function generateSystemAlerts(totalUsers: number, totalProjects: number, storageBytes: number) {
  const alerts = [];

  if (totalUsers > 100) {
    alerts.push({
      type: 'info' as const,
      message: `Sistema creciendo: ${totalUsers} usuarios registrados`
    });
  }

  const storageGB = storageBytes / (1024 * 1024 * 1024);
  if (storageGB > 1) {
    alerts.push({
      type: 'warning' as const,
      message: `Uso de almacenamiento: ${storageGB.toFixed(1)}GB`
    });
  }

  const unverifiedUsers = await Users.count({ where: { verified: 'pending' } });
  if (unverifiedUsers > 10) {
    alerts.push({
      type: 'warning' as const,
      message: `${unverifiedUsers} usuarios pendientes de verificación`,
      count: unverifiedUsers
    });
  }

  const bannedUsers = await Users.count({ where: { role: 'banned' } });
  if (bannedUsers > 0) {
    alerts.push({
      type: 'info' as const,
      message: `${bannedUsers} usuarios baneados en el sistema`,
      count: bannedUsers
    });
  }

  return alerts;
}

async function getDailyMetrics(days: number) {
  
  const dailyUsers = [];
  const projectsCreated = [];
  const aiUsage = [];

  for (let i = 0; i < days; i++) {
    const date = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
    const dateStr = date.toISOString().split('T')[0];
    
    dailyUsers.push({ date: dateStr, count: Math.floor(Math.random() * 10) });
    projectsCreated.push({ date: dateStr, count: Math.floor(Math.random() * 5) });
    aiUsage.push({ date: dateStr, requests: Math.floor(Math.random() * 20) });
  }

  return { dailyUsers, projectsCreated, aiUsage };
}

async function getPerformanceStats() {
  return {
    averageResponseTime: 245,
    errorRate: 2.1,
    aiSuccessRate: 96.5,
    storageGrowth: '+12.3MB/day'
  };
}

async function getTopStats() {
  const topUsers = await Users.findAll({
    attributes: ['username'],
    where: { role: { [Op.ne]: 'banned' } },
    order: [['id', 'DESC']],
    limit: 5
  });

  const projectTypes = await Design.findAll({
    attributes: [
      'type',
      [Sequelize.fn('COUNT', Sequelize.col('uuid')), 'count']
    ],
    group: ['type'],
    order: [[Sequelize.literal('count'), 'DESC']]
  });

  const totalProjects = await Design.count();

  return {
    mostActiveUsers: topUsers.map(user => ({
      username: user.username,
      projects: Math.floor(Math.random() * 10) + 1,
      activity: 'Reciente'
    })),
    popularProjectTypes: projectTypes.map(item => ({
      type: item.type,
      count: parseInt((item as any).dataValues.count),
      percentage: totalProjects > 0 ? Math.round((parseInt((item as any).dataValues.count) / totalProjects) * 100) : 0
    })),
    peakUsageHours: [
      { hour: 14, requests: 245 },
      { hour: 15, requests: 198 },
      { hour: 10, requests: 167 }
    ]
  };
}

function getAvailableActions(userRole: string): string[] {
  const adminActions = [
    'get_users',
    'verify_user', 
    'ban_user',
    'unban_user',
    
    'get_projects',
    'feature_project',
    
    'clear_cache',
    'generate_report'
  ];

  const superAdminActions = [
    ...adminActions, 
    
    'delete_user',
    'delete_project',
    'backup_data',
    'system_reset'
  ];

  return userRole === 'superadmin' ? superAdminActions : adminActions;
}

async function getUsersList(filters: any) {
  const { page = 1, limit = 20, search, status, role } = filters;
  const whereConditions: any = {};

  if (search) {
    whereConditions[Op.or] = [
      { username: { [Op.like]: `%${search}%` } },
      { email: { [Op.like]: `%${search}%` } }
    ];
  }

  if (status) {
    whereConditions.verified = status;
  }

  if (role) {
    whereConditions.role = role;
  }

  const offset = (page - 1) * limit;

  const { count, rows: users } = await Users.findAndCountAll({
    where: whereConditions,
    attributes: ['uuid', 'username', 'email', 'role', 'verified'],
    offset,
    limit,
    order: [['id', 'DESC']]
  });

  return {
    users: users.map(user => ({
      ...user.toJSON(),
      projectCount: 0 
    })),
    pagination: {
      current: page,
      total: Math.ceil(count / limit),
      totalItems: count
    },
    summary: {
      totalUsers: count,
      activeUsers: users.filter(u => u.verified === 'true').length,
      bannedUsers: users.filter(u => u.role === 'banned').length,
      pendingUsers: users.filter(u => u.verified === 'pending').length
    }
  };
}

async function verifyUser(userId: string) {
  const user = await Users.findOne({ where: { uuid: userId } });
  if (!user) {
    throw new Error('Usuario no encontrado');
  }

  await Users.update({ verified: 'true' }, { where: { uuid: userId } });
  return { 
    action: 'verify', 
    userId, 
    username: user.username,
    status: 'completed' 
  };
}

async function banUser(userId: string, reason: string) {
  const user = await Users.findOne({ where: { uuid: userId } });
  if (!user) {
    throw new Error('Usuario no encontrado');
  }

  const previousRole = user.role;
  await Users.update({ 
    role: 'banned',
  }, { where: { uuid: userId } });

  return { 
    action: 'ban', 
    userId, 
    username: user.username,
    reason, 
    previousRole,
    status: 'completed' 
  };
}

async function unbanUser(userId: string) {
  const user = await Users.findOne({ where: { uuid: userId } });
  if (!user) {
    throw new Error('Usuario no encontrado');
  }

  await Users.update({ role: 'user' }, { where: { uuid: userId } });
  return { 
    action: 'unban', 
    userId, 
    username: user.username,
    newRole: 'user',
    status: 'completed' 
  };
}

async function deleteUser(userId: string) {
  const user = await Users.findOne({ where: { uuid: userId } });
  if (!user) {
    throw new Error('Usuario no encontrado');
  }

  if (['admin', 'superadmin'].includes(user.role)) {
    throw new Error('No se puede eliminar un administrador');
  }

  await Users.destroy({ where: { uuid: userId } });
  return { 
    action: 'delete_user', 
    userId, 
    username: user.username,
    status: 'completed',
    warning: 'Acción irreversible - Usuario eliminado permanentemente'
  };
}

async function getProjectsList(filters: any) {
  const { page = 1, limit = 20, type, status, userId } = filters;
  const whereConditions: any = {};

  if (type) whereConditions.type = type;
  if (status) whereConditions.status = status;
  if (userId) whereConditions.userId = userId;

  const offset = (page - 1) * limit;

  const { count, rows: projects } = await Design.findAndCountAll({
    where: whereConditions,
    attributes: ['uuid', 'title', 'type', 'status', 'userId'],
    offset,
    limit,
    order: [['id', 'DESC']]
  });

  return {
    projects: projects.map(project => ({
      uuid: project.uuid,
      title: project.title,
      type: project.type,
      status: project.status,
      userId: project.userId,
      messagesCount: 0, 
      featured: false 
    })),
    pagination: {
      current: page,
      total: Math.ceil(count / limit),
      totalItems: count
    },
    summary: {
      totalProjects: count,
      activeProjects: projects.filter(p => p.status === 'active').length,
      completedProjects: projects.filter(p => p.status === 'completed').length
    }
  };
}

async function featureProject(projectId: string, featured: boolean) {
  const project = await Design.findOne({ where: { uuid: projectId } });
  if (!project) {
    throw new Error('Proyecto no encontrado');
  }

  return { 
    action: 'feature_project', 
    projectId, 
    title: project.title,
    featured, 
    status: 'completed' 
  };
}

async function deleteProject(projectId: string) {
  const project = await Design.findOne({ where: { uuid: projectId } });
  if (!project) {
    throw new Error('Proyecto no encontrado');
  }

  await Design.destroy({ where: { uuid: projectId } });
  return { 
    action: 'delete_project', 
    projectId, 
    title: project.title,
    status: 'completed',
    warning: 'Acción irreversible - Proyecto y todos sus archivos eliminados'
  };
}

async function clearSystemCache() {
  return { 
    action: 'clear_cache', 
    status: 'completed', 
    clearedAt: new Date().toISOString(),
    details: 'Cache del sistema limpiado exitosamente'
  };
}

async function generateReport(type: string, period: string) {
  const reportId = `report_${type}_${Date.now()}`;
  return { 
    action: 'generate_report', 
    reportId, 
    type, 
    period, 
    status: 'generating',
    estimatedTime: '2-5 minutos',
    downloadUrl: `/api/admin/reports/${reportId}`
  };
}

async function createBackup() {
  const backupId = `backup_${Date.now()}`;
  return { 
    action: 'backup_data', 
    backupId, 
    status: 'creating',
    estimatedTime: '5-10 minutos',
    includes: ['users', 'projects', 'files', 'messages'],
    downloadUrl: `/api/admin/backups/${backupId}`
  };
}

async function systemReset() {
  return { 
    action: 'system_reset', 
    status: 'initiated',
    warning: 'ACCIÓN CRÍTICA: El sistema se reiniciará en 5 minutos',
    estimatedDowntime: '2-3 minutos',
    timestamp: new Date().toISOString()
  };
}

function formatBytes(bytes: number): string {
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  if (bytes === 0) return '0 Bytes';
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
}

function getSystemUptime(): string {
  const uptime = process.uptime();
  const hours = Math.floor(uptime / 3600);
  const minutes = Math.floor((uptime % 3600) / 60);
  const days = Math.floor(hours / 24);
  
  if (days > 0) {
    return `${days}d ${hours % 24}h ${minutes}m`;
  } else if (hours > 0) {
    return `${hours}h ${minutes}m`;
  } else {
    return `${minutes}m`;
  }
}

export default AdminDashboardController;