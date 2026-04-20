import React, { useState, useEffect } from 'react';
import { 
  X, 
  Download, 
  ZoomIn, 
  ZoomOut, 
  RotateCw,
  Maximize2,
  Eye,
  FileText,
  Box,
  Image as ImageIcon,
  Settings
} from 'lucide-react';
import './FilePreview.css';

interface FilePreviewProps {
  file: {
    type: string;
    url?: string;
    status: 'generating' | 'ready' | 'error';
    progress?: number;
  };
  onClose: () => void;
}

const FilePreview: React.FC<FilePreviewProps> = ({ file, onClose }) => {
  const [scale, setScale] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageError, setImageError] = useState(false);

  useEffect(() => {
    setImageLoaded(false);
    setImageError(false);
  }, [file.url, file.type]);

  // 🔧 EFECTOS
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('keydown', handleEscape);
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = 'unset';
    };
  }, [onClose]);

  // 🎯 FUNCIONES DE CONTROL
  const handleZoomIn = () => {
    setScale(prev => Math.min(prev * 1.2, 3));
  };

  const handleZoomOut = () => {
    setScale(prev => Math.max(prev / 1.2, 0.5));
  };

  const handleRotate = () => {
    setRotation(prev => (prev + 90) % 360);
  };

  const handleReset = () => {
    setScale(1);
    setRotation(0);
  };

  const handleDownload = () => {
    if (file.url) {
      const link = document.createElement('a');
      link.href = file.url;
      link.download = `archivo.${file.type.toLowerCase()}`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  const toggleFullscreen = () => {
    setIsFullscreen(!isFullscreen);
  };

  // 🎨 ICONOS POR TIPO DE ARCHIVO
  const getFileIcon = () => {
    switch (file.type.toLowerCase()) {
      case 'pdf': return <FileText size={64} />;
      case 'dwg': return <Settings size={64} />;
      case 'obj': return <Box size={64} />;
      case 'svg': return <ImageIcon size={64} />;
      case 'jpg': return <ImageIcon size={64} />;
      default: return <FileText size={64} />;
    }
  };

  // 🖼️ CONTENIDO DEL PREVIEW
  const renderPreviewContent = () => {
    if (file.status !== 'ready' || !file.url) {
      return (
        <div className="preview-placeholder">
          <div className="placeholder-icon">
            {getFileIcon()}
          </div>
          <h3 className="placeholder-title">
            {file.status === 'generating' ? 'Generando archivo...' : 'Archivo no disponible'}
          </h3>
          <p className="placeholder-description">
            {file.status === 'generating' 
              ? `Progreso: ${file.progress || 0}%`
              : 'El archivo aún no está listo para visualizar'
            }
          </p>
        </div>
      );
    }

    // 🖼️ PREVIEW DE IMÁGENES (JPG, PNG)
    if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].includes(file.type.toLowerCase())) {
      return (
        <div className="image-preview-container">
          {!imageLoaded && !imageError && (
            <div className="image-loading">
              <div className="loading-spinner"></div>
              <p>Cargando imagen...</p>
            </div>
          )}
          
          {imageError && (
            <div className="image-error">
              <ImageIcon size={48} />
              <p>Error al cargar la imagen</p>
            </div>
          )}
          
          <img
            src={file.url}
            alt={`Preview ${file.type}`}
            className="preview-image"
            style={{
              transform: `scale(${scale}) rotate(${rotation}deg)`,
              display: imageLoaded && !imageError ? 'block' : 'none'
            }}
            onLoad={() => setImageLoaded(true)}
            onError={() => setImageError(true)}
          />
        </div>
      );
    }

    // 📄 PREVIEW DE PDF
    if (file.type.toLowerCase() === 'pdf') {
      return (
        <div className="pdf-preview-container">
          <iframe
            src={file.url}
            className="preview-iframe"
            title="PDF Preview"
            style={{
              transform: `scale(${scale})`
            }}
          />
        </div>
      );
    }

    // 🔧 OTROS ARCHIVOS (DWG, OBJ, etc.)
    return (
      <div className="file-preview-placeholder">
        <div className="placeholder-icon">
          {getFileIcon()}
        </div>
        <h3 className="placeholder-title">
          Archivo {file.type.toUpperCase()}
        </h3>
        <p className="placeholder-description">
          Vista previa no disponible para este tipo de archivo
        </p>
        <button onClick={handleDownload} className="preview-download-btn">
          <Download size={20} />
          Descargar para ver
        </button>
      </div>
    );
  };

  return (
    <div className={`file-preview-overlay ${isFullscreen ? 'fullscreen' : ''}`}>
      <div className="file-preview-modal">
        {/* 🔝 HEADER */}
        <div className="preview-header">
          <div className="preview-file-info">
            <div className="file-icon-small">
              {getFileIcon()}
            </div>
            <div className="file-details">
              <h3 className="file-title">
                Archivo {file.type.toUpperCase()}
              </h3>
              <p className="file-status">
                Estado: {file.status === 'ready' ? 'Listo' : 'Generando...'}
              </p>
            </div>
          </div>

          <div className="preview-actions">
            {/* 🔍 CONTROLES DE ZOOM */}
            {['jpg', 'jpeg', 'png', 'svg', 'pdf'].includes(file.type.toLowerCase()) && file.status === 'ready' && (
              <>
                <button onClick={handleZoomOut} className="action-btn" title="Alejar">
                  <ZoomOut size={18} />
                </button>
                <span className="zoom-indicator">{Math.round(scale * 100)}%</span>
                <button onClick={handleZoomIn} className="action-btn" title="Acercar">
                  <ZoomIn size={18} />
                </button>
                <button onClick={handleRotate} className="action-btn" title="Rotar">
                  <RotateCw size={18} />
                </button>
                <button onClick={handleReset} className="action-btn" title="Restablecer">
                  <Eye size={18} />
                </button>
                <div className="divider"></div>
              </>
            )}

            {/* 📥 DESCARGA */}
            {file.status === 'ready' && (
              <button onClick={handleDownload} className="action-btn download" title="Descargar">
                <Download size={18} />
              </button>
            )}

            {/* 🔲 PANTALLA COMPLETA */}
            <button onClick={toggleFullscreen} className="action-btn" title="Pantalla completa">
              <Maximize2 size={18} />
            </button>

            {/* ❌ CERRAR */}
            <button onClick={onClose} className="action-btn close" title="Cerrar">
              <X size={18} />
            </button>
          </div>
        </div>

        {/* 📋 CONTENIDO PRINCIPAL */}
        <div className="preview-content">
          {renderPreviewContent()}
        </div>

        {/* 🔽 FOOTER */}
        <div className="preview-footer">
          <div className="footer-info">
            <span className="file-type-badge">{file.type.toUpperCase()}</span>
            {file.status === 'ready' && (
              <span className="file-size">Listo para descargar</span>
            )}
          </div>
          
          <div className="footer-controls">
            <button onClick={onClose} className="close-btn">
              Cerrar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default FilePreview;