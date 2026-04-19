import { Graph } from 'graphlib';
import { PascalGenerator } from '../Pascal/PascalGenerator';
import { SpacePartitioner } from '../../utils/SpacePartitioner'; 

interface RoomRequirement {
  name: string;
  type?: string;
  area?: number;
  minArea?: number;
  maxArea?: number;
  priority?: 'required' | 'suggested' | 'optional';
  specifications?: string[];
}

interface BuildingConstraints {
  buildingWidth?: number;
  buildingDepth?: number;
  orientation?: 'north' | 'south' | 'east' | 'west';
  style?: 'modern' | 'traditional' | 'open_concept';
  maxFloors?: number;
  accessibility?: boolean;
}

interface DynamicRoom {
  id: string;
  name: string;
  type: string;
  area: number;
  width: number;
  height: number;
  aspectRatio: number;
  priority: 'required' | 'suggested' | 'optional';
  placement: 'front' | 'back' | 'private' | 'connector' | 'flexible';
  adjacencies: string[];
  specifications: string[];
  source: 'user' | 'suggested';
}

interface LayoutRoom extends DynamicRoom {
  position: { x: number; y: number };
  size: { width: number; height: number };
  rotation: number;
  doors: Array<{ position: [number, number], orientation: string, type: string }>;
  windows: Array<{ position: [number, number, number], size: [number, number], orientation: string }>;
}

// 🔧 TIPOS CORREGIDOS PARA ÍNDICES
type RoomFunctionType = 'social' | 'rest' | 'service' | 'hygiene' | 'circulation' | 'work' | 'storage';
type BuildingType = 'residential' | 'commercial';
type PlacementType = 'front' | 'back' | 'private' | 'connector' | 'flexible';
type StandardRoomType = 'living_area' | 'kitchen' | 'bedroom' | 'bathroom' | 'dining_area' | 'hallway' | 'storage' | 'circulation' | 'main_area' | 'reception' | 'office';

export class ArchitecturalLayoutEngine {
  private static readonly DOOR_CLEAR_OPENING = 0.9;
  
  // 🔧 ESTÁNDARES CORREGIDOS
  private static readonly HOUSING_STANDARDS: Record<BuildingType, { essential: string[]; comfort: string[]; luxury: string[] }> = {
    residential: {
      essential: ['living_area', 'kitchen', 'bedroom', 'bathroom'],
      comfort: ['dining_area', 'hallway', 'storage'],
      luxury: ['guest_room', 'study', 'laundry_room', 'balcony']
    },
    commercial: {
      essential: ['main_area', 'reception', 'bathroom'],
      comfort: ['storage', 'office', 'meeting_room'],
      luxury: ['conference_room', 'break_room', 'server_room']
    }
  };

  // 🔧 GUÍAS DE FUNCIÓN CORREGIDAS - AQUÍ ESTÁ EL FIX
  private static readonly ROOM_FUNCTION_GUIDES: Record<RoomFunctionType, {
    minArea: number;
    maxArea: number;
    aspectRatio: number[];
    placement: PlacementType; // ✅ CAMBIO AQUÍ: de string a PlacementType
    adjacencies: string[];
  }> = {
    social: { 
      minArea: 15, maxArea: 50, 
      aspectRatio: [1.0, 2.0], 
      placement: 'front',
      adjacencies: ['kitchen', 'dining', 'entrance']
    },
    rest: { 
      minArea: 10, maxArea: 25, 
      aspectRatio: [1.0, 1.6], 
      placement: 'private',
      adjacencies: ['bathroom', 'hallway']
    },
    service: { 
      minArea: 8, maxArea: 20, 
      aspectRatio: [0.8, 1.5], 
      placement: 'back',
      adjacencies: ['dining', 'storage']
    },
    hygiene: { 
      minArea: 4, maxArea: 12, 
      aspectRatio: [0.8, 1.4], 
      placement: 'private',
      adjacencies: ['bedroom', 'hallway']
    },
    circulation: { 
      minArea: 6, maxArea: 20, 
      aspectRatio: [2.0, 6.0], 
      placement: 'connector',
      adjacencies: ['*']
    },
    work: { 
      minArea: 12, maxArea: 40, 
      aspectRatio: [1.0, 2.0], 
      placement: 'flexible',
      adjacencies: ['entrance', 'storage']
    },
    storage: { 
      minArea: 3, maxArea: 15, 
      aspectRatio: [0.8, 2.0], 
      placement: 'back',
      adjacencies: ['*']
    }
  };

  /**
   * Genera un layout completamente dinámico basado en requerimientos del usuario
   */
  static generateDynamicLayout(
    userRequirements: RoomRequirement[],
    totalArea: number,
    buildingType: 'residential' | 'commercial' | 'mixed',
    constraints: BuildingConstraints = {}
  ) {
    
    try {
      console.log('🏗️ Iniciando generación de layout dinámico...');
      console.log('📋 Requerimientos del usuario:', userRequirements.length);
      
      // 1. Procesar requerimientos del usuario
      const userRooms = this.processUserRequirements(userRequirements, totalArea);
      console.log('✅ Habitaciones del usuario procesadas:', userRooms.length);
      
      // 2. Corregir buildingType para evitar 'mixed'
      const correctedBuildingType: BuildingType = buildingType === 'mixed' ? 'residential' : buildingType as BuildingType;
      
      // 3. Sugerir habitaciones complementarias
      const suggestedRooms = this.suggestComplementaryRooms(userRooms, correctedBuildingType, totalArea);
      console.log('✅ Habitaciones sugeridas:', suggestedRooms.length);
      
      // 4. Combinar todas las habitaciones
      const allRooms = this.ensureCirculationRoom([...userRooms, ...suggestedRooms], totalArea);
      
      // 5. Calcular dimensiones del edificio
      const building = this.calculateOptimalBuildingDimensions(allRooms, totalArea, constraints);
      console.log('✅ Dimensiones del edificio:', `${building.width}x${building.depth}m`);
      
      // 6. Crear grafo de conectividad
      const connectivityGraph = this.createDynamicConnectivityGraph(allRooms);

      // 7. Resolver layout con restricciones
      const partitionedSpaces = SpacePartitioner.generateLayout(allRooms, building.width, building.depth);

      const layout: LayoutRoom[] = partitionedSpaces.map(room => ({
        ...(room as DynamicRoom),
        position: room.position!, // Las coordenadas perfectas calculadas por Treemap
        size: room.size!,         // El ancho y alto perfecto sin decimales flotantes
        rotation: 0,
        doors: [],
        windows: []
      }));
      console.log('✅ Layout particionado (Cero huecos):', layout.length, 'habitaciones colocadas');
            
      // 8. Generar puertas y ventanas
      const layoutWithOpenings = this.generateDoorsAndWindows(layout, building);
      
      // 9. Validar geometría
      const validation = this.validateDynamicGeometry(layoutWithOpenings, building);
      
      // 10. Optimizar si es necesario
      const optimizedLayout = validation.valid ? 
        layoutWithOpenings : 
        this.optimizeDynamicLayout(layoutWithOpenings, building);
      
      // 11. Generar datos de renderizado
      const render2D = this.generateStructuralSVG(optimizedLayout, building);
      const pascalBlueprint = PascalGenerator.generateShell(optimizedLayout, building);
      const structural = this.generateWallStructure(optimizedLayout, building);
      
      return {
        success: true,
        layout: optimizedLayout,
        building,
        render2D,
        pascalData: pascalBlueprint,
        structural,
        validation,
        suggestions: {
          userRooms: userRooms.length,
          suggestedRooms: suggestedRooms.length,
          totalArea: building.totalArea,
          efficiency: (building.usableArea / building.totalArea * 100).toFixed(1) + '%'
        }
      };
      
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Error desconocido';
      console.error('❌ Error en generación de layout dinámico:', errorMessage);
      return {
        success: false,
        error: errorMessage,
        layout: [],
        building: null,
        suggestions: { userRooms: 0, suggestedRooms: 0 }
      };
    }
  }

  /**
   * Procesa los requerimientos específicos del usuario
   */
  private static processUserRequirements(requirements: RoomRequirement[], totalArea: number): DynamicRoom[] {
    const rooms: DynamicRoom[] = [];
    let allocatedArea = 0;

    for (const req of requirements) {
      // Detectar función de la habitación
      const roomFunction = this.detectRoomFunction(req.name, req.type, req.specifications);
      const functionGuide = this.ROOM_FUNCTION_GUIDES[roomFunction as RoomFunctionType] || this.ROOM_FUNCTION_GUIDES['work'];
      
      // Calcular área
      let area = req.area || req.minArea || functionGuide.minArea;
      if (req.maxArea && area > req.maxArea) area = req.maxArea;
      if (area < functionGuide.minArea) area = functionGuide.minArea;
      
      // Calcular dimensiones
      const aspectRatio = (functionGuide.aspectRatio[0] + functionGuide.aspectRatio[1]) / 2;
      const width = Math.sqrt(area * aspectRatio);
      const height = area / width;

      rooms.push({
        id: `user_${req.name.replace(/\s+/g, '_')}_${Date.now()}`,
        name: req.name,
        type: this.normalizeRoomType(req.name, roomFunction),
        area: Math.round(area * 10) / 10,
        width: Math.round(width * 10) / 10,
        height: Math.round(height * 10) / 10,
        aspectRatio,
        priority: req.priority || 'required',
        placement: functionGuide.placement, // ✅ YA NO HAY ERROR AQUÍ
        adjacencies: req.specifications?.filter(spec => spec.includes('cerca de')) || functionGuide.adjacencies,
        specifications: req.specifications || [],
        source: 'user'
      });

      allocatedArea += area;
    }

    // Ajustar áreas si exceden el 70% del total
    const maxUserArea = totalArea * 0.70;
    if (allocatedArea > maxUserArea) {
      const scaleFactor = maxUserArea / allocatedArea;
      rooms.forEach(room => {
        room.area = Math.round(room.area * scaleFactor * 10) / 10;
        room.width = Math.round(room.width * Math.sqrt(scaleFactor) * 10) / 10;
        room.height = Math.round(room.height * Math.sqrt(scaleFactor) * 10) / 10;
      });
    }

    return rooms;
  }

  /**
   * Detecta la función de una habitación basándose en su nombre y descripción
   */
  private static detectRoomFunction(name: string, type?: string, specs?: string[]): RoomFunctionType {
    const input = `${name} ${type || ''} ${specs?.join(' ') || ''}`.toLowerCase();
    
    // Mapeo inteligente de funciones
    if (input.includes('sala') || input.includes('living') || input.includes('estar') || 
        input.includes('social') || input.includes('recibo')) return 'social';
    
    if (input.includes('dormitorio') || input.includes('bedroom') || input.includes('cuarto') || 
        input.includes('habitacion') || input.includes('descanso')) return 'rest';
    
    if (input.includes('cocina') || input.includes('kitchen') || input.includes('cocineta')) return 'service';
    
    if (input.includes('baño') || input.includes('bathroom') || input.includes('bano') || 
        input.includes('aseo') || input.includes('higiene')) return 'hygiene';
    
    if (input.includes('pasillo') || input.includes('hallway') || input.includes('corredor') || 
        input.includes('entrada') || input.includes('vestibulo')) return 'circulation';
    
    if (input.includes('oficina') || input.includes('office') || input.includes('estudio') || 
        input.includes('trabajo') || input.includes('despacho')) return 'work';
    
    if (input.includes('deposito') || input.includes('storage') || input.includes('almacen') || 
        input.includes('bodega') || input.includes('closet')) return 'storage';
    
    return 'work'; // función por defecto flexible
  }

  /**
   * Sugiere habitaciones complementarias
   */
  private static suggestComplementaryRooms(
    userRooms: DynamicRoom[], 
    buildingType: BuildingType,
    totalArea: number
  ): DynamicRoom[] {
    
    const suggestions: DynamicRoom[] = [];
    const userFunctions = userRooms.map(room => this.detectRoomFunction(room.name));
    const standards = this.HOUSING_STANDARDS[buildingType];
    
    // Calcular área disponible
    const usedArea = userRooms.reduce((sum, room) => sum + room.area, 0);
    const availableArea = (totalArea * 0.85) - usedArea;
    
    if (availableArea < 10) return suggestions;
    
    // Sugerir habitaciones esenciales faltantes
    const missingEssentials = standards.essential.filter((essential: string) => 
      !userFunctions.some(func => this.functionsMatch(func, essential))
    );
    
    for (const missing of missingEssentials) {
      const suggestedRoom = this.createSuggestedRoom(missing, availableArea / missingEssentials.length);
      if (suggestedRoom) {
        suggestions.push(suggestedRoom);
      }
    }
    
    return suggestions;
  }

  /**
   * Verifica si dos funciones coinciden
   */
  private static functionsMatch(userFunction: string, standardFunction: string): boolean {
    const matches: Record<string, string[]> = {
      'living_area': ['social'],
      'kitchen': ['service'],
      'bedroom': ['rest'],
      'bathroom': ['hygiene'],
      'dining_area': ['social'],
      'hallway': ['circulation'],
      'storage': ['storage'],
      'main_area': ['social', 'work'],
      'reception': ['social'],
      'office': ['work']
    };
    
    return matches[standardFunction]?.includes(userFunction) || false;
  }

  /**
   * Crea una habitación sugerida
   */
  private static createSuggestedRoom(functionType: string, availableArea: number): DynamicRoom | null {
    const functionGuide = this.getFunctionGuideByStandard(functionType);
    if (!functionGuide) return null;
    
    const area = Math.min(Math.max(functionGuide.minArea, availableArea * 0.5), functionGuide.maxArea);
    const aspectRatio = (functionGuide.aspectRatio[0] + functionGuide.aspectRatio[1]) / 2;
    const width = Math.sqrt(area * aspectRatio);
    const height = area / width;
    
    return {
      id: `suggested_${functionType}_${Date.now()}`,
      name: this.getStandardRoomName(functionType),
      type: functionType,
      area: Math.round(area * 10) / 10,
      width: Math.round(width * 10) / 10,
      height: Math.round(height * 10) / 10,
      aspectRatio,
      priority: 'suggested',
      placement: functionGuide.placement, // ✅ YA NO HAY ERROR AQUÍ TAMPOCO
      adjacencies: functionGuide.adjacencies,
      specifications: [`Sugerido automáticamente para ${functionType}`],
      source: 'suggested'
    };
  }

  /**
   * Obtiene la guía de función para estándares específicos
   */
  private static getFunctionGuideByStandard(standard: string) {
    const mapping: Record<string, RoomFunctionType> = {
      'living_area': 'social',
      'kitchen': 'service', 
      'bedroom': 'rest',
      'bathroom': 'hygiene',
      'dining_area': 'social',
      'hallway': 'circulation',
      'storage': 'storage',
      'circulation': 'circulation'
    };
    
    const functionType = mapping[standard] || 'work';
    return this.ROOM_FUNCTION_GUIDES[functionType];
  }

  /**
   * Obtiene el nombre estándar para un tipo de habitación
   */
  private static getStandardRoomName(functionType: string): string {
    const names: Record<string, string> = {
      'living_area': 'Sala de estar',
      'kitchen': 'Cocina',
      'bedroom': 'Dormitorio',
      'bathroom': 'Baño',
      'dining_area': 'Comedor',
      'hallway': 'Pasillo',
      'storage': 'Almacén',
      'circulation': 'Circulación'
    };
    
    return names[functionType] || `Área ${functionType}`;
  }

  /**
   * Normaliza el tipo de habitación para consistencia
   */
  private static normalizeRoomType(name: string, detectedFunction: string): string {
    return detectedFunction;
  }

  /**
   * Garantiza un espacio de circulacion para conectar todas las habitaciones.
   */
  private static ensureCirculationRoom(rooms: DynamicRoom[], totalArea: number): DynamicRoom[] {
    if (rooms.some(room => room.type === 'circulation')) {
      return rooms;
    }

    const guide = this.ROOM_FUNCTION_GUIDES.circulation;
    const targetArea = Math.max(guide.minArea, Math.min(guide.maxArea, totalArea * 0.08));
    const width = 1.5;
    const height = Math.max(guide.minArea / width, targetArea / width);

    const circulationRoom: DynamicRoom = {
      id: `suggested_circulation_${Date.now()}`,
      name: 'Pasillo de Circulacion',
      type: 'circulation',
      area: Math.round(targetArea * 10) / 10,
      width: Math.round(width * 10) / 10,
      height: Math.round(height * 10) / 10,
      aspectRatio: width / Math.max(height, 0.1),
      priority: 'required',
      placement: 'connector',
      adjacencies: ['*'],
      specifications: ['Generado automaticamente para conectividad'],
      source: 'suggested'
    };

    return [...rooms, circulationRoom];
  }

  /**
   * Genera puertas y ventanas automáticamente
   */
  private static generateDoorsAndWindows(layout: LayoutRoom[], building: any): LayoutRoom[] {
    return layout.map(room => ({
      ...room,
      doors: this.generateRoomDoors(room, layout, building),
      windows: this.generateRoomWindows(room, building)
    }));
  }

  /**
   * Genera puertas para una habitación específica
   */
  private static generateRoomDoors(room: LayoutRoom, allRooms: LayoutRoom[], building: any) {
    const doors: { position: [number, number], orientation: string, type: string }[] = [];
    const seenDoors = new Set<string>();

    const addDoor = (door: { position: [number, number], orientation: string, type: string }) => {
      const key = `${Math.round(door.position[0] * 100)}_${Math.round(door.position[1] * 100)}_${door.type}`;
      if (seenDoors.has(key)) return;
      seenDoors.add(key);
      doors.push(door);
    };

    const hallway = allRooms.find(r => r.type === 'circulation');

    if (hallway && room.id !== hallway.id) {
      const toHallway = this.findOptimalDoorPosition(room, hallway);
      if (toHallway) {
        addDoor({
          position: [toHallway.x, toHallway.y] as [number, number],
          orientation: toHallway.orientation,
          type: 'interior'
        });
        return doors;
      }

      // Fallback: conectar con cualquier habitacion adyacente.
      for (const candidate of allRooms) {
        if (candidate.id === room.id) continue;
        const fallbackDoor = this.findOptimalDoorPosition(room, candidate);
        if (fallbackDoor) {
          addDoor({
            position: [fallbackDoor.x, fallbackDoor.y] as [number, number],
            orientation: fallbackDoor.orientation,
            type: 'interior'
          });
          return doors;
        }
      }
    }

    if (room.type === 'circulation') {
      // El pasillo recibe una puerta por cada espacio adyacente.
      for (const candidate of allRooms) {
        if (candidate.id === room.id) continue;
        const accessDoor = this.findOptimalDoorPosition(room, candidate);
        if (accessDoor) {
          addDoor({
            position: [accessDoor.x, accessDoor.y] as [number, number],
            orientation: accessDoor.orientation,
            type: 'interior'
          });
        }
      }

      // Puerta principal de acceso al exterior.
      addDoor({
        position: [room.position.x + room.size.width / 2, room.position.y] as [number, number],
        orientation: 'north',
        type: 'main'
      });
      return doors;
    }

    // Ultimo fallback para no dejar habitaciones inaccesibles.
    if (doors.length === 0) {
      addDoor({
        position: [room.position.x + room.size.width / 2, room.position.y] as [number, number],
        orientation: 'north',
        type: 'interior'
      });
    }

    return doors;
  }

  /**
   * Genera ventanas para una habitación específica
   */
  private static generateRoomWindows(room: LayoutRoom, building: any) {
    const windows: { position: [number, number, number], size: [number, number], orientation: string }[] = [];
    if (room.type === 'circulation') {
      return windows;
    }

    const eps = 0.05;
    const windowHeight = 1.5;
    const requiredWindows = Math.max(1, Math.min(3, Math.ceil(room.area / 18)));
    const candidates: Array<{ position: [number, number, number], size: [number, number], orientation: string }> = [];

    const createHorizontalWindows = (orientation: 'north' | 'south', y: number, count: number) => {
      const width = Math.min(Math.max(room.size.width * 0.28, 0.9), 1.8);
      const centers = count === 1
        ? [0.5]
        : count === 2
        ? [0.33, 0.67]
        : [0.25, 0.5, 0.75];
      centers.forEach(ratio => {
        candidates.push({
          position: [room.position.x + room.size.width * ratio, y, windowHeight] as [number, number, number],
          size: [width, 1.0] as [number, number],
          orientation
        });
      });
    };

    const createVerticalWindows = (orientation: 'west' | 'east', x: number, count: number) => {
      const width = Math.min(Math.max(room.size.height * 0.28, 0.9), 1.8);
      const centers = count === 1
        ? [0.5]
        : count === 2
        ? [0.33, 0.67]
        : [0.25, 0.5, 0.75];
      centers.forEach(ratio => {
        candidates.push({
          position: [x, room.position.y + room.size.height * ratio, windowHeight] as [number, number, number],
          size: [width, 1.0] as [number, number],
          orientation
        });
      });
    };

    if (room.position.y <= eps) {
      createHorizontalWindows('north', room.position.y, room.size.width > 4.5 ? 2 : 1);
    }
    if (room.position.y + room.size.height >= building.depth - eps) {
      createHorizontalWindows('south', room.position.y + room.size.height, room.size.width > 4.5 ? 2 : 1);
    }
    if (room.position.x <= eps) {
      createVerticalWindows('west', room.position.x, room.size.height > 4.5 ? 2 : 1);
    }
    if (room.position.x + room.size.width >= building.width - eps) {
      createVerticalWindows('east', room.position.x + room.size.width, room.size.height > 4.5 ? 2 : 1);
    }

    for (let i = 0; i < candidates.length && windows.length < requiredWindows; i++) {
      windows.push(candidates[i]);
    }

    return windows;
  }

  /**
   * Encuentra la posición óptima para una puerta
   */
  private static findOptimalDoorPosition(roomA: LayoutRoom, roomB: LayoutRoom) {
    const margin = 0.08;
    const minimumOverlap = this.DOOR_CLEAR_OPENING + 0.2;

    const aLeft = roomA.position.x;
    const aRight = roomA.position.x + roomA.size.width;
    const aTop = roomA.position.y;
    const aBottom = roomA.position.y + roomA.size.height;

    const bLeft = roomB.position.x;
    const bRight = roomB.position.x + roomB.size.width;
    const bTop = roomB.position.y;
    const bBottom = roomB.position.y + roomB.size.height;

    const verticalOverlapFrom = Math.max(aTop, bTop);
    const verticalOverlapTo = Math.min(aBottom, bBottom);
    const horizontalOverlapFrom = Math.max(aLeft, bLeft);
    const horizontalOverlapTo = Math.min(aRight, bRight);

    const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

    // A a la izquierda de B
    if (Math.abs(aRight - bLeft) <= margin && verticalOverlapTo - verticalOverlapFrom >= minimumOverlap) {
      const y = clamp(
        (verticalOverlapFrom + verticalOverlapTo) / 2,
        verticalOverlapFrom + this.DOOR_CLEAR_OPENING / 2,
        verticalOverlapTo - this.DOOR_CLEAR_OPENING / 2
      );
      return {
        x: aRight,
        y,
        orientation: 'east'
      };
    }

    // A a la derecha de B
    if (Math.abs(aLeft - bRight) <= margin && verticalOverlapTo - verticalOverlapFrom >= minimumOverlap) {
      const y = clamp(
        (verticalOverlapFrom + verticalOverlapTo) / 2,
        verticalOverlapFrom + this.DOOR_CLEAR_OPENING / 2,
        verticalOverlapTo - this.DOOR_CLEAR_OPENING / 2
      );
      return {
        x: aLeft,
        y,
        orientation: 'west'
      };
    }

    // A encima de B
    if (Math.abs(aBottom - bTop) <= margin && horizontalOverlapTo - horizontalOverlapFrom >= minimumOverlap) {
      const x = clamp(
        (horizontalOverlapFrom + horizontalOverlapTo) / 2,
        horizontalOverlapFrom + this.DOOR_CLEAR_OPENING / 2,
        horizontalOverlapTo - this.DOOR_CLEAR_OPENING / 2
      );
      return {
        x,
        y: aBottom,
        orientation: 'south'
      };
    }

    // A debajo de B
    if (Math.abs(aTop - bBottom) <= margin && horizontalOverlapTo - horizontalOverlapFrom >= minimumOverlap) {
      const x = clamp(
        (horizontalOverlapFrom + horizontalOverlapTo) / 2,
        horizontalOverlapFrom + this.DOOR_CLEAR_OPENING / 2,
        horizontalOverlapTo - this.DOOR_CLEAR_OPENING / 2
      );
      return {
        x,
        y: aTop,
        orientation: 'north'
      };
    }

    return null;
  }

  // Métodos auxiliares simplificados
  private static createDynamicConnectivityGraph(rooms: DynamicRoom[]): Graph {
    const graph = new Graph({ directed: false });
    
    rooms.forEach(room => graph.setNode(room.id, room));
    
    for (let i = 0; i < rooms.length; i++) {
      for (let j = i + 1; j < rooms.length; j++) {
        if (this.shouldBeAdjacentDynamic(rooms[i], rooms[j])) {
          graph.setEdge(rooms[i].id, rooms[j].id, {
            priority: this.getDynamicAdjacencyPriority(rooms[i], rooms[j])
          });
        }
      }
    }
    
    return graph;
  }

  private static shouldBeAdjacentDynamic(roomA: DynamicRoom, roomB: DynamicRoom): boolean {
    const functionalConnections: Record<string, string[]> = {
      'social': ['service', 'circulation'],
      'service': ['social', 'circulation', 'storage'],
      'rest': ['hygiene', 'circulation'],
      'hygiene': ['rest', 'circulation'],
      'circulation': ['*'],
      'work': ['circulation', 'storage'],
      'storage': ['*']
    };
    
    const connectionsA = functionalConnections[roomA.type] || [];
    const connectionsB = functionalConnections[roomB.type] || [];
    
    return connectionsA.includes(roomB.type) || 
           connectionsB.includes(roomA.type) ||
           connectionsA.includes('*') || 
           connectionsB.includes('*');
  }

  private static getDynamicAdjacencyPriority(roomA: DynamicRoom, roomB: DynamicRoom): number {
    if (roomA.priority === 'required' && roomB.priority === 'required') return 1;
    if (roomA.priority === 'required' || roomB.priority === 'required') return 2;
    if (roomA.priority === 'suggested' && roomB.priority === 'suggested') return 3;
    return 4;
  }

  private static calculateOptimalBuildingDimensions(rooms: DynamicRoom[], totalArea: number, constraints: BuildingConstraints) {
    const usableArea = totalArea * 0.85;
    
    let width: number, depth: number;
    
    if (constraints.buildingWidth && constraints.buildingDepth) {
      width = constraints.buildingWidth;
      depth = constraints.buildingDepth;
    } else {
      const totalRoomArea = rooms.reduce((sum, room) => sum + room.area, 0);
      const circulationFactor = totalRoomArea < usableArea * 0.7 ? 1.2 : 1.1;
      
      const aspectRatio = 1.3 + Math.random() * 0.4;
      width = Math.sqrt(totalArea * aspectRatio);
      depth = totalArea / width;
    }

    return {
      width: Math.round(width * 10) / 10,
      depth: Math.round(depth * 10) / 10,
      totalArea,
      usableArea,
      orientation: constraints.orientation || 'south',
      style: constraints.style || 'modern',
      accessibility: constraints.accessibility || false
    };
  }

  private static solveDynamicLayoutConstraints(rooms: DynamicRoom[], building: any, graph: Graph): LayoutRoom[] {
    const sortedRooms = this.sortRoomsByDynamicPriority(rooms);
    const hallway = sortedRooms.find(room => room.type === 'circulation');
    const nonHallwayRooms = sortedRooms.filter(room => room.type !== 'circulation');

    // Caso simple: una sola habitacion.
    if (!hallway && nonHallwayRooms.length === 1) {
      const single = nonHallwayRooms[0];
      const width = Math.min(single.width, building.width);
      const height = Math.min(single.height, building.depth);
      return [{
        ...single,
        position: { x: (building.width - width) / 2, y: (building.depth - height) / 2 },
        size: { width, height },
        rotation: 0,
        doors: [],
        windows: []
      }];
    }

    // Distribucion principal con corredor central para conectividad garantizada.
    if (hallway) {
      const layout: LayoutRoom[] = [];

      const hallwayWidth = Math.max(1.2, Math.min(2.2, building.width * 0.16));
      const sideWidth = Math.max(2.2, (building.width - hallwayWidth) / 2);
      const hallwayX = sideWidth;

      const leftRooms: DynamicRoom[] = [];
      const rightRooms: DynamicRoom[] = [];
      let leftArea = 0;
      let rightArea = 0;

      // Balancear por area y afinidad funcional para mantener logica arquitectonica.
      for (const room of nonHallwayRooms) {
        const leftScore = this.scoreRoomSideAssignment(room, leftRooms, leftArea, rightArea);
        const rightScore = this.scoreRoomSideAssignment(room, rightRooms, rightArea, leftArea);

        if (leftScore <= rightScore) {
          leftRooms.push(room);
          leftArea += room.area;
        } else {
          rightRooms.push(room);
          rightArea += room.area;
        }
      }

      const orderedLeftRooms = this.sortRoomsForCorridorSequence(leftRooms);
      const orderedRightRooms = this.sortRoomsForCorridorSequence(rightRooms);

      const leftScale = Math.min(1, (sideWidth * building.depth) / Math.max(leftArea, 0.01));
      const rightScale = Math.min(1, (sideWidth * building.depth) / Math.max(rightArea, 0.01));

      const minRoomDepth = 1.8;
      const leftRawHeights = orderedLeftRooms.map(room => Math.max(minRoomDepth, (room.area * leftScale) / sideWidth));
      const rightRawHeights = orderedRightRooms.map(room => Math.max(minRoomDepth, (room.area * rightScale) / sideWidth));
      const leftHeightFactor = building.depth / Math.max(leftRawHeights.reduce((sum, h) => sum + h, 0), 0.01);
      const rightHeightFactor = building.depth / Math.max(rightRawHeights.reduce((sum, h) => sum + h, 0), 0.01);

      let leftY = 0;
      for (let i = 0; i < orderedLeftRooms.length; i++) {
        const room = orderedLeftRooms[i];
        const adjustedArea = room.area * leftScale;
        const computedHeight = leftRawHeights[i] * leftHeightFactor;
        const safeHeight = i === orderedLeftRooms.length - 1
          ? Math.max(0.8, building.depth - leftY)
          : Math.max(0.8, Math.min(computedHeight, building.depth - leftY));

        layout.push({
          ...room,
          area: Math.round(adjustedArea * 10) / 10,
          position: { x: 0, y: leftY },
          size: { width: sideWidth, height: safeHeight },
          rotation: 0,
          doors: [],
          windows: []
        });

        leftY += safeHeight;
      }

      let rightY = 0;
      for (let i = 0; i < orderedRightRooms.length; i++) {
        const room = orderedRightRooms[i];
        const adjustedArea = room.area * rightScale;
        const computedHeight = rightRawHeights[i] * rightHeightFactor;
        const safeHeight = i === orderedRightRooms.length - 1
          ? Math.max(0.8, building.depth - rightY)
          : Math.max(0.8, Math.min(computedHeight, building.depth - rightY));

        layout.push({
          ...room,
          area: Math.round(adjustedArea * 10) / 10,
          position: { x: hallwayX + hallwayWidth, y: rightY },
          size: { width: sideWidth, height: safeHeight },
          rotation: 0,
          doors: [],
          windows: []
        });

        rightY += safeHeight;
      }

      layout.push({
        ...hallway,
        area: Math.round((hallwayWidth * building.depth) * 10) / 10,
        position: { x: hallwayX, y: 0 },
        size: { width: hallwayWidth, height: building.depth },
        rotation: 0,
        doors: [],
        windows: []
      });

      return layout;
    }

    // Fallback sin pasillo: ubicar por grilla evitando solapes.
    const layout: LayoutRoom[] = [];
    const placedRooms = new Map<string, LayoutRoom>();

    for (const room of sortedRooms) {
      const position = this.findOptimalPositionDynamic(room, placedRooms, building, graph);
      if (!position) continue;

      const layoutRoom: LayoutRoom = {
        ...room,
        position: { x: position.x, y: position.y },
        size: { width: room.width, height: room.height },
        rotation: 0,
        doors: [],
        windows: []
      };

      layout.push(layoutRoom);
      placedRooms.set(room.id, layoutRoom);
    }

    return layout;
  }

  private static scoreRoomSideAssignment(
    room: DynamicRoom,
    sideRooms: DynamicRoom[],
    currentSideArea: number,
    oppositeSideArea: number
  ): number {
    const areaImbalanceScore = Math.abs((currentSideArea + room.area) - oppositeSideArea) * 0.2;
    const semanticBonus = this.getSemanticAdjacencyScore(room, sideRooms);

    let functionalPenalty = 0;
    if (room.type === 'hygiene' && !sideRooms.some(r => r.type === 'rest')) {
      functionalPenalty += 6;
    }
    if (room.type === 'service' && !sideRooms.some(r => r.type === 'social')) {
      functionalPenalty += 4;
    }

    return areaImbalanceScore + functionalPenalty - semanticBonus;
  }

  private static getSemanticAdjacencyScore(room: DynamicRoom, sideRooms: DynamicRoom[]): number {
    if (sideRooms.length === 0) return 0;

    const affinityMap: Record<string, string[]> = {
      social: ['service', 'work', 'circulation'],
      service: ['social', 'storage', 'circulation'],
      rest: ['hygiene', 'circulation'],
      hygiene: ['rest', 'circulation'],
      work: ['social', 'circulation', 'storage'],
      storage: ['service', 'work', 'circulation'],
      circulation: ['social', 'service', 'rest', 'hygiene', 'work', 'storage']
    };

    const preferred = affinityMap[room.type] || [];
    const adjacentMatches = sideRooms.filter(existing => preferred.includes(existing.type)).length;
    const lastRoom = sideRooms[sideRooms.length - 1];
    const lastBonus = preferred.includes(lastRoom.type) ? 2 : 0;

    return adjacentMatches * 1.5 + lastBonus;
  }

  private static sortRoomsForCorridorSequence(rooms: DynamicRoom[]): DynamicRoom[] {
    const placementWeight: Record<PlacementType, number> = {
      front: 0,
      connector: 1,
      flexible: 2,
      private: 3,
      back: 4
    };

    return [...rooms].sort((a, b) => {
      const placementDiff = placementWeight[a.placement] - placementWeight[b.placement];
      if (placementDiff !== 0) return placementDiff;
      return b.area - a.area;
    });
  }

  private static sortRoomsByDynamicPriority(rooms: DynamicRoom[]): DynamicRoom[] {
    return rooms.sort((a, b) => {
      if (a.priority === 'required' && b.priority !== 'required') return -1;
      if (b.priority === 'required' && a.priority !== 'required') return 1;
      if (a.source === 'user' && b.source !== 'user') return -1;
      if (b.source === 'user' && a.source !== 'user') return 1;
      return b.area - a.area;
    });
  }

  private static findOptimalPositionDynamic(room: DynamicRoom, placedRooms: Map<string, LayoutRoom>, building: any, graph: Graph) {
    const candidates = [];
    const gridSize = 0.25;
    
    for (let x = 0; x <= building.width - room.width; x += gridSize) {
      for (let y = 0; y <= building.depth - room.height; y += gridSize) {
        const position = { x, y };
        const score = this.evaluatePositionDynamic(room, position, placedRooms, building, graph);
        
        if (score > 0) {
          candidates.push({ ...position, score });
        }
      }
    }
    
    if (candidates.length === 0) {
      return null;
    }
    
    candidates.sort((a, b) => b.score - a.score);
    return candidates[0];
  }

  private static evaluatePositionDynamic(room: DynamicRoom, position: any, placedRooms: Map<string, LayoutRoom>, building: any, graph: Graph): number {
    let score = 100;
    
    // Verificar colisiones
    for (const [, placedRoom] of placedRooms) {
      if (this.roomsOverlapDynamic(
        { ...room, position, size: { width: room.width, height: room.height } } as LayoutRoom,
        placedRoom
      )) {
        return 0;
      }
    }
    
    // Verificar límites
    if (position.x + room.width > building.width || position.y + room.height > building.depth) {
      return 0;
    }
    
    // Bonus por prioridad
    if (room.priority === 'required') score += 50;
    if (room.source === 'user') score += 30;
    
    // Evaluar placement
    score += this.evaluateDynamicPlacement(room, position, building);
    
    return Math.max(0, score);
  }

  private static roomsOverlapDynamic(roomA: LayoutRoom, roomB: LayoutRoom): boolean {
    const margin = 0.2;
    
    return !(
      roomA.position.x + roomA.size.width + margin <= roomB.position.x ||
      roomB.position.x + roomB.size.width + margin <= roomA.position.x ||
      roomA.position.y + roomA.size.height + margin <= roomB.position.y ||
      roomB.position.y + roomB.size.height + margin <= roomA.position.y
    );
  }

  private static evaluateDynamicPlacement(room: DynamicRoom, position: any, building: any): number {
    let score = 0;
    
    switch (room.placement) {
      case 'front':
        score += Math.max(0, 50 - (position.y / building.depth) * 50);
        break;
      case 'back':
        score += (position.y / building.depth) * 50;
        break;
      case 'private':
        score += Math.abs(0.7 - (position.y / building.depth)) < 0.3 ? 30 : 0;
        break;
      case 'connector':
        score += Math.abs(0.5 - (position.x / building.width)) < 0.2 ? 40 : 0;
        break;
      default:
        score += 10;
    }
    
    return score;
  }

  // Métodos simplificados para validación y renderizado
  private static validateDynamicGeometry(layout: LayoutRoom[], building: any) {
    const warnings: string[] = [];
    let valid = true;

    for (let i = 0; i < layout.length; i++) {
      for (let j = i + 1; j < layout.length; j++) {
        if (this.roomsOverlapDynamic(layout[i], layout[j])) {
          warnings.push(`Solapamiento entre ${layout[i].name} y ${layout[j].name}`);
          valid = false;
        }
      }
    }

    for (const room of layout) {
      if (room.position.x < 0 || room.position.y < 0 ||
          room.position.x + room.size.width > building.width ||
          room.position.y + room.size.height > building.depth) {
        warnings.push(`${room.name} está fuera de los límites del edificio`);
        valid = false;
      }

      if (!room.doors || room.doors.length === 0) {
        warnings.push(`${room.name} no tiene puertas de acceso`);
        valid = false;
      }

      if (room.type !== 'circulation' && (!room.windows || room.windows.length === 0)) {
        warnings.push(`${room.name} no tiene ventanas exteriores`);
        valid = false;
      }
    }

    const hasMainDoor = layout.some(room => room.doors.some(door => door.type === 'main'));
    if (!hasMainDoor) {
      warnings.push('No se encontró puerta principal de acceso');
      valid = false;
    }

    return { valid, warnings };
  }

  private static optimizeDynamicLayout(layout: LayoutRoom[], building: any): LayoutRoom[] {
    // Implementación básica de optimización
    return layout;
  }

  private static generateStructuralSVG(layout: LayoutRoom[], building: any): string {
    return `<svg width="${building.width * 10}" height="${building.depth * 10}"><!-- SVG content --></svg>`;
  }

  private static generateStructuralThreeJS(layout: LayoutRoom[], building: any): any {
    return {
      walls: [],
      rooms: layout,
      doors: [],
      windows: []
    };
  }

  private static generateWallStructure(layout: LayoutRoom[], building: any): any {
    return {
      externalWalls: [],
      internalWalls: [],
      loadBearing: []
    };
  }
}