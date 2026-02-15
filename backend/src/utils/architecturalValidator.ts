// 🛡️ VALIDADOR DE CONTEXTO ARQUITECTÓNICO - BACKEND
// Versión backend de la validación de contenido arquitectónico

interface ValidationResult {
    isValid: boolean;
    reason?: string;
    suggestions?: string[];
}

export class ArchitecturalValidatorBackend {
    // Palabras clave arquitectónicas (versión simplificada para backend)
    private static readonly ARCHITECTURAL_KEYWORDS = [
        // Tipos de construcción
        'casa', 'vivienda', 'hogar', 'residencia', 'edificio', 'departamento', 'apartamento', 
        'oficina', 'local', 'comercio', 'villa', 'duplex', 'loft', 'penthouse', 'nave', 'almacén',
        
        // Elementos arquitectónicos básicos
        'habitación', 'dormitorio', 'cuarto', 'recámara', 'baño', 'aseo', 'cocina', 'sala', 
        'comedor', 'living', 'salón', 'estudio', 'vestidor', 'terraza', 'balcón', 'patio', 
        'jardín', 'garage', 'garaje', 'sótano', 'ático', 'escalera', 'pasillo',
        
        // Términos de construcción
        'construir', 'construcción', 'edificar', 'diseñar', 'diseño', 'plano', 'planos', 
        'proyecto', 'arquitectura', 'arquitectónico', 'estructural', 'estructura',
        'muros', 'paredes', 'techos', 'ventanas', 'puertas', 'fachada',
        
        // Materiales comunes
        'concreto', 'hormigón', 'cemento', 'ladrillo', 'madera', 'acero', 'vidrio', 
        'aluminio', 'piedra', 'mármol', 'cerámica', 'azulejo',
        
        // Medidas y dimensiones
        'metros', 'metro', 'm²', 'm2', 'cuadrados', 'área', 'superficie', 'dimensiones',
        'largo', 'ancho', 'alto', 'altura', 'tamaño', 'espacio',
        
        // Estilos básicos
        'moderno', 'contemporáneo', 'clásico', 'tradicional', 'minimalista', 'industrial', 'rústico',
        
        // Características específicas
        'piscina', 'chimenea', 'iluminación', 'ventilación', 'instalación', 'domótica',
        
        // Términos técnicos
        'render', 'renderizado', '3d', '2d', 'modelo', 'maqueta', 'planta', 'elevación',
        'corte', 'sección', 'perspectiva', 'cad', 'dwg', 'pdf'
    ];

    // Patrones que NO son arquitectónicos
    private static readonly NON_ARCHITECTURAL_PATTERNS = [
        /^(hola|hi|hey|saludos|buenas|buenos días|buenas tardes|buenas noches)$/i,
        /^(hello|good morning|good afternoon|good evening)$/i,
        /^(cómo estás|how are you|qué tal|como estas|que tal)$/i,
        /^(gracias|thanks|de nada|you're welcome)$/i,
        /^(adiós|bye|chao|hasta luego|see you|nos vemos)$/i,
        /^(ok|vale|bien|mal|regular|más o menos)$/i,
        /^(test|prueba|testing|probando)$/i,
        /^\d+$/i, // Solo números
        /^[.,;:!?¿¡\s\-_+=(){}[\]]+$/i // Solo puntuación y espacios
    ];

    // Ejemplos válidos
    private static readonly VALID_EXAMPLES = [
        'Quiero diseñar una casa de 150m² con 3 habitaciones y 2 baños',
        'Necesito planos para un departamento moderno de 80m²',
        'Diseña una oficina de 200m² con sala de juntas',
        'Crear una villa contemporánea con piscina y jardín',
        'Planos para una casa de 2 pisos con garaje',
        'Diseño de local comercial de 100m² estilo industrial'
    ];

    /**
     * Valida el contenido del mensaje
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

        // Verificar patrones no arquitectónicos
        for (const pattern of this.NON_ARCHITECTURAL_PATTERNS) {
            if (pattern.test(normalizedContent)) {
                return {
                    isValid: false,
                    reason: 'Soy un asistente especializado en diseño arquitectónico. Por favor, describe tu proyecto de construcción o diseño.',
                    suggestions: this.VALID_EXAMPLES.slice(0, 4)
                };
            }
        }

        // Verificar palabras clave arquitectónicas
        const hasArchitecturalContent = this.ARCHITECTURAL_KEYWORDS.some(keyword => 
            normalizedContent.includes(keyword.toLowerCase())
        );

        if (!hasArchitecturalContent) {
            // Verificar intención de diseño
            const intentKeywords = ['quiero', 'necesito', 'deseo', 'busco', 'planear', 'crear', 'hacer'];
            const hasIntent = intentKeywords.some(keyword => normalizedContent.includes(keyword));
            
            if (hasIntent) {
                return {
                    isValid: false,
                    reason: 'Entiendo que necesitas algo, pero no puedo identificar qué tipo de proyecto arquitectónico. Por favor, especifica qué tipo de construcción, casa o espacio necesitas diseñar.',
                    suggestions: this.VALID_EXAMPLES.slice(2, 6)
                };
            }

            return {
                isValid: false,
                reason: 'No puedo procesar solicitudes que no estén relacionadas con diseño arquitectónico. Por favor, describe tu proyecto de construcción, planos o diseño.',
                suggestions: this.VALID_EXAMPLES
            };
        }

        return { isValid: true };
    }

    /**
     * Obtiene ejemplos válidos
     */
    public static getValidExamples(): string[] {
        return [...this.VALID_EXAMPLES];
    }
}

// Función de validación simple para uso directo
export function validateArchitecturalContent(content: string): ValidationResult {
    return ArchitecturalValidatorBackend.validate(content);
}

export default ArchitecturalValidatorBackend;