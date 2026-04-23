import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { Bell, Check, Download, Palette, Info, X } from 'lucide-react';
import { useLanguage } from '../../../../../../contexts/LanguageContext';
import './NotificationCenter.css';

interface Notification {
  id: string;
  title: string;
  message: string;
  type: 'design_complete' | 'new_template' | 'conversion_complete' | 'system';
  isRead: boolean;
  createdAt: string;
  data?: any;
}

interface NotificationCenterProps {
  isOpen: boolean;
  onClose: () => void;
  onUnreadCountChange?: (count: number) => void;
}

interface ApiResponse<T = any> {
  success: boolean;
  message?: string;
  data?: T;
}

interface NotificationsResponse {
  notifications: Notification[];
  unreadCount: number;
}

const NotificationCenter: React.FC<NotificationCenterProps> = ({ isOpen, onClose, onUnreadCountChange }) => {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [dataLoaded, setDataLoaded] = useState(false);
  const { t } = useLanguage();

  console.log('🚀 NotificationCenter renderizado, isOpen:', isOpen, 'notificaciones:', notifications.length);

  // Función para limpiar notificaciones al cerrar el panel
  const handleClose = async () => {
    console.log('🔒 Cerrando panel y limpiando notificaciones');
    
    // Marcar todas como leídas si hay alguna sin leer
    const unreadIds = notifications
      .filter((n: Notification) => !n.isRead)
      .map((n: Notification) => n.id);
    
    if (unreadIds.length > 0) {
      try {
        await axios.patch('/api/notifications/read', { notificationIds: unreadIds });
        console.log('✅ Notificaciones marcadas como leídas en el servidor');
      } catch (error) {
        console.error('❌ Error al marcar notificaciones como leídas:', error);
      }
    }
    
    // Limpiar el estado local
    setNotifications([]);
    setUnreadCount(0);
    setDataLoaded(false);
    
    // Actualizar el contador en el navbar
    if (onUnreadCountChange) {
      onUnreadCountChange(0);
    }
    
    // Cerrar el panel
    onClose();
  };

  const loadNotifications = useCallback(async () => {
    if (dataLoaded) return; // Evitar cargar si ya tenemos datos
    
    setLoading(true);
    try {
      // 🎯 USAR LA API REAL AHORA
      const response = await axios.get<ApiResponse<NotificationsResponse>>(
        'http://localhost:8081/notifications',
        { withCredentials: true }
      );
      
      // � VALIDACIÓN TIPADA SEGURA
      if (response.data && typeof response.data === 'object' && 'success' in response.data) {
        const apiResponse = response.data as ApiResponse<NotificationsResponse>;
        if (apiResponse.success && apiResponse.data) {
          setNotifications(apiResponse.data.notifications || []);
          const currentUnreadCount = apiResponse.data.unreadCount || 0;
          setUnreadCount(currentUnreadCount);
          
          // Notificar al componente padre sobre el cambio en el contador
          if (onUnreadCountChange) {
            onUnreadCountChange(currentUnreadCount);
          }
        } else {
          console.warn('API response success=false:', apiResponse.message);
          setNotifications([]);
          setUnreadCount(0);
          if (onUnreadCountChange) {
            onUnreadCountChange(0);
          }
        }
      } else {
        console.warn('Invalid API response format');
        setNotifications([]);
        setUnreadCount(0);
        if (onUnreadCountChange) {
          onUnreadCountChange(0);
        }
      }
      
      setDataLoaded(true); // Marcar que los datos ya están cargados
      
    } catch (error) {
      console.error('Error cargando notificaciones:', error);
      
      // Si hay error de conexión, mostrar estado vacío
      setNotifications([]);
      setUnreadCount(0);
      if (onUnreadCountChange) {
        onUnreadCountChange(0);
      }
      setDataLoaded(true);
    } finally {
      setLoading(false);
    }
  }, [dataLoaded, onUnreadCountChange]);

  useEffect(() => {
    if (isOpen && !dataLoaded) {
      loadNotifications();
    }
  }, [isOpen, dataLoaded, loadNotifications]);

  const markAsRead = async (notificationIds: string[], skipStateUpdate = false) => {
    console.log('🔍 markAsRead llamado con IDs:', notificationIds);
    console.log('🔍 Notificaciones actuales:', notifications.map(n => ({ id: n.id, isRead: n.isRead })));
    
    // Solo actualizar si no se ha hecho ya
    const notificationsToUpdate = notifications.filter(n => 
      notificationIds.includes(n.id) && !n.isRead
    );
    
    console.log('🔍 Notificaciones a actualizar:', notificationsToUpdate.map(n => ({ id: n.id, title: n.title })));
    
    if (notificationsToUpdate.length === 0) {
      console.log('⚠️ No hay notificaciones para actualizar');
      return;
    }
    
    try {
      // Actualizar el estado local inmediatamente para mejor UX (solo si no se ha hecho ya)
      if (!skipStateUpdate) {
        console.log('🔄 Actualizando estado local...');
        setNotifications(prev => prev.map(notif => {
          const shouldUpdate = notificationIds.includes(notif.id);
          console.log(`📋 Notificación ${notif.id}: ${shouldUpdate ? 'MARCANDO COMO LEÍDA' : 'sin cambios'}`);
          return shouldUpdate ? { ...notif, isRead: true } : notif;
        }));
        
        const newUnreadCount = Math.max(0, unreadCount - notificationsToUpdate.length);
        console.log('📊 Nuevo contador:', newUnreadCount);
        setUnreadCount(newUnreadCount);
        
        // Notificar al componente padre sobre el cambio
        if (onUnreadCountChange) {
          onUnreadCountChange(newUnreadCount);
        }
      }
      
      // 🎯 LLAMAR A LA API REAL PARA MARCAR COMO LEÍDAS
      const response = await axios.patch<ApiResponse>(
        'http://localhost:8081/notifications/read',
        { notificationIds },
        { withCredentials: true }
      );
      
      // 🎯 VALIDACIÓN TIPADA SEGURA
      if (response.data && typeof response.data === 'object' && 'success' in response.data) {
        const apiResponse = response.data as ApiResponse;
        if (apiResponse.success) {
          console.log('✅ Notificaciones marcadas como leídas en el servidor');
        } else {
          console.warn('⚠️ Error del servidor al marcar como leídas:', apiResponse.message);
        }
      }
      
    } catch (error) {
      console.error('❌ Error marcando notificaciones:', error);
      
      // En caso de error de API, revertir cambios locales (solo si se hicieron)
      if (!skipStateUpdate) {
        console.log('🔄 Revirtiendo cambios debido a error...');
        setNotifications(prev => prev.map(notif => 
          notificationIds.includes(notif.id) 
            ? { ...notif, isRead: false }
            : notif
        ));
        
        // Restaurar contador anterior
        const originalUnreadCount = unreadCount + notificationsToUpdate.length;
        setUnreadCount(originalUnreadCount);
        
        if (onUnreadCountChange) {
          onUnreadCountChange(originalUnreadCount);
        }
        
        console.warn('🔄 Cambios revertidos debido a error de API');
      }
    }
  };

  const markAllAsRead = async () => {
    console.log('🔄 markAllAsRead iniciado');
    console.log('📋 Notificaciones actuales:', notifications);
    
    const unreadIds = notifications
      .filter((n: Notification) => !n.isRead)
      .map((n: Notification) => n.id);
    
    console.log('📝 IDs de notificaciones sin leer:', unreadIds);
    
    if (unreadIds.length > 0) {
      console.log('✅ Marcando todas como leídas...');
      
      // Actualizar estado inmediatamente
      setNotifications(prev => {
        const updated = prev.map(notif => ({ ...notif, isRead: true }));
        console.log('🔄 Notificaciones después de marcar todas:', updated);
        return updated;
      });
      setUnreadCount(0);
      
      // Notificar al navbar inmediatamente
      if (onUnreadCountChange) {
        onUnreadCountChange(0);
      }
      
      // Luego hacer la llamada a la API (saltando la actualización de estado)
      await markAsRead(unreadIds, true);
    } else {
      console.log('⚠️ No hay notificaciones sin leer para marcar');
    }
  };

  const refreshNotifications = async () => {
    setDataLoaded(false); // Permitir recarga
    await loadNotifications();
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'design_complete':
        return <Check size={20} />;
      case 'new_template':
        return <Palette size={20} />;
      case 'conversion_complete':
        return <Download size={20} />;
      case 'system':
        return <Info size={20} />;
      default:
        return <Bell size={20} />;
    }
  };

  const getNotificationIconClass = (type: string) => {
    switch (type) {
      case 'design_complete':
        return 'design-complete';
      case 'new_template':
        return 'new-template';
      case 'conversion_complete':
        return 'conversion-complete';
      case 'system':
        return 'system';
      default:
        return 'system';
    }
  };

  const formatTimeAgo = (timestamp: string) => {
    const now = new Date();
    const time = new Date(timestamp);
    const diffInSeconds = Math.floor((now.getTime() - time.getTime()) / 1000);
    
    if (diffInSeconds < 60) return t('notifications.time.fewSeconds');
    if (diffInSeconds < 3600) return t('notifications.time.minutes', { minutes: Math.floor(diffInSeconds / 60) });
    if (diffInSeconds < 86400) return t('notifications.time.hours', { hours: Math.floor(diffInSeconds / 3600) });
    return t('notifications.time.days', { days: Math.floor(diffInSeconds / 86400) });
  };

  if (!isOpen) return null;

  return (
    <div className="notification-center-overlay" onClick={handleClose}>
      <div className="notification-center" onClick={(e) => e.stopPropagation()}>
        <div className="notification-header">
          <h3>
            <Bell size={18} className="notification-header-icon" />
            {t('notifications.title')}
          </h3>
          <div className="notification-actions">
            <button 
              className="mark-all-read-btn"
              onClick={handleClose}
            >
              <X size={16} />
              {t('notifications.close')}
            </button>
          </div>
        </div>

        <div className="notification-content">
          {loading ? (
            <div className="notification-loading">
              <div className="loading-spinner"></div>
              <p>{t('notifications.loading')}</p>
            </div>
          ) : notifications.length === 0 ? (
            <div className="notification-empty">
              <Bell size={48} />
              <p>{t('notifications.noNotifications')}</p>
            </div>
          ) : (
            <div className="notification-list">
              {notifications.map(notification => (
                <div 
                  key={notification.id}
                  className={`notification-item ${!notification.isRead ? 'unread' : ''}`}
                >
                  <div className={`notification-icon ${getNotificationIconClass(notification.type)}`}>
                    {getNotificationIcon(notification.type)}
                  </div>
                  
                  <div className="notification-body">
                    <h4 className="notification-title">{notification.title}</h4>
                    <p className="notification-message">{notification.message}</p>
                    <span className="notification-time">
                      {formatTimeAgo(notification.createdAt)}
                    </span>
                  </div>
                  
                  {!notification.isRead && (
                    <div className="notification-unread-indicator"></div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default NotificationCenter;