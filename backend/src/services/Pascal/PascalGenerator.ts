// backend/src/services/Pascal/PascalGenerator.ts

export interface PascalNode {
  id: string;
  x: number;
  y: number;
}

export interface PascalWall {
  id: string;
  startNode: string;
  endNode: string;
  thickness: number;
  height: number;
}

export interface PascalBlueprint {
  metadata: {
    format: string;
    version: string;
  };
  project: {
    nodes: PascalNode[];
    walls: PascalWall[];
  };
}

interface PascalLayoutRoom {
  position: {
    x: number;
    y: number;
  };
  size: {
    width: number;
    height: number;
  };
}

export class PascalGenerator {
  static generateShell(layoutRooms: PascalLayoutRoom[], _building: unknown): PascalBlueprint {
    const nodes: Map<string, PascalNode> = new Map();
    const walls: PascalWall[] = [];
    let wallCounter = 1;

    // Función auxiliar para redondear y evitar nodos duplicados por decimales
    const roundCoord = (val: number) => Math.round(val * 100) / 100;
    
    // Función para crear o recuperar un nodo
    const getOrCreateNode = (x: number, y: number): string => {
      const id = `n_${roundCoord(x)}_${roundCoord(y)}`;
      if (!nodes.has(id)) {
        nodes.set(id, { id, x: roundCoord(x), y: roundCoord(y) });
      }
      return id;
    };

    // Procesar cada habitación
    layoutRooms.forEach((room) => {
      const startX = room.position.x;
      const startY = room.position.y;
      const endX = room.position.x + room.size.width;
      const endY = room.position.y + room.size.height;

      // Generar los 4 nodos de la habitación
      const nTL = getOrCreateNode(startX, startY);     // Top-Left
      const nTR = getOrCreateNode(endX, startY);       // Top-Right
      const nBR = getOrCreateNode(endX, endY);         // Bottom-Right
      const nBL = getOrCreateNode(startX, endY);       // Bottom-Left

      const defaultHeight = 2.8;
      const defaultThickness = 0.15;

      // Generar los 4 muros conectando los nodos
      walls.push(
        { id: `w_${wallCounter++}`, startNode: nTL, endNode: nTR, thickness: defaultThickness, height: defaultHeight },
        { id: `w_${wallCounter++}`, startNode: nTR, endNode: nBR, thickness: defaultThickness, height: defaultHeight },
        { id: `w_${wallCounter++}`, startNode: nBR, endNode: nBL, thickness: defaultThickness, height: defaultHeight },
        { id: `w_${wallCounter++}`, startNode: nBL, endNode: nTL, thickness: defaultThickness, height: defaultHeight }
      );
    });

    // IMPORTANTE: Aquí se exporta el formato JSON limpio para Pascal
    return {
      metadata: { format: "pascal-blueprint", version: "1.0" },
      project: {
        nodes: Array.from(nodes.values()),
        walls: walls
      }
    };
  }
}