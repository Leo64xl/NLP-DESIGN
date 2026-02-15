import React, { useState } from 'react';
import { 
  Settings,
  Globe,
  Palette,
  Monitor,
  Sun,
  Moon,
  Smartphone
} from 'lucide-react';
import { useLanguage } from '../../../contexts/LanguageContext';
import './NavbarSettings.css';

interface NavbarSettingsProps {
  isOpen: boolean;
  onClose: () => void;
}

const NavbarSettings: React.FC<NavbarSettingsProps> = ({ isOpen, onClose }) => {
  const { language, setLanguage, t } = useLanguage();
  const [theme, setTheme] = useState('light');

  const handleLanguageChange = (newLanguage: string) => {
    setLanguage(newLanguage);
    console.log('🌐 Idioma cambiado globalmente a:', newLanguage);
  };

  const handleThemeChange = (newTheme: string) => {
    setTheme(newTheme);
    // Aquí implementarías la lógica para cambiar el tema
    console.log('Tema cambiado a:', newTheme);
  };

  const handleOverlayClick = (e: React.MouseEvent) => {
    // Solo cerrar si se hace click en el overlay, no en el panel
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  return (
    <div className="navbar-settings-overlay" onClick={handleOverlayClick}>
      <div className="navbar-dropdown">
        <div className="navbar-settings">
          {/* Header idéntico a NotificationCenter */}
          <div className="settings-header">
            <h3>
              <Settings size={18} className="settings-header-icon" />
              {t('settings.title')}
            </h3>
          </div>

          {/* Content idéntico a NotificationCenter */}
          <div className="settings-content">
            {/* Configuración de Idioma - Ícono/texto izquierda, botones centrados */}
            <div className="setting-section">
              <div className="setting-header">
                <div className="setting-icon language-icon">
                  <Globe size={20} />
                </div>
                <div className="setting-info">
                  <h4 className="setting-title">{t('settings.language')}</h4>
                  <p className="setting-description">{t('settings.language.description')}</p>
                </div>
              </div>
              
              <div className="setting-options">
                <button 
                  className={`setting-option ${language === 'es' ? 'active' : ''}`}
                  onClick={() => handleLanguageChange('es')}
                >
                  <span className="option-flag">🇪🇸</span>
                  <span>{t('settings.language.spanish')}</span>
                </button>
                <button 
                  className={`setting-option ${language === 'en' ? 'active' : ''}`}
                  onClick={() => handleLanguageChange('en')}
                >
                  <span className="option-flag">🇺🇸</span>
                  <span>{t('settings.language.english')}</span>
                </button>
              </div>
            </div>

            {/* Configuración de Tema - Ícono/texto izquierda, botones centrados */}
            <div className="setting-section">
              <div className="setting-header">
                <div className="setting-icon theme-icon">
                  <Palette size={20} />
                </div>
                <div className="setting-info">
                  <h4 className="setting-title">{t('settings.theme')}</h4>
                  <p className="setting-description">{t('settings.theme.description')}</p>
                </div>
              </div>
              
              <div className="setting-options">
                <button 
                  className={`setting-option ${theme === 'light' ? 'active' : ''}`}
                  onClick={() => handleThemeChange('light')}
                >
                  <Sun size={16} />
                  <span>{t('settings.theme.light')}</span>
                </button>
                <button 
                  className={`setting-option ${theme === 'dark' ? 'active' : ''}`}
                  onClick={() => handleThemeChange('dark')}
                >
                  <Moon size={16} />
                  <span>{t('settings.theme.dark')}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default NavbarSettings;