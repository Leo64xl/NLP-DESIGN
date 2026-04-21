import React, { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useSelector } from "react-redux";
import axios from "axios";
import ScrollToBottom from 'react-scroll-to-bottom';
import {
  Send,
  Loader2,
  User,
  Bot,
  Sparkles,
  RefreshCw,
  Settings,
  Palette,
  X,
} from "lucide-react";
import { useLanguage } from "../../../../../contexts/LanguageContext";
import { ArchitecturalValidator } from "../../../../../utils/architecturalValidator";
import PascalNativeViewer from "../tools/pascal-viewer/PascalNativeViewer";
import "./Chat.css";

const generateUUID = (): string => {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function (c) {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
};

interface Message {
  uuid: string;
  role: "user" | "assistant" | "system";
  content: string;
  status: "completed" | "processing" | "error";
  createdAt: string;
  metadata?: {
    structuralData?: {
      metadata: {
        title: string;
        description: string;
        totalArea: number;
        dimensions: { width: number; length: number; height?: number };
        style: string;
        generatedAt: string;
      };
      rooms: Array<{
        name: string;
        type: string;
        area: number;
        position: { x: number; y: number };
        size: { width: number; height: number };
        doors: Array<{ position: string; width: number }>;
        windows: Array<{ position: string; width: number; height: number }>;
        features: string[];
      }>;
      walls: Array<{
        start: [number, number];
        end: [number, number];
        thickness: number;
        material: string;
      }>;
      connections: Array<{
        from: string;
        to: string;
        type: 'door' | 'opening' | 'window';
        width: number;
      }>;
    };
    files?: any[];
    [key: string]: any;
  };
}

interface DesignData {
  uuid: string;
  title: string;
  type: string;
  status: "generating" | "ready" | "error";
  files?: Array<{
    type: string;
    status: "generating" | "ready" | "error";
    url?: string;
    progress?: number;
  }>;
}

interface DesignType {
  type: string;
  label: string;
  description: string;
  features: string[];
}

// 🎯 INTERFACES PARA RESPUESTAS DE API - ACTUALIZADAS
interface ApiResponse<T = any> {
  success: boolean;
  message?: string;
  data?: T;
  action?: string;
  redirectUrl?: string;
}

interface MessagesResponse {
  messages: Message[];
}

interface CreateDesignData {
  design: {
    uuid: string;
    title: string;
    type: string;
    status: string;
    metadata?: any;
  };
  firstMessage?: Message;
  typeInfo?: any;
  plan?: any; // Plan generado por Groq
}

interface GetDesignData {
  design: {
    uuid: string;
    title: string;
    type: string;
    status: string;
    metadata?: any;
    files?: Array<{
      fileType: string;
      status: string;
      downloadUrl?: string;
    }>;
  };
}

interface MessageData {
  message: Message;
  processingTime?: number;
}

interface DesignTypesResponse {
  types: DesignType[];
}

interface ConvertResponse {
  success: boolean;
  convertedFiles: Array<{
    originalType: string;
    newType: string;
    status: string;
    url?: string;
  }>;
}

const Chat: React.FC = () => {
  const { designId } = useParams<{ designId?: string }>();
  const navigate = useNavigate();
  const { user } = useSelector((state: any) => state.auth);
  const { t, language } = useLanguage();

  const [messages, setMessages] = useState<Message[]>([]);
  const [currentMessage, setCurrentMessage] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [designData, setDesignData] = useState<DesignData | null>(null);
  const [hasStarted, setHasStarted] = useState(false);
  const [availableTypes, setAvailableTypes] = useState<DesignType[]>([]);
  const [isRenderModalOpen, setIsRenderModalOpen] = useState(false);
  const [renderModalData, setRenderModalData] = useState<any | null>(null);
  
  // 🎨 NUEVO: Estado para el configurador visual
  const [showDesignWizard, setShowDesignWizard] = useState(false);
  const [wizardSettings, setWizardSettings] = useState({
    buildingType: 'casa',
    constructionArea: '', // Área de construcción
    landArea: '', // Área del terreno
    rooms: 3,
    bathrooms: 2,
    style: 'moderno',
    features: [] as string[],
    materials: [] as string[],
    budget: 'medio',
    floors: 1,
    parking: 0,
    orientation: 'norte',
    sustainability: false,
    smartHome: false,
    accessibility: false,
    location: '', // Ciudad/región
    climate: 'templado' // Clima de la zona
  });
  const [showPreview, setShowPreview] = useState(false);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  
  // 💡 NUEVO: Estado para tips rotativos
  const [currentTipIndex, setCurrentTipIndex] = useState(0);

  // 💡 NUEVO: Array de tips para mostrar
  const designTips = [
    "🎨 Usa el Asistente de Diseño Visual para crear tu diseño de forma más práctica y visual. Te ayuda a configurar correctamente todas las características y evita errores en la solicitud.",
    "📏 Sé específico con las medidas: incluye metros cuadrados de construcción y terreno para obtener diseños más precisos y realistas.",
    "🏠 Describe el estilo arquitectónico que prefieres: moderno, clásico, minimalista, contemporáneo, tradicional o rústico.",
    "🛏️ Especifica la cantidad exacta de habitaciones, baños y espacios adicionales como cocina, sala, comedor o estudio.",
    "🌿 Menciona características especiales como jardín, terraza, piscina, garaje o balcón para un diseño más completo.",
    "💰 Indica tu presupuesto aproximado (económico, medio, alto) para recibir recomendaciones acordes a tus posibilidades.",
    "🧱 Especifica materiales de construcción preferidos: concreto, madera, acero, piedra, ladrillo o materiales mixtos.",
    "🌍 Incluye tu ubicación y tipo de clima para adaptar el diseño a las condiciones ambientales de tu zona.",
    "♿ Si necesitas accesibilidad universal, menciónalo para incluir rampas, puertas amplias y espacios adaptados.",
    "🏡 Para casas de varios pisos, especifica la distribución deseada entre los diferentes niveles del proyecto."
  ];

  // 🛡️ NUEVO: Validador de contexto arquitectónico (usando clase utilitaria)
  const validateArchitecturalContext = (message: string) => {
    return ArchitecturalValidator.validate(message);
  };

  const inputRef = useRef<HTMLTextAreaElement>(null);

  const [isTranslating, setIsTranslating] = useState(false);

  // 🧹 FUNCIÓN PARA OBTENER EL CONTENIDO ORIGINAL SIN MARCADORES
  const getOriginalContent = (content: string): string => {
    return content.replace(' 🌐', '').replace(' 🌍', '');
  };

  // 🌐 FUNCIÓN PARA TRADUCIR MENSAJES DE LA IA AUTOMÁTICAMENTE (BIDIRECCIONAL)
  const translateAIMessage = async (content: string, targetLanguage: string): Promise<string> => {
    try {
      // Traducciones bidireccionales para respuestas de la IA
      const translations: Record<string, { es: string; en: string }> = {
        // Saludos y confirmaciones
        'perfect': { es: '¡Perfecto!', en: '¡Perfect!' },
        'excellent': { es: 'Excelente', en: 'Excellent' },
        'very good': { es: 'Muy bien', en: 'Very good' },
        'great': { es: 'Genial', en: 'Great' },
        
        // Acciones de diseño
        'i have created a design': { es: 'He creado un diseño', en: 'I have created a design' },
        'architectural design': { es: 'diseño arquitectónico', en: 'architectural design' },
        'technical plans': { es: 'planos técnicos', en: 'technical plans' },
        '3d model': { es: 'modelo 3D', en: '3D model' },
        'render': { es: 'render', en: 'render' },
        
        // Estados y procesos
        'generating files': { es: 'Generando archivos', en: 'Generating files' },
        'processing design': { es: 'Procesando diseño', en: 'Processing design' },
        'creating plans': { es: 'Creando planos', en: 'Creating plans' },
        'rendering': { es: 'Renderizando', en: 'Rendering' },
        'optimizing': { es: 'Optimizando', en: 'Optimizing' },
        
        // Características del diseño
        'design characteristics': { es: 'Características del diseño', en: 'Design characteristics' },
        'technical specifications': { es: 'Especificaciones técnicas', en: 'Technical specifications' },
        'construction details': { es: 'Detalles constructivos', en: 'Construction details' },
        'total area': { es: 'Área total', en: 'Total area' },
        'number of rooms': { es: 'Número de habitaciones', en: 'Number of rooms' },
        'architectural style': { es: 'Estilo arquitectónico', en: 'Architectural style' },
        
        // Tiempos y estados
        'the files will be ready': { es: 'Los archivos estarán listos', en: 'The files will be ready' },
        'in a few moments': { es: 'en unos momentos', en: 'in a few moments' },
        'the process is complete': { es: 'El proceso está completo', en: 'The process is complete' },
        'all ready': { es: 'Todo listo', en: 'All ready' },
        
        // Tipos de espacios
        'house': { es: 'casa', en: 'house' },
        'apartment': { es: 'apartamento', en: 'apartment' },
        'office': { es: 'oficina', en: 'office' },
        'commercial space': { es: 'local comercial', en: 'commercial space' },
        'dwelling': { es: 'vivienda', en: 'dwelling' },
        
        // Estilos
        'modern': { es: 'moderno', en: 'modern' },
        'contemporary': { es: 'contemporáneo', en: 'contemporary' },
        'classic': { es: 'clásico', en: 'classic' },
        'minimalist': { es: 'minimalista', en: 'minimalist' },
        'traditional': { es: 'tradicional', en: 'traditional' },
        'rustic': { es: 'rústico', en: 'rustic' },
        
        // Espacios
        'room': { es: 'habitación', en: 'room' },
        'bedroom': { es: 'dormitorio', en: 'bedroom' },
        'bathroom': { es: 'baño', en: 'bathroom' },
        'kitchen': { es: 'cocina', en: 'kitchen' },
        'living room': { es: 'sala', en: 'living room' },
        'dining room': { es: 'comedor', en: 'dining room' },
        'terrace': { es: 'terraza', en: 'terrace' },
        'balcony': { es: 'balcón', en: 'balcony' },
        'garden': { es: 'jardín', en: 'garden' },
        'garage': { es: 'garaje', en: 'garage' },
        'study': { es: 'estudio', en: 'study' },
        'walk-in closet': { es: 'vestidor', en: 'walk-in closet' },
        
        // Procesos técnicos
        'conversion started': { es: 'Conversión iniciada', en: 'Conversion started' },
        'file converted': { es: 'Archivo convertido', en: 'File converted' },
        'download available': { es: 'Descarga disponible', en: 'Download available' },
        'the file will be ready shortly': { es: 'El archivo estará listo en breve', en: 'The file will be ready shortly' },
        
        // Mensajes de error y estado
        'the design is being processed in the background': { es: 'El diseño está siendo procesado en segundo plano', en: 'The design is being processed in the background' },
        'i will notify you when it is ready': { es: 'Te notificaré cuando esté listo', en: 'I will notify you when it is ready' },
        'the process took longer than expected': { es: 'El proceso tomó más tiempo del esperado', en: 'The process took longer than expected' },
        'please try again': { es: 'Por favor, intenta nuevamente', en: 'Please try again' },
        'there are connection issues': { es: 'Hay problemas de conexión', en: 'There are connection issues' },
        'try reloading the page in a few minutes': { es: 'Intenta recargar la página en unos minutos', en: 'Try reloading the page in a few minutes' },
        'sorry, there was a problem': { es: 'Lo siento, hubo un problema', en: 'Sorry, there was a problem' },
        
        // Frases comunes
        'that includes': { es: 'que incluye', en: 'that includes' },
        'with the following characteristics': { es: 'con las siguientes características', en: 'with the following characteristics' },
        'based on your description': { es: 'Basado en tu descripción', en: 'Based on your description' },
        'i have generated': { es: 'He generado', en: 'I have generated' },
        'according to your specifications': { es: 'según tus especificaciones', en: 'according to your specifications' },
      };

      let translatedContent = content;
      
      // Aplicar traducciones bidireccionales
      for (const [key, values] of Object.entries(translations)) {
        if (targetLanguage === 'es') {
          // Traducir de inglés a español
          const regex = new RegExp(values.en, 'gi');
          translatedContent = translatedContent.replace(regex, values.es);
        } else {
          // Traducir de español a inglés
          const regex = new RegExp(values.es, 'gi');
          translatedContent = translatedContent.replace(regex, values.en);
        }
      }

      return translatedContent;
    } catch (error) {
      console.error('Error traduciendo mensaje:', error);
      return content; // Retornar el contenido original si falla la traducción
    }
  };

  // 🎯 TIPO POR DEFECTO - SIEMPRE GENERAR 2D Y 3D
  const DEFAULT_TYPE = "both"; // Siempre generar ambos tipos
  const DEFAULT_TYPES: DesignType[] = [
    {
      type: "both",
      label: "Diseño Completo 2D + 3D",
      description: "Planos arquitectónicos y modelo 3D",
      features: ["svg", "stl"], // SVG para 2D y STL para 3D
    },
  ];

  // 🎯 CONFIGURACIÓN INICIAL
  useEffect(() => {
    console.log("🚀 Inicializando componente Chat");
    setAvailableTypes(DEFAULT_TYPES);
    loadDesignTypes();

    if (designId) {
      console.log("📂 Cargando diseño existente:", designId);
      loadExistingDesign(designId);
      setHasStarted(true);
    } else {
      console.log("👋 Iniciando chat nuevo");
      const userName = user?.name || user?.username || "Usuario";
      const welcomeMessage = {
        uuid: generateUUID(),
        role: "assistant" as const,
        content: t('chat.welcome', { name: userName }),
        status: "completed" as const,
        createdAt: new Date().toISOString(),
      };
      console.log("🤖 Agregando mensaje de bienvenida:", welcomeMessage.content);
      setMessages([welcomeMessage]);
    }
  }, [designId, user]);

  // 📏 NUEVO: Auto-resize del textarea cuando cambia el mensaje
  useEffect(() => {
    if (inputRef.current) {
      const textarea = inputRef.current;
      
      // Aplicar el mismo lógica que en handleTextareaChange
      textarea.style.height = '44px';
      
      if (textarea.value.trim()) {
        const scrollHeight = textarea.scrollHeight;
        const lineHeight = 22;
        const padding = 16;
        const maxLines = 6;
        const maxHeight = (lineHeight * maxLines) + padding;
        
        if (scrollHeight <= maxHeight) {
          textarea.style.height = `${scrollHeight}px`;
        } else {
          textarea.style.height = `${maxHeight}px`;
          textarea.style.overflowY = 'auto';
        }
      } else {
        textarea.style.height = '44px';
        textarea.style.overflowY = 'hidden';
      }
    }
  }, [currentMessage]);

  // 🔧 NUEVO: Inicializar textarea al montar el componente
  useEffect(() => {
    if (inputRef.current) {
      const textarea = inputRef.current;
      textarea.style.height = '44px';
      textarea.style.overflowY = 'hidden';
    }
  }, []);

  // 💡 NUEVO: Efecto para rotar tips cada 15 segundos
  useEffect(() => {
    const tipInterval = setInterval(() => {
      setCurrentTipIndex(prevIndex => 
        prevIndex === designTips.length - 1 ? 0 : prevIndex + 1
      );
    }, 15000); // Cambiar cada 15 segundos

    return () => clearInterval(tipInterval);
  }, [designTips.length]);

  // 🌐 TRADUCIR MENSAJES EXISTENTES CUANDO CAMBIA EL IDIOMA - SIMPLIFICADO
  useEffect(() => {
    // TEMPORALMENTE DESHABILITADO PARA MANTENER FLUJO DE CONVERSACIÓN
    // La traducción automática interfiere con el mantenimiento de mensajes
    // TODO: Implementar traducción que no sobrescriba el historial
    
    // const translateExistingMessages = async () => {
    //   const messagesToTranslate = messages.filter(msg => msg.role === 'assistant');
    //   
    //   if (messagesToTranslate.length === 0) return;
    //   
    //   setIsTranslating(true);
    //   
    //   const translatedMessages = await Promise.all(
    //     messages.map(async (msg) => {
    //       if (msg.role === 'assistant') {
    //         const originalContent = getOriginalContent(msg.content);
    //         const translatedContent = await translateAIMessage(originalContent, language);
    //         const marker = language === 'es' ? ' 🌍' : ' 🌐';
    //         return { ...msg, content: translatedContent + marker };
    //       }
    //       return msg;
    //     })
    //   );
    //   
    //   setMessages(translatedMessages);
    //   setIsTranslating(false);
    // };
    // 
    // if (messages.length > 0) {
    //   translateExistingMessages();
    // }
  }, [language]); // Ejecutar cuando cambie el idioma

  const loadDesignTypes = async () => {
    try {
      console.log("🔍 Iniciando carga de tipos de diseño...");

      const response = await axios.get<ApiResponse<DesignTypesResponse>>(
        "http://localhost:5000/design-types",
        {
          withCredentials: true,
          timeout: 10000,
        }
      );

      console.log("📊 Respuesta completa:", response.data);

      if (
        response.data &&
        response.data.success &&
        response.data.data &&
        response.data.data.types
      ) {
        let typesArray: DesignType[] = [];

        if (
          typeof response.data.data.types === "object" &&
          !Array.isArray(response.data.data.types)
        ) {
          console.log("ℹ️ Transformando objeto de tipos a array");

          typesArray = Object.entries(response.data.data.types).map(
            ([type, data]) => {
              if (typeof data === "object" && data !== null) {
                const typeData = data as any;

                return {
                  type: type,
                  label: typeData.label || type.toUpperCase(),
                  description: typeData.description || `Diseño tipo ${type}`,
                  features: Array.isArray(typeData.features)
                    ? typeData.features
                    : [],
                };
              }

              return {
                type: type,
                label: type.toUpperCase(),
                description: `Diseño tipo ${type}`,
                features: [],
              };
            }
          );
        } else if (Array.isArray(response.data.data.types)) {
          typesArray = response.data.data.types;
        }

        if (typesArray.length > 0) {
          console.log("✅ Tipos procesados correctamente:", typesArray);
          setAvailableTypes(typesArray);
          return;
        }
      }

      console.warn("⚠️ Estructura de respuesta inválida:", response.data);
      console.info("🔄 Usando tipos por defecto:", DEFAULT_TYPES);
      setAvailableTypes(DEFAULT_TYPES);
    } catch (err: any) {
      console.error("❌ Error cargando tipos:", err);
      console.info("🔄 Usando tipos por defecto:", DEFAULT_TYPES);
      setAvailableTypes(DEFAULT_TYPES);
    }
  };

  // 🔄 CARGAR DISEÑO EXISTENTE
  const loadExistingDesign = async (designUuid: string) => {
    try {
      const response = await axios.get<ApiResponse<MessagesResponse>>(
        `http://localhost:5000/designs/${designUuid}/messages`,
        { withCredentials: true }
      );

      if (response.data.success && response.data.data?.messages) {
        const backendMessages = response.data.data.messages;
        console.log(`📥 Cargando ${backendMessages.length} mensajes del backend para diseño: ${designUuid}`);
        
        // 🔍 DIAGNÓSTICO: Ver qué mensajes tienen structuralData
        backendMessages.forEach((msg, index) => {
          const metadataKeys = msg.metadata ? Object.keys(msg.metadata) : [];
          console.log(`📋 Mensaje ${index + 1}:`, {
            role: msg.role,
            hasMetadata: !!msg.metadata,
            hasStructuralData: !!msg.metadata?.structuralData,
            metadataKeys: metadataKeys,
            first10Keys: metadataKeys.slice(0, 10),
            hasRooms: !!msg.metadata?.rooms,
            hasWalls: !!msg.metadata?.walls,
          });
          
          // Imprimir first10Keys directamente
          console.log(`🔑 First 10 keys:`, metadataKeys.slice(0, 10));
          console.log(`🏠 hasRooms:`, !!msg.metadata?.rooms);
          console.log(`🧱 hasWalls:`, !!msg.metadata?.walls);
        });
        
        // CRÍTICO: Solo cargar si no hay mensajes previos, sino combinar
        setMessages((currentMessages) => {
          if (currentMessages.length === 0) {
            // Si no hay mensajes actuales, cargar todos del backend
            console.log("🆕 Cargando mensajes desde cero");
            const sortedMessages = backendMessages.sort((a, b) =>
              new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
            );
            return ensureRenderMessage(sortedMessages);
          } else {
            // Si ya hay mensajes, combinar sin duplicados
            console.log("🔄 Combinando mensajes existentes con backend");
            const allMessagesMap = new Map();
            
            // Agregar mensajes actuales
            currentMessages.forEach(msg => allMessagesMap.set(msg.uuid, msg));
            
            // Agregar/actualizar con mensajes del backend
            backendMessages.forEach(msg => allMessagesMap.set(msg.uuid, msg));
            
            const combinedMessages = Array.from(allMessagesMap.values());
            const sortedMessages = combinedMessages.sort((a, b) =>
              new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
            );
            return ensureRenderMessage(sortedMessages);
          }
        });
      }

      try {
        const designResponse = await axios.get<ApiResponse<GetDesignData>>(
          `http://localhost:5000/designs/${designUuid}`,
          { withCredentials: true }
        );

        if (designResponse.data.success && designResponse.data.data) {
          const design = designResponse.data.data.design;
          setDesignData({
            uuid: design.uuid,
            title: design.title,
            type: design.type,
            status: design.status === "active" ? "generating" : "ready",
            files:
              design.files?.map((file) => ({
                type: file.fileType,
                status: file.status as "generating" | "ready" | "error",
                url: file.downloadUrl,
                progress: file.status === "ready" ? 100 : 50,
              })) || [],
          });
        }
      } catch (designError) {
        console.log("Error cargando datos del diseño:", designError);
      }
    } catch (error) {
      console.error("Error cargando mensajes:", error);
      setMessages([
        {
          uuid: generateUUID(),
          role: "assistant",
          content: t('chat.loadError'),
          status: "error",
          createdAt: new Date().toISOString(),
        },
      ]);
    }
  };

  // � GUARDAR MENSAJES EN EL BACKEND
  const saveMessagesToBackend = async (designUuid: string, messages: Message[]) => {
    try {
      // Filtrar mensajes de acción de render (se regeneran dinámicamente)
      // Y mensajes de bienvenida (no son parte de la conversación del diseño)
      const messagesToSave = messages.filter(msg => {
        // Excluir mensajes de render action
        if (msg.metadata?.renderAction === "open_render") return false;
        
        // Excluir mensaje de bienvenida
        if (msg.role === "assistant" && msg.content.includes("👋")) return false;
        
        return true;
      });

      if (messagesToSave.length === 0) return;

      console.log(`💾 Guardando ${messagesToSave.length} mensajes en backend para diseño ${designUuid}`);

      await axios.post(
        `http://localhost:5000/designs/${designUuid}/messages/bulk`,
        { messages: messagesToSave },
        { withCredentials: true }
      );

      console.log("✅ Mensajes guardados exitosamente");
    } catch (error) {
      console.error("❌ Error guardando mensajes:", error);
      // No lanzar error, solo loguear
    }
  };

  // �💬 ENVIAR MENSAJE DIRECTO - CON VALIDACIÓN ARQUITECTÓNICA
  const handleSendMessage = async () => {
    if (!currentMessage.trim() || isGenerating) return;

    // 🛡️ VALIDACIÓN DE CONTEXTO ARQUITECTÓNICO
    const validation = validateArchitecturalContext(currentMessage.trim());
    
    if (!validation.isValid) {
      // Crear mensaje de error del asistente con ejemplos
      const examples = validation.suggestions || ArchitecturalValidator.getValidExamples().slice(0, 4);
      const examplesText = examples.map(example => `• "${example}"`).join('\n');
      
      const errorMessage: Message = {
        uuid: generateUUID(),
        role: "assistant",
        content: `🤖 ${validation.reason}\n\n💡 Ejemplos de solicitudes válidas:\n${examplesText}\n\n🎨 También puedes usar el Asistente de Diseño Visual haciendo clic en el botón ⚙️ para configurar tu proyecto paso a paso.`,
        status: "completed",
        createdAt: new Date().toISOString(),
      };

      setMessages((prev) => [...prev, errorMessage]);
      setCurrentMessage(""); // Limpiar el input
      return; // No procesar la solicitud
    }

    const userMessage: Message = {
      uuid: generateUUID(),
      role: "user",
      content: currentMessage.trim(),
      status: "completed",
      createdAt: new Date().toISOString(),
    };

    console.log("👤 Agregando mensaje del usuario:", userMessage.content);
    console.log("✅ Mensaje validado como contexto arquitectónico válido");
    setMessages((prev) => {
      const newMessages = [...prev, userMessage];
      console.log(`📊 Total de mensajes después de agregar usuario: ${newMessages.length}`);
      console.log(`📋 Historial completo:`, newMessages.map(m => `${m.role}: ${m.content.substring(0, 30)}...`));
      return newMessages;
    });
    
    const messageToSend = currentMessage;
    setCurrentMessage("");
    setIsGenerating(true);

    try {
      let targetDesignId = designId;

      // 🆕 Si es el primer mensaje, crear diseño automáticamente con tipo "both"
      if (!hasStarted) {
        const designType = DEFAULT_TYPE; // Siempre "both"

        try {
          const promptData = {
            prompt: {
              userDescription: messageToSend,
              requirements: {
                totalArea: extractAreaFromMessage(messageToSend) || 100,
                rooms: extractRoomsFromMessage(messageToSend),
                style: extractStyleFromMessage(messageToSend) || "moderno",
                specialFeatures: extractFeaturesFromMessage(messageToSend),
              },
              context: {
                designType: designType,
                complexity: "medium",
                priority: "quality",
                fileTypes: ["svg", "stl"], // SVG y STL
              },
            },
          };

          console.log("🚀 Enviando datos al backend:", promptData);

          const createResponse = await axios.post<ApiResponse<CreateDesignData>>(
            "http://localhost:5000/designs",
            promptData,
            {
              withCredentials: true,
              timeout: 1200000,
            }
          );

          console.log("🔍 Respuesta completa del backend:", createResponse.data);

          if (createResponse.data.success && createResponse.data.data) {
            const designData = createResponse.data.data.design;
            const firstMessage = createResponse.data.data.firstMessage;

            if (!designData || !designData.uuid) {
              console.error("❌ Datos de diseño inválidos:", createResponse.data);
              throw new Error("Estructura de respuesta inválida: falta información del diseño");
            }

            targetDesignId = designData.uuid;
            navigate(`/design/${targetDesignId}`, { replace: true });
            setHasStarted(true);

            // Agregar mensaje inicial del backend si existe, sino crear uno
            if (firstMessage) {
              const hasStructuralData = !!firstMessage.metadata?.structuralData;
              const normalizedFirstMessage: Message = hasStructuralData
                ? {
                    ...firstMessage,
                    metadata: {
                      ...firstMessage.metadata,
                      renderMode: "none",
                    },
                  }
                : firstMessage;

              setMessages((prev) => {
                const nextMessages = [...prev, normalizedFirstMessage];
                if (hasStructuralData) {
                  nextMessages.push(
                    buildRenderMessage(
                      firstMessage.metadata?.structuralData,
                      normalizedFirstMessage.createdAt
                    )
                  );
                }
                
                // 🔥 GUARDAR TODOS LOS MENSAJES EN EL BACKEND
                saveMessagesToBackend(designData.uuid, nextMessages);
                
                return nextMessages;
              });

              if (hasStructuralData) {
                // Mantener archivos como pendientes, sin monitoreo por ahora
                setDesignData({
                  uuid: targetDesignId,
                  title: designData.title,
                  type: designData.type,
                  status: "generating",
                  files: [
                    { type: "svg", status: "generating", progress: 0 },
                    { type: "stl", status: "generating", progress: 0 }
                  ],
                });
                setIsGenerating(false);
              } else {
                // Sin structuralData, usar flujo tradicional de archivos
                setDesignData({
                  uuid: targetDesignId,
                  title: designData.title,
                  type: designData.type,
                  status: "generating",
                  files: [
                    { type: "svg", status: "generating", progress: 0 },
                    { type: "stl", status: "generating", progress: 0 }
                  ],
                });
                // 🚀 INICIAR MONITOREO DE ARCHIVOS
                console.log("🔍 Iniciando monitoreo de archivos para:", targetDesignId);
                startProgressMonitoring(targetDesignId);
              }
            } else {
              const confirmationMessage: Message = {
                uuid: generateUUID(),
                role: "assistant",
                content: `✅ Perfecto! He comenzado a generar tu diseño arquitectónico completo que incluye:\n\n🎨 **Plano 2D** (SVG) - Planos arquitectónicos vectoriales\n🏗️ **Modelo 3D** (STL) - Modelo tridimensional imprimible\n\nLos archivos estarán listos en unos momentos...`,
                status: "completed",
                createdAt: new Date().toISOString(),
              };
              setMessages((prev) => [...prev, confirmationMessage]);
              
              // Caso fallback: no hay structuralData, esperar archivos
              setDesignData({
                uuid: targetDesignId,
                title: designData.title,
                type: designData.type,
                status: "generating",
                files: [
                  { type: "svg", status: "generating", progress: 0 },
                  { type: "stl", status: "generating", progress: 0 }
                ],
              });
              console.log("🔍 Iniciando monitoreo de archivos (fallback)");
              startProgressMonitoring(targetDesignId);
            }

          } else {
            console.error("❌ Respuesta del servidor sin datos:", createResponse.data);
            throw new Error("Respuesta del servidor inválida");
          }

        } catch (createError: any) {
          console.error("❌ Error creando diseño:", createError);

          if (
            createError.code === "ECONNABORTED" ||
            createError.message.includes("timeout")
          ) {
            console.log("⏰ Timeout en creación, pero continuando con monitoreo...");

            const processingMessage: Message = {
              uuid: generateUUID(),
              role: "assistant",
              content: t('chat.processingBackground'),
              status: "processing",
              createdAt: new Date().toISOString(),
            };

            setMessages((prev) => [...prev, processingMessage]);

            setTimeout(() => {
              setIsGenerating(false);
              setMessages((prev) => [
                ...prev.filter(m => m.status !== "processing"),
                {
                  uuid: generateUUID(),
                  role: "assistant",
                  content: t('chat.processDelayed'),
                  status: "error",
                  createdAt: new Date().toISOString(),
                },
              ]);
            }, 10000);
          } else {
            throw createError;
          }
        }
      }

      // Si ya tenemos un designId, solo enviar el mensaje
      if (targetDesignId && hasStarted) {
        try {
          await axios.post<ApiResponse<MessageData>>(
            `http://localhost:5000/designs/${targetDesignId}/messages`,
            {
              content: messageToSend,
              role: "user",
            },
            {
              withCredentials: true,
              timeout: 15000,
            }
          );

          console.log("✅ Mensaje enviado para procesamiento");
          startProgressMonitoring(targetDesignId);
        } catch (messageError: any) {
          console.error("❌ Error enviando mensaje:", messageError);
          
          // 🛡️ Manejo específico de errores de validación para mensajes existentes
          if (messageError.response?.status === 400 && messageError.response?.data?.action === 'validation_failed') {
            const validationMessage: Message = {
              uuid: generateUUID(),
              role: "assistant",
              content: messageError.response.data.data.message.content,
              status: "completed",
              createdAt: new Date().toISOString(),
            };

            setMessages((prev) => [...prev, validationMessage]);
            setIsGenerating(false);
            return;
          }
          
          console.log("⏱️ Error enviando mensaje, iniciando monitoreo de todas formas");
          startProgressMonitoring(targetDesignId);
        }
      }
    } catch (error: any) {
      console.error("❌ Error general:", error);

      // 🛡️ Manejo específico de errores de validación
      if (error.response?.status === 400 && error.response?.data?.action === 'validation_failed') {
        const validationMessage: Message = {
          uuid: generateUUID(),
          role: "assistant",
          content: error.response.data.data.message.content,
          status: "completed",
          createdAt: new Date().toISOString(),
        };

        setMessages((prev) => [...prev, validationMessage]);
        setIsGenerating(false);
        return;
      }

      const errorMessage: Message = {
        uuid: generateUUID(),
        role: "assistant",
        content: t('chat.generalError', {
          error: error.response?.data?.message || error.message || "Error desconocido"
        }),
        status: "error",
        createdAt: new Date().toISOString(),
      };

      setMessages((prev) => [...prev, errorMessage]);
      setIsGenerating(false);
    }
  };

  // 🔧 FUNCIONES AUXILIARES PARA EXTRAER DATOS DEL MENSAJE
  const extractAreaFromMessage = (message: string): number | null => {
    const areaMatch = message.match(/(\d+)\s*(m²|metros|m2|metro)/i);
    return areaMatch ? parseInt(areaMatch[1]) : null;
  };

  const extractRoomsFromMessage = (
    message: string
  ): Array<{ type: string; count: number }> => {
    const rooms = [];

    const habitacionMatch = message.match(
      /(\d+)\s*(habitacion|dormitorio|cuarto|habitaciones)/i
    );
    if (habitacionMatch) {
      rooms.push({ type: "habitación", count: parseInt(habitacionMatch[1]) });
    }

    const bañoMatch = message.match(/(\d+)\s*(baño|aseo|baños)/i);
    if (bañoMatch) {
      rooms.push({ type: "baño", count: parseInt(bañoMatch[1]) });
    }

    const cocinarMatch = message.match(/(\d+)?\s*(cocina|cocinas)/i);
    if (cocinarMatch) {
      rooms.push({
        type: "cocina",
        count: cocinarMatch[1] ? parseInt(cocinarMatch[1]) : 1,
      });
    }

    const salaMatch = message.match(/(\d+)?\s*(sala|living)/i);
    if (salaMatch) {
      rooms.push({
        type: "sala",
        count: salaMatch[1] ? parseInt(salaMatch[1]) : 1,
      });
    }

    return rooms.length > 0 ? rooms : [{ type: "habitación", count: 2 }];
  };

  const extractStyleFromMessage = (message: string): string => {
    const styles = [
      "moderno",
      "clásico",
      "minimalista",
      "contemporáneo",
      "tradicional",
      "rústico",
    ];
    const lowerMessage = message.toLowerCase();
    return styles.find((style) => lowerMessage.includes(style)) || "moderno";
  };

  const extractFeaturesFromMessage = (message: string): string[] => {
    const features = [];
    const lowerMessage = message.toLowerCase();

    if (lowerMessage.includes("cocina abierta")) features.push("cocina abierta");
    if (lowerMessage.includes("terraza")) features.push("terraza");
    if (lowerMessage.includes("jardín")) features.push("jardín");
    if (lowerMessage.includes("garaje")) features.push("garaje");
    if (lowerMessage.includes("piscina")) features.push("piscina");
    if (lowerMessage.includes("balcón")) features.push("balcón");
    if (lowerMessage.includes("vestidor")) features.push("vestidor");
    if (lowerMessage.includes("estudio")) features.push("estudio");

    return features;
  };

  // 🔄 CONVERTIR ARCHIVOS A OTROS FORMATOS
  const handleConvertFiles = async (fromFormat: string, toFormat: string) => {
    if (!designData?.uuid) return;

    try {
      const response = await axios.post<ApiResponse<ConvertResponse>>(
        `http://localhost:5000/designs/${designData.uuid}/convert`,
        {
          fromFormat,
          toFormat,
          conversionType: "format_change",
          options: {
            quality: "high",
            includeTextures: true,
          },
        },
        { withCredentials: true }
      );

      if (response.data.success) {
        const conversionMessage: Message = {
          uuid: generateUUID(),
          role: "assistant",
          content: t('chat.conversionStarted', {
            from: fromFormat.toUpperCase(),
            to: toFormat.toUpperCase()
          }),
          status: "completed",
          createdAt: new Date().toISOString(),
        };

        setMessages((prev) => [...prev, conversionMessage]);

        setDesignData((prev) =>
          prev
            ? {
                ...prev,
                files: [
                  ...(prev.files || []),
                  {
                    type: toFormat,
                    status: "generating",
                    progress: 0,
                  },
                ],
              }
            : null
        );
      }
    } catch (error) {
      console.error("Error convirtiendo archivos:", error);
    }
  };

  // 📊 MONITOREO DE PROGRESO MEJORADO
  const startProgressMonitoring = (designUuid: string) => {
    console.log("🔍 Iniciando monitoreo mejorado para:", designUuid);

    setIsGenerating(true);

    let monitoringActive = true;
    let consecutiveErrors = 0;
    let lastMessageCount = 0; // INICIAR EN 0 para detectar TODOS los mensajes del backend
    let checkCount = 0;

    const checkDesignStatus = async () => {
      if (!monitoringActive) return;

      checkCount++;
      console.log(`🔍 Verificación ${checkCount} para diseño: ${designUuid}`);

      try {
        // 1. Verificar mensajes nuevos
        const messagesResponse = await axios.get<ApiResponse<MessagesResponse>>(
          `http://localhost:5000/designs/${designUuid}/messages`,
          {
            withCredentials: true,
            timeout: 8000,
          }
        );

        if (
          messagesResponse.data.success &&
          messagesResponse.data.data?.messages
        ) {
          const newMessages = messagesResponse.data.data.messages;

          if (newMessages.length !== lastMessageCount) {
            console.log(
              `💬 Sincronizando mensajes: Backend: ${newMessages.length}, Local: ${lastMessageCount}`
            );
            
            // Actualizar contador de mensajes
            lastMessageCount = newMessages.length;

            // CRÍTICO: SIEMPRE sincronizar con el backend
            setMessages((currentMessages) => {
              console.log(`📝 Mensajes actuales: ${currentMessages.length}`);
              console.log(`📨 Mensajes del backend: ${newMessages.length}`);
              
              // Crear un mapa de todos los mensajes del backend por UUID
              const backendMessagesMap = new Map();
              newMessages.forEach(msg => backendMessagesMap.set(msg.uuid, msg));
              
              // Crear un mapa de mensajes actuales por UUID
              const currentMessagesMap = new Map();
              currentMessages.forEach(msg => currentMessagesMap.set(msg.uuid, msg));
              
              // Combinar todos los mensajes sin duplicados
              const allMessagesMap = new Map();
              
              // Primero agregar mensajes actuales
              currentMessages.forEach(msg => allMessagesMap.set(msg.uuid, msg));
              
              // Luego agregar/actualizar con mensajes del backend
              newMessages.forEach(msg => allMessagesMap.set(msg.uuid, msg));
              
              // Convertir de vuelta a array y ordenar cronológicamente
              const combinedMessages = Array.from(allMessagesMap.values());
              const sortedMessages = combinedMessages.sort((a, b) => 
                new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
              );
              
              console.log(`🔄 Mensajes finales: ${sortedMessages.length}`);
              console.log(`📋 Roles: ${sortedMessages.map(m => `${m.role}(${m.content.substring(0, 30)}...)`).join(', ')}`);
              
              return sortedMessages;
            });

            consecutiveErrors = 0;
          }
        }

        // 2. Verificar estado del diseño
        const designResponse = await axios.get<ApiResponse<GetDesignData>>(
          `http://localhost:5000/designs/${designUuid}`,
          {
            withCredentials: true,
            timeout: 8000,
          }
        );

        if (designResponse.data.success && designResponse.data.data) {
          const design = designResponse.data.data.design;

          setDesignData((prev) =>
            prev
              ? {
                  ...prev,
                  status: design.status === "active" ? "generating" : "ready",
                  files:
                    design.files?.map((file) => ({
                      type: file.fileType,
                      status: file.status as "generating" | "ready" | "error",
                      url: file.downloadUrl,
                      progress:
                        file.status === "ready"
                          ? 100
                          : file.status === "generating"
                          ? Math.min(90, 20 + checkCount * 5)
                          : 0,
                    })) || [],
                }
              : null
          );

          const allFilesReady = design.files?.every(
            (f) => f.status === "ready"
          );
          const hasFiles = design.files && design.files.length > 0;
          const designCompleted =
            design.status === "completed" || design.status === "ready";

          if ((allFilesReady && hasFiles) || designCompleted) {
            console.log("✅ Diseño completado. Deteniendo monitoreo.");
            monitoringActive = false;
            setIsGenerating(false);

          }
        }

        consecutiveErrors = 0;
      } catch (error: any) {
        consecutiveErrors++;
        console.error(`❌ Error en monitoreo (${consecutiveErrors}/3):`, error);

        if (consecutiveErrors >= 3) {
          console.log("⚠️ Demasiados errores. Deteniendo monitoreo.");
          monitoringActive = false;
          setIsGenerating(false);

          setMessages((prev) => [
            ...prev,
            {
              uuid: generateUUID(),
              role: "assistant",
              content: t('chat.connectionIssues'),
              status: "error",
              createdAt: new Date().toISOString(),
            },
          ]);
        }
      }
    };

    checkDesignStatus();

    const interval = setInterval(() => {
      if (monitoringActive) {
        checkDesignStatus();
      } else {
        clearInterval(interval);
      }
    }, 4000);

    setTimeout(() => {
      if (monitoringActive) {
        monitoringActive = false;
        clearInterval(interval);
        setIsGenerating(false);

        setMessages((prev) => [
          ...prev,
          {
            uuid: generateUUID(),
            role: "assistant",
            content: t('chat.processTimeout'),
            status: "completed",
            createdAt: new Date().toISOString(),
          },
        ]);
      }
    }, 300000); // 5 minutos para procesamiento NLP complejo
  };

  // 🔧 FUNCIONES AUXILIARES
  const detectDesignType = (message: string): string => {
    const lower = message.toLowerCase();
    if (
      lower.includes("3d") ||
      lower.includes("modelo") ||
      lower.includes("render")
    ) {
      return "3d";
    } else if (
      lower.includes("plano") ||
      lower.includes("dwg") ||
      lower.includes("2d")
    ) {
      return "2d";
    } else if (
      lower.includes("completo") ||
      lower.includes("todo") ||
      lower.includes("ambos")
    ) {
      return "both";
    }
    return "2d";
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage(); // Directo, sin selector
    }
  };

  // 📏 NUEVA: Función para auto-resize del textarea
  const handleTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const textarea = e.target;
    setCurrentMessage(textarea.value);
    
    // Auto-resize del textarea - mejorado
    textarea.style.height = '44px'; // Altura mínima base
    
    // Si hay contenido, calcular la altura necesaria
    if (textarea.value.trim()) {
      const scrollHeight = textarea.scrollHeight;
      const lineHeight = 22; // Altura aproximada por línea
      const padding = 16; // Padding top + bottom
      const maxLines = 6; // Máximo 6 líneas
      const maxHeight = (lineHeight * maxLines) + padding;
      
      if (scrollHeight <= maxHeight) {
        textarea.style.height = `${scrollHeight}px`;
      } else {
        textarea.style.height = `${maxHeight}px`;
        textarea.style.overflowY = 'auto';
      }
    } else {
      // Si no hay contenido, mantener altura mínima
      textarea.style.height = '44px';
      textarea.style.overflowY = 'hidden';
    }
  };

  const formatTime = (timestamp: string) => {
    return new Date(timestamp).toLocaleString("es-ES", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
      day: "2-digit",
      month: "short",
    });
  };

  const safeAvailableTypes = Array.isArray(availableTypes)
    ? availableTypes
    : DEFAULT_TYPES;

  const handleResetChat = () => {
    setIsGenerating(false);
    setCurrentMessage("");
    const userName = user?.name || user?.username || "Usuario";
    setMessages([
      {
        uuid: generateUUID(),
        role: "assistant",
        content: t('chat.resetWelcome', { name: userName }),
        status: "completed",
        createdAt: new Date().toISOString(),
      },
    ]);
  };

  // 🎨 Función para formatear mensajes con nombres en negrita
  const formatMessageContent = (content: string, isWelcomeMessage: boolean = false) => {
    if (isWelcomeMessage && content.includes('¡Hola')) {
      // Buscar el patrón de saludo y hacer todo el saludo bold
      const welcomePattern = /(¡Hola\s+[^!]+!\s*👋)/;
      const match = content.match(welcomePattern);
      
      if (match) {
        const [, fullGreeting] = match;
        const restOfMessage = content.replace(welcomePattern, '');
        
        return (
          <>
            <span className="chat-bold-text">{fullGreeting}</span>
            {restOfMessage}
          </>
        );
      }
    }
    
    // Para otros mensajes, retornar el contenido sin marcadores de traducción
    return content.replace(' 🌐', '');
  };

  // 🎨 NUEVA: Función para generar prompt desde configuración visual
  const generatePromptFromWizard = (): string => {
    const { buildingType, constructionArea, landArea, rooms, bathrooms, style, features, materials, budget, floors, parking, orientation, sustainability, smartHome, accessibility, location, climate } = wizardSettings;
    
    let prompt = `Diseñar un ${buildingType} de estilo ${style}`;
    
    // Áreas específicas
    if (constructionArea) {
      prompt += ` con ${constructionArea}m² de área construida`;
    }
    
    if (landArea) {
      prompt += ` en un terreno de ${landArea}m²`;
    }
    
    // Habitaciones y distribución
    prompt += ` con ${rooms} habitaciones y ${bathrooms} baños`;
    
    if (floors > 1) {
      prompt += `, distribuido en ${floors} pisos`;
    }
    
    // Estacionamiento
    if (parking > 0) {
      prompt += `, con ${parking} espacio${parking > 1 ? 's' : ''} de estacionamiento`;
    }
    
    // Características especiales
    if (features.length > 0) {
      prompt += `, incluyendo ${features.join(', ')}`;
    }
    
    // Materiales
    if (materials.length > 0) {
      prompt += `, utilizando materiales como ${materials.join(', ')}`;
    }
    
    // Ubicación y clima
    if (location) {
      prompt += `, ubicado en ${location}`;
    }
    
    if (climate !== 'templado') {
      prompt += `, adaptado para clima ${climate}`;
    }
    
    // Orientación
    if (orientation && orientation !== 'norte') {
      prompt += `, con orientación preferencial hacia el ${orientation}`;
    }
    
    // Características especiales
    if (sustainability) {
      prompt += `, con características sostenibles y tecnologías verdes`;
    }
    
    if (smartHome) {
      prompt += `, con integración de tecnología de hogar inteligente`;
    }
    
    if (accessibility) {
      prompt += `, con diseño universal para accesibilidad completa`;
    }
    
    // Presupuesto
    prompt += `. Presupuesto estimado: ${budget}.`;
    
    return prompt;
  };

  // 🎨 NUEVA: Función para aplicar configuración del wizard
  const handleApplyWizardSettings = () => {
    const validation = validateWizardSettings();
    
    if (!validation.isValid) {
      setValidationErrors(validation.errors);
      return;
    }
    
    setValidationErrors([]);
    const generatedPrompt = generatePromptFromWizard();
    setCurrentMessage(generatedPrompt);
    setShowPreview(true);
  };

  // 🎨 NUEVA: Función para enviar directamente
  const handleSendFromWizard = () => {
    const generatedPrompt = generatePromptFromWizard();
    setCurrentMessage(generatedPrompt);
    setShowDesignWizard(false);
    setShowPreview(false);
    
    // Enviar automáticamente después de un momento
    setTimeout(() => handleSendMessage(), 200);
  };

  // 🎨 NUEVA: Función para cancelar preview del wizard
  const handleCancelPreview = () => {
    setShowPreview(false);
    setValidationErrors([]);
  };

  // 📥 NUEVA: Función para descargar archivos
  const handleDownloadFile = async (downloadUrl: string) => {
    if (!downloadUrl) {
      console.error('❌ URL de descarga no disponible');
      return;
    }

    try {
      console.log('📥 Iniciando descarga:', downloadUrl);
      
      // Construir URL completa si es necesario
      const fullUrl = downloadUrl.startsWith('http') 
        ? downloadUrl 
        : `http://localhost:5000${downloadUrl}`;

      // Usar fetch para descargar con credenciales
      const response = await fetch(fullUrl, {
        method: 'GET',
        credentials: 'include',
        headers: {
          'Accept': '*/*',
        }
      });

      if (!response.ok) {
        throw new Error(`Error ${response.status}: ${response.statusText}`);
      }

      // Obtener el blob del archivo
      const blob = await response.blob();
      
      // Obtener el nombre del archivo desde el header o URL
      const contentDisposition = response.headers.get('Content-Disposition');
      let filename = 'archivo_descargado';
      
      if (contentDisposition && contentDisposition.includes('filename=')) {
        const matches = contentDisposition.match(/filename="?([^"]+)"?/);
        if (matches && matches[1]) {
          filename = matches[1];
        }
      } else {
        // Extraer nombre del archivo de la URL
        const urlParts = downloadUrl.split('/');
        const lastPart = urlParts[urlParts.length - 1];
        if (lastPart) {
          filename = lastPart;
        }
      }

      // Crear enlace de descarga
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      
      // Limpiar
      window.URL.revokeObjectURL(url);
      document.body.removeChild(link);
      
      console.log('✅ Descarga completada:', filename);

    } catch (error) {
      console.error('❌ Error descargando archivo:', error);
      
      // Fallback: abrir en nueva ventana
      try {
        const fullUrl = downloadUrl.startsWith('http') 
          ? downloadUrl 
          : `http://localhost:5000${downloadUrl}`;
        window.open(fullUrl, '_blank');
      } catch (fallbackError) {
        console.error('❌ Error en fallback:', fallbackError);
        alert('Error al descargar el archivo. Por favor, intenta nuevamente.');
      }
    }
  };

  // 🆕 NUEVA: Función para generar archivos 2D/3D con OpenAI NLP
  const handleGenerateNLP2D3D = async () => {
    if (!currentMessage.trim() || !designId || isGenerating) return;

    console.log('🎨 Iniciando generación NLP to 2D/3D con OpenAI...');

    // Validación arquitectónica
    const validation = validateArchitecturalContext(currentMessage.trim());
    
    if (!validation.isValid) {
      const errorMessage: Message = {
        uuid: generateUUID(),
        role: "assistant",
        content: `🤖 ${validation.reason}\n\n💡 Para generar archivos 2D/3D necesito una descripción arquitectónica válida con detalles específicos sobre espacios, distribución y características del diseño.`,
        status: "completed",
        createdAt: new Date().toISOString(),
      };

      setMessages((prev) => [...prev, errorMessage]);
      return;
    }

    const userMessage: Message = {
      uuid: generateUUID(),
      role: "user",
      content: `🎨 **[Generación NLP to 2D/3D]** ${currentMessage.trim()}`,
      status: "completed",
      createdAt: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, userMessage]);

    const processingMessage: Message = {
      uuid: generateUUID(),
      role: "assistant",
      content: "🚀 **Procesando con IA avanzada...**\n\n🤖 Analizando descripción con OpenAI GPT-4o-mini\n📊 Extrayendo datos estructurales\n🎯 Generando archivos SVG (2D) y STL (3D)\n\n⏳ Esto puede tomar unos momentos...",
      status: "processing",
      createdAt: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, processingMessage]);
    
    const messageToSend = currentMessage;
    setCurrentMessage("");
    setIsGenerating(true);

    try {
      const response = await axios.post<ApiResponse<any>>(
        `http://localhost:5000/chat/design/${designId}/nlp-files`,
        {
          content: messageToSend,
          generateFiles: true
        },
        {
          withCredentials: true,
          timeout: 300000, // 5 minutos para procesamiento NLP con OpenAI
        }
      );

      console.log('✅ Respuesta NLP to 2D/3D:', response.data);

      if (response.data.success) {
        // Actualizar mensaje de procesamiento a completado
        setMessages((prev) => 
          prev.map((msg) => 
            msg.uuid === processingMessage.uuid 
              ? { ...msg, status: "completed" as const }
              : msg
          )
        );

        // Agregar mensaje de éxito con detalles
        const { files, processingStats } = response.data.data;
        const successContent = `✅ **¡Archivos generados exitosamente!**\n\n🤖 **Procesamiento completado:**\n• Tiempo: ${processingStats.processingTime}ms\n• Habitaciones detectadas: ${processingStats.roomsCount}\n• Área total: ${processingStats.totalArea}m²\n\n📄 **Archivos disponibles:**\n${files.map((file: any) => `• ${file.fileType.toUpperCase()}: ${file.filename} (${(file.fileSize / 1024).toFixed(1)} KB)`).join('\n')}\n\n💾 Haz clic en los enlaces de descarga para obtener tus archivos.`;

        const successMessage: Message = {
          uuid: generateUUID(),
          role: "assistant",
          content: successContent,
          status: "completed",
          createdAt: new Date().toISOString(),
        };

        setMessages((prev) => [...prev, successMessage]);

        // Actualizar datos de archivos del diseño
        if (files && files.length > 0) {
          setDesignData((prev) => ({
            ...prev!,
            files: files.map((file: any) => ({
              type: file.fileType,
              status: "ready" as const,
              url: file.downloadUrl,
              progress: 100
            }))
          }));
        }

      } else {
        // Error en la respuesta
        throw new Error(response.data.message || 'Error en la generación');
      }

    } catch (error: any) {
      console.error('❌ Error en generación NLP to 2D/3D:', error);

      // Actualizar mensaje de procesamiento a error
      setMessages((prev) => 
        prev.map((msg) => 
          msg.uuid === processingMessage.uuid 
            ? { 
                ...msg, 
                status: "completed" as const,
                content: `❌ **Error en la generación**\n\nHubo un problema al procesar tu solicitud con el servicio de IA avanzada.\n\n🔄 **Recomendaciones:**\n• Verifica que la descripción incluya detalles arquitectónicos específicos\n• Intenta con una descripción más detallada\n• Puedes usar el chat normal para generar un plan básico\n\n🛠️ **Error técnico:** ${error.response?.data?.message || error.message || 'Error desconocido'}`
              }
            : msg
        )
      );
    } finally {
      setIsGenerating(false);
    }
  };

  // 🎨 NUEVA: Función para validar configuración del wizard
  const validateWizardSettings = (): { isValid: boolean; errors: string[] } => {
    const errors: string[] = [];
    const { constructionArea, landArea, rooms, bathrooms, floors, parking, budget } = wizardSettings;

    // Validaciones de áreas
    if (constructionArea && landArea) {
      const construction = parseInt(constructionArea);
      const land = parseInt(landArea);
      
      if (construction >= land) {
        errors.push('El área de construcción debe ser menor al área del terreno');
      }
      
      if (construction > land * 0.8) {
        errors.push('El área de construcción no puede exceder el 80% del terreno (regulaciones urbanas)');
      }
      
      if (land < 50) {
        errors.push('El terreno debe tener al menos 50m² para ser viable');
      }
    }

    // Validaciones de habitaciones vs baños
    if (bathrooms > rooms + 2) {
      errors.push('Demasiados baños para la cantidad de habitaciones seleccionadas');
    }

    if (rooms > 8 && floors === 1) {
      errors.push('Para más de 8 habitaciones se recomienda construir en más de un piso');
    }

    // Validaciones de estacionamiento vs terreno
    if (parking > 0 && landArea) {
      const land = parseInt(landArea);
      const requiredParkingArea = parking * 15; // 15m² por auto mínimo
      
      if (land < 100 && parking > 1) {
        errors.push('Terreno muy pequeño para múltiples espacios de estacionamiento');
      }
      
      if (constructionArea) {
        const construction = parseInt(constructionArea);
        if ((construction + requiredParkingArea) > land * 0.9) {
          errors.push('No hay suficiente espacio para la construcción y estacionamiento');
        }
      }
    }

    // Validaciones de presupuesto vs especificaciones
    if (budget === 'económico') {
      if (wizardSettings.features.includes('piscina')) {
        errors.push('Una piscina no es viable con presupuesto económico');
      }
      if (wizardSettings.smartHome) {
        errors.push('Casa inteligente requiere presupuesto medio o superior');
      }
      if (floors > 2) {
        errors.push('Construcción de 3+ pisos requiere presupuesto alto');
      }
    }

    // Validaciones de características vs espacio
    if (wizardSettings.features.includes('piscina') && landArea) {
      const land = parseInt(landArea);
      if (land < 150) {
        errors.push('Se necesitan al menos 150m² de terreno para incluir piscina');
      }
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  };

  // 🎨 NUEVA: Función para actualizar configuración del wizard
  const updateWizardSetting = (key: string, value: any) => {
    setWizardSettings(prev => ({
      ...prev,
      [key]: value
    }));
    
    // Limpiar errores cuando el usuario hace cambios
    if (validationErrors.length > 0) {
      setValidationErrors([]);
    }
  };

  // 🎨 NUEVA: Función para toggle de características
  const toggleWizardFeature = (feature: string) => {
    setWizardSettings(prev => ({
      ...prev,
      features: prev.features.includes(feature)
        ? prev.features.filter(f => f !== feature)
        : [...prev.features, feature]
    }));
  };

  // 🎨 NUEVA: Función para toggle de materiales
  const toggleWizardMaterial = (material: string) => {
    setWizardSettings(prev => ({
      ...prev,
      materials: prev.materials.includes(material)
        ? prev.materials.filter(m => m !== material)
        : [...prev.materials, material]
    }));
  };

  const openRenderModal = (structuralData: any) => {
    console.log("🎬 ABRIENDO RENDER MODAL CON DATOS:", {
      hasData: !!structuralData,
      type: typeof structuralData,
      keys: structuralData ? Object.keys(structuralData) : [],
      roomCount: structuralData?.rooms?.length || 0,
      wallCount: structuralData?.walls?.length || 0,
      fullData: structuralData
    });
    setRenderModalData(structuralData);
    setIsRenderModalOpen(true);
  };

  const closeRenderModal = () => {
    setIsRenderModalOpen(false);
  };

  const buildRenderMessage = (structuralData: any, anchorCreatedAt?: string): Message => {
    const baseTime = anchorCreatedAt ? new Date(anchorCreatedAt).getTime() : Date.now();
    return {
      uuid: generateUUID(),
      role: "assistant",
      content: "Ver renderizado",
      status: "completed",
      createdAt: new Date(baseTime + 1).toISOString(),
      metadata: {
        renderAction: "open_render",
        renderMode: "modal",
        structuralData: structuralData,
      },
    };
  };

  const ensureRenderMessage = (messages: Message[]): Message[] => {
    console.log("🔍 ensureRenderMessage: Verificando mensajes...", {
      totalMessages: messages.length,
      hasRenderAction: messages.some(msg => msg.metadata?.renderAction === "open_render"),
    });
    
    const hasRenderAction = messages.some(
      (msg) => msg.metadata?.renderAction === "open_render"
    );
    if (hasRenderAction) {
      console.log("✅ Ya existe mensaje de render action");
      return messages;
    }

    const source = messages.find((msg) => msg.metadata?.structuralData);
    console.log("🔍 Buscando structuralData:", {
      found: !!source,
      sourceRole: source?.role,
      hasStructuralData: !!source?.metadata?.structuralData,
    });
    
    if (!source || !source.metadata?.structuralData) {
      console.log("⚠️ No se encontró structuralData en ningún mensaje");
      return messages;
    }

    console.log("✅ Generando mensaje de render con structuralData");
    const renderMessage = buildRenderMessage(
      source.metadata.structuralData,
      source.createdAt
    );
    return [...messages, renderMessage].sort(
      (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    );
  };

  return (
    <div className="chat-component-app-container">
      <div className="chat-component-container">
        <div className="chat-component-section">
          <div className="chat-component-interface">
            <ScrollToBottom 
              className="chat-component-messages-container"
              followButtonClassName="chat-scroll-to-bottom"
              mode="bottom"
              checkInterval={100}
            >
              <div className="chat-component-messages">
                {(() => {
                  console.log(`🎨 Renderizando ${messages.length} mensajes en el chat`);
                  return null;
                })()}
                {messages.map((message, index) => {
                  console.log(`📝 Mensaje ${index + 1}: ${message.role} - ${message.content.substring(0, 50)}...`);
                  return (
                    <div
                      key={message.uuid}
                      className={`chat-component-message ${
                        message.role === "user" ? "chat-component-user-message" : "chat-component-ai-message"
                      }`}
                    >
                      <div className="chat-component-message-avatar">
                        {message.role === "user" ? (
                          <User size={20} />
                        ) : (
                          <Bot size={20} />
                        )}
                      </div>

                      <div className="chat-component-message-content">
                        {/* 🔥 ACCION PARA VER RENDERIZADO EN MODAL */}
                        {message.metadata?.renderAction === "open_render" &&
                          message.metadata?.structuralData ? (
                            <div className="chat-render-action">
                              <button
                                className="chat-render-button"
                                onClick={() =>
                                  openRenderModal(message.metadata?.structuralData)
                                }
                              >
                                Ver renderizado
                              </button>
                            </div>
                          ) : (
                            <div className="chat-component-message-text">
                              {message.role === 'assistant' && message.content.includes('¡Hola') ? 
                                formatMessageContent(message.content, true) :
                                formatMessageContent(message.content)
                              }
                              {message.role === 'assistant' && language !== 'es' && message.content.includes('🌐') && (
                                <span style={{ fontSize: '12px', opacity: 0.6, marginLeft: '8px' }}>
                                  🌐 Translated
                                </span>
                              )}
                            </div>
                          )}                        
                        {/* 🔥 VISUALIZACIÓN INSTANTÁNEA DEL PLANO 3D (INLINE SOLO SI SE PIDE) */}
                        {message.metadata?.structuralData &&
                          message.metadata?.renderMode === "inline" && (
                            <div className="chat-model-viewer-container" style={{ 
                              marginTop: '16px', 
                              border: '1px solid #e0e0e0', 
                              borderRadius: '8px', 
                              overflow: 'hidden',
                              backgroundColor: '#fff'
                            }}>
                              <PascalNativeViewer
                                pascalData={message.metadata.structuralData}
                              />
                            </div>
                          )}
                        
                        <div className="chat-component-message-time">
                          {formatTime(message.createdAt)}
                        </div>
                      </div>
                    </div>
                  );
                })}

                {/* 🎨 PROGRESO INTEGRADO EN EL CHAT */}
                {designData && (
                  <div className="chat-component-message chat-component-ai-message">
                    <div className="chat-component-message-avatar">
                      <Bot size={20} />
                    </div>
                    <div className="chat-component-message-content">
                      <div className="chat-component-integrated-progress">
                        <div className="chat-progress-header">
                          <h4>📐 {designData.title}</h4>
                          <span className="chat-progress-id">ID: {designData.uuid.substring(0, 8)}</span>
                        </div>
                        
                        <div className="chat-progress-status">
                          <div className={`chat-status-indicator ${designData.status}`}>
                            {designData.status === "generating" ? (
                              <>
                                <div className="chat-status-spinner"></div>
                                <span>Generando archivos...</span>
                              </>
                            ) : (
                              <>
                                <div className="chat-status-check">✓</div>
                                <span>Completado</span>
                              </>
                            )}
                          </div>
                        </div>

                        {designData.files && designData.files.length > 0 && (
                          <div className="chat-progress-files">
                            {designData.files.map((file, index) => (
                              <div key={index} className="chat-file-progress">
                                <div className="chat-file-info">
                                  <div className="chat-file-icon">
                                    {file.type === "svg" ? "🎨" : file.type === "stl" ? "🏗️" : "📄"}
                                  </div>
                                  <div className="chat-file-details">
                                    <span className="chat-file-name">
                                      {file.type === "svg" ? "Plano 2D" : file.type === "stl" ? "Modelo 3D" : file.type.toUpperCase()}
                                    </span>
                                    <span className="chat-file-type">
                                      {file.type.toUpperCase()}
                                    </span>
                                  </div>
                                </div>
                                
                                <div className="chat-file-status">
                                  {file.status === "generating" ? (
                                    <div className="chat-file-progress-bar">
                                      <div 
                                        className="chat-file-progress-fill"
                                        style={{ width: `${file.progress || 0}%` }}
                                      ></div>
                                      <span className="chat-file-progress-text">
                                        {file.progress || 0}%
                                      </span>
                                    </div>
                                  ) : file.status === "ready" ? (
                                    <button 
                                      className="chat-download-button"
                                      onClick={() => handleDownloadFile(file.url || '')}
                                    >
                                      📥 Descargar
                                    </button>
                                  ) : (
                                    <span className="chat-file-error">❌ Error</span>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Acciones rápidas integradas */}
                        {designData.status === "ready" && (
                          <div className="chat-quick-actions">
                            <button 
                              className="chat-action-button"
                              onClick={() => handleConvertFiles("svg", "pdf")}
                            >
                              � Convertir SVG a PDF
                            </button>
                            <button 
                              className="chat-action-button"
                              onClick={() => handleConvertFiles("stl", "obj")}
                            >
                              🎨 Convertir STL a OBJ
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {isGenerating && (
                  <div className="chat-component-message chat-component-ai-message chat-component-generating">
                    <div className="chat-component-message-avatar">
                      <Bot size={20} />
                    </div>
                    <div className="chat-component-message-content">
                      <div className="chat-component-message-text">
                        <div className="chat-component-typing-indicator">
                          <div className="chat-component-typing-dots">
                            <span></span>
                            <span></span>
                            <span></span>
                          </div>
                          <span className="chat-component-typing-text">
                            {t('chat.typing')}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </ScrollToBottom>

            {isRenderModalOpen && renderModalData && (
              <div className="chat-render-modal" onClick={closeRenderModal}>
                <div
                  className="chat-render-modal-content"
                  onClick={(event) => event.stopPropagation()}
                >
                  <div className="chat-render-modal-header">
                    <div className="chat-render-modal-title">Renderizado del Plano Arquitectonico</div>
                    <div className="chat-render-modal-actions">
                      <button
                        className="chat-render-modal-action chat-render-modal-close"
                        onClick={closeRenderModal}
                        title="Cerrar"
                        aria-label="Cerrar"
                        type="button"
                      >
                        <X size={16} />
                      </button>
                    </div>
                  </div>
                  <div className="chat-render-modal-body">
                    <div className="chat-render-modal-viewer-container">
                      <PascalNativeViewer pascalData={renderModalData} />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* 🔧 ÁREA DE INPUT SIMPLIFICADA */}
            <div className="chat-component-input-area">
              <div className="chat-component-input-container">
                {/* 🎨 NUEVO: Icono del wizard a la izquierda */}
                <button
                  onClick={() => {
                    setShowDesignWizard(!showDesignWizard);
                    setValidationErrors([]); // Limpiar errores al abrir
                  }}
                  className="chat-component-wizard-button"
                  title="Asistente de Diseño Visual"
                  type="button"
                >
                  <Palette size={18} />
                </button>

                <textarea
                  ref={inputRef}
                  value={currentMessage}
                  onChange={handleTextareaChange}
                  onKeyDown={handleKeyPress}
                  placeholder={t('chat.placeholder')}
                  className="chat-component-input"
                  rows={1}
                  disabled={isGenerating}
                  style={{ 
                    resize: 'none',
                    overflowY: 'hidden',
                    height: '44px',
                    lineHeight: '22px',
                    transition: 'height 0.1s ease'
                  }}
                />

                <button
                  onClick={handleSendMessage}
                  disabled={!currentMessage.trim() || isGenerating}
                  className="chat-component-send-button"
                >
                  {isGenerating ? (
                    <Loader2 size={20} className="chat-component-spinning" />
                  ) : (
                    <Send size={20} />
                  )}
                </button>

                {/* 🆕 NUEVO: Botón para generación NLP to 2D/3D con OpenAI */}
                {designId && !isGenerating && currentMessage.trim() && (
                  <button
                    onClick={handleGenerateNLP2D3D}
                    disabled={isGenerating}
                    className="chat-component-nlp-button"
                    title="Generar archivos 2D/3D con IA avanzada"
                  >
                    <Sparkles size={18} />
                  </button>
                )}

                {isGenerating && (
                  <button
                    onClick={handleResetChat}
                    className="chat-component-reset-button"
                    title={t('chat.resetTitle')}
                  >
                    <RefreshCw size={18} />
                  </button>
                )}
              </div>

              <div className="chat-component-input-help">
                <p>
                  💡 {designTips[currentTipIndex]}
                </p>
                {isGenerating && (
                  <p style={{ color: "#ff6b6b", fontSize: "12px" }}>
                    {t('chat.resetWarning')}
                  </p>
                )}
              </div>
            </div>

            {/* 🎨 NUEVO: Modal del Design Wizard */}
            {showDesignWizard && (
              <div className="chat-design-wizard-overlay">
                <div className="chat-design-wizard-modal">
                  <div className="chat-design-wizard-header">
                    <h3>🎨 Asistente de Diseño Visual</h3>
                    <button 
                      onClick={() => setShowDesignWizard(false)}
                      className="chat-design-wizard-close"
                    >
                      ×
                    </button>
                  </div>
                  
                  <div className="chat-design-wizard-content">
                    
                    {/* PASO 1: Información Básica */}
                    <div className="chat-wizard-step">
                      <h4>📋 Información Básica</h4>
                      
                      <div className="chat-wizard-section">
                        <label>Tipo de Proyecto:</label>
                        <div className="input-container">
                          <select 
                            value={wizardSettings.buildingType} 
                            onChange={(e) => updateWizardSetting('buildingType', e.target.value)}
                            className="chat-wizard-select"
                          >
                            <option value="casa">🏠 Casa Familiar</option>
                          <option value="departamento">🏢 Departamento</option>
                          <option value="oficina">🏢 Oficina</option>
                          <option value="local comercial">🏪 Local Comercial</option>
                          <option value="villa">🏘️ Villa</option>
                          <option value="duplex">🏘️ Duplex</option>
                        </select>
                        </div>
                      </div>

                      <div className="chat-wizard-row">
                        <div className="chat-wizard-col">
                          <label>🏗️ Área de Construcción:</label>
                          <div className="input-with-unit">
                            <input 
                              type="number" 
                              placeholder="150" 
                              value={wizardSettings.constructionArea} 
                              onChange={(e) => updateWizardSetting('constructionArea', e.target.value)}
                              className="chat-wizard-input"
                            />
                            <span className="unit">m²</span>
                          </div>
                        </div>
                        <div className="chat-wizard-col">
                          <label>🌍 Área del Terreno:</label>
                          <div className="input-with-unit">
                            <input 
                              type="number" 
                              placeholder="250" 
                              value={wizardSettings.landArea} 
                              onChange={(e) => updateWizardSetting('landArea', e.target.value)}
                              className="chat-wizard-input"
                            />
                            <span className="unit">m²</span>
                          </div>
                        </div>
                      </div>

                      <div className="chat-wizard-row">
                        <div className="chat-wizard-col">
                          <label>📍 Ubicación:</label>
                          <div className="input-container">
                            <input 
                              type="text" 
                              placeholder="Ciudad, País" 
                              value={wizardSettings.location} 
                              onChange={(e) => updateWizardSetting('location', e.target.value)}
                              className="chat-wizard-input"
                            />
                          </div>
                        </div>
                        <div className="chat-wizard-col">
                          <label>🌡️ Clima:</label>
                          <div className="input-container">
                            <select 
                              value={wizardSettings.climate} 
                              onChange={(e) => updateWizardSetting('climate', e.target.value)}
                              className="chat-wizard-select"
                            >
                              <option value="templado">Templado</option>
                              <option value="tropical">Tropical</option>
                              <option value="frío">Frío</option>
                              <option value="árido">Árido/Seco</option>
                              <option value="húmedo">Húmedo</option>
                            </select>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* PASO 2: Distribución */}
                    <div className="chat-wizard-step">
                      <h4>🏠 Distribución de Espacios</h4>
                      
                      <div className="chat-wizard-row">
                        <div className="chat-wizard-col">
                          <label>🛏️ Habitaciones:</label>
                          <div className="number-selector">
                            <button 
                              onClick={() => updateWizardSetting('rooms', Math.max(1, wizardSettings.rooms - 1))}
                              className="number-btn"
                            >-</button>
                            <span className="number-display">{wizardSettings.rooms}</span>
                            <button 
                              onClick={() => updateWizardSetting('rooms', Math.min(10, wizardSettings.rooms + 1))}
                              className="number-btn"
                            >+</button>
                          </div>
                        </div>
                        <div className="chat-wizard-col">
                          <label>🚿 Baños:</label>
                          <div className="number-selector">
                            <button 
                              onClick={() => updateWizardSetting('bathrooms', Math.max(1, wizardSettings.bathrooms - 1))}
                              className="number-btn"
                            >-</button>
                            <span className="number-display">{wizardSettings.bathrooms}</span>
                            <button 
                              onClick={() => updateWizardSetting('bathrooms', Math.min(5, wizardSettings.bathrooms + 1))}
                              className="number-btn"
                            >+</button>
                          </div>
                        </div>
                      </div>

                      <div className="chat-wizard-row">
                        <div className="chat-wizard-col">
                          <label>🏢 Pisos:</label>
                          <select 
                            value={wizardSettings.floors} 
                            onChange={(e) => updateWizardSetting('floors', parseInt(e.target.value))}
                            className="chat-wizard-select"
                          >
                            <option value={1}>1 Piso</option>
                            <option value={2}>2 Pisos</option>
                            <option value={3}>3 Pisos</option>
                          </select>
                        </div>
                        <div className="chat-wizard-col">
                          <label>🚗 Estacionamiento:</label>
                          <div className="number-selector">
                            <button 
                              onClick={() => updateWizardSetting('parking', Math.max(0, wizardSettings.parking - 1))}
                              className="number-btn"
                            >-</button>
                            <span className="number-display">{wizardSettings.parking}</span>
                            <button 
                              onClick={() => updateWizardSetting('parking', Math.min(4, wizardSettings.parking + 1))}
                              className="number-btn"
                            >+</button>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* PASO 3: Estilo */}
                    <div className="chat-wizard-step">
                      <h4>🎨 Estilo Arquitectónico</h4>
                      <div className="style-grid">
                        {['moderno', 'contemporáneo', 'clásico', 'minimalista', 'industrial', 'mediterráneo', 'rústico', 'colonial'].map(style => (
                          <button
                            key={style}
                            onClick={() => updateWizardSetting('style', style)}
                            className={`style-btn ${wizardSettings.style === style ? 'active' : ''}`}
                          >
                            <span className="style-name">{style.charAt(0).toUpperCase() + style.slice(1)}</span>
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* PASO 4: Características especiales */}
                    <div className="chat-wizard-step">
                      <h4>✨ Características Especiales</h4>
                      <div className="chat-wizard-features">
                        {[
                          {id: 'cocina moderna', label: '👨‍🍳 Cocina Moderna', desc: 'Isla central, electrodomésticos integrados'},
                          {id: 'terraza', label: '🌅 Terraza', desc: 'Espacio exterior techado'},
                          {id: 'jardín', label: '🌳 Jardín', desc: 'Área verde landscaping'},
                          {id: 'garage', label: '🚗 Garage', desc: 'Garaje techado'},
                          {id: 'piscina', label: '🏊‍♂️ Piscina', desc: 'Área de recreación acuática'},
                          {id: 'chimenea', label: '🔥 Chimenea', desc: 'Calefacción y ambiente'},
                          {id: 'balcón', label: '🏠 Balcón', desc: 'Espacio exterior sin techar'},
                          {id: 'vestidor', label: '👗 Vestidor', desc: 'Walk-in closet principal'},
                          {id: 'oficina', label: '💼 Oficina/Estudio', desc: 'Espacio de trabajo'},
                          {id: 'biblioteca', label: '📚 Biblioteca', desc: 'Sala de lectura'},
                          {id: 'gimnasio', label: '🏋️ Gimnasio', desc: 'Espacio de ejercicio'},
                          {id: 'sala de juegos', label: '🎮 Sala de Juegos', desc: 'Entretenimiento familiar'},
                          {id: 'bodega', label: '📦 Bodega', desc: 'Espacio de almacenamiento'},
                          {id: 'lavandería', label: '🧺 Lavandería', desc: 'Cuarto de lavado independiente'},
                          {id: 'terraza roof top', label: '🏙️ Roof Top', desc: 'Azotea con vista panorámica'},
                          {id: 'jacuzzi', label: '🛁 Jacuzzi', desc: 'Tina de hidromasaje'},
                          {id: 'sauna', label: '🧖‍♀️ Sauna', desc: 'Cabina de vapor'},
                          {id: 'wine cellar', label: '🍷 Cava de Vinos', desc: 'Bodega climatizada'},
                          {id: 'home theater', label: '🎬 Home Theater', desc: 'Sala de cine en casa'},
                          {id: 'bar', label: '🍸 Bar', desc: 'Barra de tragos'},
                        ].map(feature => (
                          <button
                            key={feature.id}
                            onClick={() => toggleWizardFeature(feature.id)}
                            className={`chat-wizard-feature-btn ${wizardSettings.features.includes(feature.id) ? 'active' : ''}`}
                          >
                            <div className="feature-main">{feature.label}</div>
                            <div className="feature-desc">{feature.desc}</div>
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* PASO 5: Configuración avanzada */}
                    <div className="chat-wizard-step">
                      <h4>⚙️ Configuración Avanzada</h4>
                      
                      <div className="chat-wizard-row">
                        <div className="chat-wizard-col">
                          <label>💰 Presupuesto:</label>
                          <select 
                            value={wizardSettings.budget} 
                            onChange={(e) => updateWizardSetting('budget', e.target.value)}
                            className="chat-wizard-select"
                          >
                            <option value="económico">💵 Económico (Hasta $50k)</option>
                            <option value="medio">💸 Medio ($50k - $150k)</option>
                            <option value="alto">💎 Alto ($150k - $300k)</option>
                            <option value="premium">👑 Premium (+$300k)</option>
                          </select>
                        </div>
                        <div className="chat-wizard-col">
                          <label>🧭 Orientación:</label>
                          <select 
                            value={wizardSettings.orientation} 
                            onChange={(e) => updateWizardSetting('orientation', e.target.value)}
                            className="chat-wizard-select"
                          >
                            <option value="norte">Norte</option>
                            <option value="sur">Sur</option>
                            <option value="este">Este</option>
                            <option value="oeste">Oeste</option>
                          </select>
                        </div>
                      </div>

                      <div className="chat-wizard-checkboxes">
                        <label className="chat-checkbox">
                          <input
                            type="checkbox"
                            checked={wizardSettings.sustainability}
                            onChange={(e) => updateWizardSetting('sustainability', e.target.checked)}
                          />
                          <span className="checkmark"></span>
                          🌱 Diseño Sustentable (Paneles solares, recolección de agua, materiales eco-friendly)
                        </label>

                        <label className="chat-checkbox">
                          <input
                            type="checkbox"
                            checked={wizardSettings.smartHome}
                            onChange={(e) => updateWizardSetting('smartHome', e.target.checked)}
                          />
                          <span className="checkmark"></span>
                          🏠 Casa Inteligente (Domótica, control por app, sensores automatizados)
                        </label>

                        <label className="chat-checkbox">
                          <input
                            type="checkbox"
                            checked={wizardSettings.accessibility}
                            onChange={(e) => updateWizardSetting('accessibility', e.target.checked)}
                          />
                          <span className="checkmark"></span>
                          ♿ Accesibilidad Universal (Rampas, puertas amplias, baño adaptado)
                        </label>
                      </div>
                    </div>

                    {/* PREVIEW DEL MENSAJE */}
                    {showPreview && (
                      <div className="chat-wizard-preview">
                        <h4>📝 Vista Previa del Mensaje</h4>
                        <div className="preview-content">
                          {generatePromptFromWizard()}
                        </div>
                        <p className="preview-note">
                          Este mensaje se enviará al asistente de IA para generar tu diseño personalizado.
                        </p>
                      </div>
                    )}

                    {/* ERRORES DE VALIDACIÓN */}
                    {validationErrors.length > 0 && (
                      <div className="chat-wizard-errors">
                        <h4>⚠️ Correcciones Necesarias</h4>
                        <ul>
                          {validationErrors.map((error, index) => (
                            <li key={index}>{error}</li>
                          ))}
                        </ul>
                        <p className="errors-note">
                          Por favor corrige estos puntos antes de continuar.
                        </p>
                      </div>
                    )}
                  </div>

                  <div className="chat-design-wizard-footer">
                    {!showPreview ? (
                      <>
                        <button 
                          onClick={() => {
                            setShowDesignWizard(false);
                            setShowPreview(false);
                            setValidationErrors([]);
                          }}
                          className="chat-wizard-btn-cancel"
                        >
                          ❌ Cancelar
                        </button>
                        <button 
                          onClick={handleApplyWizardSettings}
                          className="chat-wizard-btn-preview"
                          disabled={validationErrors.length > 0}
                        >
                          � Ver Preview
                        </button>
                        <button 
                          onClick={handleSendFromWizard}
                          className="chat-wizard-btn-send-direct"
                          disabled={validationErrors.length > 0}
                        >
                          🚀 Diseñar Ahora
                        </button>
                      </>
                    ) : (
                      <>
                        <button 
                          onClick={handleCancelPreview}
                          className="chat-wizard-btn-cancel"
                        >
                          ← Volver a Editar
                        </button>
                        <button 
                          onClick={() => { 
                            setShowDesignWizard(false);
                            setShowPreview(false);
                          }}
                          className="chat-wizard-btn-save"
                        >
                          💾 Solo Guardar
                        </button>
                        <button 
                          onClick={handleSendFromWizard}
                          className="chat-wizard-btn-send"
                        >
                          🚀 Enviar y Generar
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Chat;