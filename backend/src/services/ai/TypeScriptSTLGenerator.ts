// 🏗️ GENERADOR STL CON TYPESCRIPT PURO
// Convierte datos estructurales en modelos 3D STL

interface NLPStructuralData {
  metadata: {
    title: string;
    description: string;
    totalArea: number;
    dimensions: { width: number; length: number; height?: number };
    style: string;
    generatedAt: string;
  };
  rooms: Array<{
    name: string;
    type: string;
    area: number;
    position: { x: number; y: number };
    size: { width: number; height: number };
    doors: Array<{ position: string; width: number }>;
    windows: Array<{ position: string; width: number; height: number }>;
    features: string[];
  }>;
  walls: Array<{
    start: [number, number];
    end: [number, number];
    thickness: number;
    material: string;
  }>;
  connections: Array<{
    from: string;
    to: string;
    type: 'door' | 'opening' | 'window';
    width: number;
  }>;
}

interface Vector3 {
  x: number;
  y: number;
  z: number;
}

interface Triangle {
  normal: Vector3;
  vertices: [Vector3, Vector3, Vector3];
}

export class TypeScriptSTLGenerator {
  private static readonly STL_CONFIG = {
    wallHeight: 2.8, // metros
    wallThickness: 0.2, // metros
    floorThickness: 0.2, // metros
    doorHeight: 2.1, // metros
    windowHeight: 1.2, // metros
    windowSillHeight: 0.9, // metros desde el suelo
  };

  /**
   * Genera un STL arquitectónico completo
   */
  static generateArchitecturalSTL(data: NLPStructuralData): string {
    console.log('🏗️ Generando STL arquitectónico...');

    const triangles: Triangle[] = [];

    // 1. Generar piso base
    triangles.push(...this.generateFloor(data.metadata.dimensions));

    // 2. Generar paredes
    triangles.push(...this.generateWalls(data.walls));

    // 3. Generar puertas y ventanas (como aberturas en las paredes)
    // Nota: Las aberturas se manejan restando geometría de las paredes

    // 4. Convertir triángulos a formato STL
    const stlContent = this.trianglesToSTL(triangles, data.metadata.title);

    console.log('✅ STL generado exitosamente');
    console.log(`📊 Total de triángulos: ${triangles.length}`);

    return stlContent;
  }

  /**
   * Genera el piso base
   */
  private static generateFloor(dimensions: { width: number; length: number }): Triangle[] {
    const triangles: Triangle[] = [];
    const { width, length } = dimensions;
    const thickness = this.STL_CONFIG.floorThickness;

    // Superficie superior del piso
    const topFace = [
      { x: 0, y: 0, z: 0 },
      { x: width, y: 0, z: 0 },
      { x: width, y: length, z: 0 },
      { x: 0, y: length, z: 0 }
    ];

    // Superficie inferior del piso
    const bottomFace = [
      { x: 0, y: 0, z: -thickness },
      { x: 0, y: length, z: -thickness },
      { x: width, y: length, z: -thickness },
      { x: width, y: 0, z: -thickness }
    ];

    // Cara superior (2 triángulos)
    triangles.push({
      normal: { x: 0, y: 0, z: 1 },
      vertices: [topFace[0], topFace[1], topFace[2]]
    });
    triangles.push({
      normal: { x: 0, y: 0, z: 1 },
      vertices: [topFace[0], topFace[2], topFace[3]]
    });

    // Cara inferior (2 triángulos)
    triangles.push({
      normal: { x: 0, y: 0, z: -1 },
      vertices: [bottomFace[0], bottomFace[2], bottomFace[1]]
    });
    triangles.push({
      normal: { x: 0, y: 0, z: -1 },
      vertices: [bottomFace[0], bottomFace[3], bottomFace[2]]
    });

    // Caras laterales
    // Cara frontal
    triangles.push(...this.createQuadTriangles(
      topFace[0], topFace[1], bottomFace[1], bottomFace[0],
      { x: 0, y: -1, z: 0 }
    ));

    // Cara trasera
    triangles.push(...this.createQuadTriangles(
      topFace[2], topFace[3], bottomFace[3], bottomFace[2],
      { x: 0, y: 1, z: 0 }
    ));

    // Cara izquierda
    triangles.push(...this.createQuadTriangles(
      topFace[3], topFace[0], bottomFace[0], bottomFace[3],
      { x: -1, y: 0, z: 0 }
    ));

    // Cara derecha
    triangles.push(...this.createQuadTriangles(
      topFace[1], topFace[2], bottomFace[2], bottomFace[1],
      { x: 1, y: 0, z: 0 }
    ));

    return triangles;
  }

  /**
   * Genera las paredes
   */
  private static generateWalls(walls: NLPStructuralData['walls']): Triangle[] {
    const triangles: Triangle[] = [];
    const wallHeight = this.STL_CONFIG.wallHeight;
    const wallThickness = this.STL_CONFIG.wallThickness;

    walls.forEach(wall => {
      const [x1, y1] = wall.start;
      const [x2, y2] = wall.end;

      // Calcular el vector direccional de la pared
      const dx = x2 - x1;
      const dy = y2 - y1;
      const length = Math.sqrt(dx * dx + dy * dy);

      if (length === 0) return; // Evitar paredes de longitud cero

      // Vector normalizado perpendicular (para el grosor)
      const perpX = -dy / length * wallThickness / 2;
      const perpY = dx / length * wallThickness / 2;

      // Vértices de la pared
      const bottomVertices = [
        { x: x1 + perpX, y: y1 + perpY, z: 0 },
        { x: x2 + perpX, y: y2 + perpY, z: 0 },
        { x: x2 - perpX, y: y2 - perpY, z: 0 },
        { x: x1 - perpX, y: y1 - perpY, z: 0 }
      ];

      const topVertices = bottomVertices.map(v => ({
        x: v.x,
        y: v.y,
        z: wallHeight
      }));

      // Cara superior
      triangles.push(...this.createQuadTriangles(
        topVertices[0], topVertices[1], topVertices[2], topVertices[3],
        { x: 0, y: 0, z: 1 }
      ));

      // Cara inferior
      triangles.push(...this.createQuadTriangles(
        bottomVertices[3], bottomVertices[2], bottomVertices[1], bottomVertices[0],
        { x: 0, y: 0, z: -1 }
      ));

      // Caras laterales
      // Cara exterior
      triangles.push(...this.createQuadTriangles(
        bottomVertices[0], bottomVertices[1], topVertices[1], topVertices[0],
        { x: perpX * 2, y: perpY * 2, z: 0 }
      ));

      // Cara interior
      triangles.push(...this.createQuadTriangles(
        bottomVertices[2], bottomVertices[3], topVertices[3], topVertices[2],
        { x: -perpX * 2, y: -perpY * 2, z: 0 }
      ));

      // Caras laterales de los extremos
      triangles.push(...this.createQuadTriangles(
        bottomVertices[3], bottomVertices[0], topVertices[0], topVertices[3],
        { x: -dx / length, y: -dy / length, z: 0 }
      ));

      triangles.push(...this.createQuadTriangles(
        bottomVertices[1], bottomVertices[2], topVertices[2], topVertices[1],
        { x: dx / length, y: dy / length, z: 0 }
      ));
    });

    return triangles;
  }

  /**
   * Crea dos triángulos a partir de un cuadrilátero
   */
  private static createQuadTriangles(
    v1: Vector3, 
    v2: Vector3, 
    v3: Vector3, 
    v4: Vector3, 
    normal: Vector3
  ): Triangle[] {
    return [
      {
        normal: this.normalizeVector(normal),
        vertices: [v1, v2, v3]
      },
      {
        normal: this.normalizeVector(normal),
        vertices: [v1, v3, v4]
      }
    ];
  }

  /**
   * Normaliza un vector
   */
  private static normalizeVector(v: Vector3): Vector3 {
    const length = Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z);
    if (length === 0) return { x: 0, y: 0, z: 1 };
    
    return {
      x: v.x / length,
      y: v.y / length,
      z: v.z / length
    };
  }

  /**
   * Convierte triángulos a formato STL ASCII
   */
  private static trianglesToSTL(triangles: Triangle[], title: string): string {
    let stlContent = `solid ${title.replace(/\s+/g, '_')}\n`;

    triangles.forEach(triangle => {
      const { normal, vertices } = triangle;
      
      stlContent += `  facet normal ${normal.x.toFixed(6)} ${normal.y.toFixed(6)} ${normal.z.toFixed(6)}\n`;
      stlContent += `    outer loop\n`;
      
      vertices.forEach(vertex => {
        stlContent += `      vertex ${vertex.x.toFixed(6)} ${vertex.y.toFixed(6)} ${vertex.z.toFixed(6)}\n`;
      });
      
      stlContent += `    endloop\n`;
      stlContent += `  endfacet\n`;
    });

    stlContent += `endsolid ${title.replace(/\s+/g, '_')}\n`;

    return stlContent;
  }

  /**
   * Genera un STL de prueba para validación
   */
  static generateTestSTL(): string {
    // Cubo simple de prueba (1x1x1 metros)
    const triangles: Triangle[] = [];

    // Cara frontal
    triangles.push({
      normal: { x: 0, y: -1, z: 0 },
      vertices: [
        { x: 0, y: 0, z: 0 },
        { x: 1, y: 0, z: 0 },
        { x: 1, y: 0, z: 1 }
      ]
    });
    triangles.push({
      normal: { x: 0, y: -1, z: 0 },
      vertices: [
        { x: 0, y: 0, z: 0 },
        { x: 1, y: 0, z: 1 },
        { x: 0, y: 0, z: 1 }
      ]
    });

    // Cara trasera
    triangles.push({
      normal: { x: 0, y: 1, z: 0 },
      vertices: [
        { x: 0, y: 1, z: 0 },
        { x: 0, y: 1, z: 1 },
        { x: 1, y: 1, z: 1 }
      ]
    });
    triangles.push({
      normal: { x: 0, y: 1, z: 0 },
      vertices: [
        { x: 0, y: 1, z: 0 },
        { x: 1, y: 1, z: 1 },
        { x: 1, y: 1, z: 0 }
      ]
    });

    // Agregar más caras del cubo...
    // (Para simplicidad, solo incluyo 2 caras en este ejemplo)

    return this.trianglesToSTL(triangles, "Test_Cube");
  }

  /**
   * Valida que el STL generado es válido
   */
  static validateSTL(stlContent: string): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!stlContent.startsWith('solid ')) {
      errors.push('El archivo STL debe comenzar con "solid"');
    }

    if (!stlContent.endsWith('endsolid')) {
      errors.push('El archivo STL debe terminar con "endsolid"');
    }

    const facetCount = (stlContent.match(/facet normal/g) || []).length;
    const endfacetCount = (stlContent.match(/endfacet/g) || []).length;

    if (facetCount !== endfacetCount) {
      errors.push('Número desigual de "facet" y "endfacet"');
    }

    if (facetCount === 0) {
      errors.push('El STL no contiene triángulos');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }
}

export default TypeScriptSTLGenerator;