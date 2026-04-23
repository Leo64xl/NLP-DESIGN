import path from 'path';
import { ArchitecturalPrompt, ArchitecturalPlan } from './ConfigAI';
import OpenAIArchitecturalService, { FileGenerationResult } from './OpenAIArchitecturalService';

/**
 * Servicio principal de IA - Usa OpenAI exclusivamente
 */
export class MainAIService {
  
  /**
   * Genera un plan arquitectónico usando OpenAI
   */
  static async generatePlan(
    prompt: ArchitecturalPrompt,
    designUuid: string  
  ): Promise<{plan: ArchitecturalPlan, structuralData: any, files: {svg: string, stl: string}}> {
    console.log('🚀 Iniciando generación de plan arquitectónico con OpenAI...');
    
    try {
      // Validar entrada
      this.validatePrompt(prompt);
      
      // Verificar que OpenAI esté disponible
      const openaiStatus = await OpenAIArchitecturalService.checkServiceStatus();
      
      if (!openaiStatus.available) {
        throw new Error(`OpenAI no disponible: ${openaiStatus.error}`);
      }

      console.log('✅ OpenAI disponible, procesando con NLP to 2D/3D...');
      
      // Usar el UUID real como carpeta de destino
      const outputDirectory = path.join(process.cwd(), 'uploads', 'designs', designUuid);
      
      const result = await OpenAIArchitecturalService.processNLPToFiles(
        prompt.userDescription,
        designUuid,      
        outputDirectory  
      );
      
      // Convertir resultado de OpenAI al formato ArchitecturalPlan esperado
      const architecturalPlan = this.convertOpenAIToArchitecturalPlan(result, prompt);
      
      console.log('✅ Plan generado exitosamente con OpenAI');
      
      // Devolver plan Y structuralData completo para visualización instantánea
      return {
        plan: architecturalPlan,
        structuralData: result.structuralData,
        files: result.files
      };
      
    } catch (error) {
      console.error('❌ Error en generación:', error);
      const errorMessage = error instanceof Error ? error.message : 'Error desconocido';
      throw new Error(`Error generando plan: ${errorMessage}`);
    }
  }

  /**
   * Genera archivos 2D/3D usando OpenAI NLP
   */
  static async generateNLP2D3DFiles(
    userDescription: string,
    designId: string,
    outputDirectory: string
  ): Promise<FileGenerationResult> {
    console.log('🎨 Generando archivos 2D/3D con OpenAI NLP...');
    
    try {
      const result = await OpenAIArchitecturalService.processNLPToFiles(
        userDescription,
        designId,
        outputDirectory
      );
      
      console.log('✅ Archivos 2D/3D generados exitosamente');
      return result;
      
    } catch (error) {
      console.error('❌ Error generando archivos 2D/3D:', error);
      throw new Error(`Error en generación NLP to 2D/3D: ${error instanceof Error ? error.message : 'Error desconocido'}`);
    }
  }
  
  /**
   * Convierte resultado de OpenAI al formato ArchitecturalPlan
   */
  private static convertOpenAIToArchitecturalPlan(
    openaiResult: any, 
    originalPrompt: ArchitecturalPrompt
  ): ArchitecturalPlan {
    const structuralData = openaiResult.structuralData;
    
    return {
      metadata: {
        title: structuralData.metadata.title,
        totalArea: structuralData.metadata.totalArea,
        dimensions: structuralData.metadata.dimensions,
        style: structuralData.metadata.style,
        generatedAt: structuralData.metadata.generatedAt,
        generationMethod: 'openai',
        processingTime: openaiResult.processingTime
      },
      description: structuralData.metadata.description,
      rooms: structuralData.rooms.map((room: any) => ({
        name: room.name,
        area: room.area,
        position: room.position,
        size: room.size,
        purpose: room.type,
        features: room.features
      })),
      threeJSData: {
        vertices: structuralData.rooms.map((room: any) => [
          room.position.x, room.position.y, 0
        ]),
        faces: structuralData.rooms.map((room: any, index: number) => [
          index * 4, index * 4 + 1, index * 4 + 2, index * 4 + 3
        ]),
        walls: structuralData.walls || [],
        rooms: structuralData.rooms.map((room: any) => ({
          name: room.name,
          vertices: [
            [room.position.x, room.position.y],
            [room.position.x + room.size.width, room.position.y],
            [room.position.x + room.size.width, room.position.y + room.size.height],
            [room.position.x, room.position.y + room.size.height]
          ],
          height: 2.5,
          material: 'default'
        })),
        doors: structuralData.connections?.filter((c: any) => c.type === 'door').map((door: any) => ({
          position: [
            door.from === structuralData.rooms[0]?.name ? structuralData.rooms[0].position.x : 0, 
            door.from === structuralData.rooms[0]?.name ? structuralData.rooms[0].position.y : 0
          ],
          size: [door.width, 2],
          rotation: 0,
          type: 'interior' as const
        })) || [],
        windows: structuralData.connections?.filter((c: any) => c.type === 'window').map((window: any) => ({
          position: [
            window.from === structuralData.rooms[0]?.name ? structuralData.rooms[0].position.x : 0, 
            window.from === structuralData.rooms[0]?.name ? structuralData.rooms[0].position.y : 0,
            1
          ],
          size: [window.width, 1.2],
          orientation: 'north' as const
        })) || [],
        furniture: []
      },
      technicalSpecs: {
        structure: 'Concreto armado',
        materials: ['Concreto', 'Ladrillo', 'Acero'],
        electrical: 'Instalación eléctrica completa',
        plumbing: 'Instalación sanitaria completa',
        accessibility: []
      },
      estimatedCost: {
        construction: structuralData.metadata.totalArea * 800,
        materials: structuralData.metadata.totalArea * 400,
        labor: structuralData.metadata.totalArea * 400,
        total: structuralData.metadata.totalArea * 1200,
        currency: 'USD'
      }
    };
  }
  
  /**
   * Valida el prompt de entrada
   */
  private static validatePrompt(prompt: ArchitecturalPrompt): void {
    if (!prompt.userDescription?.trim()) {
      throw new Error('Descripción del usuario es requerida');
    }
    
    if (!prompt.context?.designType) {
      throw new Error('Tipo de diseño es requerido');
    }
    
    if (prompt.requirements?.totalArea && prompt.requirements.totalArea <= 0) {
      throw new Error('Área total debe ser mayor a 0');
    }
  }
  
  /**
   * Verifica el estado del servicio OpenAI
   */
  static async getServiceStatus(): Promise<{
    status: 'available' | 'unavailable';
    service: 'openai';
    model: string;
    error?: string;
  }> {
    try {
      const openaiStatus = await OpenAIArchitecturalService.checkServiceStatus();
      
      return {
        status: openaiStatus.available ? 'available' : 'unavailable',
        service: 'openai',
        model: openaiStatus.model,
        error: openaiStatus.error
      };
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Error desconocido en el servicio';
      return {
        status: 'unavailable',
        service: 'openai',
        model: 'gpt-4o-mini',
        error: errorMessage
      };
    }
  }
}

export default MainAIService;