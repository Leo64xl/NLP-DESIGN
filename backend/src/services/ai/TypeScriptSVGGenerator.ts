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

    const legendX = containerX;
    const legendY = containerY + containerSize + 26;
    const displayTotalArea = this.formatMeasure(data.metadata.totalArea);
    const displayWidth = this.formatMeasure(data.metadata.dimensions.width);
    const displayLength = this.formatMeasure(data.metadata.dimensions.length);

    let svgContent = `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${svgWidth}" height="${svgHeight}" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${svgWidth} ${svgHeight}">
  <defs>
    <style>
      .background { fill: ${this.SVG_CONFIG.colors.background}; }
      .container { fill: none; stroke: ${this.SVG_CONFIG.colors.container}; stroke-width: 2; }
      .container-shadow { fill: rgba(0,0,0,0.1); }
      .wall { fill: none; stroke: ${this.SVG_CONFIG.colors.walls}; stroke-width: ${this.SVG_CONFIG.strokeWidth}; stroke-linecap: round; }
      .door { fill: none; stroke: ${this.SVG_CONFIG.colors.doors}; stroke-width: ${this.SVG_CONFIG.strokeWidth * 1.5}; stroke-linecap: round; }
      .main-door { fill: none; stroke: #b00020; stroke-width: ${this.SVG_CONFIG.strokeWidth * 2.2}; stroke-linecap: round; }
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
  <text x="${svgWidth / 2}" y="50" class="dimension">Área total: ${displayTotalArea}m² | ${displayWidth}m × ${displayLength}m</text>
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

  <!-- Leyenda de colores (distribucion en dos filas para evitar solapes) -->
  <g transform="translate(${legendX}, ${legendY})">
    <text x="0" y="0" class="dimension" font-weight="bold" text-anchor="start">Leyenda:</text>

    <rect x="0" y="12" width="14" height="14" fill="#e8f4f8" stroke="#4a90a4" />
    <text x="20" y="23" class="dimension" text-anchor="start">Habitaciones</text>

    <rect x="140" y="12" width="14" height="14" fill="#f0f8ff" stroke="#6495ed" />
    <text x="160" y="23" class="dimension" text-anchor="start">Zonas húmedas</text>

    <rect x="300" y="12" width="14" height="14" fill="#fff3cd" stroke="#c28b00" />
    <text x="320" y="23" class="dimension" text-anchor="start">Circulación</text>

    <line x1="0" y1="43" x2="24" y2="43" class="door" stroke-width="4" />
    <text x="32" y="47" class="dimension" text-anchor="start">Puertas</text>

    <line x1="120" y1="43" x2="144" y2="43" class="main-door" stroke-width="5" />
    <text x="152" y="47" class="dimension" text-anchor="start">Puerta principal</text>

    <line x1="300" y1="43" x2="324" y2="43" class="window" stroke-width="3" />
    <text x="332" y="47" class="dimension" text-anchor="start">Ventanas</text>
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
        'hallway': 'fill: #fff3cd; stroke: #c28b00;'
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
    const drawnSegments = new Set<string>();

    const roomRects = rooms.map(room => {
      const x = room.position.x * scale;
      const y = room.position.y * scale;
      const width = room.size.width * scale;
      const height = room.size.height * scale;
      return {
        x,
        y,
        width,
        height,
        right: x + width,
        bottom: y + height
      };
    });

    const segmentKey = (x1: number, y1: number, x2: number, y2: number, kind: 'door' | 'window') => {
      const ax = Math.round(Math.min(x1, x2) * 100);
      const ay = Math.round(Math.min(y1, y2) * 100);
      const bx = Math.round(Math.max(x1, x2) * 100);
      const by = Math.round(Math.max(y1, y2) * 100);
      return `${kind}_${ax}_${ay}_${bx}_${by}`;
    };

    const getOpeningSegmentFromEdge = (
      roomIndex: number,
      edge: string,
      spanRatio: number
    ): { x1: number; y1: number; x2: number; y2: number } => {
      const room = roomRects[roomIndex];
      const roomX = room.x;
      const roomY = room.y;
      const roomWidth = room.width;
      const roomHeight = room.height;

      // Rectangle vertices in clockwise order: NW, NE, SE, SW.
      const vertices = {
        nw: { x: roomX, y: roomY },
        ne: { x: roomX + roomWidth, y: roomY },
        se: { x: roomX + roomWidth, y: roomY + roomHeight },
        sw: { x: roomX, y: roomY + roomHeight }
      };

      const edgeVertices: Record<string, [{ x: number; y: number }, { x: number; y: number }]> = {
        north: [vertices.nw, vertices.ne],
        south: [vertices.sw, vertices.se],
        east: [vertices.ne, vertices.se],
        west: [vertices.nw, vertices.sw]
      };

      const normalizedEdge = (edge || 'west').toLowerCase();
      const [a, b] = edgeVertices[normalizedEdge] || edgeVertices.west;
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const edgeLength = Math.max(0.01, Math.hypot(dx, dy));

      const isHorizontal = Math.abs(dy) < 1e-6;
      const axisStart = isHorizontal ? Math.min(a.x, b.x) : Math.min(a.y, b.y);
      const axisEnd = isHorizontal ? Math.max(a.x, b.x) : Math.max(a.y, b.y);
      const axisMid = (axisStart + axisEnd) / 2;
      const lineCoord = isHorizontal ? a.y : a.x;
      const tol = 1.2;

      // Candidate shared intervals with neighboring rooms touching the opposite side of this edge.
      const sharedIntervals: Array<{ start: number; end: number }> = [];
      roomRects.forEach((other, idx) => {
        if (idx === roomIndex) return;

        if (normalizedEdge === 'north' && Math.abs(other.bottom - lineCoord) <= tol) {
          const start = Math.max(axisStart, other.x);
          const end = Math.min(axisEnd, other.right);
          if (end - start > 1.5) sharedIntervals.push({ start, end });
        }
        if (normalizedEdge === 'south' && Math.abs(other.y - lineCoord) <= tol) {
          const start = Math.max(axisStart, other.x);
          const end = Math.min(axisEnd, other.right);
          if (end - start > 1.5) sharedIntervals.push({ start, end });
        }
        if (normalizedEdge === 'west' && Math.abs(other.right - lineCoord) <= tol) {
          const start = Math.max(axisStart, other.y);
          const end = Math.min(axisEnd, other.bottom);
          if (end - start > 1.5) sharedIntervals.push({ start, end });
        }
        if (normalizedEdge === 'east' && Math.abs(other.x - lineCoord) <= tol) {
          const start = Math.max(axisStart, other.y);
          const end = Math.min(axisEnd, other.bottom);
          if (end - start > 1.5) sharedIntervals.push({ start, end });
        }
      });

      // Collect breakpoints from all vertices lying on this edge line (including neighbors).
      const breakpoints = new Set<number>([axisStart, axisEnd]);
      roomRects.forEach((rect) => {
        const v = [
          { x: rect.x, y: rect.y },
          { x: rect.right, y: rect.y },
          { x: rect.right, y: rect.bottom },
          { x: rect.x, y: rect.bottom }
        ];

        v.forEach((p) => {
          const aligned = isHorizontal ? Math.abs(p.y - lineCoord) <= tol : Math.abs(p.x - lineCoord) <= tol;
          if (!aligned) return;
          const scalar = isHorizontal ? p.x : p.y;
          if (scalar >= axisStart - tol && scalar <= axisEnd + tol) {
            breakpoints.add(Math.max(axisStart, Math.min(axisEnd, scalar)));
          }
        });
      });

      const sortedBreakpoints = Array.from(breakpoints).sort((m, n) => m - n);
      const segments: Array<{ start: number; end: number; mid: number; len: number }> = [];
      for (let i = 0; i < sortedBreakpoints.length - 1; i++) {
        const start = sortedBreakpoints[i];
        const end = sortedBreakpoints[i + 1];
        const len = end - start;
        if (len > 1.2) {
          segments.push({ start, end, mid: (start + end) / 2, len });
        }
      }

      // Prefer segments overlapping a shared interval; otherwise use segment nearest the edge midpoint.
      let selectedSegment = segments.sort((s1, s2) => s2.len - s1.len)[0] || {
        start: axisStart,
        end: axisEnd,
        mid: axisMid,
        len: axisEnd - axisStart
      };

      if (sharedIntervals.length > 0) {
        const bestShared = [...sharedIntervals].sort((i1, i2) => {
          const l1 = i1.end - i1.start;
          const l2 = i2.end - i2.start;
          if (Math.abs(l1 - l2) > 0.001) return l2 - l1;
          const c1 = (i1.start + i1.end) / 2;
          const c2 = (i2.start + i2.end) / 2;
          return Math.abs(c1 - axisMid) - Math.abs(c2 - axisMid);
        })[0];

        const overlapCandidates = segments
          .map(seg => {
            const oStart = Math.max(seg.start, bestShared.start);
            const oEnd = Math.min(seg.end, bestShared.end);
            const oLen = oEnd - oStart;
            return oLen > 1.2
              ? { start: oStart, end: oEnd, mid: (oStart + oEnd) / 2, len: oLen }
              : null;
          })
          .filter(Boolean) as Array<{ start: number; end: number; mid: number; len: number }>;

        if (overlapCandidates.length > 0) {
          selectedSegment = overlapCandidates.sort((s1, s2) => {
            if (Math.abs(s1.len - s2.len) > 0.001) return s2.len - s1.len;
            return Math.abs(s1.mid - axisMid) - Math.abs(s2.mid - axisMid);
          })[0];
        }
      } else if (segments.length > 0) {
        selectedSegment = [...segments].sort((s1, s2) => Math.abs(s1.mid - axisMid) - Math.abs(s2.mid - axisMid))[0];
      }

      // Opening span is a percentage of the selected edge segment, centered on the segment midpoint.
      const spanBase = selectedSegment.len > 0 ? selectedSegment.len : edgeLength;
      const span = Math.max(2, spanBase * spanRatio);
      const ux = dx / edgeLength;
      const uy = dy / edgeLength;
      const midScalar = selectedSegment.mid;
      const midX = isHorizontal ? midScalar : lineCoord;
      const midY = isHorizontal ? lineCoord : midScalar;
      const half = span / 2;

      return {
        x1: midX - (ux * half),
        y1: midY - (uy * half),
        x2: midX + (ux * half),
        y2: midY + (uy * half)
      };
    };

    rooms.forEach((room, roomIndex) => {
      const roomX = room.position.x * scale;
      const roomY = room.position.y * scale;
      const roomWidth = room.size.width * scale;
      const roomHeight = room.size.height * scale;

      // Puertas
      room.doors.forEach(door => {
        const isGarageDoor = room.type === 'garage' && door.width >= 2;
        const doorClass = (!isGarageDoor && door.width >= 1.2) ? 'main-door' : 'door';
        const strokeWidth = (!isGarageDoor && door.width >= 1.2) ? 5 : 4;
        const normalizedEdge = String(door.position || 'west').toLowerCase();
        const edgeLength = (normalizedEdge === 'north' || normalizedEdge === 'south')
          ? roomWidth
          : roomHeight;

        // Puertas estándar conservan 25%; puertas anchas (cochera) usan proporción explícita del ancho solicitado.
        const proportionalSpan = edgeLength > 0.01 ? (door.width * scale) / edgeLength : 0.25;
        const spanRatio = door.width >= 2
          ? Math.max(0.25, Math.min(0.85, proportionalSpan))
          : 0.25;

        const doorSegment = getOpeningSegmentFromEdge(
          roomIndex,
          normalizedEdge,
          spanRatio
        );

        const key = segmentKey(doorSegment.x1, doorSegment.y1, doorSegment.x2, doorSegment.y2, 'door');
        if (!drawnSegments.has(key)) {
          drawnSegments.add(key);
          elementsSVG += `    <line x1="${doorSegment.x1}" y1="${doorSegment.y1}" x2="${doorSegment.x2}" y2="${doorSegment.y2}" class="${doorClass}" stroke-width="${strokeWidth}" />
      `;
        }
      });

      // Ventanas
      room.windows.forEach(window => {
        const windowSegment = getOpeningSegmentFromEdge(
          roomIndex,
          String(window.position || 'west').toLowerCase(),
          0.30
        );

        const key = segmentKey(windowSegment.x1, windowSegment.y1, windowSegment.x2, windowSegment.y2, 'window');
        if (!drawnSegments.has(key)) {
          drawnSegments.add(key);
          elementsSVG += `    <line x1="${windowSegment.x1}" y1="${windowSegment.y1}" x2="${windowSegment.x2}" y2="${windowSegment.y2}" class="window" stroke-width="3" />
      `;
        }
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
        const displayName = String(room.name || '').trim() || (room.type === 'hallway' ? 'Circulación' : room.type);
        // Nombre de la habitación
        labelsSVG += `    <text x="${centerX}" y="${centerY - 8}" class="room-label">${displayName}</text>
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
    dimensionsSVG += `    <text x="${planWidth / 2}" y="${planHeight + 30}" class="dimension">${this.formatMeasure(dimensions.width)}m</text>
`;

    // Dimensión vertical (largo) - al lado derecho del plano
    dimensionsSVG += `    <line x1="${planWidth + 15}" y1="0" x2="${planWidth + 15}" y2="${planHeight}" stroke="${this.SVG_CONFIG.colors.text}" stroke-width="0.8" />
`;
    dimensionsSVG += `    <line x1="${planWidth + 10}" y1="0" x2="${planWidth + 20}" y2="0" stroke="${this.SVG_CONFIG.colors.text}" stroke-width="0.8" />
`;
    dimensionsSVG += `    <line x1="${planWidth + 10}" y1="${planHeight}" x2="${planWidth + 20}" y2="${planHeight}" stroke="${this.SVG_CONFIG.colors.text}" stroke-width="0.8" />
`;
    dimensionsSVG += `    <text x="${planWidth + 30}" y="${planHeight / 2}" class="dimension" transform="rotate(-90, ${planWidth + 30}, ${planHeight / 2})">${this.formatMeasure(dimensions.length)}m</text>
`;

    return dimensionsSVG;
  }

  private static formatMeasure(value: number): string {
    if (!Number.isFinite(value)) return '0';
    const rounded = Number(value.toFixed(2));
    return Number.isInteger(rounded) ? String(Math.trunc(rounded)) : String(rounded);
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