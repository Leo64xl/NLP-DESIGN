export interface MaterialProperties {
  type: 'MeshLambertMaterial' | 'MeshPhongMaterial' | 'MeshStandardMaterial';
  color: number;
  map?: string;
  normalMap?: string;
  roughnessMap?: string;
  metalness?: number;
  roughness?: number;
  emissive?: number;
  opacity?: number;
  transparent?: boolean;
}

export interface MaterialLibrary {
  floors: Record<string, MaterialProperties>;
  walls: Record<string, MaterialProperties>;
  furniture: Record<string, MaterialProperties>;
  doors: Record<string, MaterialProperties>;
  windows: Record<string, MaterialProperties>;
}

export const THREEJS_MATERIALS: MaterialLibrary = {
  floors: {
    wood_floor: {
      type: 'MeshLambertMaterial',
      color: 0x8B4513,
      map: 'textures/wood_floor.jpg',
      normalMap: 'textures/wood_floor_normal.jpg',
      roughness: 0.8
    },
    ceramic_tile: {
      type: 'MeshPhongMaterial',
      color: 0xF5F5F5,
      map: 'textures/ceramic_tile.jpg',
      normalMap: 'textures/ceramic_tile_normal.jpg',
      roughness: 0.1
    },
    carpet: {
      type: 'MeshLambertMaterial',
      color: 0x8FBC8F,
      map: 'textures/carpet.jpg',
      roughness: 0.9
    },
    marble: {
      type: 'MeshPhongMaterial',
      color: 0xFFFFFF,
      map: 'textures/marble.jpg',
      normalMap: 'textures/marble_normal.jpg',
      roughness: 0.2
    },
    concrete: {
      type: 'MeshLambertMaterial',
      color: 0x808080,
      map: 'textures/concrete.jpg',
      normalMap: 'textures/concrete_normal.jpg',
      roughness: 0.9
    }
  },
  walls: {
    interior_wall: {
      type: 'MeshLambertMaterial',
      color: 0xFFFFFF,
      map: 'textures/wall_interior.jpg',
      roughness: 0.8
    },
    exterior_wall: {
      type: 'MeshLambertMaterial',
      color: 0xDDDDDD,
      map: 'textures/brick.jpg',
      normalMap: 'textures/brick_normal.jpg',
      roughness: 0.9
    },
    drywall: {
      type: 'MeshLambertMaterial',
      color: 0xF8F8FF,
      map: 'textures/drywall.jpg',
      roughness: 0.7
    }
  },
  furniture: {
    wood_dark: {
      type: 'MeshPhongMaterial',
      color: 0x4A4A4A,
      map: 'textures/wood_dark.jpg',
      normalMap: 'textures/wood_normal.jpg',
      roughness: 0.6
    },
    wood_light: {
      type: 'MeshPhongMaterial',
      color: 0xD2B48C,
      map: 'textures/wood_light.jpg',
      normalMap: 'textures/wood_normal.jpg',
      roughness: 0.6
    },
    fabric_sofa: {
      type: 'MeshLambertMaterial',
      color: 0x2F4F4F,
      map: 'textures/fabric.jpg',
      roughness: 0.8
    },
    metal_steel: {
      type: 'MeshStandardMaterial',
      color: 0xC0C0C0,
      metalness: 0.9,
      roughness: 0.1
    }
  },
  doors: {
    wood_door: {
      type: 'MeshPhongMaterial',
      color: 0x8B4513,
      map: 'textures/door_wood.jpg',
      normalMap: 'textures/door_wood_normal.jpg',
      roughness: 0.7
    },
    glass_door: {
      type: 'MeshPhongMaterial',
      color: 0xFFFFFF,
      opacity: 0.3,
      transparent: true,
      roughness: 0.1
    }
  },
  windows: {
    glass_clear: {
      type: 'MeshPhongMaterial',
      color: 0xFFFFFF,
      opacity: 0.2,
      transparent: true,
      roughness: 0.05
    },
    glass_tinted: {
      type: 'MeshPhongMaterial',
      color: 0x87CEEB,
      opacity: 0.4,
      transparent: true,
      roughness: 0.1
    }
  }
};