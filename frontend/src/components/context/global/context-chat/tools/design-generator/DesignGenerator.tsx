import React, { useState } from 'react';
import { 
  Download, 
  Eye, 
  FileText, 
  Box, 
  Image, 
  Settings,
  RefreshCw,
  CheckCircle,
  Clock,
  AlertCircle,
} from 'lucide-react';
import Loader from '../progress-loader/Loader';
import FilePreview from '../file-preview/FilePreview';
import DesignSettings from '../design-settings/DesignSettings';
import PascalNativeViewer from '../pascal-viewer/PascalNativeViewer';
import './DesignGenerator.css';

interface DesignData {
  uuid: string;
  title: string;
  type: string;
  status: 'generating' | 'ready' | 'error';
  analysis?: any;
  files?: Array<{
    type: string;
    status: 'generating' | 'ready' | 'error';
    url?: string;
    progress?: number;
  }>;
}

interface DesignGeneratorProps {
  designData: DesignData;
  onUpdateDesign: (updates: Partial<DesignData>) => void;
  onSendMessage: (message: string) => void;
  onConvertFiles?: (fromFormat: string, toFormat: string) => void;
}

const DesignGenerator: React.FC<DesignGeneratorProps> = ({
  designData,
  onUpdateDesign,
  onSendMessage
}) => {
  // 👇 ACTUALIZADO: Añadir 'viewer' como opción de tab
  const [activeTab, setActiveTab] = useState<'progress' | 'files' | 'settings' | 'viewer'>('progress');
  const [selectedFile, setSelectedFile] = useState<any>(null);
  const pascalData = designData.analysis?.pascalData || null;

  // Determinar si se puede mostrar el visualizador
  const canShowViewer = !!pascalData;

  const getFileIcon = (type: string) => {
    switch (type.toLowerCase()) {
      case 'pdf': return <FileText size={20} />;
      case 'dwg': return <Settings size={20} />;
      case 'obj': return <Box size={20} />;
      case 'mtl': return <Box size={20} />; // Añadido icono para MTL
      case 'jpg': 
      case 'image': return <Image size={20} />; // Soportar ambos 'jpg' e 'image'
      case 'json': return <FileText size={20} />;
      default: return <FileText size={20} />;
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'ready': return <CheckCircle className="status-ready" size={16} />;
      case 'generating': return <Clock className="status-generating" size={16} />;
      case 'error': return <AlertCircle className="status-error" size={16} />;
      default: return <Clock size={16} />;
    }
  };

  const getOverallProgress = () => {
    if (!designData.files?.length) return 0;
    
    const totalProgress = designData.files.reduce((sum, file) => {
      return sum + (file.progress || 0);
    }, 0);
    
    return Math.round(totalProgress / designData.files.length);
  };

  const handleDownloadFile = async (file: any) => {
    if (file.status === 'ready' && file.url) {
      // Implementar descarga
      window.open(file.url, '_blank');
    }
  };

  const handlePreviewFile = (file: any) => {
    if (file.status === 'ready') {
      setSelectedFile(file);
    }
  };

  const handleRegenerateFile = (fileType: string) => {
    onSendMessage(`Regenera el archivo ${fileType.toUpperCase()} con mejor calidad`);
  };

  const getFileTypeDescription = (type: string): string => {
    switch (type.toLowerCase()) {
      case 'pdf': return 'Planos arquitectónicos detallados';
      case 'dwg': return 'Archivo CAD editable';
      case 'obj': return 'Modelo 3D interactivo';
      case 'mtl': return 'Materiales para modelo 3D';
      case 'json': return 'Datos de geometría';
      case 'jpg': 
      case 'image': return 'Render fotorrealista';
      default: return 'Archivo de diseño';
    }
  };

  return (
    <div className="design-generator">
      {/* 📋 ENCABEZADO DEL DISEÑO */}
      <div className="design-header">
        <div className="design-info">
          <h3 className="design-title">{designData.title}</h3>
          <div className="design-meta">
            <span className="design-type">{designData.type}</span>
            <span className="design-id">ID: {designData.uuid.slice(0, 8)}</span>
          </div>
        </div>
        
        <div className="design-status">
          {getStatusIcon(designData.status)}
          <span className="status-text">
            {designData.status === 'generating' ? 'Generando...' : 
             designData.status === 'ready' ? 'Completado' : 'Error'}
          </span>
        </div>
      </div>

      {/* 📊 PROGRESO GENERAL */}
      {designData.status === 'generating' && (
        <Loader text="Generando archivos técnicos..." />
      )}

      {/* 🔖 PESTAÑAS - AÑADIMOS LA NUEVA PESTAÑA VISOR */}
      <div className="generation-tabs">
        <button
          className={`tab ${activeTab === 'progress' ? 'active' : ''}`}
          onClick={() => setActiveTab('progress')}
        >
          <Clock size={16} />
          Progreso
        </button>
        
        <button
          className={`tab ${activeTab === 'files' ? 'active' : ''}`}
          onClick={() => setActiveTab('files')}
        >
          <FileText size={16} />
          Archivos ({designData.files?.length || 0})
        </button>
        
        {/* 🔴 NUEVA PESTAÑA: VISOR 3D/2D */}
        <button
          className={`tab ${activeTab === 'viewer' ? 'active' : ''}`}
          onClick={() => setActiveTab('viewer')}
          disabled={!canShowViewer}
        >
          <Box size={16} />
          Visor Pascal
        </button>
        
        <button
          className={`tab ${activeTab === 'settings' ? 'active' : ''}`}
          onClick={() => setActiveTab('settings')}
        >
          <Settings size={16} />
          Configuración
        </button>
      </div>

      {/* 📋 CONTENIDO DE PESTAÑAS */}
      <div className="tab-content">
        {/* 📊 PESTAÑA DE PROGRESO */}
        {activeTab === 'progress' && (
          <div className="progress-tab">
            <div className="files-progress">
              {designData.files?.map((file, index) => (
                <div key={index} className="file-progress-item">
                  <div className="file-progress-header">
                    <div className="file-info">
                      {getFileIcon(file.type)}
                      <span className="file-name">
                        {file.type.toUpperCase()} - {getFileTypeDescription(file.type)}
                      </span>
                    </div>
                    <div className="file-status">
                      {getStatusIcon(file.status)}
                      <span>{file.progress || 0}%</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 📁 PESTAÑA DE ARCHIVOS */}
        {activeTab === 'files' && (
          <div className="files-tab">
            <div className="files-grid">
              {designData.files?.map((file, index) => (
                <div key={index} className={`file-card ${file.status}`}>
                  <div className="file-card-header">
                    {getFileIcon(file.type)}
                    <h4>{file.type.toUpperCase()}</h4>
                    {getStatusIcon(file.status)}
                  </div>
                  
                  <p className="file-description">
                    {getFileTypeDescription(file.type)}
                  </p>
                  
                  <div className="file-actions">
                    <button
                      onClick={() => handlePreviewFile(file)}
                      disabled={file.status !== 'ready'}
                      className="file-action-btn preview"
                    >
                      <Eye size={16} />
                      Vista previa
                    </button>
                    
                    <button
                      onClick={() => handleDownloadFile(file)}
                      disabled={file.status !== 'ready'}
                      className="file-action-btn download"
                    >
                      <Download size={16} />
                      Descargar
                    </button>
                    
                    <button
                      onClick={() => handleRegenerateFile(file.type)}
                      className="file-action-btn regenerate"
                    >
                      <RefreshCw size={16} />
                      Regenerar
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 🔴 NUEVA PESTAÑA: VISOR 3D/2D */}
        {activeTab === 'viewer' && (
          <div className="viewer-tab">
            {canShowViewer ? (
              <PascalNativeViewer pascalData={pascalData} />
            ) : (
              <div className="viewer-placeholder">
                <div className="placeholder-content">
                  <Box size={48} />
                  <h3>Vista previa no disponible</h3>
                  <p>
                    {designData.status === 'generating' 
                      ? 'Los datos del visor se están generando...' 
                      : 'No hay datos de Pascal disponibles para mostrar'}
                  </p>
                  <button 
                    className="regenerate-model-btn"
                    onClick={() => handleRegenerateFile('pascal')}
                  >
                    <RefreshCw size={16} />
                    Regenerar datos Pascal
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ⚙️ PESTAÑA DE CONFIGURACIÓN */}
        {activeTab === 'settings' && (
          <DesignSettings
            designData={designData}
            onUpdateDesign={onUpdateDesign}
            onSendMessage={onSendMessage}
          />
        )}
      </div>

      {/* 🖼️ MODAL DE VISTA PREVIA */}
      {selectedFile && (
        <FilePreview
          file={selectedFile}
          onClose={() => setSelectedFile(null)}
        />
      )}
    </div>
  );
};

export default DesignGenerator;