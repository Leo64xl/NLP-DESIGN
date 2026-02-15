import React, { useState } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import axios from 'axios'
import Swal from 'sweetalert2'
import withReactContent from 'sweetalert2-react-content'
import { 
  Mail,
  Send,
  Loader2,
  CheckCircle,
  ArrowLeft,
  UserPlus,
  RefreshCw
} from 'lucide-react'
import './ResendVerified.css'

const MySwal = withReactContent(Swal)

interface ResendSuccessResponse {
  msg: string;
  email?: string;
  action?: string;
}

interface ResendErrorResponse {
  msg: string;
  action?: string;
  verified?: boolean | string;
}

const ResendVerified = () => {
  const [email, setEmail] = useState('')
  const [localError, setLocalError] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [isSuccess, setIsSuccess] = useState(false)
  const [isAlreadyVerified, setIsAlreadyVerified] = useState(false)
  
  const navigate = useNavigate()
  const location = useLocation()

  const showSuccessAlert = (email: string) => {
    MySwal.fire({
      title: '¡Enlace enviado exitosamente!',
      html: `
        <div style="text-align: center; color: #374151; line-height: 1.6;">
          <div style="margin: 1.5rem 0;">
            <div style="display: inline-flex; align-items: center; justify-content: center; width: 80px; height: 80px; background: linear-gradient(135deg, #10b981 0%, #34d399 100%); border-radius: 50%; margin-bottom: 1rem; animation: successPulse 2s ease-in-out infinite;">
              <svg width="45" height="45" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="color: white;">
                <path d="M9 11l3 3l8-8"/>
                <path d="M21 12c0 4.97-4.03 9-9 9s-9-4.03-9-9s4.03-9 9-9c1.51 0 2.93 0.37 4.18 1.03"/>
              </svg>
            </div>
            <div style="font-size: 1.1rem; margin-bottom: 1.5rem;">
              <p style="margin: 0.8rem 0; display: flex; align-items: center; justify-content: center; gap: 0.5rem;">
                <span style="font-size: 1.2rem;">📧</span>
                <span>Revisa tu correo: <strong style="color: #a855f7;">${email}</strong></span>
              </p>
              <p style="margin: 0.8rem 0; display: flex; align-items: center; justify-content: center; gap: 0.5rem;">
                <span style="font-size: 1.2rem;">⏰</span>
                <span>El enlace es válido por <strong>10 minutos</strong></span>
              </p>
              <p style="margin: 0.8rem 0; display: flex; align-items: center; justify-content: center; gap: 0.5rem;">
                <span style="font-size: 1.2rem;">🔄</span>
                <span>Redirigiendo automáticamente en <span id="countdown" style="font-weight: bold; color: #a855f7;">10</span> segundos...</span>
              </p>
            </div>
          </div>
        </div>
      `,
      showCancelButton: true,
      confirmButtonText: 'Ir al Login ahora',
      cancelButtonText: 'Esperar redirección',
      confirmButtonColor: '#a855f7',
      cancelButtonColor: '#6b7280',
      background: '#fff',
      customClass: {
        popup: 'resend-success-popup',
        title: 'resend-success-title-custom',
        confirmButton: 'resend-success-confirm-btn',
        cancelButton: 'resend-success-cancel-btn'
      },
      didOpen: () => {
        const style = document.createElement('style');
        style.textContent = `
          @keyframes successPulse {
            0%, 100% { 
              transform: scale(1);
              box-shadow: 0 0 20px rgba(16, 185, 129, 0.3);
            }
            50% { 
              transform: scale(1.05);
              box-shadow: 0 0 30px rgba(16, 185, 129, 0.5);
            }
          }
        `;
        document.head.appendChild(style);
        
        let timeLeft = 10;
        const countdownElement = document.getElementById('countdown');
        
        const timer = setInterval(() => {
          timeLeft--;
          if (countdownElement) {
            countdownElement.textContent = timeLeft.toString();
          }
          
          if (timeLeft <= 0) {
            clearInterval(timer);
            MySwal.close();
            navigate('/', { state: { email: email } });
          }
        }, 1000);
        
        MySwal.getPopup()?.setAttribute('data-timer', timer.toString());
      },
      didClose: () => {
        const popup = MySwal.getPopup();
        const timerId = popup?.getAttribute('data-timer');
        if (timerId) {
          clearInterval(parseInt(timerId));
        }
      }
    }).then((result) => {
      if (result.isConfirmed) {
        navigate('/', { state: { email: email } });
      }
    });
  };

  const showWarningAlert = (title: string, text: string) => {
    MySwal.fire({
      icon: 'warning',
      title,
      text,
      confirmButtonText: 'Entendido',
      confirmButtonColor: '#667eea',
      background: '#fff',
      color: '#333'
    });
  };

  const showErrorToast = (title: string, text?: string) => {
    MySwal.fire({
      toast: true,
      position: 'top',
      icon: 'error',
      title,
      text,
      showConfirmButton: false,
      timer: 4000,
      timerProgressBar: true,
      background: '#f8f9fa',
      color: '#dc3545'
    });
  };

  const showInfoToast = (title: string, text?: string) => {
    MySwal.fire({
      toast: true,
      position: 'top-end',
      icon: 'info',
      title,
      text,
      showConfirmButton: false,
      timer: 4000,
      timerProgressBar: true,
      background: '#f8f9fa',
      color: '#667eea',
      didOpen: (toast) => {
        toast.addEventListener('mouseenter', Swal.stopTimer);
        toast.addEventListener('mouseleave', Swal.resumeTimer);
      }
    });
  };

  const showSuccessToast = (title: string, text?: string) => {
    MySwal.fire({
      toast: true,
      position: 'top',
      icon: 'success',
      title,
      text,
      showConfirmButton: false,
      timer: 3000,
      timerProgressBar: true,
      background: '#f8f9fa',
      color: '#28a745',
      didOpen: (toast) => {
        toast.addEventListener('mouseenter', Swal.stopTimer);
        toast.addEventListener('mouseleave', Swal.resumeTimer);
      }
    });
  };
  
  React.useEffect(() => {
    const emailFromState = location.state?.email
    const reason = location.state?.reason
    const source = location.state?.source

    if (emailFromState) {
      setEmail(emailFromState)
    }

    if (reason === 'expired_from_email' && source === 'error_page') {
      showInfoToast('Enlace expirado', 'Tu enlace de verificación ha expirado. Genera uno nuevo.')
    } else if (reason === 'expired_verification' && source === 'login') {
      showInfoToast('Verificación requerida', 'Tu enlace anterior expiró. Genera uno nuevo para poder iniciar sesión.')
    } else if (reason === 'pending_verification' && source === 'login') {
      showInfoToast('Verificación pendiente', 'Debes verificar tu correo antes de iniciar sesión.')
    }
  }, [location.state])

  const handleResendVerification = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!email) {
      setLocalError('Por favor, ingresa tu correo electrónico')
      return
    }
    
    setLocalError('')
    setIsLoading(true)
    setIsSuccess(false)
    setIsAlreadyVerified(false)
    
    try {
      const response = await axios.post<ResendSuccessResponse>('http://localhost:5000/resend-verification', {
        email: email.toLowerCase()
      })
      
      setIsLoading(false)
      setIsSuccess(true)
      
      showSuccessAlert(email)
      
    } catch (error: any) {
      setIsLoading(false)
      
      const errorResponse = error.response?.data as ResendErrorResponse
      
      if (error.response?.status === 400 && 
          (errorResponse?.action === 'login' || 
           errorResponse?.verified === true ||
           errorResponse?.msg?.includes('ya está verificada'))) {
        
        setLocalError('Tu cuenta ya está verificada')
        setIsAlreadyVerified(true)
        setIsSuccess(false)
        showSuccessToast('¡Cuenta verificada!', 'Puedes iniciar sesión normalmente')
        
      } else if (error.response?.status === 404 && 
                 errorResponse?.action === 'check_email_or_register') {
        
        setLocalError('No se encontró una cuenta con este correo')
        showErrorToast('Cuenta no encontrada', 'Verifica el email o regístrate')
        
      } else if (error.response?.status === 429) {
        
        showWarningAlert(
          'Demasiados intentos de reenvío', 
          'Has excedido el límite de intentos de reenvío. Por favor espera unos minutos antes de intentar nuevamente.'
        );
        
      } else if (error.response?.status === 400 && 
                 errorResponse?.action === 'contact_support') {
        
        setLocalError('Tu cuenta tiene un estado inválido. Contacta al soporte técnico')
        showErrorToast('Error de cuenta', 'Contacta al soporte técnico')
        
      } else if (error.response?.status === 500) {
        
        showErrorToast('Error del servidor', 'Intenta nuevamente en unos momentos')
        
      } else {
        
        setLocalError(errorResponse?.msg || 'Error al enviar verificación')
        showErrorToast('Error de envío', 'Intenta nuevamente')
      }
    }
  }

  const handleTryAnotherEmail = () => {
    setEmail('')
    setLocalError('')
    setIsAlreadyVerified(false)
    setIsSuccess(false)
  }

  const getSubtitle = () => {
    const reason = location.state?.reason
    const source = location.state?.source

    if (reason === 'expired_from_email' && source === 'error_page') {
      return 'Tu enlace del email expiró. Genera uno nuevo para verificar tu cuenta.'
    } else if (reason === 'expired_verification' && source === 'login') {
      return 'Tu enlace anterior expiró. Genera uno nuevo para poder iniciar sesión.'
    } else if (reason === 'pending_verification' && source === 'login') {
      return 'Verifica tu correo para completar el registro e iniciar sesión.'
    } else {
      return 'Ingresa tu email para generar un nuevo enlace de verificación.'
    }
  }

  return (
    <div className="resend-bg">
      <div className="resend-container">
        <div className="resend-content">
          <div className="resend-brand-section">
            <h1 className="resend-brand-title">AI Design</h1>
            <p className="resend-brand-subtitle">Verificación de cuenta</p>
          </div>

          <div className="resend-form-section">
            <div className="resend-icon-section">
              <div className="resend-icon">
                <Mail size={48} />
              </div>
            </div>

            <div className="resend-form-title">
              <h2>Reenviar Verificación</h2>
              <p className="resend-subtitle">{getSubtitle()}</p>
            </div>

            <form className="resend-form" onSubmit={handleResendVerification}>
              <div className="resend-input-group">
                <label htmlFor="email" className="resend-label">Correo electrónico</label>
                <div className="resend-input-wrapper">
                  <Mail className="resend-input-icon" size={18} />
                  <input
                    type="email"
                    id="email"
                    name="email"
                    className="resend-input"
                    value={email}
                    onChange={e => {
                      setEmail(e.target.value)
                      setLocalError('')
                    }}
                    placeholder="Tu correo electrónico"
                    required
                    autoComplete="email"
                    autoFocus
                    disabled={isLoading || isAlreadyVerified}
                  />
                </div>
              </div>

              {localError && <div className="resend-error-message">{localError}</div>}

              <button 
                type="submit" 
                className="resend-button" 
                disabled={isLoading || isAlreadyVerified}
              >
                {isLoading ? (
                  <span className="resend-button-content">
                    <Loader2 className="resend-spinner" size={20} />
                    Enviando...
                  </span>
                ) : isAlreadyVerified ? (
                  <span className="resend-button-content">
                    <CheckCircle size={20} />
                    Cuenta Verificada
                  </span>
                ) : (
                  <span className="resend-button-content">
                    <Send size={20} />
                    Generar Nuevo Enlace
                  </span>
                )}
              </button>

              <div className="resend-actions">
                <Link to="/" className="resend-back-link">
                  <ArrowLeft size={16} />
                  Volver al Login
                </Link>
                <Link to="/register" className="resend-register-link">
                  <UserPlus size={16} />
                  Crear cuenta nueva
                </Link>
              </div>
            </form>

            {isAlreadyVerified && (
              <div className="resend-verified-notice">
                <div className="resend-verified-icon">
                  <CheckCircle size={32} />
                </div>
                <h3 className="resend-verified-title">¡Tu cuenta ya está verificada!</h3>
                <p className="resend-verified-text">
                  No necesitas verificar nuevamente tu correo.
                </p>
                <div className="resend-verified-actions">
                  <Link to="/" className="resend-login-button">
                    Iniciar Sesión
                  </Link>
                  <button 
                    onClick={handleTryAnotherEmail}
                    className="resend-try-another-button"
                  >
                    <RefreshCw size={16} />
                    Probar otro correo
                  </button>
                </div>
              </div>
            )}

            <div className="resend-help-section">
              <p className="resend-help-text">
                ¿Necesitas ayuda? Contacta a{' '}
                <a 
                  href={`mailto:soporte-ai-design@gmail.com?subject=Problema%20con%20verificación%20de%20email`}
                  className="resend-help-link"
                >
                  soporte-ai-design@gmail.com
                </a>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default ResendVerified