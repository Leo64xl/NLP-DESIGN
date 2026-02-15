import React, { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useDispatch, useSelector } from 'react-redux'
import { LogOut, reset } from '../../../features/authSlice'
import { 
  Bell, 
  Grid, 
  Settings, 
  User, 
  LogOut as LogOutIcon,
  Palette,
  Home,
  ChevronDown,
  BadgeCheck
} from 'lucide-react'
import TemplateGallery from '../../context/global/context-chat/tools/template-gallery/TemplateGallery'
import NotificationCenter from '../../context/global/context-chat/tools/notification-center/NotificationCenter'
import UserProfile from '../../context/global/context-chat/tools/user-profile/UserProfile'
import NavbarSettings from './NavbarSettings'
import { useAppContext } from '../../../contexts/AppContext'
import { useLanguage } from '../../../contexts/LanguageContext'
import type { AppDispatch } from '../../../app/store'
import './Navbar.css'

interface Template {
  id: string;
  name: string;
  category: string;
  area: string;
  rooms: number;
  style: string;
  thumbnail: string;
  description: string;
  popularity: number;
  downloads: number;
  trending?: boolean;
}

const Navbar = () => {
  const dispatch = useDispatch<AppDispatch>()
  const navigate = useNavigate()
  const { id } = useParams()
  const { user } = useSelector((state: any) => state.auth)
  const { setSelectedTemplate, setNavbarMessage } = useAppContext()
  const { t } = useLanguage()
  
  // Estados para los modales/paneles
  const [showTemplates, setShowTemplates] = useState(false)
  const [showNotifications, setShowNotifications] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [showUserMenu, setShowUserMenu] = useState(false)
  const [unreadCount, setUnreadCount] = useState<number | null>(null) // null indica que no se ha inicializado aún
  const [isLoading, setIsLoading] = useState(false)
  
  // Inicializar el contador cuando el componente se monta
  useEffect(() => {
    // Simular el conteo inicial de notificaciones no leídas
    const initialUnreadCount = 3; // Este valor debería venir del backend
    setUnreadCount(initialUnreadCount);
  }, []);
  
  const logout = () => {
    dispatch(LogOut())
    dispatch(reset())
    navigate('/')
  }

  const handleTemplateSelect = (template: Template) => {
    setIsLoading(true)
    setShowTemplates(false)
    setSelectedTemplate(template)
    
    // Generar mensaje automático basado en el template
    const templateMessage = `Crear un diseño basado en el template "${template.name}" - ${template.description}. Estilo: ${template.style}, Área aproximada: ${template.area}, ${template.rooms} habitaciones.`;
    setNavbarMessage(templateMessage)
    
    console.log('Template seleccionado desde navbar:', template)
    
    // Simular carga
    setTimeout(() => setIsLoading(false), 1500)
  }

  // Cerrar modales al hacer click fuera
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Element
      if (!target.closest('.navbar-dropdown')) {
        setShowTemplates(false)
        setShowNotifications(false)
        setShowSettings(false)
        setShowUserMenu(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  return (
    <nav className={`navbar ${isLoading ? 'loading' : ''}`}>
      <div className="navbar-content">
        {/* Logo y título */}
        <div className="navbar-brand">
          <Home size={24} />
          <span className="navbar-title">{t('navbar.title')}</span>
        </div>

        {/* Navegación central */}
        <div className="navbar-nav">
          <button 
            className={`nav-item ${showTemplates ? 'active' : ''}`}
            onClick={() => {
              setShowTemplates(!showTemplates)
              setShowNotifications(false)
              setShowSettings(false)
              setShowUserMenu(false)
            }}
          >
            <Grid size={20} />
            <span>{t('navbar.templates')}</span>
          </button>
        </div>

        {/* Acciones del usuario */}
        <div className="navbar-actions">
          {/* Configuración */}
          <div className="navbar-dropdown">
            <button 
              className={`action-btn settings-btn ${showSettings ? 'active' : ''}`}
              onClick={() => {
                setShowSettings(!showSettings)
                setShowTemplates(false)
                setShowNotifications(false)
                setShowUserMenu(false)
              }}
            >
              <Settings size={20} />
            </button>
          </div>

          {/* Notificaciones */}
          <button 
            className={`action-btn notification-btn ${showNotifications ? 'active' : ''}`}
            onClick={() => {
              setShowNotifications(!showNotifications)
              setShowTemplates(false)
              setShowSettings(false)
              setShowUserMenu(false)
            }}
          >
            <Bell size={20} />
            {unreadCount !== null && unreadCount > 0 && !showNotifications && (
              <span className="notification-badge pulse">{unreadCount}</span>
            )}
          </button>

          {/* Menú de usuario */}
          <div className="navbar-dropdown">
            <button 
              className={`action-btn user-btn circular ${showUserMenu ? 'active' : ''}`}
              onClick={() => {
                setShowUserMenu(!showUserMenu)
                setShowTemplates(false)
                setShowNotifications(false)
                setShowSettings(false)
              }}
            >
              <User size={20} />
            </button>
          </div>
        </div>
      </div>

      {/* Paneles desplegables */}
      {showTemplates && (
        <div className="navbar-panel templates-panel">
          <TemplateGallery 
            onSelectTemplate={handleTemplateSelect}
            showPopularOnly={false}
          />
        </div>
      )}

      {showNotifications && (
        <NotificationCenter
          isOpen={true}
          onClose={() => setShowNotifications(false)}
          onUnreadCountChange={(count) => {
            setUnreadCount(count)
          }}
        />
      )}

      {showUserMenu && (
        <UserProfile
          isOpen={true}
          onClose={() => setShowUserMenu(false)}
        />
      )}

      {showSettings && (
        <NavbarSettings
          isOpen={true}
          onClose={() => setShowSettings(false)}
        />
      )}
    </nav>
  )
}

export default Navbar