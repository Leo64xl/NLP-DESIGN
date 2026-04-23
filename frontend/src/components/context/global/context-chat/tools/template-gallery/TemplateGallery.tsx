import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Download, Eye, Star, TrendingUp } from 'lucide-react';
import { useLanguage } from '../../../../../../contexts/LanguageContext';
//import './TemplateGallery.css';

interface Template {
  id: string;
  name: string;
  category: string;
  area: string;
  rooms: number;
  style: string;
  thumbnail: string;
  description: string;
  popularity: number;
  downloads: number;
  trending?: boolean;
}

interface TemplateGalleryProps {
  onSelectTemplate?: (template: Template) => void;
  showPopularOnly?: boolean;
}

// 🎯 INTERFACES PARA TIPADO DE RESPUESTAS API
interface ApiResponse<T = any> {
  success: boolean;
  message?: string;
  data?: T;
}

interface TemplatesResponse {
  templates: Template[];
}

interface GenerateResponse {
  design: any;
}

const TemplateGallery: React.FC<TemplateGalleryProps> = ({ 
  onSelectTemplate, 
  showPopularOnly = false 
}) => {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const { t } = useLanguage();

  useEffect(() => {
    loadTemplates();
  }, [showPopularOnly]);

  const loadTemplates = async () => {
    try {
      const endpoint = showPopularOnly ? '/templates/popular' : '/templates';
      const response = await axios.get<ApiResponse<TemplatesResponse>>(
        `http://localhost:8081${endpoint}`
      );
      
      // 🎯 VALIDACIÓN TIPADA SEGURA
      if (response.data && typeof response.data === 'object' && 'success' in response.data) {
        const apiResponse = response.data as ApiResponse<TemplatesResponse>;
        if (apiResponse.success && apiResponse.data?.templates) {
          setTemplates(apiResponse.data.templates);
        }
      }
    } catch (error) {
      console.error('Error cargando templates:', error);
    } finally {
      setLoading(false);
    }
  };

  // 🎯 CORREGIR SET ITERATION - USAR Array.from()
  const categories = ['all', ...Array.from(new Set(templates.map(t => t.category)))];
  const filteredTemplates = selectedCategory === 'all' 
    ? templates 
    : templates.filter(t => t.category === selectedCategory);

  const handleUseTemplate = async (template: Template) => {
    if (onSelectTemplate) {
      onSelectTemplate(template);
    } else {
      // Iniciar generación desde template
      try {
        const response = await axios.post<ApiResponse<GenerateResponse>>(
          `http://localhost:8081/templates/${template.id}/generate`,
          { customizations: {} },
          { withCredentials: true }
        );
        
        // 🎯 VALIDACIÓN TIPADA SEGURA
        if (response.data && typeof response.data === 'object' && 'success' in response.data) {
          const apiResponse = response.data as ApiResponse<GenerateResponse>;
          if (apiResponse.success && apiResponse.data) {
            console.log('Generación iniciada:', apiResponse.data.design);
          }
        }
      } catch (error) {
        console.error('Error generando desde template:', error);
      }
    }
  };

  if (loading) {
    return (
      <div className="template-gallery-loading">
        <div className="loading-spinner"></div>
        <p>{t('templates.loading')}</p>
      </div>
    );
  }

  return (
    <div className="template-gallery">
      <div className="template-gallery-header">
        <h2>{showPopularOnly ? t('templates.popularTitle') : t('templates.title')}</h2>
        <p>{t('templates.description')}</p>
      </div>

      <div className="template-filters">
        <div className="category-filters">
          {categories.map(category => (
            <button
              key={category}
              className={`filter-btn ${selectedCategory === category ? 'active' : ''}`}
              onClick={() => setSelectedCategory(category)}
            >
              {category === 'all' ? t('templates.all') : category}
            </button>
          ))}
        </div>
      </div>

      <div className="templates-grid">
        {filteredTemplates.map(template => (
          <div key={template.id} className="template-card">
            {template.trending && (
              <div className="template-badge trending">
                <TrendingUp size={16} />
                {t('templates.trending')}
              </div>
            )}
            
            <div className="template-thumbnail">
              <img src={template.thumbnail} alt={template.name} />
              <div className="template-overlay">
                <button className="overlay-btn preview">
                  <Eye size={20} />
                  {t('templates.preview')}
                </button>
                <button 
                  className="overlay-btn use"
                  onClick={() => handleUseTemplate(template)}
                >
                  <Download size={20} />
                  {t('templates.use')}
                </button>
              </div>
            </div>

            <div className="template-content">
              <h3 className="template-name">{template.name}</h3>
              <p className="template-description">{template.description}</p>
              
              <div className="template-specs">
                <span className="spec-item">{template.area}</span>
                <span className="spec-item">{template.rooms} {t('templates.rooms')}</span>
                <span className="spec-item">{template.style}</span>
              </div>

              <div className="template-stats">
                <div className="stat-item">
                  <Star size={16} />
                  <span>{template.popularity}%</span>
                </div>
                <div className="stat-item">
                  <Download size={16} />
                  <span>{template.downloads.toLocaleString()}</span>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default TemplateGallery;