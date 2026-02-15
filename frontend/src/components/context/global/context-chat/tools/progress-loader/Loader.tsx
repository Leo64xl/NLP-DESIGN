import React from 'react';
import { useLanguage } from '../../../../../../contexts/LanguageContext';
import './Loader.css';

const Loader: React.FC<{ text?: string }> = ({ text }) => {
  const { t } = useLanguage();
  const displayText = text || t('loader.generating');
  
  return (
    <div className="loader-container">
      <div className="spinner"></div>
      <span className="loader-text">{displayText}</span>
    </div>
  );
};

export default Loader;