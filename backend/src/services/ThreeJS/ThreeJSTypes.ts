export interface ThreeJSVertex {
  x: number;
  y: number;
  z?: number;
}

export interface ThreeJSFace {
  indices: number[];
  material?: string;
  normal?: [number, number, number];
}

export interface ThreeJSWall {
  start: [number, number];
  end: [number, number];
  height: number;
  thickness: number;
  material: string;
}

export interface ThreeJSRoom {
  name: string;
  vertices: number[][];
  height: number;
  material: string;
  lighting?: ThreeJSLight[];
}

export interface ThreeJSLight {
  type: 'natural' | 'artificial' | 'ambient' | 'directional' | 'point' | 'spot';
  position: [number, number, number];
  intensity: number;
  color?: number;
  castShadow?: boolean;
}

export interface ThreeJSDoor {
  position: [number, number];
  size: [number, number];
  rotation: number;
  type: 'main' | 'interior' | 'sliding' | 'double';
  material?: string;
}

export interface ThreeJSWindow {
  position: [number, number, number];
  size: [number, number];
  orientation: 'north' | 'south' | 'east' | 'west';
  type?: 'standard' | 'bay' | 'skylight';
  material?: string;
}

export interface ThreeJSFurniture {
  type: FurnitureType;
  position: [number, number, number];
  rotation: number;
  room: string;
  scale?: [number, number, number];
  material?: string;
}

export type FurnitureType = 
  | 'sofa' | 'bed' | 'desk' | 'dining_table' | 'coffee_table' 
  | 'wardrobe' | 'nightstand' | 'office_chair' | 'dining_chair'
  | 'kitchen_counter' | 'stove' | 'refrigerator' | 'bookshelf'
  | 'tv_stand' | 'lamp' | 'plant' | 'rug';

export interface ThreeJSGeometry {
  vertices: number[][];
  faces: number[][];
  walls: ThreeJSWall[];
  rooms: ThreeJSRoom[];
  doors: ThreeJSDoor[];
  windows: ThreeJSWindow[];
  furniture?: ThreeJSFurniture[];
  lighting?: ThreeJSLight[];
}

export interface ThreeJSExportFiles {
  geometryJSON: string;
  materialsJSON: string;
  sceneJSON: string;
  objFile: string;
  mtlFile: string;
  gltfFile?: string;
}

export interface ThreeJSGenerationResult {
  geometry: ThreeJSGeometry;
  exportFiles: ThreeJSExportFiles;
  metadata: {
    generatedAt: string;
    totalVertices: number;
    totalFaces: number;
    totalObjects: number;
    processingTime: number;
  };
}