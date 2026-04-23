import React, { useState, useEffect } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import axios from 'axios'
import Swal from 'sweetalert2'
import withReactContent from 'sweetalert2-react-content'
import { 
  Lock,
  Eye,
  EyeOff,
  KeyRound,
  CheckCircle,
  Loader2,
  ArrowLeft,
  Shield,
  AlertCircle
} from 'lucide-react'
import './ResetPasswordForm.css'

const MySwal = withReactContent(Swal)

interface ResetPasswordResponse {
  success: boolean;
  message: string;
  action: string;
  redirectUrl?: string; 
}

const ResetPasswordForm = () => {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showNewPassword, setShowNewPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [localError, setLocalError] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [isSuccess, setIsSuccess] = useState(false)
  
  const token = searchParams.get('token')

  useEffect(() => {
    if (!token) {
      navigate('/reset-password-error?type=invalid&message=' + encodeURIComponent('Token no válido'))
    }
  }, [token, navigate])

  const showSuccessAlert = () => {
    MySwal.fire({
      title: '¡Contraseña actualizada!',
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
                <span style="font-size: 1.2rem;">🔐</span>
                <span>Tu contraseña ha sido actualizada exitosamente</span>
              </p>
              <p style="margin: 0.8rem 0; display: flex; align-items: center; justify-content: center; gap: 0.5rem;">
                <span style="font-size: 1.2rem;">🚀</span>
                <span>Ya puedes iniciar sesión con tu nueva contraseña</span>
              </p>
              <p style="margin: 0.8rem 0; display: flex; align-items: center; justify-content: center; gap: 0.5rem;">
                <span style="font-size: 1.2rem;">🔄</span>
                <span>Redirigiendo al login en <span id="countdown" style="font-weight: bold; color: #a855f7;">10</span> segundos...</span>
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
        popup: 'reset-success-popup',
        title: 'reset-success-title-custom',
        confirmButton: 'reset-success-confirm-btn',
        cancelButton: 'reset-success-cancel-btn'
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
                message: 'Contraseña actualizada exitosamente. ¡Inicia sesión!'
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
            message: 'Contraseña actualizada exitosamente. ¡Inicia sesión!'
          }
        });
      }
    });
  };

  const showErrorAlert = (title: string, text: string, redirectTo?: string) => {
    MySwal.fire({
      icon: 'error',
      title,
      html: `
        <div style="text-align: center; color: #374151; line-height: 1.6;">
          <p style="margin-bottom: 1.5rem; font-size: 1rem;">${text}</p>
          ${redirectTo ? `
            <div style="margin-top: 1.5rem;">
              <p style="color: #6b7280; font-size: 0.9rem; margin-bottom: 1rem;">
                Serás redirigido automáticamente en 3 segundos
              </p>
            </div>
          ` : ''}
        </div>
      `,
      confirmButtonText: 'Entendido',
      confirmButtonColor: '#a855f7',
      background: '#fff',
      width: '600px',
      customClass: {
        popup: 'reset-error-popup',
        title: 'reset-error-title-custom',
        confirmButton: 'reset-error-confirm-btn'
      },
      timer: redirectTo ? 3000 : undefined,
      timerProgressBar: redirectTo ? true : false,
      didClose: () => {
        if (redirectTo) {
          navigate(redirectTo);
        }
      }
    }).then((result) => {
      if (redirectTo && result.isConfirmed) {
        navigate(redirectTo);
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

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!newPassword || !confirmPassword) {
      setLocalError('Todos los campos son obligatorios')
      return
    }

    if (newPassword !== confirmPassword) {
      setLocalError('Las contraseñas no coinciden')
      return
    }

    if (newPassword.length < 3 || newPassword.length > 16) {
      setLocalError('La contraseña debe tener entre 3 y 16 caracteres')
      return
    }
    
    setLocalError('')
    setIsLoading(true)
    setIsSuccess(false)
    
    try {
      const response = await axios.post<ResetPasswordResponse>('http://localhost:8081/reset-password', {
        token,
        newPassword,
        confirmPassword
      })
      
      setIsLoading(false)
      setIsSuccess(true)
      
      showSuccessAlert()
      
    } catch (error: any) {
      setIsLoading(false)
      console.log('Error en reset password:', error.response);
      
      const errorData = error.response?.data;
      
      if (error.response?.status === 400) {
        if (errorData?.action === 'request_new') {
          showErrorAlert(
            'Enlace expirado',
            'El enlace de recuperación ha expirado. Solicita uno nuevo.',
            '/forgot-password'
          );
        } else if (errorData?.action === 'go_login') {
          showErrorAlert(
            'Enlace inválido',
            'El enlace es inválido o el usuario no fue encontrado.',
            '/'
          );
        } else {
          showErrorToast('Error de validación', errorData?.message || 'Datos incorrectos');
        }
      } else {
        showErrorToast('Error del servidor', 'Intenta nuevamente en unos momentos');
      }
      setIsSuccess(false)
    }
  }

  const toggleNewPasswordVisibility = () => {
    setShowNewPassword(!showNewPassword)
    
    if (!showNewPassword) {
      MySwal.fire({
        toast: true,
        position: 'bottom-end',
        icon: 'info',
        title: 'Contraseña visible',
        showConfirmButton: false,
        timer: 1500,
        timerProgressBar: false,
        background: '#f8f9fa',
        color: '#667eea'
      });
    }
  }

  const toggleConfirmPasswordVisibility = () => {
    setShowConfirmPassword(!showConfirmPassword)
    
    if (!showConfirmPassword) {
      MySwal.fire({
        toast: true,
        position: 'bottom-end',
        icon: 'info',
        title: 'Contraseña visible',
        showConfirmButton: false,
        timer: 1500,
        timerProgressBar: false,
        background: '#f8f9fa',
        color: '#667eea'
      });
    }
  }

  if (!token) {
    return null 
  }

  return (
    <div className="reset-password-bg">
      <div className="reset-password-container">
        <div className="reset-password-content">
          <div className="reset-brand-section">
            <h1 className="reset-brand-title">AI Design</h1>
            <p className="reset-brand-subtitle">Restablecimiento de contraseña</p>
          </div>

          <div className="reset-form-section">
            <div className="reset-icon-section">
              <div className="reset-icon">
                <KeyRound size={48} />
              </div>
            </div>

            <div className="reset-form-title">
              <h2>Nueva contraseña</h2>
              <p className="reset-subtitle">
                Ingresa tu nueva contraseña. Asegúrate de que sea segura y fácil de recordar.
              </p>
            </div>

            <form className="reset-form" onSubmit={handleResetPassword}>
              <div className="reset-input-group">
                <label htmlFor="newPassword" className="reset-label">Nueva contraseña</label>
                <div className="reset-input-wrapper">
                  <Lock className="reset-input-icon" size={18} />
                  <input
                    type={showNewPassword ? "text" : "password"}
                    id="newPassword"
                    name="newPassword"
                    className="reset-input"
                    value={newPassword}
                    onChange={e => {
                      setNewPassword(e.target.value)
                      setLocalError('')
                    }}
                    placeholder="Ingresa tu nueva contraseña"
                    required
                    minLength={3}
                    maxLength={16}
                    autoComplete="new-password"
                    autoFocus
                    disabled={isLoading || isSuccess}
                  />
                  <button
                    type="button"
                    className="reset-toggle-password"
                    onClick={toggleNewPasswordVisibility}
                    disabled={isLoading || isSuccess}
                  >
                    {showNewPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              <div className="reset-input-group">
                <label htmlFor="confirmPassword" className="reset-label">Confirmar contraseña</label>
                <div className="reset-input-wrapper">
                  <Lock className="reset-input-icon" size={18} />
                  <input
                    type={showConfirmPassword ? "text" : "password"}
                    id="confirmPassword"
                    name="confirmPassword"
                    className="reset-input"
                    value={confirmPassword}
                    onChange={e => {
                      setConfirmPassword(e.target.value)
                      setLocalError('')
                    }}
                    placeholder="Confirma tu nueva contraseña"
                    required
                    minLength={3}
                    maxLength={16}
                    autoComplete="new-password"
                    disabled={isLoading || isSuccess}
                  />
                  <button
                    type="button"
                    className="reset-toggle-password"
                    onClick={toggleConfirmPasswordVisibility}
                    disabled={isLoading || isSuccess}
                  >
                    {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              {localError && <div className="reset-error-message">{localError}</div>}

              <button 
                type="submit" 
                className="reset-button" 
                disabled={isLoading || isSuccess}
              >
                {isLoading ? (
                  <span className="reset-button-content">
                    <Loader2 className="reset-spinner" size={20} />
                    Actualizando...
                  </span>
                ) : isSuccess ? (
                  <span className="reset-button-content">
                    <CheckCircle size={20} />
                    Contraseña Actualizada
                  </span>
                ) : (
                  <span className="reset-button-content">
                    <KeyRound size={20} />
                    Restablecer contraseña
                  </span>
                )}
              </button>

              <div className="reset-actions">
                <button 
                  type="button"
                  onClick={() => navigate('/')}
                  className="reset-back-link"
                  disabled={isLoading}
                >
                  <ArrowLeft size={16} />
                  Volver al Login
                </button>
              </div>
            </form>

            <div className="reset-security-info">
              <div className="security-header">
                <div className="security-header-icon">
                  <Shield size={22} />
                </div>
                <span className="security-header-text">Consejos de seguridad</span>
              </div>
              <div className="security-tips">
                <div className="security-tip">
                  <div className="tip-icon">
                    <CheckCircle size={16} />
                  </div>
                  <div className="tip-content">
                    <span className="tip-title">Longitud adecuada</span>
                    <span className="tip-description">Entre 3 y 16 caracteres</span>
                  </div>
                </div>
                <div className="security-tip">
                  <div className="tip-icon">
                    <CheckCircle size={16} />
                  </div>
                  <div className="tip-content">
                    <span className="tip-title">Combina elementos</span>
                    <span className="tip-description">Letras y números</span>
                  </div>
                </div>
                <div className="security-tip">
                  <div className="tip-icon">
                    <CheckCircle size={16} />
                  </div>
                  <div className="tip-content">
                    <span className="tip-title">Evita datos personales</span>
                    <span className="tip-description">No uses información personal</span>
                  </div>
                </div>
                <div className="security-tip">
                  <div className="tip-icon">
                    <CheckCircle size={16} />
                  </div>
                  <div className="tip-content">
                    <span className="tip-title">Mantén privacidad</span>
                    <span className="tip-description">No compartas tu contraseña</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default ResetPasswordForm