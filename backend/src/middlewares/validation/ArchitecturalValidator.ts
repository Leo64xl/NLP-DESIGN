/**
 * Validador de contexto arquitectónico para el backend
 */
export class ArchitecturalValidator {
  // Palabras clave arquitectónicas
  private static readonly ARCHITECTURAL_KEYWORDS = [
    // Tipos de construcción
    'casa', 'departamento', 'edificio', 'oficina', 'local', 'vivienda', 'residencia',
    'construcción', 'proyecto', 'diseño', 'plano', 'arquitectura', 'estructura',
    
    // Espacios y habitaciones
    'habitación', 'dormitorio', 'cuarto', 'sala', 'salón', 'comedor', 'cocina',
    'baño', 'aseo', 'estudio', 'oficina', 'garaje', 'cochera', 'terraza',
    'balcón', 'jardín', 'patio', 'pasillo', 'escalera', 'vestíbulo',
    
    // Medidas y dimensiones
    'metros', 'metro', 'm²', 'm2', 'área', 'superficie', 'dimensión', 'tamaño',
    'ancho', 'largo', 'alto', 'altura', 'profundidad',
    
    // Características arquitectónicas
    'piso', 'planta', 'nivel', 'pared', 'muro', 'techo', 'ventana', 'puerta',
    'entrada', 'fachada', 'columna', 'viga', 'losa', 'cimentación',
    
    // Estilos y materiales
    'moderno', 'contemporáneo', 'clásico', 'minimalista', 'colonial', 'industrial',
    'concreto', 'ladrillo', 'madera', 'acero', 'vidrio', 'piedra',
    
    // Instalaciones
    'eléctrico', 'electricidad', 'plomería', 'sanitario', 'agua', 'luz', 'gas',
    'aire acondicionado', 'calefacción', 'ventilación',
    
    // Términos técnicos
    'planos', 'render', 'modelo', '3d', '2d', 'maqueta', 'diseño', 'proyecto',
    'construcción', 'edificación', 'inmueble'
  ];

  // Patrones arquitectónicos (regex)
  private static readonly ARCHITECTURAL_PATTERNS = [
    /\d+\s*m[²2²]/i,           // Área en metros cuadrados
    /\d+\s*metros?/i,          // Medidas en metros
    /\d+\s*habitaci[oó]n(es)?/i, // Número de habitaciones
    /\d+\s*dormitori(o|os)/i,  // Número de dormitorios
    /\d+\s*ba[ñn](o|os)/i,     // Número de baños
    /\d+\s*piso(s)?/i,         // Número de pisos
    /\d+\s*planta(s)?/i,       // Número de plantas
    /casa\s+de/i,              // "casa de..."
    /departamento\s+de/i,      // "departamento de..."
    /edificio\s+de/i,          // "edificio de..."
    /plano\s+de/i,             // "plano de..."
    /diseño\s+de/i,            // "diseño de..."
    /construcción\s+de/i       // "construcción de..."
  ];

  // Frases no arquitectónicas que deben ser rechazadas
  private static readonly NON_ARCHITECTURAL_PHRASES = [
    'hola', 'hello', 'hi', 'saludos', 'buenos días', 'buenas tardes', 'buenas noches',
    'cómo estás', 'qué tal', 'cómo andas', 'qué hay', 'qué pasa',
    'gracias', 'thank you', 'thanks', 'de nada', 'por favor', 'please',
    'ayuda', 'help', 'información', 'info', 'pregunta', 'question',
    'test', 'testing', 'prueba', 'probando', 'ejemplo', 'example'
  ];

  /**
   * Valida si el contenido es de contexto arquitectónico
   */
  static validateArchitecturalContext(content: string): {
    isValid: boolean;
    reason?: string;
    confidence: number;
    suggestions?: string[];
  } {
    if (!content || typeof content !== 'string') {
      return {
        isValid: false,
        reason: 'El contenido no puede estar vacío',
        confidence: 0
      };
    }

    const cleanContent = content.trim().toLowerCase();

    // Verificar si es solo saludo o frase no arquitectónica
    if (this.isNonArchitecturalPhrase(cleanContent)) {
      return {
        isValid: false,
        reason: 'Solo puedo ayudarte con consultas relacionadas a arquitectura y diseño',
        confidence: 0.9,
        suggestions: this.getValidExamples().slice(0, 3)
      };
    }

    // Calcular puntuación arquitectónica
    const architecturalScore = this.calculateArchitecturalScore(cleanContent);

    if (architecturalScore >= 0.6) {
      return {
        isValid: true,
        confidence: architecturalScore
      };
    } else if (architecturalScore >= 0.3) {
      return {
        isValid: false,
        reason: 'Tu consulta parece relacionada con arquitectura, pero necesita más detalles específicos',
        confidence: architecturalScore,
        suggestions: [
          'Especifica el tipo de construcción (casa, departamento, oficina)',
          'Incluye medidas o área aproximada',
          'Menciona número de habitaciones o espacios',
          'Describe el estilo arquitectónico deseado'
        ]
      };
    } else {
      return {
        isValid: false,
        reason: 'No detecté contenido relacionado con arquitectura o diseño',
        confidence: architecturalScore,
        suggestions: this.getValidExamples().slice(0, 4)
      };
    }
  }

  /**
   * Verifica si es una frase no arquitectónica
   */
  private static isNonArchitecturalPhrase(content: string): boolean {
    const words = content.split(/\s+/);
    
    // Si es muy corto y coincide con frases no arquitectónicas
    if (words.length <= 3) {
      return this.NON_ARCHITECTURAL_PHRASES.some(phrase => 
        content.includes(phrase) || content === phrase
      );
    }

    // Verificar si toda la frase es no arquitectónica
    const nonArchWords = words.filter(word => 
      this.NON_ARCHITECTURAL_PHRASES.some(phrase => phrase.includes(word))
    );

    return nonArchWords.length >= words.length * 0.7;
  }

  /**
   * Calcula puntuación arquitectónica del contenido
   */
  private static calculateArchitecturalScore(content: string): number {
    let score = 0;
    const words = content.split(/\s+/);
    const totalWords = words.length;

    // Puntos por palabras clave arquitectónicas
    const architecturalWords = words.filter(word => 
      this.ARCHITECTURAL_KEYWORDS.some(keyword => 
        word.includes(keyword) || keyword.includes(word)
      )
    );
    score += (architecturalWords.length / totalWords) * 0.4;

    // Puntos por patrones arquitectónicos
    const patternMatches = this.ARCHITECTURAL_PATTERNS.filter(pattern => 
      pattern.test(content)
    );
    score += (patternMatches.length / this.ARCHITECTURAL_PATTERNS.length) * 0.6;

    // Bonus por longitud adecuada (descripciones detalladas)
    if (totalWords >= 5 && totalWords <= 100) {
      score += 0.1;
    }

    // Penalty por palabras no arquitectónicas
    const nonArchWords = words.filter(word => 
      this.NON_ARCHITECTURAL_PHRASES.includes(word)
    );
    score -= (nonArchWords.length / totalWords) * 0.3;

    return Math.max(0, Math.min(1, score));
  }

  /**
   * Obtiene ejemplos válidos de consultas arquitectónicas
   */
  static getValidExamples(): string[] {
    return [
      "Casa de 3 habitaciones, 2 baños, 120m² en estilo moderno",
      "Departamento de 2 dormitorios con cocina abierta",
      "Oficina de 50m² con sala de reuniones",
      "Casa de 2 pisos con garaje y jardín",
      "Plano de casa familiar de 100m²",
      "Diseño de departamento minimalista",
      "Construcción de 4 habitaciones estilo contemporáneo",
      "Vivienda unifamiliar con terraza",
      "Edificio de 3 plantas para oficinas",
      "Residencia con piscina y área social"
    ];
  }

  /**
   * Obtiene estadísticas de validación
   */
  static getValidationStats(content: string): {
    wordCount: number;
    architecturalWords: string[];
    detectedPatterns: string[];
    confidence: number;
  } {
    const words = content.toLowerCase().split(/\s+/);
    const architecturalWords = words.filter(word => 
      this.ARCHITECTURAL_KEYWORDS.some(keyword => 
        word.includes(keyword) || keyword.includes(word)
      )
    );
    
    const detectedPatterns = this.ARCHITECTURAL_PATTERNS
      .filter(pattern => pattern.test(content))
      .map(pattern => pattern.toString());

    return {
      wordCount: words.length,
      architecturalWords,
      detectedPatterns,
      confidence: this.calculateArchitecturalScore(content)
    };
  }
}

export default ArchitecturalValidator;