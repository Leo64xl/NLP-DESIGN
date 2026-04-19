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
  length: number;
  angle: number;
  rooms: string[];
  isExterior: boolean;
}

export interface PascalOpening {
  x: number;
  y: number;
  width: number;
  height: number;
  elevation: number;
  angle: number;
  isWindow: boolean;
  isMain?: boolean;
}

export interface PascalBlueprint {
  metadata: {
    format: string;
    version: string;
  };
  project: {
    nodes: PascalNode[];
    walls: PascalWall[];
    openings: PascalOpening[];
  };
}

export class PascalGenerator {
  static generateShell(layoutRooms: any[], _building: unknown): PascalBlueprint {
    const clean = (val: number) => Math.round(val * 100) / 100;

    // 1. EXTRAER LA CUADRÍCULA TOPOLÓGICA (Grid de cortes)
    const xSet = new Set<number>();
    const ySet = new Set<number>();

    layoutRooms.forEach(room => {
      xSet.add(clean(room.position.x));
      xSet.add(clean(room.position.x + room.size.width));
      ySet.add(clean(room.position.y));
      ySet.add(clean(room.position.y + room.size.height));
    });

    const sortedX = Array.from(xSet).sort((a, b) => a - b);
    const sortedY = Array.from(ySet).sort((a, b) => a - b);

    const nodesMap: Record<string, PascalNode> = {};
    const walls: PascalWall[] = [];
    let wallCounter = 1;

    const addNode = (x: number, y: number) => {
      const id = `n_${clean(x)}_${clean(y)}`;
      if (!nodesMap[id]) nodesMap[id] = { id, x: clean(x), y: clean(y) };
      return id;
    };

    const defaultHeight = 2.8;
    const defaultThickness = 0.15;

    // 2. SEGMENTAR MUROS HORIZONTALES
    for (let y of sortedY) {
      for (let i = 0; i < sortedX.length - 1; i++) {
        const x1 = sortedX[i];
        const x2 = sortedX[i + 1];
        const midX = (x1 + x2) / 2;

        const touchingRooms = layoutRooms.filter(room => {
          const rx1 = clean(room.position.x), rx2 = clean(room.position.x + room.size.width);
          const ry1 = clean(room.position.y), ry2 = clean(room.position.y + room.size.height);
          return (Math.abs(y - ry1) < 0.05 || Math.abs(y - ry2) < 0.05) && (midX > rx1 && midX < rx2);
        });

        if (touchingRooms.length > 0) {
          walls.push({
            id: `w_h_${wallCounter++}`,
            startNode: addNode(x1, y),
            endNode: addNode(x2, y),
            thickness: defaultThickness,
            height: defaultHeight,
            length: clean(x2 - x1),
            angle: 0,
            rooms: touchingRooms.map(r => r.name),
            isExterior: touchingRooms.length === 1
          });
        }
      }
    }

    // 3. SEGMENTAR MUROS VERTICALES
    for (let x of sortedX) {
      for (let j = 0; j < sortedY.length - 1; j++) {
        const y1 = sortedY[j];
        const y2 = sortedY[j + 1];
        const midY = (y1 + y2) / 2;

        const touchingRooms = layoutRooms.filter(room => {
          const rx1 = clean(room.position.x), rx2 = clean(room.position.x + room.size.width);
          const ry1 = clean(room.position.y), ry2 = clean(room.position.y + room.size.height);
          return (Math.abs(x - rx1) < 0.05 || Math.abs(x - rx2) < 0.05) && (midY > ry1 && midY < ry2);
        });

        if (touchingRooms.length > 0) {
          walls.push({
            id: `w_v_${wallCounter++}`,
            startNode: addNode(x, y1),
            endNode: addNode(x, y2),
            thickness: defaultThickness,
            height: defaultHeight,
            length: clean(y2 - y1),
            angle: Math.PI / 2,
            rooms: touchingRooms.map(r => r.name),
            isExterior: touchingRooms.length === 1
          });
        }
      }
    }

    // 4. LÓGICA DE FACHADA Y ABERTURAS
    const openings: PascalOpening[] = [];
    const wallsWithPriorityDoors = new Set<string>(); // Para evitar poner ventanas donde van las puertas de fachada
    let mainDoorAssigned = false;

    // Filtramos los muros exteriores y los ordenamos por tamaño para elegir las mejores caras
    const exteriorWalls = walls.filter(w => w.isExterior).sort((a, b) => b.length - a.length);

    // A. IDENTIFICAR ENTRADA PRINCIPAL (Sala de Estar)
    const salaWall = exteriorWalls.find(w => w.rooms.some(r => r.toLowerCase().match(/sala|living|estar/)));
    if (salaWall && salaWall.length >= 1.5) {
      const s = nodesMap[salaWall.startNode];
      const e = nodesMap[salaWall.endNode];
      openings.push({
        x: s.x + (e.x - s.x) / 2, y: s.y + (e.y - s.y) / 2,
        width: 1.2, // Puerta principal estándar
        height: 2.3, elevation: 0, angle: salaWall.angle, isWindow: false, isMain: true
      });
      mainDoorAssigned = true;
      wallsWithPriorityDoors.add(salaWall.id);
    }

    // B. IDENTIFICAR COCHERA (Garage)
    const garageWall = exteriorWalls.find(w => w.rooms.some(r => r.toLowerCase().match(/garage|cochera/)));
    if (garageWall && garageWall.length >= 2.0) {
      const s = nodesMap[garageWall.startNode];
      const e = nodesMap[garageWall.endNode];
      openings.push({
        x: s.x + (e.x - s.x) / 2, y: s.y + (e.y - s.y) / 2,
        width: garageWall.length * 0.8, // Portón del 80% del muro exterior
        height: 2.4, elevation: 0, angle: garageWall.angle, isWindow: false
      });
      wallsWithPriorityDoors.add(garageWall.id);
    }

    // C. FALLBACK DE ENTRADA (Si la Sala no quedó en el borde, forzamos la entrada en el muro más largo disponible)
    if (!mainDoorAssigned) {
      const fallbackWall = exteriorWalls.find(w => !wallsWithPriorityDoors.has(w.id));
      if (fallbackWall) {
        const s = nodesMap[fallbackWall.startNode];
        const e = nodesMap[fallbackWall.endNode];
        openings.push({
          x: s.x + (e.x - s.x) / 2, y: s.y + (e.y - s.y) / 2,
          width: 1.2, height: 2.3, elevation: 0, angle: fallbackWall.angle, isWindow: false, isMain: true
        });
        wallsWithPriorityDoors.add(fallbackWall.id);
      }
    }

    // D. RECORRER EL RESTO DE LOS MUROS (Ventanas y Puertas interiores)
    walls.forEach(wall => {
      // Si el muro ya tiene la puerta principal o de cochera, lo ignoramos (no ventanas ahí)
      if (wallsWithPriorityDoors.has(wall.id)) return; 
      
      // Muros muy pequeños no llevan aberturas
      if (wall.length < 1.0) return; 

      const start = nodesMap[wall.startNode];
      const end = nodesMap[wall.endNode];
      const midX = start.x + (end.x - start.x) / 2;
      const midY = start.y + (end.y - start.y) / 2;

      if (wall.isExterior) {
        // VENTANAS EXTERIORES (30% del arista)
        openings.push({
          x: midX, y: midY,
          width: wall.length * 0.30,
          height: 1.2, elevation: 1.1, angle: wall.angle, isWindow: true
        });
      } else {
        // PUERTAS INTERIORES (25% del arista)
        openings.push({
          x: midX, y: midY,
          width: wall.length * 0.25,
          height: 2.1, elevation: 0, angle: wall.angle, isWindow: false
        });
      }
    });

    return {
      metadata: { format: "pascal-blueprint", version: "2.0" },
      project: {
        nodes: Object.values(nodesMap),
        walls: walls,
        openings: openings
      }
    };
  }
}