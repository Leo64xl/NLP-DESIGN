import React, { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import axios from 'axios'
import Swal from 'sweetalert2'
import withReactContent from 'sweetalert2-react-content'

import { 
  User, 
  Mail, 
  Lock, 
  Eye, 
  EyeOff, 
  UserPlus, 
  Loader2,
} from 'lucide-react'

import './Register.css'

const MySwal = withReactContent(Swal)

const Register = () => {
  const [username, setUsername] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [acceptTerms, setAcceptTerms] = useState(false)
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  
  const navigate = useNavigate()

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

  const togglePasswordVisibility = () => {
    setShowPassword(!showPassword)
    
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
  }

  const toggleConfirmPasswordVisibility = () => {
    setShowConfirmPassword(!showConfirmPassword)
  }

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!acceptTerms) {
      showErrorToast('Términos requeridos', 'Debes aceptar los términos de servicio y política de privacidad')
      return
    }
    
    if (password !== confirmPassword) {
      setError('Las contraseñas no coinciden')
      return
    }
    
    if (password.length < 3 || password.length > 16) {
      setError('La contraseña debe tener entre 3 y 16 caracteres')
      return
    }
    
    setError('')
    setIsLoading(true)
    
    try {
      await axios.post('http://localhost:8081/users', {
        username,
        email,
        password,
        confPassword: confirmPassword,
        role: 'user'
      })
      
      showSuccessToast('¡Registro exitoso!', 'Revisa tu correo para verificar tu cuenta')
      
      setTimeout(() => {
        navigate('/')
      }, 3000)
      
    } catch (error: any) {
      setIsLoading(false)
      
      if (error.response?.status === 429) {
        showWarningAlert(
          'Demasiados intentos de registro', 
          'Has excedido el límite de intentos de registro. Por favor espera unos minutos antes de intentar nuevamente.'
        );
      } else {
        setError(error.response?.data?.msg || 'Error al registrar el usuario')
        showErrorToast('Error de registro', error.response?.data?.msg || 'Error al registrar el usuario')
      }
    }
  }

  return (
    <div className="register-bg">
      <div className="register-container">
        <div className="register-content">
          <div className="register-brand-section">
            <h1 className="register-brand-title">AI Design</h1>
            <p className="register-brand-subtitle">Únete a nuestra plataforma de diseño con IA</p>
          </div>
          
          <form className="register-form" onSubmit={handleRegister}>
            <div className="register-form-title">
              <h2>Crear cuenta</h2>
            </div>

            <div className="register-input-group">
              <label htmlFor="username" className="register-label">Nombre de usuario</label>
              <div className="register-input-wrapper">
                <User className="register-input-icon" size={18} />
                <input
                  type="text"
                  id="username"
                  name="username"
                  className="register-input"       
                  value={username}
                  onChange={e => {
                    setUsername(e.target.value)
                    setError('')
                  }}
                  placeholder="Tu nombre de usuario"
                  required
                  minLength={3}
                  autoComplete="username"
                />
              </div>
            </div>

            <div className="register-input-group">
              <label htmlFor="email" className="register-label">Correo electrónico</label>
              <div className="register-input-wrapper">
                <Mail className="register-input-icon" size={18} />
                <input
                  type="email"
                  id="email"
                  name="email"
                  className="register-input"          
                  value={email}
                  onChange={e => {
                    setEmail(e.target.value)
                    setError('')
                  }}
                  placeholder="Tu correo electrónico"
                  required
                  autoComplete="email"
                />
              </div>
            </div>

            <div className="register-input-group">
              <label htmlFor="password" className="register-label">Contraseña</label>
              <div className="register-input-wrapper">
                <Lock className="register-input-icon" size={18} />
                <input
                  type={showPassword ? "text" : "password"}
                  id="password"
                  name="password"
                  className="register-input"      
                  value={password}
                  onChange={e => {
                    setPassword(e.target.value)
                    setError('')
                  }}
                  placeholder="Tu contraseña"
                  required
                  minLength={3}    
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  className="register-eye-button"
                  onClick={togglePasswordVisibility}
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            <div className="register-input-group">
              <label htmlFor="confirmPassword" className="register-label">Confirmar contraseña</label>
              <div className="register-input-wrapper">
                <Lock className="register-input-icon" size={18} />
                <input
                  type={showConfirmPassword ? "text" : "password"}
                  id="confirmPassword"
                  name="confirmPassword"
                  className="register-input"  
                  value={confirmPassword}
                  onChange={e => {
                    setConfirmPassword(e.target.value)
                    setError('')
                  }}
                  placeholder="Confirma tu contraseña"
                  required
                  minLength={3}          
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  className="register-eye-button"
                  onClick={toggleConfirmPasswordVisibility}
                  tabIndex={-1}
                >
                  {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            {error && <div className="register-error-message">{error}</div>}

            <button type="submit" className="register-button" disabled={isLoading || !acceptTerms}>
              {isLoading ? (
                <span className="register-button-content">
                  <Loader2 className="register-spinner" size={20} />
                  Registrando...
                </span>
              ) : (
                <span className="register-button-content">
                  <UserPlus size={20} />
                  Crear cuenta
                </span>
              )}
            </button>

            <div className="register-terms-section">
              <label className="register-terms-label">
                <input
                  type="checkbox"
                  className="register-terms-checkbox"
                  checked={acceptTerms}
                  onChange={e => setAcceptTerms(e.target.checked)}
                  required
                />
                <span className="register-terms-checkmark"></span>
                <span className="register-terms-text">
                  Al registrarte, aceptas nuestros{' '}
                  <a href="#" className="register-terms-link">Términos de servicio</a> y{' '}
                  <a href="#" className="register-terms-link">Política de Privacidad</a>
                </span>
              </label>
            </div>

            <div className="register-login-section">
              <p className="register-login-text">
                ¿Ya tienes cuenta?{' '}
                <Link to="/" className="register-login-link">
                  Inicia sesión
                </Link>
              </p>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}

export default Register