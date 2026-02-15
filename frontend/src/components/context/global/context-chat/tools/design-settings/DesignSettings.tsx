import React, { useState, useEffect } from 'react';
import { 
  Settings,
  Home,
  Building,
  Warehouse,
  Palette,
  Ruler,
  Users,
  Bed,
  Bath,
  Car,
  Trees,
  Sun,
  Zap,
  Droplets,
  Wind,
  Shield,
  Save,
  RefreshCw,
  Sliders,
  MessageSquare,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import './DesignSettings.css';

interface DesignData {
  uuid: string;
  title: string;
  type: string;
  status: 'generating' | 'ready' | 'error';
  analysis?: {
    buildingType: string;
    estimatedSize: string;
    rooms: number;
    style: string;
    features: string[];
    materials: string[];
    budget: string;
  };
}

interface DesignSettingsProps {
  designData: DesignData;
  onUpdateDesign: (updates: Partial<DesignData>) => void;
  onSendMessage: (message: string) => void;
}

const DesignSettings: React.FC<DesignSettingsProps> = ({
  designData,
  onUpdateDesign,
  onSendMessage
}) => {
  // 🎯 ESTADOS LOCALES
  const [activeSection, setActiveSection] = useState<string>('basic');
  const [localSettings, setLocalSettings] = useState({
    buildingType: designData.analysis?.buildingType || 'residential',
    size: designData.analysis?.estimatedSize || '150m²',
    rooms: designData.analysis?.rooms || 3,
    bathrooms: 2,
    style: designData.analysis?.style || 'modern',
    features: designData.analysis?.features || [],
    materials: designData.analysis?.materials || [],
    budget: designData.analysis?.budget || 'medium',
    floors: 1,
    parking: 2,
    orientation: 'north',
    sustainability: false,
    smartHome: false,
    accessibility: false
  });
  
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    basic: true,
    details: false,
    features: false,
    materials: false,
    advanced: false
  });

  // 🔄 SINCRONIZAR CON PROPS
  useEffect(() => {
    if (designData.analysis) {
      setLocalSettings(prev => ({
        ...prev,
        buildingType: designData.analysis?.buildingType || prev.buildingType,
        size: designData.analysis?.estimatedSize || prev.size,
        rooms: designData.analysis?.rooms || prev.rooms,
        style: designData.analysis?.style || prev.style,
        features: designData.analysis?.features || prev.features,
        materials: designData.analysis?.materials || prev.materials,
        budget: designData.analysis?.budget || prev.budget,
      }));
    }
  }, [designData.analysis]);

  // 🎨 OPCIONES CONFIGURABLES
  const buildingTypes = [
    { value: 'residential', label: 'Residencial', icon: <Home size={16} /> },
    { value: 'commercial', label: 'Comercial', icon: <Building size={16} /> },
    { value: 'industrial', label: 'Industrial', icon: <Warehouse size={16} /> }
  ];

  const architecturalStyles = [
    'Moderno', 'Contemporáneo', 'Minimalista', 'Industrial', 'Clásico',
    'Colonial', 'Mediterráneo', 'Escandinavo', 'Tropical', 'Rustico'
  ];

  const availableFeatures = [
    { id: 'pool', label: 'Piscina', icon: <Droplets size={16} /> },
    { id: 'garden', label: 'Jardín', icon: <Trees size={16} /> },
    { id: 'terrace', label: 'Terraza', icon: <Sun size={16} /> },
    { id: 'balcony', label: 'Balcón', icon: <Wind size={16} /> },
    { id: 'garage', label: 'Garaje', icon: <Car size={16} /> },
    { id: 'basement', label: 'Sótano', icon: <Shield size={16} /> },
    { id: 'office', label: 'Oficina', icon: <Building size={16} /> },
    { id: 'gym', label: 'Gimnasio', icon: <Zap size={16} /> }
  ];

  const constructionMaterials = [
    'Concreto', 'Ladrillo', 'Madera', 'Acero', 'Vidrio',
    'Piedra', 'Adobe', 'Bambú', 'Prefabricado', 'Mixto'
  ];

  // 🔧 FUNCIONES DE CONTROL
  const toggleSection = (section: string) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  };

  const updateSetting = (key: string, value: any) => {
    setLocalSettings(prev => ({
      ...prev,
      [key]: value
    }));
  };

  const toggleFeature = (featureId: string) => {
    setLocalSettings(prev => ({
      ...prev,
      features: prev.features.includes(featureId)
        ? prev.features.filter(f => f !== featureId)
        : [...prev.features, featureId]
    }));
  };

  const toggleMaterial = (material: string) => {
    setLocalSettings(prev => ({
      ...prev,
      materials: prev.materials.includes(material)
        ? prev.materials.filter(m => m !== material)
        : [...prev.materials, material]
    }));
  };

  // 💬 GENERAR MENSAJE PARA IA
  const generateUpdateMessage = () => {
    const features = localSettings.features.length > 0 
      ? `, con ${localSettings.features.join(', ')}`
      : '';
    
    const materials = localSettings.materials.length > 0
      ? ` usando materiales como ${localSettings.materials.join(', ')}`
      : '';

    return `Actualizar el diseño: ${localSettings.buildingType} de estilo ${localSettings.style}, ` +
           `${localSettings.size}, ${localSettings.rooms} habitaciones, ${localSettings.bathrooms} baños` +
           `${features}${materials}. Presupuesto ${localSettings.budget}.`;
  };

  const handleApplyChanges = () => {
    const updateMessage = generateUpdateMessage();
    onSendMessage(updateMessage);
  };

  const handleQuickUpdate = (aspect: string, value: string) => {
    const quickMessages = {
      'bigger': 'Hacer el diseño más grande, aumentar el tamaño total',
      'smaller': 'Reducir el tamaño del diseño, hacer más compacto',
      'more_rooms': 'Agregar más habitaciones al diseño',
      'modern': 'Cambiar a estilo más moderno y contemporáneo',
      'traditional': 'Cambiar a estilo más tradicional y clásico',
      'luxury': 'Hacer el diseño más lujoso con mejores acabados',
      'budget': 'Optimizar el diseño para reducir costos',
      'sustainable': 'Hacer el diseño más sostenible y ecológico'
    };
    
    const message = quickMessages[aspect as keyof typeof quickMessages] || `Modificar ${aspect}: ${value}`;
    onSendMessage(message);
  };

  return (
    <div className="design-settings">
      {/* 🎯 HEADER */}
      <div className="settings-header">
        <div className="header-content">
          <Settings size={24} />
          <div>
            <h3>Configuración del Diseño</h3>
            <p>Personaliza tu proyecto arquitectónico</p>
          </div>
        </div>
      </div>

      {/* ⚡ ACCIONES RÁPIDAS */}
      <div className="quick-actions">
        <h4>Modificaciones Rápidas</h4>
        <div className="quick-buttons">
          <button 
            onClick={() => handleQuickUpdate('bigger', 'más grande')}
            className="quick-btn"
          >
            <Ruler size={16} />
            Más Grande
          </button>
          <button 
            onClick={() => handleQuickUpdate('smaller', 'más pequeño')}
            className="quick-btn"
          >
            <Ruler size={16} />
            Más Pequeño
          </button>
          <button 
            onClick={() => handleQuickUpdate('more_rooms', 'más habitaciones')}
            className="quick-btn"
          >
            <Bed size={16} />
            + Habitaciones
          </button>
          <button 
            onClick={() => handleQuickUpdate('modern', 'moderno')}
            className="quick-btn"
          >
            <Palette size={16} />
            Modernizar
          </button>
          <button 
            onClick={() => handleQuickUpdate('luxury', 'lujo')}
            className="quick-btn"
          >
            <Sun size={16} />
            Más Lujo
          </button>
          <button 
            onClick={() => handleQuickUpdate('sustainable', 'sostenible')}
            className="quick-btn"
          >
            <Trees size={16} />
            Eco-Friendly
          </button>
        </div>
      </div>

      {/* 📋 CONFIGURACIONES DETALLADAS */}
      <div className="settings-sections">
        
        {/* 🏠 CONFIGURACIÓN BÁSICA */}
        <div className="settings-section">
          <button
            className="section-header"
            onClick={() => toggleSection('basic')}
          >
            <Home size={20} />
            <span>Configuración Básica</span>
            {expandedSections.basic ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>
          
          {expandedSections.basic && (
            <div className="section-content">
              {/* Tipo de Edificio */}
              <div className="setting-group">
                <label>Tipo de Edificio</label>
                <div className="building-type-selector">
                  {buildingTypes.map(type => (
                    <button
                      key={type.value}
                      className={`type-btn ${localSettings.buildingType === type.value ? 'active' : ''}`}
                      onClick={() => updateSetting('buildingType', type.value)}
                    >
                      {type.icon}
                      {type.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Tamaño */}
              <div className="setting-group">
                <label>Tamaño Total</label>
                <input
                  type="text"
                  value={localSettings.size}
                  onChange={(e) => updateSetting('size', e.target.value)}
                  placeholder="ej: 150m²"
                  className="setting-input"
                />
              </div>

              {/* Estilo Arquitectónico */}
              <div className="setting-group">
                <label>Estilo Arquitectónico</label>
                <select
                  value={localSettings.style}
                  onChange={(e) => updateSetting('style', e.target.value)}
                  className="setting-select"
                >
                  {architecturalStyles.map(style => (
                    <option key={style} value={style.toLowerCase()}>
                      {style}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}
        </div>

        {/* 📐 DETALLES ESPECÍFICOS */}
        <div className="settings-section">
          <button
            className="section-header"
            onClick={() => toggleSection('details')}
          >
            <Sliders size={20} />
            <span>Detalles Específicos</span>
            {expandedSections.details ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>
          
          {expandedSections.details && (
            <div className="section-content">
              <div className="setting-row">
                <div className="setting-group">
                  <label>
                    <Bed size={16} />
                    Habitaciones
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="10"
                    value={localSettings.rooms}
                    onChange={(e) => updateSetting('rooms', parseInt(e.target.value))}
                    className="setting-input-small"
                  />
                </div>

                <div className="setting-group">
                  <label>
                    <Bath size={16} />
                    Baños
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="8"
                    value={localSettings.bathrooms}
                    onChange={(e) => updateSetting('bathrooms', parseInt(e.target.value))}
                    className="setting-input-small"
                  />
                </div>
              </div>

              <div className="setting-row">
                <div className="setting-group">
                  <label>Pisos</label>
                  <select
                    value={localSettings.floors}
                    onChange={(e) => updateSetting('floors', parseInt(e.target.value))}
                    className="setting-select"
                  >
                    <option value={1}>1 Piso</option>
                    <option value={2}>2 Pisos</option>
                    <option value={3}>3 Pisos</option>
                  </select>
                </div>

                <div className="setting-group">
                  <label>
                    <Car size={16} />
                    Estacionamientos
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="6"
                    value={localSettings.parking}
                    onChange={(e) => updateSetting('parking', parseInt(e.target.value))}
                    className="setting-input-small"
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ✨ CARACTERÍSTICAS ESPECIALES */}
        <div className="settings-section">
          <button
            className="section-header"
            onClick={() => toggleSection('features')}
          >
            <Sun size={20} />
            <span>Características Especiales</span>
            {expandedSections.features ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>
          
          {expandedSections.features && (
            <div className="section-content">
              <div className="features-grid">
                {availableFeatures.map(feature => (
                  <button
                    key={feature.id}
                    className={`feature-btn ${localSettings.features.includes(feature.id) ? 'active' : ''}`}
                    onClick={() => toggleFeature(feature.id)}
                  >
                    {feature.icon}
                    {feature.label}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* 🧱 MATERIALES */}
        <div className="settings-section">
          <button
            className="section-header"
            onClick={() => toggleSection('materials')}
          >
            <Shield size={20} />
            <span>Materiales de Construcción</span>
            {expandedSections.materials ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>
          
          {expandedSections.materials && (
            <div className="section-content">
              <div className="materials-grid">
                {constructionMaterials.map(material => (
                  <button
                    key={material}
                    className={`material-btn ${localSettings.materials.includes(material) ? 'active' : ''}`}
                    onClick={() => toggleMaterial(material)}
                  >
                    {material}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* ⚙️ CONFIGURACIÓN AVANZADA */}
        <div className="settings-section">
          <button
            className="section-header"
            onClick={() => toggleSection('advanced')}
          >
            <Zap size={20} />
            <span>Configuración Avanzada</span>
            {expandedSections.advanced ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>
          
          {expandedSections.advanced && (
            <div className="section-content">
              <div className="setting-group">
                <label>Presupuesto</label>
                <select
                  value={localSettings.budget}
                  onChange={(e) => updateSetting('budget', e.target.value)}
                  className="setting-select"
                >
                  <option value="low">Económico</option>
                  <option value="medium">Medio</option>
                  <option value="high">Alto</option>
                  <option value="luxury">Lujo</option>
                </select>
              </div>

              <div className="checkboxes-group">
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={localSettings.sustainability}
                    onChange={(e) => updateSetting('sustainability', e.target.checked)}
                  />
                  <span>Diseño Sostenible</span>
                </label>

                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={localSettings.smartHome}
                    onChange={(e) => updateSetting('smartHome', e.target.checked)}
                  />
                  <span>Casa Inteligente</span>
                </label>

                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={localSettings.accessibility}
                    onChange={(e) => updateSetting('accessibility', e.target.checked)}
                  />
                  <span>Accesibilidad Universal</span>
                </label>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 💾 ACCIONES DE GUARDADO */}
      <div className="settings-actions">
        <button 
          onClick={handleApplyChanges}
          className="apply-btn"
        >
          <MessageSquare size={16} />
          Aplicar Cambios
        </button>
        
        <button 
          onClick={() => onSendMessage('Regenerar todos los archivos con la nueva configuración')}
          className="regenerate-btn"
        >
          <RefreshCw size={16} />
          Regenerar Archivos
        </button>
      </div>
    </div>
  );
};

export default DesignSettings;