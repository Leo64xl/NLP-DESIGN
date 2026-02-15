import React, { useState, useEffect, useRef } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { LoginUser, reset } from '../../../../../features/authSlice'
import { RootState, AppDispatch } from '../../../../../app/store'
import background from '../../../../../assets/background.png'
import house from '../../../../../assets/house.png'
import axios from 'axios'
import Swal from 'sweetalert2'
import withReactContent from 'sweetalert2-react-content'

import { 
  Mail, 
  Lock, 
  Eye, 
  EyeOff, 
  LogIn, 
  Loader2,
  User
} from 'lucide-react'

import './Login.css'

const MySwal = withReactContent(Swal)

const Login: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [localError, setLocalError] = useState(''); 
  const [isLocalLoading, setIsLocalLoading] = useState(false);

  const dispatch: AppDispatch = useDispatch();
  const navigate = useNavigate();
  const location = useLocation();
  const emailInputRef = useRef<HTMLInputElement>(null);
  const { user, isError, isSuccess, isLoading, message } = useSelector((state: RootState) => state.auth);

  const CONVERSATION_ROUTE = '/dashboard';

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

  useEffect(() => {
    const stateMessage = location.state?.message;
    const stateEmail = location.state?.email;
    
    if (stateMessage) {
      if (stateMessage.includes('verificado') || stateMessage.includes('exitoso')) {
        showSuccessToast('¡Éxito!', stateMessage);
      } else if (stateMessage.includes('redirigiendo') || stateMessage.includes('enviado')) {
        showInfoToast('Información', stateMessage);
      }
      
      window.history.replaceState({}, document.title);
    }
    
    if (stateEmail) {
      setEmail(stateEmail);
    }
  }, [location.state]);

  useEffect(() => {
    if (user || isSuccess) {
      showSuccessToast('¡Bienvenido a AI Design!', 'Acceso autorizado');
      setTimeout(() => {
        navigate(CONVERSATION_ROUTE);
      }, 1500);
    }
    dispatch(reset());
  }, [user, isSuccess, navigate, dispatch]);

  useEffect(() => {
    if (emailInputRef.current) {
      emailInputRef.current.focus();
    }
  }, []);

  const handleAuth = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    
    if (!email || !password) {
      setLocalError('Todos los campos son obligatorios');
      return;
    }
    
    setLocalError('');
    setIsLocalLoading(true);
    
    try {
      const response = await axios.post('http://localhost:5000/login', {
        email: email,
        password: password
      });
      
      dispatch(LoginUser({ email, password }));
      
    } catch (error: any) {
      setIsLocalLoading(false);
      
      if (error.response?.status === 403) {
        const { action, verified, email: userEmail, msg } = error.response.data;
        
        if (action === 'resend_verification' && verified === 'expired') {
          showInfoToast('Verificación expirada', 'Redirigiendo para generar nuevo enlace...');
          setTimeout(() => {
            navigate('/resend-verification', { 
              state: { 
                email: userEmail, 
                reason: 'expired_verification',
                source: 'login'
              }
            });
          }, 2000);
          return;
        }
        
        if (action === 'verify_email' && verified === 'pending') {
          showInfoToast('Email pendiente de verificación', 'Redirigiendo para verificar correo...');
          setTimeout(() => {
            navigate('/resend-verification', { 
              state: { 
                email: userEmail, 
                reason: 'pending_verification',
                source: 'login'
              }
            });
          }, 2000);
          return;
        }
        
        if (error.response.data.role === 'banned') {
          setLocalError('Tu cuenta ha sido baneada permanentemente.');
          return;
        }
        
        setLocalError(msg || 'Error de verificación');
        
      } else if (error.response?.status === 404) {
        setLocalError('Credenciales incorrectas');

      } else if (error.response?.status === 429) {
        showWarningAlert(
          'Demasiados intentos', 
          'Has excedido el límite de intentos de login. Por favor espera unos minutos antes de intentar nuevamente.'
        );
        
      } else if (error.response?.status === 400) {
        setLocalError('Todos los campos son obligatorios');
        
      } else {
        MySwal.fire({
          toast: true,
          position: 'top',
          icon: 'error',
          title: 'Error de conexión',
          text: 'Hubo un problema al conectar con el servidor',
          showConfirmButton: false,
          timer: 3500,
          timerProgressBar: true,
          background: '#f8f9fa',
          color: '#dc3545'
        });
      }
    }
  };

  const togglePasswordVisibility = () => {
    setShowPassword(!showPassword);
    
    if (!showPassword) {
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
  };

  const isFormLoading = isLoading || isLocalLoading;
  const displayError = localError || (isError ? message : '');

  return (
    <div className="login-bg" style={{ backgroundImage: `url(${background})` }}>
      <div className="login-container">
        <div className="login-left">
          <div className="login-brand-section">
            <h1 className="login-brand-title">AI Design</h1>
            <p className="login-brand-subtitle">Crea planos arquitectónicos con inteligencia artificial</p>
          </div>
          
          <form className="login-form" onSubmit={handleAuth}>
            <div className="login-form-title">
              <h2>Iniciar Sesión</h2>
            </div>

            <div className="login-input-group">
              <label htmlFor="email" className="login-label">Correo electrónico</label>
              <div className="login-input-wrapper">
                <User className="login-input-icon" size={18} />
                <input
                  ref={emailInputRef}
                  type="email"
                  id="email"
                  name="email"
                  className="login-input"           
                  value={email}
                  onChange={e => {
                    setEmail(e.target.value);
                    setLocalError(''); 
                  }}
                  placeholder='Tu correo electrónico'
                  autoComplete="email"
                  required              
                />
              </div>
            </div>
            
            <div className="login-input-group">
              <label htmlFor="password" className="login-label">Contraseña</label>
              <div className="login-input-wrapper">
                <Lock className="login-input-icon" size={18} />
                <input
                  type={showPassword ? "text" : "password"}
                  id="password"
                  name="password"
                  className="login-input"
                  value={password}
                  onChange={e => {
                    setPassword(e.target.value);
                    setLocalError(''); 
                  }}
                  placeholder='Tu contraseña'
                  autoComplete="current-password" 
                  required                                 
                />
                <button
                  type="button"
                  className="login-eye-button"
                  onClick={togglePasswordVisibility}
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            <div className="login-form-options">
              <Link to="/forgot-password" className="login-forgot-link">
                ¿Olvidaste tu contraseña?
              </Link>
            </div>
            
            {displayError && <div className="login-error-message">{displayError}</div>}
            
            <button type="submit" className="login-button" disabled={isFormLoading}>
              {isFormLoading ? (
                <span className="login-button-content">
                  <Loader2 className="login-spinner" size={20} />
                  Verificando...
                </span>
              ) : (
                <span className="login-button-content">
                  <LogIn size={20} />
                  Iniciar Sesión
                </span>
              )}
            </button>

            <div className="login-register-section">
              <p className="login-register-text">
                ¿Aún no tienes cuenta?{' '}
                <Link to="/register" className="login-register-link">
                  Crea una ahora
                </Link>
              </p>
            </div>
          </form>
        </div>

        <div className="login-right">
          <div className="login-house-container">
            <img src={house} alt="AI Design House" className="login-house-image" />
          </div>
        </div>
      </div>
    </div>
  )
}

export default Login