import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

interface LanguageContextType {
  language: string;
  setLanguage: (lang: string) => void;
  t: (key: string, interpolations?: Record<string, string | number>) => string;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

// Traducciones
const translations = {
  es: {
    // Navbar
    'navbar.title': 'AI Design Assistant',
    'navbar.templates': 'Plantillas',
    'navbar.notifications': 'Notificaciones',
    'navbar.settings': 'Configuración',
    'navbar.user': 'Usuario',
    'navbar.userMenu': 'Menú de usuario',
    
    // Settings Panel
    'settings.title': 'Configuración',
    'settings.language': 'Idioma',
    'settings.language.description': 'Selecciona tu idioma preferido',
    'settings.theme': 'Tema',
    'settings.theme.description': 'Personaliza la apariencia',
    'settings.language.spanish': 'Español',
    'settings.language.english': 'English',
    'settings.theme.light': 'Claro',
    'settings.theme.dark': 'Oscuro',
    
    // User Profile
    'user.dashboard': 'Panel',
    'user.designs': 'Diseños',
    'user.settings': 'Configuración',
    'user.logout': 'Cerrar Sesión',
    'user.menu': 'Menú de Usuario',
    'user.profile': 'Ver Perfil',
    'user.myDesigns': 'Mis Diseños',
    'user.dashboardDescription': 'Ir al panel principal',
    'user.designsDescription': 'Ver todos mis proyectos',
    'user.settingsDescription': 'Ajustes de la cuenta',
    
    // Notifications
    'notifications.title': 'Notificaciones',
    'notifications.markAllRead': 'Marcar como leídas',
    'notifications.noNotifications': 'No hay notificaciones',
    'notifications.loading': 'Cargando notificaciones...',
    'notifications.close': 'Cerrar',
    'notifications.design.complete': '¡Tu diseño está listo!',
    'notifications.template.available': 'Nuevo template disponible',
    'notifications.conversion.complete': 'Conversión completada',
    'notifications.time.fewSeconds': 'Hace unos segundos',
    'notifications.time.minutes': 'Hace {minutes} minutos',
    'notifications.time.hours': 'Hace {hours} horas',
    'notifications.time.days': 'Hace {days} días',
    
    // Common
    'common.loading': 'Cargando...',
    'common.error': 'Error',
    'common.success': 'Éxito',
    'common.cancel': 'Cancelar',
    'common.save': 'Guardar',
    'common.close': 'Cerrar',
    
    // Templates
    'templates.title': 'Galería de Templates',
    'templates.popularTitle': 'Templates Populares',
    'templates.description': 'Acelera tu proceso de diseño con nuestros templates profesionales',
    'templates.loading': 'Cargando templates...',
    'templates.all': 'Todos',
    'templates.trending': 'Trending',
    'templates.preview': 'Vista previa',
    'templates.use': 'Usar template',
    'templates.rooms': 'hab.',
    
    // Chat
    'chat.welcome': '¡Hola {name}! 👋 Soy tu asistente de diseño arquitectónico con IA. Describe el espacio que quieres crear y yo me encargo de generar los planos, renders y modelos 3D automáticamente.',
    'chat.resetWelcome': 'Chat reiniciado. ¡Hola de nuevo {name}! ¿En qué puedo ayudarte con tu diseño?',
    'chat.placeholder': 'Describe tu diseño arquitectónico... (ej: Casa moderna de 150m² con 3 habitaciones)',
    'chat.typing': 'AI está analizando tu diseño...',
    'chat.tip': '💡 Tip: Sé específico sobre el tipo de construcción, tamaño, habitaciones y características especiales',
    'chat.resetWarning': '⚠️ Si el proceso se queda bloqueado, usa el botón de reinicio',
    'chat.resetTitle': 'Reiniciar chat',
    'chat.typeSelector': '¿Qué tipo de diseño necesitas?',
    'chat.includes': 'Incluye',
    'chat.designCreated': '✅ Perfecto! He creado un diseño {type} que incluye: {features}.',
    'chat.designCharacteristics': '🎯 **Características del diseño:**\n- Título: {title}\n- Tipo: {type}\n- Estado: Generando archivos...\n\nLos archivos estarán listos en unos momentos.',
    'chat.architecturalPlan': '📊 **Plan arquitectónico generado:**\n- Área total: {area}m²\n- Estilo: {style}\n- Habitaciones: {rooms}\n- Método: {method}\n\n🚀 Iniciando generación de archivos técnicos...',
    'chat.processingBackground': '⏰ El diseño está siendo procesado en segundo plano. Te notificaré cuando esté listo...',
    'chat.processDelayed': '⚠️ El proceso tomó más tiempo del esperado. Por favor, intenta nuevamente.',
    'chat.conversionStarted': '🔄 Conversión iniciada: {from} → {to}. El archivo estará listo en breve.',
    'chat.connectionIssues': '⚠️ Hay problemas de conexión. El diseño podría estar procesándose en segundo plano. Intenta recargar la página en unos minutos.',
    'chat.processTimeout': '⏰ El proceso está tomando más tiempo del esperado. Puedes recargar la página para verificar el estado.',
    'chat.loadError': 'Error al cargar el diseño. Empecemos de nuevo.',
    'chat.generalError': '❌ Lo siento, hubo un problema: {error}. Por favor, intenta nuevamente.',
    
    // Design Types
    'designType.2d.label': '2D',
    'designType.2d.description': 'Planos arquitectónicos',
    'designType.3d.label': '3D', 
    'designType.3d.description': 'Modelos tridimensionales',
    'designType.both.label': 'Completo',
    'designType.both.description': '2D + 3D + Renders',
    
    // Loader
    'loader.generating': 'Generando archivos...',
  },
  en: {
    // Navbar
    'navbar.title': 'AI Design Assistant',
    'navbar.templates': 'Templates',
    'navbar.notifications': 'Notifications',
    'navbar.settings': 'Settings',
    'navbar.user': 'User',
    'navbar.userMenu': 'User Menu',
    
    // Settings Panel
    'settings.title': 'Settings',
    'settings.language': 'Language',
    'settings.language.description': 'Select your preferred language',
    'settings.theme': 'Theme',
    'settings.theme.description': 'Customize appearance',
    'settings.language.spanish': 'Español',
    'settings.language.english': 'English',
    'settings.theme.light': 'Light',
    'settings.theme.dark': 'Dark',
    
    // User Profile
    'user.dashboard': 'Dashboard',
    'user.designs': 'Designs',
    'user.settings': 'Settings',
    'user.logout': 'Logout',
    'user.menu': 'User Menu',
    'user.profile': 'View Profile',
    'user.myDesigns': 'My Designs',
    'user.dashboardDescription': 'Go to main panel',
    'user.designsDescription': 'View all my projects',
    'user.settingsDescription': 'Account settings',
    
    // Notifications
    'notifications.title': 'Notifications',
    'notifications.markAllRead': 'Mark all as read',
    'notifications.noNotifications': 'No notifications',
    'notifications.loading': 'Loading notifications...',
    'notifications.close': 'Close',
    'notifications.design.complete': 'Your design is ready!',
    'notifications.template.available': 'New template available',
    'notifications.conversion.complete': 'Conversion completed',
    'notifications.time.fewSeconds': 'A few seconds ago',
    'notifications.time.minutes': '{minutes} minutes ago',
    'notifications.time.hours': '{hours} hours ago',
    'notifications.time.days': '{days} days ago',
    
    // Common
    'common.loading': 'Loading...',
    'common.error': 'Error',
    'common.success': 'Success',
    'common.cancel': 'Cancel',
    'common.save': 'Save',
    'common.close': 'Close',
    
    // Templates
    'templates.title': 'Template Gallery',
    'templates.popularTitle': 'Popular Templates',
    'templates.description': 'Speed up your design process with our professional templates',
    'templates.loading': 'Loading templates...',
    'templates.all': 'All',
    'templates.trending': 'Trending',
    'templates.preview': 'Preview',
    'templates.use': 'Use template',
    'templates.rooms': 'rooms',
    
    // Chat
    'chat.welcome': 'Hello {name}! 👋 I\'m your AI architectural design assistant. Describe the space you want to create and I\'ll take care of generating the plans, renders and 3D models automatically.',
    'chat.resetWelcome': 'Chat reset. Hello again {name}! How can I help you with your design?',
    'chat.placeholder': 'Describe your architectural design... (e.g: Modern 150m² house with 3 bedrooms)',
    'chat.typing': 'AI is analyzing your design...',
    'chat.tip': '💡 Tip: Be specific about construction type, size, rooms and special features',
    'chat.resetWarning': '⚠️ If the process gets stuck, use the reset button',
    'chat.resetTitle': 'Reset chat',
    'chat.typeSelector': 'What type of design do you need?',
    'chat.includes': 'Includes',
    'chat.designCreated': '✅ Perfect! I have created a {type} design that includes: {features}.',
    'chat.designCharacteristics': '🎯 **Design characteristics:**\n- Title: {title}\n- Type: {type}\n- Status: Generating files...\n\nThe files will be ready in a few moments.',
    'chat.architecturalPlan': '📊 **Architectural plan generated:**\n- Total area: {area}m²\n- Style: {style}\n- Rooms: {rooms}\n- Method: {method}\n\n🚀 Starting technical file generation...',
    'chat.processingBackground': '⏰ The design is being processed in the background. I\'ll notify you when it\'s ready...',
    'chat.processDelayed': '⚠️ The process took longer than expected. Please try again.',
    'chat.conversionStarted': '🔄 Conversion started: {from} → {to}. The file will be ready shortly.',
    'chat.connectionIssues': '⚠️ There are connection issues. The design might be processing in the background. Try reloading the page in a few minutes.',
    'chat.processTimeout': '⏰ The process is taking longer than expected. You can reload the page to check the status.',
    'chat.loadError': 'Error loading the design. Let\'s start over.',
    'chat.generalError': '❌ Sorry, there was a problem: {error}. Please try again.',
    
    // Design Types
    'designType.2d.label': '2D',
    'designType.2d.description': 'Architectural plans',
    'designType.3d.label': '3D',
    'designType.3d.description': 'Three-dimensional models', 
    'designType.both.label': 'Complete',
    'designType.both.description': '2D + 3D + Renders',
    
    // Loader
    'loader.generating': 'Generating files...',
  }
};

interface LanguageProviderProps {
  children: ReactNode;
}

export const LanguageProvider: React.FC<LanguageProviderProps> = ({ children }) => {
  const [language, setLanguageState] = useState<string>(() => {
    // Intentar obtener el idioma del localStorage o usar español por defecto
    const savedLanguage = localStorage.getItem('ai-design-language');
    return savedLanguage || 'es';
  });

  const setLanguage = (lang: string) => {
    setLanguageState(lang);
    localStorage.setItem('ai-design-language', lang);
    console.log('🌐 Idioma cambiado globalmente a:', lang);
  };

  const t = (key: string, interpolations?: Record<string, string | number>): string => {
    const languageTranslations = translations[language as keyof typeof translations];
    let translation = languageTranslations?.[key as keyof typeof languageTranslations] || key;
    
    // Manejar interpolaciones {variable}
    if (interpolations && typeof translation === 'string') {
      Object.entries(interpolations).forEach(([variable, value]) => {
        translation = translation.replace(`{${variable}}`, String(value));
      });
    }
    
    return translation;
  };

  useEffect(() => {
    // Aplicar el idioma al documento
    document.documentElement.lang = language;
  }, [language]);

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = (): LanguageContextType => {
  const context = useContext(LanguageContext);
  if (context === undefined) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
};