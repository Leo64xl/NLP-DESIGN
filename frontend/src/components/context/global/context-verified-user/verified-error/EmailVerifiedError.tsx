import React from 'react'
import { Link, useSearchParams, useNavigate } from 'react-router-dom'
import { 
  Clock, 
  X, 
  CheckCircle, 
  AlertTriangle, 
  RefreshCw,
  LogIn,
  Mail
} from 'lucide-react'
import './EmailVerifiedError.css'

const EmailVerifiedError = () => {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()  
  const errorType = searchParams.get('type') || 'expired'
  const message = searchParams.get('message') || ''

  const getErrorContent = () => {
    switch(errorType) {
      case 'expired':
        return {
          icon: <Clock size={64} />,
          title: 'Enlace Expirado',
          message: 'Tu enlace de verificación ha expirado. No te preocupes, puedes generar uno nuevo.',
          action: 'Generar Nuevo Enlace',  
          actionIcon: <RefreshCw size={20} />,
          link: '/resend-verification',     
          showResendOption: true,
          colorTheme: 'warning'
        }
      case 'invalid':
        return {
          icon: <X size={64} />,
          title: 'Enlace Inválido',
          message: 'El enlace de verificación no es válido o ha sido modificado.',
          action: 'Iniciar Sesión',
          actionIcon: <LogIn size={20} />,
          link: '/',
          showResendOption: false,
          colorTheme: 'error'
        }
      case 'used':
        return {
          icon: <CheckCircle size={64} />,
          title: 'Ya Verificado',
          message: 'Este enlace ya fue utilizado anteriormente. Tu cuenta ya está verificada.',
          action: 'Iniciar Sesión',
          actionIcon: <LogIn size={20} />,
          link: '/',
          showResendOption: false,
          colorTheme: 'success'
        }
      default:
        return {
          icon: <AlertTriangle size={64} />,
          title: 'Error de Verificación',
          message: 'Ha ocurrido un error durante la verificación. Intenta nuevamente.',
          action: 'Reintentar',
          actionIcon: <RefreshCw size={20} />,
          link: '/register',
          showResendOption: false,
          colorTheme: 'neutral'
        }
    }
  }

  const content = getErrorContent()

  const handleResendClick = () => {
    if (content.showResendOption) {
      navigate('/resend-verification', {
        state: {
          reason: 'expired_from_email',
          source: 'error_page'
        }
      })
    }
  }

  return (
    <div className="email-error-bg">
      <div className="email-error-container">
        <div className="email-error-content">
          <div className="email-error-brand-section">
            <h1 className="email-error-brand-title">AI Design</h1>
            <p className="email-error-brand-subtitle">Plataforma de diseño con inteligencia artificial</p>
          </div>

          <div className={`email-error-status-section ${content.colorTheme}`}>
            <div className="email-error-icon">
              {content.icon}
            </div>
            
            <h2 className="email-error-title">{content.title}</h2>
            <p className="email-error-message">{content.message}</p>

            <div className="email-error-actions">
              {content.showResendOption ? (
                <button 
                  onClick={handleResendClick}
                  className="email-error-button primary"
                >
                  {content.actionIcon}
                  {content.action}
                </button>
              ) : (
                <Link to={content.link} className="email-error-button primary">
                  {content.actionIcon}
                  {content.action}
                </Link>
              )}
            </div>

            <div className="email-error-help">
              <div className="email-error-help-content">
                <h3 className="email-error-help-title">¿Necesitas ayuda?</h3>
                <p className="email-error-help-text">
                  Si continúas teniendo problemas, no dudes en contactar a nuestro equipo de soporte.
                </p>
                <a 
                  href={`mailto:soporte-ai-design@gmail.com?subject=Problema%20con%20verificación%20de%20email&body=Hola,%20tengo%20problemas%20con%20la%20verificación%20de%20mi%20cuenta.%20Tipo%20de%20error:%20${errorType}`}
                  className="email-error-contact"
                >
                  <Mail size={18} />
                  soporte-ai-design@gmail.com
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default EmailVerifiedError