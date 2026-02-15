// 🎨 GENERADOR SVG CON TYPESCRIPT PURO
// Convierte datos estructurales en planos 2D SVG

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

export class TypeScriptSVGGenerator {
  private static readonly SVG_CONFIG = {
    containerSize: 450, // Tamaño fijo del contenedor cuadrado
    strokeWidth: 1.5,
    wallThickness: 0.2, // metros
    colors: {
      walls: '#2c3e50',
      doors: '#e74c3c',
      windows: '#3498db',
      text: '#2c3e50',
      room_fill: '#f8f9fa',
      room_stroke: '#6c757d',
      container: '#dee2e6',
      background: '#ffffff'
    },
    fonts: {
      title: '18px Arial, sans-serif',
      room: '11px Arial, sans-serif',
      dimension: '9px Arial, sans-serif'
    }
  };

  /**
   * Genera un SVG arquitectónico completo
   */
  static generateArchitecturalSVG(data: NLPStructuralData): string {
    console.log('🎨 Generando SVG arquitectónico optimizado para plano cuadrado...');

    // 🎯 USAR CONTENEDOR CUADRADO FIJO Y CENTRADO
    const containerSize = this.SVG_CONFIG.containerSize;
    
    // Calcular la máxima dimensión del plano real
    const maxRealDimension = Math.max(data.metadata.dimensions.width, data.metadata.dimensions.length);
    
    // Escala para que el plano llene el 90% del contenedor (dejando margen)
    const usableSize = containerSize * 0.9;
    const scale = usableSize / maxRealDimension;
    
    const planWidth = data.metadata.dimensions.width * scale;
    const planHeight = data.metadata.dimensions.length * scale;
    
    // SVG total con márgenes generosos
    const svgWidth = containerSize + 150;
    const svgHeight = containerSize + 200;
    
    // Centrar perfectamente el plano en el contenedor
    const containerX = (svgWidth - containerSize) / 2;
    const containerY = 80; // Espacio para el título
    const planOffsetX = containerX + (containerSize - planWidth) / 2;
    const planOffsetY = containerY + (containerSize - planHeight) / 2;

    let svgContent = `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${svgWidth}" height="${svgHeight}" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${svgWidth} ${svgHeight}">
  <defs>
    <style>
      .background { fill: ${this.SVG_CONFIG.colors.background}; }
      .container { fill: none; stroke: ${this.SVG_CONFIG.colors.container}; stroke-width: 2; }
      .container-shadow { fill: rgba(0,0,0,0.1); }
      .wall { fill: none; stroke: ${this.SVG_CONFIG.colors.walls}; stroke-width: ${this.SVG_CONFIG.strokeWidth}; stroke-linecap: round; }
      .door { fill: none; stroke: ${this.SVG_CONFIG.colors.doors}; stroke-width: ${this.SVG_CONFIG.strokeWidth * 1.5}; stroke-linecap: round; }
      .window { fill: none; stroke: ${this.SVG_CONFIG.colors.windows}; stroke-width: ${this.SVG_CONFIG.strokeWidth * 1.2}; stroke-linecap: round; }
      .room { fill: ${this.SVG_CONFIG.colors.room_fill}; stroke: ${this.SVG_CONFIG.colors.room_stroke}; stroke-width: 0.8; opacity: 0.9; }
      .room:hover { opacity: 1; stroke-width: 1.2; }
      .title { font: ${this.SVG_CONFIG.fonts.title}; fill: ${this.SVG_CONFIG.colors.text}; text-anchor: middle; font-weight: bold; }
      .room-label { font: ${this.SVG_CONFIG.fonts.room}; fill: ${this.SVG_CONFIG.colors.text}; text-anchor: middle; font-weight: 600; }
      .room-area { font: ${this.SVG_CONFIG.fonts.dimension}; fill: ${this.SVG_CONFIG.colors.text}; text-anchor: middle; opacity: 0.8; }
      .dimension { font: ${this.SVG_CONFIG.fonts.dimension}; fill: ${this.SVG_CONFIG.colors.text}; text-anchor: middle; }
      .grid { stroke: rgba(108,117,125,0.2); stroke-width: 0.5; }
    </style>
  </defs>

  <!-- Fondo -->
  <rect width="100%" height="100%" class="background" />

  <!-- Título del plano -->
  <text x="${svgWidth / 2}" y="30" class="title">${data.metadata.title}</text>
  <text x="${svgWidth / 2}" y="50" class="dimension">Área total: ${data.metadata.totalArea}m² | ${data.metadata.dimensions.width}m × ${data.metadata.dimensions.length}m</text>
  <text x="${svgWidth / 2}" y="65" class="dimension">Escala: 1:${Math.round(1/scale * 100)}</text>

  <!-- Sombra del contenedor -->
  <rect x="${containerX + 3}" y="${containerY + 3}" width="${containerSize}" height="${containerSize}" class="container-shadow" />
  
  <!-- Contenedor cuadrado principal -->
  <rect x="${containerX}" y="${containerY}" width="${containerSize}" height="${containerSize}" class="container" />

  <!-- Grid de referencia -->
  <g class="grid">
    ${this.generateGrid(containerX, containerY, containerSize, 10)}
  </g>

  <!-- Contenido del plano centrado -->
  <g transform="translate(${planOffsetX}, ${planOffsetY})">`;

    // 1. Dibujar habitaciones
    svgContent += this.generateRooms(data.rooms, scale);

    // 2. Dibujar paredes
    svgContent += this.generateWalls(data.walls, scale);

    // 3. Dibujar puertas y ventanas
    svgContent += this.generateDoorsAndWindows(data.rooms, scale);

    // 4. Dibujar etiquetas de habitaciones
    svgContent += this.generateRoomLabels(data.rooms, scale);

    // 5. Dibujar dimensiones del plano
    svgContent += this.generatePlanDimensions(data.metadata.dimensions, scale, planWidth, planHeight);

    svgContent += `
  </g>

  <!-- Leyenda de colores -->
  <g transform="translate(10, ${containerY + containerSize + 30})">
    <text x="0" y="0" class="dimension" font-weight="bold">Leyenda:</text>
    <rect x="0" y="10" width="15" height="15" fill="#e8f4f8" stroke="#4a90a4" />
    <text x="20" y="22" class="dimension">Dormitorios</text>
    <rect x="90" y="10" width="15" height="15" fill="#f0f8ff" stroke="#6495ed" />
    <text x="110" y="22" class="dimension">Baños</text>
    <rect x="150" y="10" width="15" height="15" fill="#fff5ee" stroke="#ff7f50" />
    <text x="170" y="22" class="dimension">Cocina</text>
    <rect x="220" y="10" width="15" height="15" fill="#f0fff0" stroke="#32cd32" />
    <text x="240" y="22" class="dimension">Sala</text>
  </g>

  <!-- Información adicional -->
  <text x="10" y="${svgHeight - 40}" class="dimension">Generado: ${new Date(data.metadata.generatedAt).toLocaleDateString()}</text>
  <text x="10" y="${svgHeight - 25}" class="dimension">Estilo: ${data.metadata.style}</text>
  <text x="10" y="${svgHeight - 10}" class="dimension">Total habitaciones: ${data.rooms.length}</text>
  <text x="${svgWidth - 10}" y="${svgHeight - 10}" class="dimension" text-anchor="end">AI-Design System v2.0</text>
</svg>`;

    console.log('✅ SVG generado exitosamente');
    return svgContent;
  }

  /**
   * Genera grid de referencia
   */
  private static generateGrid(startX: number, startY: number, size: number, gridSize: number): string {
    let gridSVG = '';
    const step = size / gridSize;
    
    // Líneas verticales
    for (let i = 0; i <= gridSize; i++) {
      const x = startX + i * step;
      gridSVG += `<line x1="${x}" y1="${startY}" x2="${x}" y2="${startY + size}" class="grid" />
`;
    }
    
    // Líneas horizontales  
    for (let i = 0; i <= gridSize; i++) {
      const y = startY + i * step;
      gridSVG += `<line x1="${startX}" y1="${y}" x2="${startX + size}" y2="${y}" class="grid" />
`;
    }
    
    return gridSVG;
  }

  /**
   * Genera las habitaciones como rectángulos con escala dinámica y mejor visualización
   */
  private static generateRooms(rooms: NLPStructuralData['rooms'], scale: number): string {
    let roomsSVG = '\n    <!-- Habitaciones -->\n';

    rooms.forEach((room, index) => {
      const x = room.position.x * scale;
      const y = room.position.y * scale;
      const width = room.size.width * scale;
      const height = room.size.height * scale;

      // Colores específicos por tipo de habitación
      const roomTypeColors = {
        'bedroom': 'fill: #e8f4f8; stroke: #4a90a4;',
        'bathroom': 'fill: #f0f8ff; stroke: #6495ed;',
        'kitchen': 'fill: #fff5ee; stroke: #ff7f50;',
        'living_room': 'fill: #f0fff0; stroke: #32cd32;',
        'dining_room': 'fill: #fff8dc; stroke: #daa520;',
        'office': 'fill: #f5f5dc; stroke: #8b7355;',
        'storage': 'fill: #f5f5f5; stroke: #808080;',
        'garage': 'fill: #e6e6fa; stroke: #9370db;',
        'hallway': 'fill: #fafafa; stroke: #696969;'
      };

      const roomColor = roomTypeColors[room.type as keyof typeof roomTypeColors] || 'fill: #f8f9fa; stroke: #6c757d;';

      roomsSVG += `    <rect x="${x}" y="${y}" width="${width}" height="${height}" style="${roomColor}" class="room" data-room="${room.name}" data-area="${room.area}m²" />
`;
    });

    return roomsSVG;
  }

  /**
   * Genera las paredes con escala dinámica
   */
  private static generateWalls(walls: NLPStructuralData['walls'], scale: number): string {
    let wallsSVG = '\n    <!-- Paredes -->\n';

    walls.forEach(wall => {
      const x1 = wall.start[0] * scale;
      const y1 = wall.start[1] * scale;
      const x2 = wall.end[0] * scale;
      const y2 = wall.end[1] * scale;

      wallsSVG += `    <line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" class="wall" />
`;
    });

    return wallsSVG;
  }

  /**
   * Genera puertas y ventanas con escala dinámica
   */
  private static generateDoorsAndWindows(rooms: NLPStructuralData['rooms'], scale: number): string {
    let elementsSVG = '\n    <!-- Puertas y Ventanas -->\n';

    rooms.forEach(room => {
      const roomX = room.position.x * scale;
      const roomY = room.position.y * scale;
      const roomWidth = room.size.width * scale;
      const roomHeight = room.size.height * scale;

      // Puertas
      room.doors.forEach(door => {
        const doorWidth = door.width * scale;
        let doorX, doorY, doorX2, doorY2;

        switch (door.position) {
          case 'north':
            doorX = roomX + (roomWidth - doorWidth) / 2;
            doorY = roomY;
            doorX2 = doorX + doorWidth;
            doorY2 = roomY;
            break;
          case 'south':
            doorX = roomX + (roomWidth - doorWidth) / 2;
            doorY = roomY + roomHeight;
            doorX2 = doorX + doorWidth;
            doorY2 = roomY + roomHeight;
            break;
          case 'east':
            doorX = roomX + roomWidth;
            doorY = roomY + (roomHeight - doorWidth) / 2;
            doorX2 = roomX + roomWidth;
            doorY2 = doorY + doorWidth;
            break;
          case 'west':
          default:
            doorX = roomX;
            doorY = roomY + (roomHeight - doorWidth) / 2;
            doorX2 = roomX;
            doorY2 = doorY + doorWidth;
            break;
        }

        elementsSVG += `    <line x1="${doorX}" y1="${doorY}" x2="${doorX2}" y2="${doorY2}" class="door" stroke-width="4" />
`;
      });

      // Ventanas
      room.windows.forEach(window => {
        const windowWidth = window.width * scale;
        let windowX, windowY, windowX2, windowY2;

        switch (window.position) {
          case 'north':
            windowX = roomX + (roomWidth - windowWidth) / 2;
            windowY = roomY;
            windowX2 = windowX + windowWidth;
            windowY2 = roomY;
            break;
          case 'south':
            windowX = roomX + (roomWidth - windowWidth) / 2;
            windowY = roomY + roomHeight;
            windowX2 = windowX + windowWidth;
            windowY2 = roomY + roomHeight;
            break;
          case 'east':
            windowX = roomX + roomWidth;
            windowY = roomY + (roomHeight - windowWidth) / 2;
            windowX2 = roomX + roomWidth;
            windowY2 = windowY + windowWidth;
            break;
          case 'west':
          default:
            windowX = roomX;
            windowY = roomY + (roomHeight - windowWidth) / 2;
            windowX2 = roomX;
            windowY2 = windowY + windowWidth;
            break;
        }

        elementsSVG += `    <line x1="${windowX}" y1="${windowY}" x2="${windowX2}" y2="${windowY2}" class="window" stroke-width="3" />
`;
      });
    });

    return elementsSVG;
  }

  /**
   * Genera etiquetas de habitaciones con escala dinámica y mejor legibilidad
   */
  private static generateRoomLabels(rooms: NLPStructuralData['rooms'], scale: number): string {
    let labelsSVG = '\n    <!-- Etiquetas de habitaciones -->\n';

    rooms.forEach(room => {
      const centerX = (room.position.x + room.size.width / 2) * scale;
      const centerY = (room.position.y + room.size.height / 2) * scale;
      const roomWidth = room.size.width * scale;
      const roomHeight = room.size.height * scale;

      // Solo mostrar etiquetas si la habitación es lo suficientemente grande
      if (roomWidth > 40 && roomHeight > 30) {
        // Nombre de la habitación
        labelsSVG += `    <text x="${centerX}" y="${centerY - 8}" class="room-label">${room.name}</text>
`;
        // Área de la habitación
        labelsSVG += `    <text x="${centerX}" y="${centerY + 6}" class="room-area">${room.area}m²</text>
`;
        
        // Dimensiones si hay espacio suficiente
        if (roomWidth > 60 && roomHeight > 45) {
          labelsSVG += `    <text x="${centerX}" y="${centerY + 18}" class="room-area">${room.size.width.toFixed(1)} × ${room.size.height.toFixed(1)}m</text>
`;
        }
      }
    });

    return labelsSVG;
  }

  /**
   * Genera líneas de dimensión del plano con escala dinámica
   */
  private static generatePlanDimensions(
    dimensions: { width: number; length: number }, 
    scale: number,
    planWidth: number,
    planHeight: number
  ): string {
    let dimensionsSVG = '\n    <!-- Dimensiones del plano -->\n';

    // Dimensión horizontal (ancho) - debajo del plano
    dimensionsSVG += `    <line x1="0" y1="${planHeight + 15}" x2="${planWidth}" y2="${planHeight + 15}" stroke="${this.SVG_CONFIG.colors.text}" stroke-width="0.8" />
`;
    dimensionsSVG += `    <line x1="0" y1="${planHeight + 10}" x2="0" y2="${planHeight + 20}" stroke="${this.SVG_CONFIG.colors.text}" stroke-width="0.8" />
`;
    dimensionsSVG += `    <line x1="${planWidth}" y1="${planHeight + 10}" x2="${planWidth}" y2="${planHeight + 20}" stroke="${this.SVG_CONFIG.colors.text}" stroke-width="0.8" />
`;
    dimensionsSVG += `    <text x="${planWidth / 2}" y="${planHeight + 30}" class="dimension">${dimensions.width}m</text>
`;

    // Dimensión vertical (largo) - al lado derecho del plano
    dimensionsSVG += `    <line x1="${planWidth + 15}" y1="0" x2="${planWidth + 15}" y2="${planHeight}" stroke="${this.SVG_CONFIG.colors.text}" stroke-width="0.8" />
`;
    dimensionsSVG += `    <line x1="${planWidth + 10}" y1="0" x2="${planWidth + 20}" y2="0" stroke="${this.SVG_CONFIG.colors.text}" stroke-width="0.8" />
`;
    dimensionsSVG += `    <line x1="${planWidth + 10}" y1="${planHeight}" x2="${planWidth + 20}" y2="${planHeight}" stroke="${this.SVG_CONFIG.colors.text}" stroke-width="0.8" />
`;
    dimensionsSVG += `    <text x="${planWidth + 30}" y="${planHeight / 2}" class="dimension" transform="rotate(-90, ${planWidth + 30}, ${planHeight / 2})">${dimensions.length}m</text>
`;

    return dimensionsSVG;
  }

  /**
   * Genera un SVG de prueba para validación
   */
  static generateTestSVG(): string {
    return `<?xml version="1.0" encoding="UTF-8"?>
<svg width="400" height="300" xmlns="http://www.w3.org/2000/svg">
  <rect x="50" y="50" width="300" height="200" fill="none" stroke="#2c3e50" stroke-width="2"/>
  <text x="200" y="150" text-anchor="middle" font="16px Arial">Plano de Prueba</text>
  <text x="200" y="280" text-anchor="middle" font="12px Arial">AI-Design System</text>
</svg>`;
  }
}

export default TypeScriptSVGGenerator;