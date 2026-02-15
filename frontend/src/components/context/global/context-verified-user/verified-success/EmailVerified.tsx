import React, { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { CheckCircle, X } from 'lucide-react'
import './EmailVerified.css'

const EmailVerified = () => {
  const [searchParams] = useSearchParams()
  const [isAlreadyVerified] = useState(searchParams.get('already') === 'true')

  const handleCloseWindow = () => {
    window.close()
    
    setTimeout(() => {
      if (!window.closed) {
        alert('Por favor, cierra esta pestaña manualmente')
      }
    }, 100)
  }

  return (
    <div className="email-verified-bg">
      <div className="email-verified-container">
        <div className="email-verified-content">
          <div className="email-verified-brand-section">
            <h1 className="email-verified-brand-title">AI Design</h1>
            <p className="email-verified-brand-subtitle">Plataforma de diseño con inteligencia artificial</p>
          </div>

          <div className="email-verified-success-section">
            <div className="email-verified-icon">
              <CheckCircle size={64} />
            </div>
            
            <h2 className="email-verified-title">
              {isAlreadyVerified ? '¡Ya estás verificado!' : '¡Correo verificado!'}
            </h2>
            
            <p className="email-verified-message">
              {isAlreadyVerified 
                ? 'Tu cuenta ya está verificada. Puedes cerrar esta ventana y continuar usando AI Design.'
                : 'Tu cuenta ha sido verificada correctamente. Ya puedes acceder a todas las funcionalidades de AI Design.'
              }
            </p>

            <button 
              onClick={handleCloseWindow}
              className="email-verified-close-button"
            >
              <X size={20} />
              Cerrar ventana
            </button>

            <div className="email-verified-footer">
              <p className="email-verified-instruction">
                Esta ventana se puede cerrar de forma segura. Regresa a la aplicación para comenzar a crear.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default EmailVerified