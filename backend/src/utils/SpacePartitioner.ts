// backend/src/utils/SpacePartitioner.ts

interface Room {
  name: string;
  type: string;
  weight?: number; 
  placement?: string; // Nueva propiedad para forzar la zonificación
  position?: { x: number; y: number };
  size?: { width: number; height: number };
}

export class SpacePartitioner {

  private static readonly MIN_ROOM_SIDE = 0.8;
  private static readonly MIN_ZONE_DEPTH = 1.6;
  
  // Función crítica para evitar los micro-desfases de 0.01m que corrompen el plano
  private static clean(val: number): number {
    return Number(val.toFixed(2));
  }

  private static assignWeights(rooms: Room[]): Room[] {
    return rooms.map(room => {
      const type = room.type.toLowerCase();
      const name = room.name.toLowerCase();
      const inferredArea = room.size?.width && room.size?.height
        ? room.size.width * room.size.height
        : undefined;

      let weight = Number.isFinite(room.weight) && (room.weight as number) > 0
        ? (room.weight as number)
        : Math.max(6, Number.isFinite(inferredArea) ? (inferredArea as number) : 10);

      let zone = this.normalizePlacement(room.placement);

      // 1. JERARQUÍA Y ZONIFICACIÓN ARQUITECTÓNICA
      if (!zone && (type.includes('sala') || name.includes('living') || name.includes('estar') || type.includes('social'))) {
        weight = 40; 
        zone = 'front'; // Obligado a la fachada Norte
      } else if (!zone && (type.includes('garage') || name.includes('cochera') || name.includes('recep') || name.includes('lobby'))) {
        weight = 30; 
        zone = 'front'; // Obligado a la fachada Norte
      } else if (!zone && (type.includes('bedroom') || name.includes('habitacion') || type.includes('rest') || type.includes('private'))) {
        weight = 25; 
        zone = 'back';
      } else if (!zone && (type.includes('kitchen') || name.includes('cocina') || type.includes('service'))) {
        weight = 15;
        zone = 'back';
      } else if (!zone && (type.includes('bathroom') || name.includes('baño') || name.includes('bano') || type.includes('hygiene'))) {
        weight = 6;  
        zone = 'back';
      } else if (!zone && (type.includes('circulation') || name.includes('pasillo') || type.includes('connector'))) {
        weight = 8;
        zone = 'back';
      }

      if (!zone) {
        zone = 'back';
      }

      return { ...room, weight, placement: zone };
    });
  }

  private static normalizePlacement(placement?: string): 'front' | 'back' | null {
    if (!placement) return null;
    const token = placement.toLowerCase();
    if (token === 'front') return 'front';
    if (token === 'back' || token === 'private' || token === 'connector' || token === 'flexible') return 'back';
    return null;
  }

  public static generateLayout(rawRooms: Room[], totalWidth: number, totalDepth: number): Room[] {
    if (!(Number.isFinite(totalWidth) && totalWidth > 0 && Number.isFinite(totalDepth) && totalDepth > 0)) {
      return [];
    }

    const weightedRooms = this.assignWeights(rawRooms);
    
    // 2. SEPARACIÓN POR ZONAS (Frontal vs Trasera)
    const frontRooms = weightedRooms.filter(r => r.placement === 'front');
    const backRooms = weightedRooms.filter(r => r.placement !== 'front');

    // Fallbacks de seguridad
    if (frontRooms.length === 0) return this.sliceAndDice(backRooms, 0, 0, totalWidth, totalDepth);
    if (backRooms.length === 0) return this.split1D(frontRooms, 0, 0, totalWidth, totalDepth, 'horizontal');

    const frontWeight = frontRooms.reduce((s, r) => s + (r.weight || 10), 0);
    const backWeight = backRooms.reduce((s, r) => s + (r.weight || 10), 0);
    const totalWeight = frontWeight + backWeight;

    // 3. CÁLCULO DEL CORTE MAESTRO (Eje Y)
    // Esto garantiza un rectangulo perfecto general, apartando el bloque de entrada
    const rawFrontDepth = totalDepth * (frontWeight / totalWeight);
    const frontDepth = Math.min(
      totalDepth - this.MIN_ZONE_DEPTH,
      Math.max(this.MIN_ZONE_DEPTH, rawFrontDepth),
    );

    // 4. PARTICIÓN DE ZONAS CONGRUENTES
    // Los cuartos frontales se alinean lado a lado a lo ancho de la fachada (y=0)
    const placedFront = this.split1D(frontRooms, 0, 0, totalWidth, frontDepth, 'horizontal');
    
    // Los cuartos traseros se particionan en el rectángulo sobrante perfecto
    const placedBack = this.sliceAndDice(backRooms, 0, frontDepth, totalWidth, totalDepth - frontDepth);

    return this.finalizeLayout([...placedFront, ...placedBack], totalWidth, totalDepth);
  }

  // Algoritmo de corte lineal (Alinea Sala y Cochera dominando la fachada)
  private static split1D(rooms: Room[], startX: number, startY: number, width: number, height: number, direction: 'horizontal' | 'vertical'): Room[] {
      const weighted = rooms.map(room => ({
      room,
      weight: Math.max(room.weight || 10, 0.001),
      }));

      let remainingWeight = weighted.reduce((s, item) => s + item.weight, 0);
      let currentX = startX;
      let currentY = startY;

      return weighted.map((item, index) => {
        const r = { ...item.room };
        const isLast = index === weighted.length - 1;

        if (direction === 'horizontal') {
          const remainingWidth = (startX + width) - currentX;
          const roomWidth = isLast
          ? remainingWidth
          : remainingWidth * (item.weight / Math.max(remainingWeight, 0.001));
          r.position = { x: this.clean(currentX), y: this.clean(currentY) };
          r.size = {
          width: this.clean(Math.max(this.MIN_ROOM_SIDE, roomWidth)),
          height: this.clean(Math.max(this.MIN_ROOM_SIDE, height)),
          };
          currentX += roomWidth;
        } else {
          const remainingHeight = (startY + height) - currentY;
          const roomHeight = isLast
          ? remainingHeight
          : remainingHeight * (item.weight / Math.max(remainingWeight, 0.001));
          r.position = { x: this.clean(currentX), y: this.clean(currentY) };
          r.size = {
          width: this.clean(Math.max(this.MIN_ROOM_SIDE, width)),
          height: this.clean(Math.max(this.MIN_ROOM_SIDE, roomHeight)),
          };
          currentY += roomHeight;
        }

        remainingWeight = Math.max(0, remainingWeight - item.weight);
        return r;
      });
  }

  // Algoritmo Treemap clásico con redondeo estricto (.toFixed) para evitar fallas topológicas
  private static sliceAndDice(rooms: Room[], x: number, y: number, width: number, height: number): Room[] {
     if (rooms.length === 0) return [];
     if (rooms.length === 1) {
        rooms[0].position = { x: this.clean(x), y: this.clean(y) };
        rooms[0].size = { width: this.clean(width), height: this.clean(height) };
        return rooms;
     }

     // Ordenar para que las habitaciones más grandes encajen primero
    const sortedRooms = [...rooms].sort((a, b) => (b.weight || 0) - (a.weight || 0));

     const totalWeight = sortedRooms.reduce((sum, r) => sum + (r.weight || 10), 0);
     let halfWeight = 0;
     let splitIndex = 0;
     
     for (let i = 0; i < sortedRooms.length; i++) {
       halfWeight += (sortedRooms[i].weight || 10);
       splitIndex = i + 1;
       if (halfWeight >= totalWeight / 2 && splitIndex < sortedRooms.length) break;
     }

     const group1 = sortedRooms.slice(0, splitIndex);
     const group2 = sortedRooms.slice(splitIndex);
     const ratio1 = group1.reduce((sum, r) => sum + (r.weight || 10), 0) / totalWeight;

     if (width > height) {
        const splitWidth = width * ratio1;
        const r1 = this.sliceAndDice(group1, x, y, splitWidth, height);
        const r2 = this.sliceAndDice(group2, x + splitWidth, y, width - splitWidth, height);
        return [...r1, ...r2];
     } else {
        const splitHeight = height * ratio1;
        const r1 = this.sliceAndDice(group1, x, y, width, splitHeight);
        const r2 = this.sliceAndDice(group2, x, y + splitHeight, width, height - splitHeight);
        return [...r1, ...r2];
     }
  }

  private static finalizeLayout(rooms: Room[], totalWidth: number, totalDepth: number): Room[] {
    return rooms.map((room) => {
      const x = this.clean(Math.max(0, room.position?.x ?? 0));
      const y = this.clean(Math.max(0, room.position?.y ?? 0));

      const maxWidth = Math.max(this.MIN_ROOM_SIDE, totalWidth - x);
      const maxHeight = Math.max(this.MIN_ROOM_SIDE, totalDepth - y);

      const width = this.clean(Math.min(maxWidth, Math.max(this.MIN_ROOM_SIDE, room.size?.width ?? this.MIN_ROOM_SIDE)));
      const height = this.clean(Math.min(maxHeight, Math.max(this.MIN_ROOM_SIDE, room.size?.height ?? this.MIN_ROOM_SIDE)));

      return {
        ...room,
        position: { x, y },
        size: { width, height },
      };
    });
  }
}