import { Request, Response } from 'express';
import { Op } from 'sequelize';
import Design from '../../../database/models/Design.model';
import Message from '../../../database/models/Message.model';
import DesignFile from '../../../database/models/DesignFile.model';

interface UserProjectHistory {
  projects: Array<{
    uuid: string;
    title: string;
    description: string;
    type: string;
    status: string;
    createdAt: string;
    updatedAt: string;
    messagesCount: number;
    filesCount: number;
    lastActivity: string;
  }>;
  summary: {
    totalProjects: number;
    activeProjects: number;
    completedProjects: number;
    totalMessages: number;
    totalFiles: number;
  };
}

interface PersonalDashboard {
  recentActivity: {
    lastLogin: string;
    projectsThisWeek: number;
    messagesThisWeek: number;
    filesGeneratedThisWeek: number;
  };
  projectStats: {
    totalProjects: number;
    favoriteProjectType: string;
    averageMessagesPerProject: number;
    mostActiveProject: string;
  };
  usageStats: {
    aiInteractions: number;
    filesDownloaded: number;
    totalDesignTime: string;
    joinedDate: string;
  };
  quickActions: Array<{
    title: string;
    description: string;
    action: string;
    icon: string;
  }>;
}

export class UserDashboardController {

  static async getProjectHistory(req: Request, res: Response) {
    try {
      const userId = req.userId as string;
      const { page = 1, limit = 10, status, type, search } = req.query;

      const whereConditions: any = { userId };

      if (status && typeof status === 'string') {
        whereConditions.status = status;
      }

      if (type && typeof type === 'string') {
        whereConditions.type = type;
      }

      if (search && typeof search === 'string') {
        whereConditions[Op.or] = [
          { title: { [Op.like]: `%${search}%` } },
          { description: { [Op.like]: `%${search}%` } }
        ];
      }

      const offset = (parseInt(page as string) - 1) * parseInt(limit as string);

      const { count, rows: projects } = await Design.findAndCountAll({
        where: whereConditions,
        include: [
          {
            model: Message,
            as: 'messages',
            attributes: ['uuid', 'role', 'createdAt'],
            required: false 
          },
          {
            model: DesignFile,
            as: 'files',
            attributes: ['uuid', 'fileType', 'status', 'createdAt'],
            required: false 
          }
        ],
        offset,
        limit: parseInt(limit as string),
        order: [['updatedAt', 'DESC']]
      });

      const allProjects = await Design.findAll({
        where: { userId },
        include: [
          {
            model: Message,
            as: 'messages',
            attributes: ['uuid'],
            required: false 
          },
          {
            model: DesignFile,
            as: 'files',
            attributes: ['uuid'],
            required: false 
          }
        ]
      });

      const summary = {
        totalProjects: allProjects.length,
        activeProjects: allProjects.filter(p => p.status === 'active').length,
        completedProjects: allProjects.filter(p => p.status === 'completed').length,
        totalMessages: allProjects.reduce((sum, p) => sum + (p.messages?.length || 0), 0), 
        totalFiles: allProjects.reduce((sum, p) => sum + (p.files?.length || 0), 0) 
      };

      const formattedProjects = projects.map(project => {
        const messages = project.messages || [];
        const files = project.files || []; 
        
        const lastMessage = messages
          .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];

        return {
          uuid: project.uuid,
          title: project.title,
          description: project.description || '', 
          type: project.type,
          status: project.status,
          createdAt: project.createdAt.toISOString(),
          updatedAt: project.updatedAt.toISOString(),
          messagesCount: messages.length,
          filesCount: files.length,
          lastActivity: lastMessage ? lastMessage.createdAt.toISOString() : project.updatedAt.toISOString()
        };
      });

      const projectHistory: UserProjectHistory = {
        projects: formattedProjects,
        summary
      };

      res.json({
        success: true,
        data: {
          history: projectHistory,
          pagination: {
            current: parseInt(page as string),
            total: Math.ceil(count / parseInt(limit as string)),
            totalItems: count,
            itemsPerPage: parseInt(limit as string)
          },
          filters: {
            status,
            type,
            search,
            availableFilters: {
              statuses: ['active', 'completed', 'draft'],
              types: ['2d', '3d', 'both']
            }
          }
        },
        message: "Historial de proyectos obtenido exitosamente"
      });

    } catch (error) {
      console.error('Error obteniendo historial de proyectos:', error);
      res.status(500).json({
        success: false,
        message: "Error interno del servidor"
      });
    }
  }

  static async getPersonalDashboard(req: Request, res: Response) {
    try {
      const userId = req.userId as string;

      const now = new Date();
      const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

      const userProjects = await Design.findAll({
        where: { userId },
        include: [
          {
            model: Message,
            as: 'messages',
            attributes: ['uuid', 'role', 'createdAt'],
            required: false 
          },
          {
            model: DesignFile,
            as: 'files',
            attributes: ['uuid', 'fileType', 'status', 'downloadCount', 'createdAt'],
            required: false 
          }
        ],
        order: [['updatedAt', 'DESC']]
      });

      const userInfo = await Design.findOne({
        where: { userId },
        order: [['createdAt', 'ASC']]
      });

      const projectsThisWeek = userProjects.filter(p => 
        new Date(p.createdAt) >= weekAgo
      ).length;

      const messagesThisWeek = userProjects.reduce((sum, project) => {
        const messages = project.messages || []; 
        return sum + messages.filter(m => new Date(m.createdAt) >= weekAgo).length;
      }, 0);

      const filesThisWeek = userProjects.reduce((sum, project) => {
        const files = project.files || []; 
        return sum + files.filter(f => new Date(f.createdAt) >= weekAgo).length;
      }, 0);

      const totalMessages = userProjects.reduce((sum, p) => sum + (p.messages?.length || 0), 0);
      const totalFiles = userProjects.reduce((sum, p) => sum + (p.files?.length || 0), 0);
      const totalDownloads = userProjects.reduce((sum, project) => {
        const files = project.files || []; 
        return sum + files.reduce((fileSum, file) => fileSum + (file.downloadCount || 0), 0);
      }, 0);

      const projectTypes = userProjects.map(p => p.type);
      const favoriteType = getMostFrequent(projectTypes) || '2d';

      const mostActiveProject = userProjects.sort((a, b) => {
        const aMessages = a.messages?.length || 0; 
        const bMessages = b.messages?.length || 0; 
        return bMessages - aMessages;
      })[0];

      const averageMessages = userProjects.length > 0 ? 
        Math.round(totalMessages / userProjects.length) : 0;

      const aiInteractions = userProjects.reduce((sum, project) => {
        const messages = project.messages || []; 
        return sum + messages.filter(m => m.role === 'assistant').length;
      }, 0);

      const personalDashboard: PersonalDashboard = {
        recentActivity: {
          lastLogin: now.toISOString(),
          projectsThisWeek,
          messagesThisWeek,
          filesGeneratedThisWeek: filesThisWeek
        },
        projectStats: {
          totalProjects: userProjects.length,
          favoriteProjectType: favoriteType,
          averageMessagesPerProject: averageMessages,
          mostActiveProject: mostActiveProject?.title || 'Ninguno'
        },
        usageStats: {
          aiInteractions,
          filesDownloaded: totalDownloads,
          totalDesignTime: calculateDesignTime(userProjects),
          joinedDate: userInfo?.createdAt?.toISOString() || now.toISOString()
        },
        quickActions: [
          {
            title: "Nuevo Proyecto",
            description: "Crear un nuevo diseño arquitectónico",
            action: "create_project",
            icon: "🏗️"
          },
          {
            title: "Continuar Último",
            description: mostActiveProject ? `Continuar con "${mostActiveProject.title}"` : "No hay proyectos activos",
            action: "continue_last",
            icon: "▶️"
          },
          {
            title: "Explorar Plantillas",
            description: "Crear desde plantillas populares",
            action: "browse_templates",
            icon: "📋"
          },
          {
            title: "Mis Archivos",
            description: "Ver todos mis archivos generados",
            action: "view_files",
            icon: "📁"
          }
        ]
      };

      res.json({
        success: true,
        data: {
          dashboard: personalDashboard,
          highlights: {
            recentProjects: userProjects.slice(0, 3).map(p => ({
              uuid: p.uuid,
              title: p.title,
              type: p.type,
              updatedAt: p.updatedAt.toISOString()
            })),
            productivity: {
              thisWeek: {
                projects: projectsThisWeek,
                messages: messagesThisWeek,
                files: filesThisWeek
              },
              thisMonth: {
                projects: userProjects.filter(p => new Date(p.createdAt) >= monthAgo).length,
                messages: userProjects.reduce((sum, project) => {
                  const messages = project.messages || []; 
                  return sum + messages.filter(m => new Date(m.createdAt) >= monthAgo).length;
                }, 0)
              }
            }
          },
          lastUpdated: now.toISOString()
        },
        message: "Dashboard personal obtenido exitosamente"
      });

    } catch (error) {
      console.error('Error obteniendo dashboard personal:', error);
      res.status(500).json({
        success: false,
        message: "Error interno del servidor"
      });
    }
  }
}

function getMostFrequent(array: string[]): string | null {
  if (array.length === 0) return null;
  
  const frequency: Record<string, number> = {};
  array.forEach(item => {
    frequency[item] = (frequency[item] || 0) + 1;
  });
  
  return Object.keys(frequency).reduce((a, b) => 
    frequency[a] > frequency[b] ? a : b
  );
}

function calculateDesignTime(projects: any[]): string {
  
  const totalInteractions = projects.reduce((sum, p) => sum + (p.messages?.length || 0), 0);
  const estimatedMinutes = totalInteractions * 3; 
  
  const hours = Math.floor(estimatedMinutes / 60);
  const minutes = estimatedMinutes % 60;
  
  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  } else {
    return `${minutes}m`;
  }
}

export default UserDashboardController;