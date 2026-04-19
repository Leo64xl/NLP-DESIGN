// backend/src/utils/SpacePartitioner.ts

interface Room {
  name: string;
  type: string;
  weight?: number; // El peso o porcentaje de área deseado
  position?: { x: number; y: number };
  size?: { width: number; height: number };
}

export class SpacePartitioner {
  /**
   * Asigna pesos (importancia de área) según el tipo de habitación.
   */
  
private static assignWeights(rooms: Room[]): Room[] {
  return rooms.map(room => {
    const type = room.type.toLowerCase();
    const name = room.name.toLowerCase();
    let weight = 10;

    // 1. JERARQUÍA DE ESPACIOS
    if (type.includes('sala') || name.includes('living') || name.includes('estar')) {
      weight = 40; // La Sala es la reina del espacio
    } else if (type.includes('garage') || name.includes('cochera')) {
      weight = 30; // La cochera necesita gran área técnica
    } else if (type.includes('bedroom') || name.includes('habitacion')) {
      weight = 20; 
    } else if (type.includes('kitchen') || name.includes('cocina')) {
      weight = 15;
    } else if (type.includes('bathroom') || name.includes('baño')) {
      weight = 6;  // REDUCCIÓN CRÍTICA: El baño ahora es un área mínima funcional
    } else if (type.includes('laundry') || name.includes('lavado')) {
      weight = 4;
    }

    return { ...room, weight };
  });
}

  /**
   * Algoritmo Treemap (Slice and Dice) para particionar el espacio sin huecos.
   */
  private static sliceAndDice(
    rooms: Room[],
    x: number,
    y: number,
    width: number,
    height: number
  ): Room[] {
    if (rooms.length === 0) return [];
    
    // Caso base: Solo queda una habitación, toma todo el espacio restante
    if (rooms.length === 1) {
      rooms[0].position = { x: Math.round(x * 100) / 100, y: Math.round(y * 100) / 100 };
      rooms[0].size = { width: Math.round(width * 100) / 100, height: Math.round(height * 100) / 100 };
      return rooms;
    }

    // Calcular el peso total del grupo actual
    const totalWeight = rooms.reduce((sum, r) => sum + (r.weight || 10), 0);
    
    // Dividir la lista de habitaciones en dos grupos (mitad y mitad de peso aprox)
    let halfWeight = 0;
    let splitIndex = 0;
    for (let i = 0; i < rooms.length; i++) {
      halfWeight += (rooms[i].weight || 10);
      splitIndex = i + 1;
      if (halfWeight >= totalWeight / 2 && splitIndex < rooms.length) {
        break;
      }
    }

    const group1 = rooms.slice(0, splitIndex);
    const group2 = rooms.slice(splitIndex);

    const ratio1 = group1.reduce((sum, r) => sum + (r.weight || 10), 0) / totalWeight;

    // Decidir si cortamos Horizontal o Verticalmente para mantener proporciones cuadradas
    if (width > height) {
      // Corte Vertical
      const splitWidth = width * ratio1;
      this.sliceAndDice(group1, x, y, splitWidth, height);
      this.sliceAndDice(group2, x + splitWidth, y, width - splitWidth, height);
    } else {
      // Corte Horizontal
      const splitHeight = height * ratio1;
      this.sliceAndDice(group1, x, y, width, splitHeight);
      this.sliceAndDice(group2, x, y + splitHeight, width, height - splitHeight);
    }

    return [...group1, ...group2];
  }

  /**
   * Función principal a llamar desde ArchitecturalLayoutEngine
   */
  public static generateLayout(rawRooms: Room[], totalWidth: number, totalDepth: number): Room[] {
    // 1. Asignar pesos arquitectónicos
    const weightedRooms = this.assignWeights(rawRooms);
    
    // 2. Ordenar las habitaciones (por ejemplo, Salas primero, Baños al final)
    weightedRooms.sort((a, b) => (b.weight || 0) - (a.weight || 0));

    // 3. Ejecutar la partición en el terreno completo
    return this.sliceAndDice(weightedRooms, 0, 0, totalWidth, totalDepth);
  }
}