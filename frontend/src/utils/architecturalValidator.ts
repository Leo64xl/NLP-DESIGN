// 🛡️ VALIDADOR DE CONTEXTO ARQUITECTÓNICO
// Este archivo contiene las reglas de validación para asegurar que solo se procesen
// solicitudes relacionadas con diseño arquitectónico y construcción

export interface ValidationResult {
  isValid: boolean;
  reason?: string;
  suggestions?: string[];
}

export class ArchitecturalValidator {
  // Palabras clave principales para arquitectura y construcción
  private static readonly ARCHITECTURAL_KEYWORDS = [
    // Tipos de construcción
    'casa', 'vivienda', 'hogar', 'residencia', 'edificio', 'departamento', 'apartamento', 
    'oficina', 'local', 'comercio', 'villa', 'duplex', 'townhouse', 'loft', 'penthouse',
    'nave', 'almacén', 'bodega', 'warehouse', 'centro comercial', 'plaza',
    
    // Elementos arquitectónicos
    'habitación', 'dormitorio', 'cuarto', 'recámara', 'bedroom', 'baño', 'aseo', 'bathroom',
    'cocina', 'kitchen', 'sala', 'comedor', 'living', 'salón', 'estudio', 'biblioteca', 
    'despacho', 'vestidor', 'closet', 'terraza', 'balcón', 'patio', 'jardín', 'garden',
    'garage', 'garaje', 'parking', 'sótano', 'basement', 'ático', 'azotea', 'rooftop',
    'escalera', 'stairs', 'pasillo', 'corredor', 'hall', 'vestíbulo', 'entrada', 'lobby',
    
    // Términos de construcción y diseño
    'construir', 'construcción', 'building', 'edificar', 'diseñar', 'diseño', 'design',
    'plano', 'planos', 'plans', 'blueprint', 'proyecto', 'project', 'arquitectura', 
    'architecture', 'arquitectónico', 'structural', 'estructural', 'estructura', 'structure',
    'cimentación', 'foundation', 'fundación', 'columnas', 'columns', 'vigas', 'beams',
    'muros', 'walls', 'paredes', 'tabiques', 'techos', 'ceiling', 'roof', 'losa', 'slab',
    'cubierta', 'tejado', 'ventanas', 'windows', 'puertas', 'doors', 'instalaciones',
    
    // Materiales de construcción
    'concreto', 'concrete', 'hormigón', 'cemento', 'cement', 'ladrillo', 'brick', 'block',
    'madera', 'wood', 'timber', 'acero', 'steel', 'hierro', 'iron', 'vidrio', 'glass',
    'aluminio', 'aluminum', 'piedra', 'stone', 'mármol', 'marble', 'granito', 'granite',
    'cerámica', 'ceramic', 'azulejo', 'tile', 'porcelanato', 'porcelain', 'laminado',
    'drywall', 'yeso', 'gypsum', 'pintura', 'paint',
    
    // Medidas y dimensiones
    'metros', 'metro', 'meter', 'm²', 'm2', 'square meters', 'cuadrados', 'área', 'area',
    'superficie', 'surface', 'dimensiones', 'dimensions', 'largo', 'length', 'ancho', 
    'width', 'alto', 'height', 'altura', 'profundidad', 'depth', 'tamaño', 'size', 'espacio', 'space',
    
    // Estilos arquitectónicos
    'moderno', 'modern', 'contemporáneo', 'contemporary', 'clásico', 'classic', 'classical',
    'tradicional', 'traditional', 'colonial', 'minimalista', 'minimalist', 'industrial',
    'rústico', 'rustic', 'mediterráneo', 'mediterranean', 'victoriano', 'victorian',
    'art deco', 'bauhaus', 'neoclásico', 'neoclassical',
    
    // Características específicas
    'piscina', 'pool', 'swimming pool', 'alberca', 'jacuzzi', 'spa', 'chimenea', 'fireplace',
    'aire acondicionado', 'air conditioning', 'calefacción', 'heating', 'iluminación', 'lighting',
    'ventilación', 'ventilation', 'instalación eléctrica', 'electrical', 'plomería', 'plumbing',
    'fontanería', 'domótica', 'smart home', 'automation', 'hogar inteligente', 'seguridad', 'security',
    
    // Términos de diseño y presentación
    'fachada', 'facade', 'exterior', 'interior', 'decoración', 'decoration', 'amueblado',
    'furnished', 'mobiliario', 'furniture', 'layout', 'distribución', 'distribution',
    'orientación', 'orientation', 'vista', 'view', 'panorámica', 'panoramic', 'luminosidad',
    'brightness', 'natural light',
    
    // Accesibilidad
    'accesible', 'accessible', 'rampa', 'ramp', 'discapacitado', 'disabled', 'universal',
    'barreras arquitectónicas', 'barrier free',
    
    // Sustentabilidad
    'sostenible', 'sustainable', 'sustentable', 'ecológico', 'ecological', 'verde', 'green',
    'solar', 'energético', 'energy', 'ahorro energético', 'energy saving', 'eficiencia energética',
    'energy efficiency',
    
    // Presupuesto y construcción
    'presupuesto', 'budget', 'costo', 'cost', 'precio', 'price', 'inversión', 'investment',
    'financiamiento', 'financing', 'crédito', 'credit', 'obra', 'construction work',
    'demolición', 'demolition', 'remodelación', 'remodeling', 'ampliación', 'extension',
    'reforma', 'renovation',
    
    // Documentos técnicos
    'render', 'rendering', 'renderizado', '3d', '2d', 'modelo', 'model', 'maqueta', 'mockup',
    'planta', 'floor plan', 'elevación', 'elevation', 'corte', 'section', 'sección',
    'perspectiva', 'perspective', 'isométrico', 'isometric', 'cad', 'dwg', 'pdf', 'blueprint'
  ];

  // Palabras que indican intención de diseño
  private static readonly INTENT_KEYWORDS = [
    'quiero', 'want', 'necesito', 'need', 'deseo', 'wish', 'me gustaría', 'would like',
    'busco', 'looking for', 'planear', 'plan', 'planificar', 'planning', 'crear', 'create',
    'hacer', 'make', 'construir', 'build', 'diseñar', 'design', 'desarrollar', 'develop',
    'proyectar', 'project', 'generar', 'generate', 'elaborar', 'elaborate', 'realizar', 'realize',
    'ejecutar', 'execute'
  ];

  // Patrones que claramente NO son arquitectónicos
  private static readonly NON_ARCHITECTURAL_PATTERNS = [
    // Saludos básicos
    /^(hola|hi|hey|saludos|buenas|buenos días|buenas tardes|buenas noches)$/i,
    /^(hello|good morning|good afternoon|good evening|greetings)$/i,
    
    // Preguntas de estado
    /^(cómo estás|how are you|qué tal|como estas|que tal|how do you do)$/i,
    /^(cómo te encuentras|how are you feeling|todo bien|everything ok)$/i,
    
    // Agradecimientos y despedidas
    /^(gracias|thanks|thank you|de nada|you're welcome|por favor|please)$/i,
    /^(adiós|bye|goodbye|chao|hasta luego|see you|nos vemos|take care)$/i,
    
    // Respuestas simples
    /^(ok|vale|bien|good|mal|bad|regular|fair|más o menos|so so)$/i,
    /^(sí|yes|no|maybe|tal vez|perhaps|quizás|perhaps)$/i,
    
    // Pruebas y tests
    /^(test|prueba|testing|probando|check|verificar)$/i,
    
    // Solo números o caracteres especiales
    /^\d+$/i,
    /^[.,;:!?¿¡\s\-_+=(){}[\]]+$/i,
    
    // Preguntas genéricas sobre el sistema
    /^(qué puedes hacer|what can you do|ayuda|help|información|info)$/i,
    /^(cómo funciona|how does it work|instrucciones|instructions)$/i
  ];

  // Ejemplos válidos para mostrar al usuario
  private static readonly VALID_EXAMPLES = [
    'Quiero diseñar una casa de 150m² con 3 habitaciones y 2 baños',
    'Necesito planos para un departamento moderno de 80m²',
    'Diseña una oficina de 200m² con sala de juntas',
    'Crear una villa contemporánea con piscina y jardín',
    'Planos para una casa de 2 pisos con garaje',
    'Diseño de local comercial de 100m² estilo industrial'
  ];

  /**
   * Valida si el contenido está relacionado con arquitectura y construcción
   * @param content Contenido del mensaje a validar
   * @returns Resultado de la validación
   */
  public static validate(content: string): ValidationResult {
    const normalizedContent = content.toLowerCase().trim();
    
    // Verificar longitud mínima
    if (normalizedContent.length < 3) {
      return {
        isValid: false,
        reason: 'La solicitud es demasiado corta. Por favor, describe tu proyecto arquitectónico con más detalle.',
        suggestions: this.VALID_EXAMPLES.slice(0, 3)
      };
    }

    // Verificar patrones claramente no arquitectónicos
    for (const pattern of this.NON_ARCHITECTURAL_PATTERNS) {
      if (pattern.test(normalizedContent)) {
        return {
          isValid: false,
          reason: 'Soy un asistente especializado en diseño arquitectónico. Por favor, describe tu proyecto de construcción o diseño.',
          suggestions: this.VALID_EXAMPLES.slice(0, 4)
        };
      }
    }

    // Verificar presencia de palabras clave arquitectónicas
    const hasArchitecturalKeywords = this.ARCHITECTURAL_KEYWORDS.some(keyword => 
      normalizedContent.includes(keyword.toLowerCase())
    );

    if (hasArchitecturalKeywords) {
      return { isValid: true };
    }

    // Verificar si contiene palabras de intención de diseño
    const hasIntentKeywords = this.INTENT_KEYWORDS.some(keyword => 
      normalizedContent.includes(keyword.toLowerCase())
    );

    if (hasIntentKeywords) {
      return {
        isValid: false,
        reason: 'Entiendo que necesitas algo, pero no puedo identificar qué tipo de proyecto arquitectónico. Por favor, especifica qué tipo de construcción, casa o espacio necesitas diseñar.',
        suggestions: this.VALID_EXAMPLES.slice(2, 6)
      };
    }

    // Verificar si menciona números que podrían ser medidas
    const hasNumbers = /\d+/.test(normalizedContent);
    const hasSpatialWords = ['grande', 'pequeño', 'amplio', 'espacioso', 'compacto', 'chico'].some(word => 
      normalizedContent.includes(word)
    );

    if (hasNumbers && hasSpatialWords) {
      return { isValid: true }; // Probablemente está describiendo espacios
    }

    // Por defecto, rechazar si no cumple ningún criterio
    return {
      isValid: false,
      reason: 'No puedo identificar una solicitud relacionada con diseño arquitectónico. Por favor, describe tu proyecto de construcción: tipo de edificación, número de habitaciones, área, estilo, etc.',
      suggestions: this.VALID_EXAMPLES
    };
  }

  /**
   * Obtiene ejemplos de solicitudes válidas
   * @returns Array de ejemplos
   */
  public static getValidExamples(): string[] {
    return [...this.VALID_EXAMPLES];
  }

  /**
   * Obtiene palabras clave arquitectónicas reconocidas
   * @returns Array de palabras clave
   */
  public static getArchitecturalKeywords(): string[] {
    return [...this.ARCHITECTURAL_KEYWORDS];
  }
}

export default ArchitecturalValidator;