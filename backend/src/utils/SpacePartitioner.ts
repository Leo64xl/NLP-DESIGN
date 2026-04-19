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
  
  // Función crítica para evitar los micro-desfases de 0.01m que corrompen el plano
  private static clean(val: number): number {
    return Number(val.toFixed(2));
  }

  private static assignWeights(rooms: Room[]): Room[] {
    return rooms.map(room => {
      const type = room.type.toLowerCase();
      const name = room.name.toLowerCase();
      let weight = 10;
      let zone = 'back'; // Por defecto, todo va atrás de la casa

      // 1. JERARQUÍA Y ZONIFICACIÓN ARQUITECTÓNICA
      if (type.includes('sala') || name.includes('living') || name.includes('estar')) {
        weight = 40; 
        zone = 'front'; // Obligado a la fachada Norte
      } else if (type.includes('garage') || name.includes('cochera')) {
        weight = 30; 
        zone = 'front'; // Obligado a la fachada Norte
      } else if (type.includes('bedroom') || name.includes('habitacion')) {
        weight = 25; 
        zone = 'back';
      } else if (type.includes('kitchen') || name.includes('cocina')) {
        weight = 15;
        zone = 'back';
      } else if (type.includes('bathroom') || name.includes('baño')) {
        weight = 6;  
        zone = 'back';
      } else if (type.includes('circulation') || name.includes('pasillo')) {
        weight = 8;
        zone = 'back';
      }

      return { ...room, weight, placement: zone };
    });
  }

  public static generateLayout(rawRooms: Room[], totalWidth: number, totalDepth: number): Room[] {
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
    const frontDepth = totalDepth * (frontWeight / totalWeight);

    // 4. PARTICIÓN DE ZONAS CONGRUENTES
    // Los cuartos frontales se alinean lado a lado a lo ancho de la fachada (y=0)
    const placedFront = this.split1D(frontRooms, 0, 0, totalWidth, frontDepth, 'horizontal');
    
    // Los cuartos traseros se particionan en el rectángulo sobrante perfecto
    const placedBack = this.sliceAndDice(backRooms, 0, frontDepth, totalWidth, totalDepth - frontDepth);

    return [...placedFront, ...placedBack];
  }

  // Algoritmo de corte lineal (Alinea Sala y Cochera dominando la fachada)
  private static split1D(rooms: Room[], startX: number, startY: number, width: number, height: number, direction: 'horizontal' | 'vertical'): Room[] {
     const totalW = rooms.reduce((s, r) => s + (r.weight || 10), 0);
     let currentX = startX;
     let currentY = startY;

     return rooms.map(room => {
        const ratio = (room.weight || 10) / totalW;
        const r = { ...room };
        
        if (direction === 'horizontal') {
           const roomWidth = width * ratio;
           r.position = { x: this.clean(currentX), y: this.clean(currentY) };
           r.size = { width: this.clean(roomWidth), height: this.clean(height) };
           currentX += roomWidth;
        } else {
           const roomHeight = height * ratio;
           r.position = { x: this.clean(currentX), y: this.clean(currentY) };
           r.size = { width: this.clean(width), height: this.clean(roomHeight) };
           currentY += roomHeight;
        }
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
     rooms.sort((a, b) => (b.weight || 0) - (a.weight || 0));

     const totalWeight = rooms.reduce((sum, r) => sum + (r.weight || 10), 0);
     let halfWeight = 0;
     let splitIndex = 0;
     
     for (let i = 0; i < rooms.length; i++) {
       halfWeight += (rooms[i].weight || 10);
       splitIndex = i + 1;
       if (halfWeight >= totalWeight / 2 && splitIndex < rooms.length) break;
     }

     const group1 = rooms.slice(0, splitIndex);
     const group2 = rooms.slice(splitIndex);
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
}