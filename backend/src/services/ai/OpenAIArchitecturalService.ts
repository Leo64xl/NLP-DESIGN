import OpenAI from 'openai';

// 🤖 CONFIGURACIÓN DE OPENAI
const openaiConfig = {
  apiKey: process.env.OPENAI_API_KEY,
  model: 'gpt-4o-mini', // Usar el modelo más eficiente para este tipo de tareas
  timeout: 380000, // 6 minutos extendido para procesamiento complejo
  maxRetries: 3,
  retryDelay: 2000,
  temperature: 0.4, // Ajuste para un balance entre creatividad y precisión  
  maxTokens: 10000
};

interface NLPStructuralData {
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
    type: 'bedroom' | 'bathroom' | 'kitchen' | 'living_room' | 'dining_room' | 'office' | 'storage' | 'garage' | 'hallway';
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
}

export interface FileGenerationResult {
  svg: {
    content: string;
    filename: string;
    path: string;
  };
  stl: {
    content: string;
    filename: string;
    path: string;
  };
  structuralData: NLPStructuralData;
  processingTime: number;
  files: {
    svg: string;
    stl: string;
  };
}

export class OpenAIArchitecturalService {
  private static client: OpenAI;

  /**
   * Inicializa el cliente de OpenAI
   */
  private static initializeClient(): OpenAI {
    if (!this.client) {
      try {
        this.client = new OpenAI({
          apiKey: openaiConfig.apiKey,
        });
        console.log('✅ Cliente OpenAI inicializado correctamente');
      } catch (error) {
        console.error('❌ Error inicializando cliente OpenAI:', error);
        throw new Error('No se pudo inicializar el cliente OpenAI');
      }
    }
    return this.client;
  }

  /**
   * Procesa texto en lenguaje natural y genera archivos 2D/3D
   */
  static async processNLPToFiles(
    userDescription: string,
    designId: string,
    outputDirectory: string
  ): Promise<FileGenerationResult> {
    const startTime = Date.now();
    console.log('🚀 Iniciando procesamiento NLP to 2D/3D...');
    console.log('📝 Descripción del usuario:', userDescription);

    try {
      // 1. Procesar texto con OpenAI para extraer estructura arquitectónica
      const structuralData = await this.extractStructuralData(userDescription);
      console.log('✅ Datos estructurales extraídos:', structuralData);

      // 2. Generar SVG (plano 2D)
      const svgResult = await this.generateSVGFile(structuralData, designId, outputDirectory);
      console.log('✅ Archivo SVG generado:', svgResult.filename);

      // 3. Generar STL (modelo 3D)
      const stlResult = await this.generateSTLFile(structuralData, designId, outputDirectory);
      console.log('✅ Archivo STL generado:', stlResult.filename);

      const processingTime = Date.now() - startTime;

      return {
        svg: svgResult,
        stl: stlResult,
        structuralData,
        processingTime,
        files: {
          svg: svgResult.path,
          stl: stlResult.path
        }
      };

    } catch (error) {
      console.error('❌ Error en procesamiento NLP to Files:', error);
      throw new Error(`Error en generación de archivos: ${error instanceof Error ? error.message : 'Error desconocido'}`);
    }
  }

  /**
   * Extrae datos estructurales usando OpenAI
   */
  private static async extractStructuralData(userDescription: string): Promise<NLPStructuralData> {
    const client = this.initializeClient();

    const systemPrompt = `
Eres un arquitecto experto que convierte descripciones en lenguaje natural a estructuras de datos arquitectónicas precisas.

🎯 DISEÑA DENTRO DE UN PLANO CUADRADO PERFECTO:
- Siempre usar dimensiones cuadradas (width = length) 
- Calcular la dimensión del cuadrado basándote en el área total: lado = √(área_total * 1.2)
- TODAS las habitaciones deben estar DENTRO del cuadrado (0,0 hasta lado,lado)
- NO generar habitaciones fuera del área del plano

RESPONDE SOLO CON JSON VÁLIDO siguiendo esta estructura EXACTA:
{
  "metadata": {
    "title": "string",
    "description": "string", 
    "totalArea": number,
    "dimensions": {"width": number, "length": number, "height": number},
    "style": "string",
    "generatedAt": "ISO date string"
  },
  "rooms": [
    {
      "name": "string",
      "type": "bedroom|bathroom|kitchen|living_room|dining_room|office|storage|garage|hallway",
      "area": number,
      "position": {"x": number, "y": number},
      "size": {"width": number, "height": number},
      "doors": [{"position": "north|south|east|west", "width": number}],
      "windows": [{"position": "north|south|east|west", "width": number, "height": number}],
      "features": ["string"]
    }
  ],
  "walls": [
    {
      "start": [number, number],
      "end": [number, number], 
      "thickness": number,
      "material": "string"
    }
  ],
  "connections": [
    {
      "from": "string",
      "to": "string", 
      "type": "door|opening|window",
      "width": number
    }
  ]
}

🔥 REGLAS CRÍTICAS PARA PLANO CUADRADO:
1. DIMENSIONES: width = length = √(área_total * 1.2) 
2. POSICIONAMIENTO: Todas las habitaciones position.x + size.width ≤ width
3. POSICIONAMIENTO: Todas las habitaciones position.y + size.height ≤ length  
4. DISTRIBUCIÓN: Usar grid de 2x2, 3x3 o 4x4 según número de habitaciones
5. HABITACIONES: Tamaños proporcionales al área del cuadrado
6. CONEXIONES: Habitaciones adyacentes deben conectar lógicamente
7. BORDES: Dejar margen de 0.5m desde los bordes del plano
8. VERIFICACIÓN: position.x ≥ 0.5, position.y ≥ 0.5
9. VERIFICACIÓN: position.x + size.width ≤ width - 0.5
10. VERIFICACIÓN: position.y + size.height ≤ length - 0.5
`;

    const userPrompt = `
Convierte esta descripción arquitectónica a la estructura JSON especificada:

"${userDescription}"

Genera un diseño arquitectónico completo, realista y funcional basado en esta descripción.
`;

    try {
      const response = await client.chat.completions.create({
        model: openaiConfig.model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: openaiConfig.temperature,
        max_tokens: openaiConfig.maxTokens,
        response_format: { type: 'json_object' }
      });

      const content = response.choices[0]?.message?.content;
      if (!content) {
        throw new Error('No se recibió respuesta de OpenAI');
      }

      const structuralData = JSON.parse(content) as NLPStructuralData;
      
      // Validar estructura básica
      this.validateStructuralData(structuralData);
      
      return structuralData;

    } catch (error) {
      console.error('❌ Error extrayendo datos estructurales:', error);
      throw new Error(`Error procesando con OpenAI: ${error instanceof Error ? error.message : 'Error desconocido'}`);
    }
  }

  /**
   * Valida la estructura de datos extraída y corrige posiciones si es necesario
   */
  private static validateStructuralData(data: NLPStructuralData): void {
    if (!data.metadata || !data.rooms || !Array.isArray(data.rooms)) {
      throw new Error('Estructura de datos inválida recibida de OpenAI');
    }

    if (data.rooms.length === 0) {
      throw new Error('No se detectaron habitaciones en la descripción');
    }

    // 🎯 VALIDAR Y CORREGIR PLANO CUADRADO
    const { width, length } = data.metadata.dimensions;
    
    // Forzar dimensiones cuadradas si no lo son
    if (Math.abs(width - length) > 0.5) {
      const avgDimension = Math.max(width, length);
      data.metadata.dimensions.width = avgDimension;
      data.metadata.dimensions.length = avgDimension;
      console.log(`🔧 Corrigiendo a dimensiones cuadradas: ${avgDimension}x${avgDimension}m`);
    }

    const planSize = data.metadata.dimensions.width;
    let correctionsMade = 0;

    // Validar que cada habitación esté dentro del plano
    for (const room of data.rooms) {
      if (!room.name || !room.position || !room.size || room.area <= 0) {
        throw new Error(`Habitación inválida detectada: ${room.name || 'sin nombre'}`);
      }

      // 🚨 CORRECCIONES AUTOMÁTICAS PARA MANTENER HABITACIONES DENTRO DEL PLANO
      const margin = 0.5; // Margen de seguridad

      // Corregir posición X
      if (room.position.x < margin) {
        room.position.x = margin;
        correctionsMade++;
      }

      // Corregir posición Y
      if (room.position.y < margin) {
        room.position.y = margin;
        correctionsMade++;
      }

      // Corregir si se sale por la derecha
      if (room.position.x + room.size.width > planSize - margin) {
        const maxWidth = planSize - margin - room.position.x;
        if (maxWidth > 1) {
          room.size.width = maxWidth;
        } else {
          room.position.x = margin;
          room.size.width = Math.min(room.size.width, planSize - 2 * margin);
        }
        correctionsMade++;
      }

      // Corregir si se sale por abajo
      if (room.position.y + room.size.height > planSize - margin) {
        const maxHeight = planSize - margin - room.position.y;
        if (maxHeight > 1) {
          room.size.height = maxHeight;
        } else {
          room.position.y = margin;
          room.size.height = Math.min(room.size.height, planSize - 2 * margin);
        }
        correctionsMade++;
      }

      // Recalcular área después de correcciones
      room.area = Math.round(room.size.width * room.size.height * 100) / 100;
    }

    if (correctionsMade > 0) {
      console.log(`🔧 Se realizaron ${correctionsMade} correcciones para mantener habitaciones dentro del plano`);
    }
  }

  /**
   * Genera archivo SVG (plano 2D)
   */
  private static async generateSVGFile(
    data: NLPStructuralData, 
    designId: string, 
    outputDirectory: string
  ): Promise<{ content: string; filename: string; path: string }> {
    const TypeScriptSVGGenerator = (await import('./TypeScriptSVGGenerator')).default;
    
    const svgContent = TypeScriptSVGGenerator.generateArchitecturalSVG(data);
    const filename = `${designId}_plan_2d.svg`;
    const fullPath = `${outputDirectory}/${filename}`;

    // Guardar archivo
    const fs = await import('fs');
    const path = await import('path');
    
    // Crear directorio si no existe
    const dir = path.dirname(fullPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    fs.writeFileSync(fullPath, svgContent, 'utf8');

    return {
      content: svgContent,
      filename,
      path: fullPath
    };
  }

  /**
   * Genera archivo STL (modelo 3D)
   */
  private static async generateSTLFile(
    data: NLPStructuralData, 
    designId: string, 
    outputDirectory: string
  ): Promise<{ content: string; filename: string; path: string }> {
    const TypeScriptSTLGenerator = (await import('./TypeScriptSTLGenerator')).default;
    
    const stlContent = TypeScriptSTLGenerator.generateArchitecturalSTL(data);
    const filename = `${designId}_model_3d.stl`;
    const fullPath = `${outputDirectory}/${filename}`;

    // Guardar archivo
    const fs = await import('fs');
    const path = await import('path');
    
    // Crear directorio si no existe
    const dir = path.dirname(fullPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    fs.writeFileSync(fullPath, stlContent, 'utf8');

    return {
      content: stlContent,
      filename,
      path: fullPath
    };
  }

  /**
   * Verifica el estado del servicio OpenAI
   */
  static async checkServiceStatus(): Promise<{
    available: boolean;
    model: string;
    error?: string;
  }> {
    try {
      const client = this.initializeClient();
      
      // Hacer una prueba simple
      const response = await client.chat.completions.create({
        model: openaiConfig.model,
        messages: [{ role: 'user', content: 'Test' }],
        max_tokens: 10
      });

      return {
        available: true,
        model: openaiConfig.model
      };
    } catch (error) {
      return {
        available: false,
        model: openaiConfig.model,
        error: error instanceof Error ? error.message : 'Error desconocido'
      };
    }
  }

  /**
   * Obtiene la configuración del servicio
   */
  static getServiceConfig() {
    return {
      model: openaiConfig.model,
      timeout: openaiConfig.timeout,
      maxRetries: openaiConfig.maxRetries,
      temperature: openaiConfig.temperature,
      maxTokens: openaiConfig.maxTokens
    };
  }
}

export default OpenAIArchitecturalService;