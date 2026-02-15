import React, { useEffect } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { LogOut as LogOutIcon, User, Mail, BadgeCheck, Settings, Palette, Home, Menu } from 'lucide-react';
import { LogOut, reset } from '../../../../../../features/authSlice';
import { useLanguage } from '../../../../../../contexts/LanguageContext';
import type { AppDispatch } from '../../../../../../app/store';
import './UserProfile.css';

interface UserProfileProps {
  isOpen: boolean;
  onClose: () => void;
}

const UserProfile: React.FC<UserProfileProps> = ({ isOpen, onClose }) => {
  const dispatch = useDispatch<AppDispatch>();
  const navigate = useNavigate();
  const { user } = useSelector((state: any) => state.auth);
  const { t } = useLanguage();

  const handleLogout = () => {
    // Primero cerramos el panel para dar feedback visual inmediato
    onClose();
    
    // Luego ejecutamos el logout global (igual que en tu otra app)
    dispatch(LogOut());
    dispatch(reset());
    navigate('/');
  };

  const handleNavigation = (path: string) => {
    navigate(path);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="user-profile-overlay" onClick={onClose}>
      <div className="user-profile" onClick={(e) => e.stopPropagation()}>
        {/* Header del menú */}
        <div className="user-profile-header">
          <h3>
            <Menu size={20} className="header-menu-icon" />
            {t('user.menu')}
          </h3>
        </div>

        <div className="user-profile-content">
          {/* Información del usuario */}
          <div className="user-info-section">
            <div className="user-avatar">
              <User size={24} />
            </div>
            <div className="user-details">
              <h4 className="user-name">{user?.name || user?.username || 'Usuario'}</h4>
              <div className="user-email-container">
                <span className="user-email">{user?.email || 'usuario@email.com'}</span>
                <BadgeCheck size={16} className="verified-icon" />
              </div>
            </div>
          </div>

          {/* Opciones de navegación */}
          <div className="user-options">
            <button 
              className="user-option-item"
              onClick={() => handleNavigation('/dashboard')}
            >
              <div className="option-icon">
                <Home size={20} />
              </div>
              <div className="option-body">
                <h4 className="option-title">{t('user.dashboard')}</h4>
                <p className="option-description">{t('user.dashboardDescription')}</p>
              </div>
            </button>
            
            <button 
              className="user-option-item"
              onClick={() => handleNavigation('/designs')}
            >
              <div className="option-icon">
                <Palette size={20} />
              </div>
              <div className="option-body">
                <h4 className="option-title">{t('user.myDesigns')}</h4>
                <p className="option-description">{t('user.designsDescription')}</p>
              </div>
            </button>
            
            <button 
              className="user-option-item"
              onClick={() => handleNavigation('/settings')}
            >
              <div className="option-icon">
                <Settings size={20} />
              </div>
              <div className="option-body">
                <h4 className="option-title">{t('user.settings')}</h4>
                <p className="option-description">{t('user.settingsDescription')}</p>
              </div>
            </button>
          </div>

          {/* Botón de logout separado */}
          <div className="user-logout-section">
            <button 
              className="logout-btn"
              onClick={handleLogout}
            >
              <LogOutIcon size={18} />
              <span>{t('user.logout')}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default UserProfile;