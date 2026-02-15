import { FurnitureType } from './ThreeJSTypes';

export interface FurnitureGeometry {
  type: 'BoxGeometry' | 'CylinderGeometry' | 'SphereGeometry' | 'PlaneGeometry';
  width: number;
  height: number;
  depth: number;
  segments?: number;
}

export interface FurnitureDefinition {
  geometry: FurnitureGeometry;
  material: string;
  category: 'seating' | 'storage' | 'surface' | 'appliance' | 'decoration';
  roomTypes: string[];
  defaultScale: [number, number, number];
  collisionBox?: {
    width: number;
    height: number;
    depth: number;
  };
}

export const FURNITURE_LIBRARY: Record<FurnitureType, FurnitureDefinition> = {
  // Asientos
  sofa: {
    geometry: { type: 'BoxGeometry', width: 2, height: 0.8, depth: 1 },
    material: 'fabric_sofa',
    category: 'seating',
    roomTypes: ['sala', 'living', 'family'],
    defaultScale: [1, 1, 1],
    collisionBox: { width: 2.1, height: 0.8, depth: 1.1 }
  },
  office_chair: {
    geometry: { type: 'BoxGeometry', width: 0.6, height: 1.2, depth: 0.6 },
    material: 'fabric_sofa',
    category: 'seating',
    roomTypes: ['oficina', 'estudio', 'office'],
    defaultScale: [1, 1, 1],
    collisionBox: { width: 0.7, height: 1.2, depth: 0.7 }
  },
  dining_chair: {
    geometry: { type: 'BoxGeometry', width: 0.5, height: 1, depth: 0.5 },
    material: 'wood_dark',
    category: 'seating',
    roomTypes: ['comedor', 'dining', 'cocina'],
    defaultScale: [1, 1, 1],
    collisionBox: { width: 0.6, height: 1, depth: 0.6 }
  },

  // Almacenamiento
  wardrobe: {
    geometry: { type: 'BoxGeometry', width: 1.2, height: 2, depth: 0.6 },
    material: 'wood_light',
    category: 'storage',
    roomTypes: ['habitacion', 'dormitorio', 'bedroom'],
    defaultScale: [1, 1, 1],
    collisionBox: { width: 1.3, height: 2, depth: 0.7 }
  },
  nightstand: {
    geometry: { type: 'BoxGeometry', width: 0.5, height: 0.6, depth: 0.4 },
    material: 'wood_light',
    category: 'storage',
    roomTypes: ['habitacion', 'dormitorio', 'bedroom'],
    defaultScale: [1, 1, 1],
    collisionBox: { width: 0.6, height: 0.6, depth: 0.5 }
  },
  bookshelf: {
    geometry: { type: 'BoxGeometry', width: 1.5, height: 2, depth: 0.3 },
    material: 'wood_dark',
    category: 'storage',
    roomTypes: ['estudio', 'oficina', 'sala', 'office'],
    defaultScale: [1, 1, 1],
    collisionBox: { width: 1.6, height: 2, depth: 0.4 }
  },

  // Superficies
  bed: {
    geometry: { type: 'BoxGeometry', width: 2, height: 0.6, depth: 1.5 },
    material: 'fabric_sofa',
    category: 'surface',
    roomTypes: ['habitacion', 'dormitorio', 'bedroom'],
    defaultScale: [1, 1, 1],
    collisionBox: { width: 2.1, height: 0.6, depth: 1.6 }
  },
  desk: {
    geometry: { type: 'BoxGeometry', width: 1.5, height: 0.75, depth: 0.8 },
    material: 'wood_dark',
    category: 'surface',
    roomTypes: ['oficina', 'estudio', 'office'],
    defaultScale: [1, 1, 1],
    collisionBox: { width: 1.6, height: 0.75, depth: 0.9 }
  },
  dining_table: {
    geometry: { type: 'BoxGeometry', width: 1.5, height: 0.75, depth: 1 },
    material: 'wood_dark',
    category: 'surface',
    roomTypes: ['comedor', 'dining', 'cocina'],
    defaultScale: [1, 1, 1],
    collisionBox: { width: 1.6, height: 0.75, depth: 1.1 }
  },
  coffee_table: {
    geometry: { type: 'BoxGeometry', width: 1, height: 0.4, depth: 0.6 },
    material: 'wood_light',
    category: 'surface',
    roomTypes: ['sala', 'living', 'family'],
    defaultScale: [1, 1, 1],
    collisionBox: { width: 1.1, height: 0.4, depth: 0.7 }
  },
  tv_stand: {
    geometry: { type: 'BoxGeometry', width: 1.5, height: 0.5, depth: 0.4 },
    material: 'wood_dark',
    category: 'surface',
    roomTypes: ['sala', 'living', 'family'],
    defaultScale: [1, 1, 1],
    collisionBox: { width: 1.6, height: 0.5, depth: 0.5 }
  },

  // Electrodomésticos
  kitchen_counter: {
    geometry: { type: 'BoxGeometry', width: 2, height: 0.9, depth: 0.6 },
    material: 'wood_dark',
    category: 'appliance',
    roomTypes: ['cocina', 'kitchen'],
    defaultScale: [1, 1, 1],
    collisionBox: { width: 2.1, height: 0.9, depth: 0.7 }
  },
  stove: {
    geometry: { type: 'BoxGeometry', width: 0.6, height: 0.9, depth: 0.6 },
    material: 'metal_steel',
    category: 'appliance',
    roomTypes: ['cocina', 'kitchen'],
    defaultScale: [1, 1, 1],
    collisionBox: { width: 0.7, height: 0.9, depth: 0.7 }
  },
  refrigerator: {
    geometry: { type: 'BoxGeometry', width: 0.7, height: 1.8, depth: 0.7 },
    material: 'metal_steel',
    category: 'appliance',
    roomTypes: ['cocina', 'kitchen'],
    defaultScale: [1, 1, 1],
    collisionBox: { width: 0.8, height: 1.8, depth: 0.8 }
  },

  // Decoración
  lamp: {
    geometry: { type: 'CylinderGeometry', width: 0.3, height: 1.5, depth: 0.3 },
    material: 'metal_steel',
    category: 'decoration',
    roomTypes: ['sala', 'habitacion', 'oficina'],
    defaultScale: [1, 1, 1],
    collisionBox: { width: 0.4, height: 1.5, depth: 0.4 }
  },
  plant: {
    geometry: { type: 'CylinderGeometry', width: 0.4, height: 0.8, depth: 0.4 },
    material: 'wood_light',
    category: 'decoration',
    roomTypes: ['sala', 'habitacion', 'oficina'],
    defaultScale: [1, 1, 1],
    collisionBox: { width: 0.5, height: 0.8, depth: 0.5 }
  },
  rug: {
    geometry: { type: 'PlaneGeometry', width: 2, height: 0.05, depth: 1.5 },
    material: 'carpet',
    category: 'decoration',
    roomTypes: ['sala', 'habitacion', 'comedor'],
    defaultScale: [1, 1, 1],
    collisionBox: { width: 2, height: 0.05, depth: 1.5 }
  }
};

export const FURNITURE_PLACEMENT_RULES = {
  // Reglas de colocación por categoría de habitación
  sala: {
    required: ['sofa', 'coffee_table'],
    optional: ['tv_stand', 'lamp', 'plant', 'rug'],
    layout: 'conversation'
  },
  habitacion: {
    required: ['bed', 'nightstand'],
    optional: ['wardrobe', 'desk', 'lamp', 'plant'],
    layout: 'bedroom'
  },
  cocina: {
    required: ['kitchen_counter', 'stove', 'refrigerator'],
    optional: ['dining_table', 'dining_chair'],
    layout: 'kitchen'
  },
  comedor: {
    required: ['dining_table', 'dining_chair'],
    optional: ['rug'],
    layout: 'dining'
  },
  oficina: {
    required: ['desk', 'office_chair'],
    optional: ['bookshelf', 'lamp', 'plant'],
    layout: 'office'
  }
};