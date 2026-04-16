import { Graph } from 'graphlib';
import { PascalGenerator } from '../Pascal/PascalGenerator';

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
      const allRooms = [...userRooms, ...suggestedRooms];
      
      // 5. Calcular dimensiones del edificio
      const building = this.calculateOptimalBuildingDimensions(allRooms, totalArea, constraints);
      console.log('✅ Dimensiones del edificio:', `${building.width}x${building.depth}m`);
      
      // 6. Crear grafo de conectividad
      const connectivityGraph = this.createDynamicConnectivityGraph(allRooms);
      
      // 7. Resolver layout con restricciones
      const layout = this.solveDynamicLayoutConstraints(allRooms, building, connectivityGraph);
      console.log('✅ Layout resuelto:', layout.length, 'habitaciones colocadas');
      
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
    
    // Puerta principal
    const hallway = allRooms.find(r => r.type === 'circulation');
    
    if (hallway) {
      const doorPosition = this.findOptimalDoorPosition(room, hallway);
      if (doorPosition) {
        doors.push({
          position: [doorPosition.x, doorPosition.y] as [number, number],
          orientation: doorPosition.orientation,
          type: 'interior'
        });
      }
    } else {
      // Puerta hacia el exterior
      doors.push({
        position: [room.position.x + room.size.width / 2, room.position.y] as [number, number],
        orientation: 'north',
        type: 'main'
      });
    }
    
    return doors;
  }

  /**
   * Genera ventanas para una habitación específica
   */
  private static generateRoomWindows(room: LayoutRoom, building: any) {
    const windows: { position: [number, number, number], size: [number, number], orientation: string }[] = [];
    
    const windowHeight = 1.5;
    const windowWidth = Math.min(room.size.width * 0.4, 2.0);
    
    // Ventana en pared externa
    if (room.position.y === 0) {
      windows.push({
        position: [room.position.x + room.size.width / 2, room.position.y, windowHeight] as [number, number, number],
        size: [windowWidth, 1.0] as [number, number],
        orientation: 'north'
      });
    } else if (room.position.x === 0) {
      windows.push({
        position: [room.position.x, room.position.y + room.size.height / 2, windowHeight] as [number, number, number],
        size: [windowWidth, 1.0] as [number, number],
        orientation: 'west'
      });
    }
    
    return windows;
  }

  /**
   * Encuentra la posición óptima para una puerta
   */
  private static findOptimalDoorPosition(roomA: LayoutRoom, roomB: LayoutRoom) {
    const margin = 0.1;
    
    // Verificar adyacencia horizontal
    if (Math.abs(roomA.position.x + roomA.size.width - roomB.position.x) < margin) {
      return {
        x: roomA.position.x + roomA.size.width,
        y: roomA.position.y + roomA.size.height / 2,
        orientation: 'east'
      };
    }
    
    // Verificar adyacencia vertical
    if (Math.abs(roomA.position.y + roomA.size.height - roomB.position.y) < margin) {
      return {
        x: roomA.position.x + roomA.size.width / 2,
        y: roomA.position.y + roomA.size.height,
        orientation: 'south'
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
    const layout: LayoutRoom[] = [];
    const sortedRooms = this.sortRoomsByDynamicPriority(rooms);
    const placedRooms = new Map<string, LayoutRoom>();
    
    for (const room of sortedRooms) {
      const position = this.findOptimalPositionDynamic(room, placedRooms, building, graph);
      
      if (position) {
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
    }
    
    return layout;
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
      return { x: 0, y: 0, score: 0 };
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