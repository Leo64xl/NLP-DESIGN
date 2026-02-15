import React, { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import axios from 'axios'
import Swal from 'sweetalert2'
import withReactContent from 'sweetalert2-react-content'
import { 
  Mail,
  Send,
  Loader2,
  ArrowLeft,
  UserPlus,
  Lock,
  HelpCircle,
  CheckCircle,
  Clock,
  Shield,
  Phone
} from 'lucide-react'
import './ForgotPassword.css'

const MySwal = withReactContent(Swal)

interface ForgotPasswordResponse {
  success: boolean;
  message: string;
  action: string;
}

const ForgotPassword = () => {
  const [email, setEmail] = useState('')
  const [localError, setLocalError] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [isSuccess, setIsSuccess] = useState(false)
  
  const navigate = useNavigate()

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
                <span>El enlace es válido por <strong>15 minutos</strong></span>
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
      width: '600px',
      customClass: {
        popup: 'forgot-success-popup',
        title: 'forgot-success-title-custom',
        confirmButton: 'forgot-success-confirm-btn',
        cancelButton: 'forgot-success-cancel-btn'
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
            navigate('/', { 
              state: { 
                email: email,
                message: 'Enlace de recuperación enviado correctamente'
              }
            });
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
        navigate('/', { 
          state: { 
            email: email,
            message: 'Enlace de recuperación enviado correctamente'
          }
        });
      }
    });
  };

  const showHelpAlert = () => {
    MySwal.fire({
      title: '¿Necesitas ayuda?',
      html: `
        <div style="text-align: left; color: #374151; line-height: 1.6;">
          <div style="margin: 1.5rem 0;">
            <div style="display: flex; align-items: center; gap: 0.8rem; margin-bottom: 1rem; padding: 1rem; background: #f0f9ff; border-radius: 8px; border-left: 4px solid #3b82f6;">
              <span style="font-size: 1.2rem;">📧</span>
              <span>Revisa tu carpeta de spam o correo no deseado</span>
            </div>
            <div style="display: flex; align-items: center; gap: 0.8rem; margin-bottom: 1rem; padding: 1rem; background: #fef3c7; border-radius: 8px; border-left: 4px solid #f59e0b;">
              <span style="font-size: 1.2rem;">⏰</span>
              <span>El enlace de recuperación expira en <strong>15 minutos</strong></span>
            </div>
            <div style="display: flex; align-items: center; gap: 0.8rem; margin-bottom: 1rem; padding: 1rem; background: #f3f4f6; border-radius: 8px; border-left: 4px solid #6b7280;">
              <span style="font-size: 1.2rem;">🔐</span>
              <span>Solo puedes tener un enlace activo a la vez</span>
            </div>
            <div style="display: flex; align-items: center; gap: 0.8rem; padding: 1rem; background: #fef2f2; border-radius: 8px; border-left: 4px solid #ef4444;">
              <span style="font-size: 1.2rem;">📞</span>
              <div>
                <span>Si sigues teniendo problemas, contacta soporte:</span><br>
                <a href="mailto:soporte-ai-design@gmail.com" style="color: #a855f7; font-weight: 600; text-decoration: none;">
                  soporte-ai-design@gmail.com
                </a>
              </div>
            </div>
          </div>
        </div>
      `,
      confirmButtonText: 'Entendido',
      confirmButtonColor: '#a855f7',
      background: '#fff',
      width: '600px',
      customClass: {
        popup: 'forgot-help-popup',
        title: 'forgot-help-title-custom',
        confirmButton: 'forgot-help-confirm-btn'
      }
    });
  };

  const showWarningAlert = (title: string, text: string) => {
    MySwal.fire({
      icon: 'warning',
      title,
      text,
      confirmButtonText: 'Entendido',
      confirmButtonColor: '#a855f7',
      background: '#fff',
      color: '#333'
    });
  };

  const showErrorAlert = (title: string, text: string, showRegisterButton = false) => {
    MySwal.fire({
      icon: 'error',
      title,
      html: `
        <div style="text-align: center; color: #374151; line-height: 1.6;">
          <p style="margin-bottom: 1.5rem; font-size: 1rem;">${text}</p>
          ${showRegisterButton ? `
            <div style="margin-top: 1.5rem;">
              <p style="color: #6b7280; font-size: 0.9rem; margin-bottom: 1rem;">
                ¿No tienes cuenta? Puedes crear una nueva
              </p>
            </div>
          ` : ''}
        </div>
      `,
      showCancelButton: showRegisterButton,
      confirmButtonText: 'Entendido',
      cancelButtonText: showRegisterButton ? 'Crear cuenta' : undefined,
      confirmButtonColor: '#a855f7',
      cancelButtonColor: '#10b981',
      background: '#fff',
      width: '600px',
      customClass: {
        popup: 'forgot-error-popup',
        title: 'forgot-error-title-custom',
        confirmButton: 'forgot-error-confirm-btn',
        cancelButton: 'forgot-error-register-btn'
      }
    }).then((result) => {
      if (result.dismiss === Swal.DismissReason.cancel && showRegisterButton) {
        navigate('/register');
      }
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

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!email) {
      setLocalError('Por favor, ingresa tu correo electrónico')
      return
    }
    
    setLocalError('')
    setIsLoading(true)
    setIsSuccess(false)
    
    try {
      const response = await axios.post<ForgotPasswordResponse>('http://localhost:5000/forgot-password', {
        email: email.toLowerCase()
      })
      
      setIsLoading(false)
      setIsSuccess(true)
      
      showSuccessAlert(email)
      
    } catch (error: any) {
      setIsLoading(false)
      console.log('Error en forgot password:', error.response);
      
      const errorResponse = error.response?.data as ForgotPasswordResponse;
      
      if (error.response?.status === 429) {
        showWarningAlert(
          'Demasiados intentos de recuperación', 
          'Has excedido el límite de intentos. Por favor espera 15 minutos antes de intentar nuevamente.'
        );
      } else if (error.response?.status === 404 && 
                 errorResponse?.action === 'check_email_or_register') {
        showErrorAlert(
          'Correo no encontrado',
          'No se encontró una cuenta registrada con este correo electrónico.',
          true  
        );
      } else if (error.response?.status === 400 && 
                 errorResponse?.action === 'verify_account') {
        showErrorAlert(
          'Cuenta no verificada',
          'Tu cuenta no está verificada. Debes verificar tu correo antes de poder cambiar la contraseña.'
        );
      } else {
        showErrorToast('Error del servidor', 'Intenta nuevamente en unos momentos');
      }
      setIsSuccess(false)
    }
  }

  return (
    <div className="forgot-password-bg">
      <div className="forgot-password-container">
        <div className="forgot-password-content">
          <div className="forgot-brand-section">
            <h1 className="forgot-brand-title">AI Design</h1>
            <p className="forgot-brand-subtitle">Recuperación de contraseña</p>
          </div>

          <div className="forgot-form-section">
            <div className="forgot-icon-section">
              <div className="forgot-icon">
                <Lock size={48} />
              </div>
            </div>

            <div className="forgot-form-title">
              <h2>¿Olvidaste tu contraseña?</h2>
              <p className="forgot-subtitle">
                No te preocupes, te ayudaremos a recuperarla. Ingresa tu correo electrónico y te enviaremos un enlace para restablecerla.
              </p>
            </div>

            <form className="forgot-form" onSubmit={handleForgotPassword}>
              <div className="forgot-input-group">
                <label htmlFor="email" className="forgot-label">Correo electrónico</label>
                <div className="forgot-input-wrapper">
                  <Mail className="forgot-input-icon" size={18} />
                  <input
                    type="email"
                    id="email"
                    name="email"
                    className="forgot-input"
                    value={email}
                    onChange={e => {
                      setEmail(e.target.value)
                      setLocalError('')
                    }}
                    placeholder="Tu correo electrónico"
                    required
                    autoComplete="email"
                    autoFocus
                    disabled={isLoading || isSuccess}
                  />
                </div>
              </div>

              {localError && <div className="forgot-error-message">{localError}</div>}

              <button 
                type="submit" 
                className="forgot-button" 
                disabled={isLoading || isSuccess}
              >
                {isLoading ? (
                  <span className="forgot-button-content">
                    <Loader2 className="forgot-spinner" size={20} />
                    Enviando...
                  </span>
                ) : isSuccess ? (
                  <span className="forgot-button-content">
                    <CheckCircle size={20} />
                    Enlace Enviado
                  </span>
                ) : (
                  <span className="forgot-button-content">
                    <Send size={20} />
                    Enviar enlace de recuperación
                  </span>
                )}
              </button>

              <div className="forgot-actions">
                <Link to="/" className="forgot-back-link">
                  <ArrowLeft size={16} />
                  Volver al Login
                </Link>
                <Link to="/register" className="forgot-register-link">
                  <UserPlus size={16} />
                  Crear cuenta nueva
                </Link>
              </div>
            </form>

            <div className="forgot-help-section">
              <button 
                onClick={showHelpAlert}
                className="forgot-help-button"
              >
                <HelpCircle size={18} />
                ¿Necesitas ayuda?
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default ForgotPassword