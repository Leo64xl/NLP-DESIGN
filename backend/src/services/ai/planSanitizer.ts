import { ArchitecturalLayoutEngine } from './ArchitecturalLayoutEngine'; 
import { ArchitecturalPlan } from './ConfigAI';

export function sanitizePlan(plan: ArchitecturalPlan): ArchitecturalPlan {
  try {
    console.log('🔧 Iniciando sanitización del plan dinámico...');
    
    // Convertir el plan existente a requerimientos dinámicos
    const userRequirements = plan.rooms.map(room => ({
      name: room.name,
      type: room.purpose || room.name,
      area: room.area,
      specifications: room.features || []
    }));
    
    // Detectar tipo de edificio basándose en las habitaciones
    const buildingType = detectBuildingType(userRequirements);
    
    // ✅ CORRECCIÓN: Usar valores por defecto para propiedades faltantes
    const result = ArchitecturalLayoutEngine.generateDynamicLayout(
      userRequirements,
      plan.metadata.totalArea,
      buildingType,
      {
        orientation: 'south', // ✅ Valor por defecto en lugar de plan.metadata.orientation
        style: plan.metadata.style as any || 'modern' // ✅ Valor por defecto si no existe
      }
    );
    
    if (!result.success) {
      throw new Error(`Error en generación de layout dinámico: ${result.error}`);
    }
    
    console.log('✅ Plan dinámico sanitizado exitosamente');
    console.log(`📊 ${result.suggestions.userRooms} habitaciones del usuario, ${result.suggestions.suggestedRooms} sugeridas`);
    
    // ✅ CORRECCIÓN: Solo retornar propiedades que existen en ArchitecturalPlan
    const sanitizedPlan: ArchitecturalPlan = {
      ...plan,
      rooms: result.layout.map(room => ({
        name: room.name,
        area: room.area,
        position: room.position,
        size: room.size,
        purpose: room.specifications.join(', ') || room.type,
        features: [`Tipo: ${room.type}`, `Prioridad: ${room.priority}`, `Fuente: ${room.source}`]
      })),
      // ✅ Mejorar threeJSData en lugar de añadir propiedades nuevas
      threeJSData: {
        ...plan.threeJSData,
        // Actualizar con datos del layout engine
        rooms: result.layout.map(room => ({
          name: room.name,
          vertices: [
            [room.position.x, room.position.y],
            [room.position.x + room.size.width, room.position.y],
            [room.position.x + room.size.width, room.position.y + room.size.height],
            [room.position.x, room.position.y + room.size.height]
          ],
          height: 3.0,
          material: getRoomMaterial(room.type)
        })),
        walls: result.structural?.externalWalls || plan.threeJSData.walls || [],
        // ✅ CORRECCIÓN: Asegurar tipos compatibles para puertas
        doors: result.layout.flatMap(room => 
          room.doors.map(door => ({
            position: door.position,
            size: [0.9, 2.1] as [number, number], // Tamaño estándar de puerta
            rotation: 0,
            type: normalizeDoorType(door.type) // ✅ Función para normalizar tipo
          }))
        ).length > 0 ? result.layout.flatMap(room => 
          room.doors.map(door => ({
            position: door.position,
            size: [0.9, 2.1] as [number, number],
            rotation: 0,
            type: normalizeDoorType(door.type)
          }))
        ) : plan.threeJSData.doors || [],
        // ✅ CORRECCIÓN: Asegurar tipos compatibles para ventanas
        windows: result.layout.flatMap(room => 
          room.windows.map(window => ({
            position: window.position,
            size: window.size,
            orientation: normalizeOrientation(window.orientation) // ✅ Función para normalizar orientación
          }))
        ).length > 0 ? result.layout.flatMap(room => 
          room.windows.map(window => ({
            position: window.position,
            size: window.size,
            orientation: normalizeOrientation(window.orientation)
          }))
        ) : plan.threeJSData.windows || []
      },
      // ✅ Mejorar metadata con información del layout engine
      metadata: {
        ...plan.metadata,
        // Añadir información del building a las dimensiones existentes
        dimensions: {
          width: result.building?.width || plan.metadata.dimensions?.width || 10,
          length: result.building?.depth || plan.metadata.dimensions?.length || 10
        }
      }
    };

    // ✅ Agregar información del layout engine como propiedades personalizadas
    (sanitizedPlan as any).layoutEngineData = {
      building: result.building,
      suggestions: result.suggestions,
      validation: result.validation,
      renderData: {
        svg: result.render2D,
        threejs: result.render3D
      },
      structural: result.structural
    };
    
    return sanitizedPlan;
    
  } catch (error: unknown) { // ✅ CORRECCIÓN: Tipado explícito del error
    const errorMessage = error instanceof Error ? error.message : 'Error desconocido en sanitización';
    console.error('❌ Error en sanitización dinámica:', errorMessage);
    throw new Error(`Error en sanitización del plan dinámico: ${errorMessage}`);
  }
}

function detectBuildingType(requirements: any[]): 'residential' | 'commercial' | 'mixed' {
  const roomTypes = requirements.map(req => req.name.toLowerCase());
  
  const residentialKeywords = ['dormitorio', 'bedroom', 'sala', 'living', 'cocina', 'kitchen', 'baño', 'bathroom'];
  const commercialKeywords = ['oficina', 'office', 'tienda', 'shop', 'consultorio', 'clinic', 'almacen', 'warehouse'];
  
  const residentialCount = roomTypes.filter(type => 
    residentialKeywords.some(keyword => type.includes(keyword))
  ).length;
  
  const commercialCount = roomTypes.filter(type => 
    commercialKeywords.some(keyword => type.includes(keyword))
  ).length;
  
  if (residentialCount > commercialCount) return 'residential';
  if (commercialCount > residentialCount) return 'commercial';
  return 'mixed';
}

// ✅ FUNCIÓN AUXILIAR: Obtener material de habitación
function getRoomMaterial(roomType: string): string {
  const materials: Record<string, string> = {
    'social': 'wood_floor',
    'service': 'tile_floor',
    'rest': 'carpet',
    'hygiene': 'ceramic_tile',
    'circulation': 'tile_floor',
    'work': 'wood_floor',
    'storage': 'concrete_floor'
  };
  
  return materials[roomType] || 'wood_floor';
}

// ✅ FUNCIÓN AUXILIAR: Normalizar tipo de puerta
function normalizeDoorType(doorType: string): 'main' | 'interior' | 'sliding' | 'double' {
  const type = doorType.toLowerCase();
  
  if (type.includes('main') || type.includes('principal') || type.includes('entrada')) {
    return 'main';
  }
  if (type.includes('sliding') || type.includes('corrediza') || type.includes('deslizante')) {
    return 'sliding';
  }
  if (type.includes('double') || type.includes('doble') || type.includes('francesa')) {
    return 'double';
  }
  
  // Por defecto, las puertas interiores
  return 'interior';
}

// ✅ FUNCIÓN AUXILIAR: Normalizar orientación de ventana
function normalizeOrientation(orientation: string): 'north' | 'south' | 'east' | 'west' {
  const orient = orientation.toLowerCase();
  
  if (orient.includes('north') || orient.includes('norte')) {
    return 'north';
  }
  if (orient.includes('south') || orient.includes('sur')) {
    return 'south';
  }
  if (orient.includes('east') || orient.includes('este')) {
    return 'east';
  }
  if (orient.includes('west') || orient.includes('oeste')) {
    return 'west';
  }
  
  // Por defecto, orientación sur (mejor iluminación)
  return 'south';
}