import React from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { 
  Clock, 
  AlertTriangle, 
  XCircle, 
  HelpCircle, 
  Mail, 
  RefreshCw, 
  Home,
  Shield
} from 'lucide-react'
import './ResetPasswordError.css'

const ResetPasswordError = () => {
  const [searchParams] = useSearchParams()
  const errorType = searchParams.get('type') || 'invalid'
  const message = searchParams.get('message') || ''

  const getErrorContent = () => {
    switch(errorType) {
      case 'expired':
        return {
          icon: <Clock size={64} />,
          title: 'Enlace Expirado',
          message: 'Tu enlace de recuperación ha expirado. Los enlaces son válidos por 15 minutos por seguridad.',
          subtitle: 'No te preocupes, puedes solicitar uno nuevo fácilmente.',
          action: 'Solicitar Nuevo Enlace',
          link: '/forgot-password',
          iconColor: '#f59e0b',
          buttonColor: '#f59e0b'
        }
      case 'invalid':
        return {
          icon: <XCircle size={64} />,
          title: 'Enlace Inválido',
          message: 'El enlace de recuperación no es válido o ya fue utilizado anteriormente.',
          subtitle: 'Por tu seguridad, cada enlace solo puede usarse una vez.',
          action: 'Solicitar Nuevo Enlace',
          link: '/forgot-password',
          iconColor: '#ef4444',
          buttonColor: '#ef4444'
        }
      case 'error':
        return {
          icon: <AlertTriangle size={64} />,
          title: 'Error del Servidor',
          message: 'Ha ocurrido un error interno en nuestros servidores.',
          subtitle: 'Nuestro equipo técnico está trabajando para solucionarlo.',
          action: 'Reintentar',
          link: '/forgot-password',
          iconColor: '#6b7280',
          buttonColor: '#6b7280'
        }
      default:
        return {
          icon: <HelpCircle size={64} />,
          title: 'Error Desconocido',
          message: 'Ha ocurrido un error inesperado.',
          subtitle: 'Por favor, contacta a nuestro equipo de soporte.',
          action: 'Volver al Inicio',
          link: '/',
          iconColor: '#6b7280',
          buttonColor: '#6b7280'
        }
    }
  }

  const content = getErrorContent()

  return (
    <div className="reset-error-bg">
      <div className="reset-error-container">
        <div className="reset-error-content">
          {/* Brand Section */}
          <div className="error-brand-section">
            <h1 className="error-brand-title">AI Design</h1>
            <p className="error-brand-subtitle">Sistema de Recuperación</p>
          </div>

          {/* Error Icon */}
          <div className="error-icon-section">
            <div className="error-icon" style={{ color: content.iconColor }}>
              {content.icon}
            </div>
          </div>

          {/* Error Content */}
          <div className="error-content-section">
            <h2 className="error-title">{content.title}</h2>
            <p className="error-message">
              {message || content.message}
            </p>
            <p className="error-subtitle">
              {content.subtitle}
            </p>
          </div>

          {/* Actions */}
          <div className="error-actions">
            <Link 
              to={content.link} 
              className="error-btn primary"
              style={{ 
                background: `linear-gradient(135deg, ${content.buttonColor} 0%, ${content.buttonColor}dd 100%)`,
                boxShadow: `0 4px 15px ${content.buttonColor}40`
              }}
            >
              <RefreshCw size={18} />
              {content.action}
            </Link>
            <Link to="/" className="error-btn secondary">
              <Home size={18} />
              Ir al Login
            </Link>
          </div>

          {/* Security Info */}
          <div className="security-info">
            <div className="security-header">
              <Shield size={20} />
              <span>Información de Seguridad</span>
            </div>
            <div className="security-content">
              <div className="security-item">
                <Clock size={16} />
                <span>Los enlaces expiran en 15 minutos</span>
              </div>
              <div className="security-item">
                <Shield size={16} />
                <span>Cada enlace es de uso único</span>
              </div>
              <div className="security-item">
                <Mail size={16} />
                <span>Enviamos confirmación por email</span>
              </div>
            </div>
          </div>

          {/* Help Section */}
          <div className="help-section">
            <div className="help-header">
              <HelpCircle size={20} />
              <span>¿Necesitas ayuda?</span>
            </div>
            <p className="help-text">
              Si continúas teniendo problemas, nuestro equipo de soporte está aquí para ayudarte.
            </p>
            <a href="mailto:soporte-ai-design@gmail.com" className="contact-email">
              <Mail size={16} />
              soporte-ai-design@gmail.com
            </a>
          </div>
        </div>
      </div>
    </div>
  )
}

export default ResetPasswordError