import {
  ThreeJSGeometry,
  ThreeJSGenerationResult,
  ThreeJSWall,
  ThreeJSRoom,
  ThreeJSDoor,
  ThreeJSWindow,
  ThreeJSFurniture,
  ThreeJSLight,
  ThreeJSExportFiles,
  FurnitureType,
} from "./ThreeJSTypes";
import {
  THREEJS_MATERIALS as MaterialLibrary,
  MaterialProperties,
} from "./ThreeJSMaterials";
import {
  FURNITURE_LIBRARY,
  FURNITURE_PLACEMENT_RULES,
} from "./ThreeJSFurniture";

// Importar ArchitecturalPlan desde ConfigAI
import { ArchitecturalPlan } from "../ai/ConfigAI";

export class ThreeJSGenerator {
  
  /**
   * Genera una escena 3D realista completa
   */
  static generateRealistic3DScene(layoutData: any) {
    const scene = {
      metadata: {
        version: '2.0',
        generator: 'AI-Design-ThreeJS',
        timestamp: new Date().toISOString()
      },
      scene: {
        background: '#87CEEB', // Sky blue
        fog: { color: '#87CEEB', near: 1, far: 1000 }
      },
      camera: {
        type: 'PerspectiveCamera',
        fov: 45,
        position: [20, 15, 20],
        target: [layoutData.building?.width/2 || 0, 0, layoutData.building?.depth/2 || 0]
      },
      lighting: this.generateRealisticLighting(layoutData.building || { width: 10, depth: 10 }),
      geometry: this.generateDetailedGeometry(layoutData),
      materials: this.generateRealisticMaterials(),
      objects: this.generateSceneObjects(layoutData)
    };
    
    return scene;
  }

  /**
   * Genera iluminación realista para la escena
   */
  private static generateRealisticLighting(building: any) {
    return {
      ambient: {
        color: '#404040',
        intensity: 0.3
      },
      directional: {
        color: '#ffffff',
        intensity: 0.8,
        position: [building.width || 10, 20, building.depth || 10],
        castShadow: true,
        shadow: {
          mapSize: [2048, 2048],
          camera: {
            near: 0.1,
            far: 50,
            left: -(building.width || 10),
            right: building.width || 10,
            top: building.depth || 10,
            bottom: -(building.depth || 10)
          }
        }
      },
      point: {
        color: '#ffff80',
        intensity: 0.5,
        position: [(building.width || 10)/2, 2.5, (building.depth || 10)/2],
        castShadow: true
      }
    };
  }

  /**
   * Genera geometría detallada de toda la escena
   */
  private static generateDetailedGeometry(layoutData: any) {
    const geometry = {
      rooms: [] as any[],
      walls: [] as any[],
      floors: [] as any[],
      ceilings: [] as any[],
      doors: [] as any[],
      windows: [] as any[]
    };

    // Generar geometría detallada para cada elemento
    if (layoutData.rooms && Array.isArray(layoutData.rooms)) {
      layoutData.rooms.forEach((room: any) => {
        geometry.rooms.push(this.createRoomGeometry(room));
        geometry.floors.push(this.createFloorGeometry(room));
        geometry.ceilings.push(this.createCeilingGeometry(room));
      });
    }

    geometry.walls = this.generateWallGeometry(layoutData);
    geometry.doors = this.generateDoorGeometry(layoutData);
    geometry.windows = this.generateWindowGeometry(layoutData);

    return geometry;
  }

  /**
   * ✅ MÉTODO IMPLEMENTADO: Crear geometría de habitación
   */
  private static createRoomGeometry(room: any) {
    return {
      name: room.name || 'Habitación',
      type: 'BoxGeometry',
      position: [
        room.position?.x || 0,
        0,
        room.position?.y || 0
      ],
      size: [
        room.size?.width || 3,
        3.0, // Altura estándar
        room.size?.height || 3
      ],
      material: this.getRoomMaterial(room.type || 'default'),
      userData: {
        roomType: room.type,
        area: room.area
      }
    };
  }

  /**
   * ✅ MÉTODO IMPLEMENTADO: Crear geometría del piso
   */
  private static createFloorGeometry(room: any) {
    return {
      name: `${room.name || 'Habitación'}_Floor`,
      type: 'BoxGeometry',
      position: [
        room.position?.x + (room.size?.width || 3) / 2,
        0.05, // Pequeño offset para evitar z-fighting
        room.position?.y + (room.size?.height || 3) / 2
      ],
      size: [
        room.size?.width || 3,
        0.1, // Grosor del piso
        room.size?.height || 3
      ],
      material: this.getFloorMaterial(room.type || 'default'),
      castShadow: false,
      receiveShadow: true
    };
  }

  /**
   * ✅ MÉTODO IMPLEMENTADO: Crear geometría del techo
   */
  private static createCeilingGeometry(room: any) {
    return {
      name: `${room.name || 'Habitación'}_Ceiling`,
      type: 'BoxGeometry',
      position: [
        room.position?.x + (room.size?.width || 3) / 2,
        2.95, // Altura del techo
        room.position?.y + (room.size?.height || 3) / 2
      ],
      size: [
        room.size?.width || 3,
        0.1, // Grosor del techo
        room.size?.height || 3
      ],
      material: 'wall_interior',
      castShadow: false,
      receiveShadow: false
    };
  }

  /**
   * ✅ MÉTODO IMPLEMENTADO: Generar geometría de paredes
   */
  private static generateWallGeometry(layoutData: any): any[] {
    const walls: any[] = [];
    
    if (layoutData.structural?.walls) {
      layoutData.structural.walls.forEach((wall: any) => {
        walls.push({
          name: `Wall_${walls.length}`,
          type: 'BoxGeometry',
          position: [
            (wall.start[0] + wall.end[0]) / 2,
            wall.height / 2,
            (wall.start[1] + wall.end[1]) / 2
          ],
          size: [
            Math.abs(wall.end[0] - wall.start[0]) || wall.thickness,
            wall.height,
            Math.abs(wall.end[1] - wall.start[1]) || wall.thickness
          ],
          material: wall.type === 'exterior' ? 'wall_exterior' : 'wall_interior',
          castShadow: true,
          receiveShadow: true
        });
      });
    }

    return walls;
  }

  /**
   * ✅ MÉTODO IMPLEMENTADO: Generar geometría de puertas
   */
  private static generateDoorGeometry(layoutData: any): any[] {
    const doors: any[] = [];
    
    if (layoutData.rooms && Array.isArray(layoutData.rooms)) {
      layoutData.rooms.forEach((room: any) => {
        if (room.doors && Array.isArray(room.doors)) {
          room.doors.forEach((door: any) => {
            doors.push({
              name: `Door_${doors.length}`,
              type: 'BoxGeometry',
              position: [
                door.position[0],
                1.05, // Altura centro de puerta
                door.position[1]
              ],
              size: [
                0.9, // Ancho estándar puerta
                2.1, // Alto estándar puerta
                0.05 // Grosor puerta
              ],
              material: 'door',
              castShadow: true,
              receiveShadow: true,
              userData: {
                type: door.type,
                orientation: door.orientation
              }
            });
          });
        }
      });
    }

    return doors;
  }

  /**
   * ✅ MÉTODO IMPLEMENTADO: Generar geometría de ventanas
   */
  private static generateWindowGeometry(layoutData: any): any[] {
    const windows: any[] = [];
    
    if (layoutData.rooms && Array.isArray(layoutData.rooms)) {
      layoutData.rooms.forEach((room: any) => {
        if (room.windows && Array.isArray(room.windows)) {
          room.windows.forEach((window: any) => {
            windows.push({
              name: `Window_${windows.length}`,
              type: 'BoxGeometry',
              position: [
                window.position[0],
                window.position[2] || 1.5, // Altura de ventana
                window.position[1]
              ],
              size: [
                window.size[0] || 1.2,
                window.size[1] || 1.0,
                0.02 // Grosor cristal
              ],
              material: 'window_glass',
              castShadow: false,
              receiveShadow: false,
              userData: {
                orientation: window.orientation
              }
            });
          });
        }
      });
    }

    return windows;
  }

  /**
   * ✅ MÉTODO IMPLEMENTADO: Generar objetos de la escena
   */
  private static generateSceneObjects(layoutData: any): any[] {
    const objects: any[] = [];
    
    // Generar terreno base
    objects.push({
      name: 'Ground',
      type: 'PlaneGeometry',
      position: [0, -0.1, 0],
      size: [50, 50],
      rotation: [-Math.PI/2, 0, 0],
      material: 'ground',
      receiveShadow: true
    });

    // Agregar elementos estructurales como objetos
    if (layoutData.rooms) {
      layoutData.rooms.forEach((room: any, index: number) => {
        objects.push({
          name: `RoomContainer_${index}`,
          type: 'Group',
          position: [room.position?.x || 0, 0, room.position?.y || 0],
          children: [
            this.createRoomGeometry(room),
            this.createFloorGeometry(room),
            this.createCeilingGeometry(room)
          ]
        });
      });
    }

    return objects;
  }

  /**
   * Genera materiales realistas
   */
  private static generateRealisticMaterials() {
    return {
      wall_interior: {
        type: 'MeshLambertMaterial',
        color: '#f5f5f5',
        roughness: 0.8
      },
      wall_exterior: {
        type: 'MeshLambertMaterial',
        color: '#d4d4d4',
        roughness: 0.9
      },
      floor_wood: {
        type: 'MeshLambertMaterial',
        color: '#8b4513',
        roughness: 0.6
      },
      floor_tile: {
        type: 'MeshLambertMaterial',
        color: '#f0f0f0',
        roughness: 0.3
      },
      floor_carpet: {
        type: 'MeshLambertMaterial',
        color: '#8fbc8f',
        roughness: 0.9
      },
      door: {
        type: 'MeshLambertMaterial',
        color: '#6b4423',
        roughness: 0.7
      },
      window_frame: {
        type: 'MeshLambertMaterial',
        color: '#ffffff',
        roughness: 0.5
      },
      window_glass: {
        type: 'MeshPhysicalMaterial',
        color: '#87ceeb',
        transmission: 0.9,
        opacity: 0.1,
        transparent: true
      },
      ground: {
        type: 'MeshLambertMaterial',
        color: '#90EE90',
        roughness: 1.0
      }
    };
  }

  /**
   * ✅ MÉTODO PÚBLICO REQUERIDO: Generar paredes (usado por OpenAIArchitecturalService)
   */
  static generateWalls(rooms: any[], building: any) {
    console.log('🔧 Generando paredes con ThreeJSGenerator...');
    
    const walls: any[] = [];
    const vertices: number[][] = [];
    const faces: number[][] = [];

    // Generar paredes exteriores del edificio
    const buildingWidth = building.width || 10;
    const buildingHeight = building.height || 10;
    
    // Paredes exteriores
    walls.push(
      {
        start: [0, 0],
        end: [buildingWidth, 0],
        height: 3.0,
        thickness: 0.25,
        material: 'exterior_wall',
        type: 'exterior'
      },
      {
        start: [buildingWidth, 0],
        end: [buildingWidth, buildingHeight],
        height: 3.0,
        thickness: 0.25,
        material: 'exterior_wall',
        type: 'exterior'
      },
      {
        start: [buildingWidth, buildingHeight],
        end: [0, buildingHeight],
        height: 3.0,
        thickness: 0.25,
        material: 'exterior_wall',
        type: 'exterior'
      },
      {
        start: [0, buildingHeight],
        end: [0, 0],
        height: 3.0,
        thickness: 0.25,
        material: 'exterior_wall',
        type: 'exterior'
      }
    );

    // Generar vertices del edificio
    vertices.push(
      [0, 0],
      [buildingWidth, 0],
      [buildingWidth, buildingHeight],
      [0, buildingHeight]
    );

    // Generar cara del edificio
    faces.push([0, 1, 2, 3]);

    console.log('✅ Paredes generadas:', walls.length);
    
    return {
      walls,
      vertices,
      faces
    };
  }

  /**
   * Obtiene el material apropiado para una habitación
   */
  private static getRoomMaterial(roomType: string): string {
    const materials: Record<string, string> = {
      'social': 'floor_wood',
      'service': 'floor_tile',
      'rest': 'floor_carpet',
      'hygiene': 'floor_tile',
      'circulation': 'floor_tile',
      'work': 'floor_wood',
      'storage': 'floor_tile',
      'default': 'floor_wood'
    };
    
    return materials[roomType] || materials.default;
  }

  /**
   * Obtiene el material apropiado para el piso
   */
  private static getFloorMaterial(roomType: string): string {
    return this.getRoomMaterial(roomType);
  }

  /**
   * Genera un resultado completo de generación 3D
   */
  static generateComplete3DResult(layoutData: any): ThreeJSGenerationResult {
    const startTime = Date.now();
    
    const geometry: ThreeJSGeometry = {
      vertices: [],
      faces: [],
      walls: [],
      rooms: [],
      doors: [],
      windows: []
    };

    // Llenar la geometría con datos del layout
    if (layoutData.rooms) {
      layoutData.rooms.forEach((room: any) => {
        // Agregar habitación
        geometry.rooms.push({
          name: room.name,
          vertices: [
            [room.position?.x || 0, room.position?.y || 0],
            [(room.position?.x || 0) + (room.size?.width || 3), room.position?.y || 0],
            [(room.position?.x || 0) + (room.size?.width || 3), (room.position?.y || 0) + (room.size?.height || 3)],
            [room.position?.x || 0, (room.position?.y || 0) + (room.size?.height || 3)]
          ],
          height: 3.0,
          material: this.getRoomMaterial(room.type || 'default')
        });
      });
    }

    const processingTime = Date.now() - startTime;

    const exportFiles: ThreeJSExportFiles = {
      geometryJSON: JSON.stringify(geometry, null, 2),
      materialsJSON: JSON.stringify(this.generateRealisticMaterials(), null, 2),
      sceneJSON: JSON.stringify(this.generateRealistic3DScene(layoutData), null, 2),
      objFile: '# OBJ File generated by AI-Design\n',
      mtlFile: '# MTL File generated by AI-Design\n'
    };

    return {
      geometry,
      exportFiles,
      metadata: {
        generatedAt: new Date().toISOString(),
        totalVertices: geometry.vertices.length,
        totalFaces: geometry.faces.length,
        totalObjects: (geometry.rooms.length + geometry.walls.length + geometry.doors.length + geometry.windows.length),
        processingTime
      }
    };
  }
}

export default ThreeJSGenerator;