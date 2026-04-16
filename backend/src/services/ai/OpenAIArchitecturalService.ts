import OpenAI from 'openai';

// 🤖 CONFIGURACIÓN DE OPENAI
const openaiConfig = {
  apiKey: process.env.OPENAI_API_KEY,
  model: 'gpt-4o-mini', // Usar el modelo más eficiente para este tipo de tareas
  timeout: 380000, // 6 minutos extendido para procesamiento complejo
  maxRetries: 3,
  retryDelay: 2000,
  temperature: 0.4, // Ajuste para un balance entre creatividad y precisión  
  maxTokens: 10000
};

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
    type: 'bedroom' | 'bathroom' | 'kitchen' | 'living_room' | 'dining_room' | 'office' | 'storage' | 'garage' | 'hallway';
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

type ProjectTypology =
  | 'house'
  | 'apartment'
  | 'office'
  | 'coworking'
  | 'retail'
  | 'restaurant'
  | 'healthcare'
  | 'education'
  | 'hospitality'
  | 'industrial'
  | 'warehouse'
  | 'mixed_use'
  | 'cultural'
  | 'sports'
  | 'public_service'
  | 'default';

type TypologyProfile =
  | 'compact_residential'
  | 'open_social_home'
  | 'open_office'
  | 'clinic_flow'
  | 'school_cluster'
  | 'restaurant_central_kitchen'
  | 'hotel_corridor'
  | 'warehouse_linear'
  | 'mixed_urban'
  | 'default';

type ZoneKey = 'north' | 'south' | 'west' | 'east';

export interface FileGenerationResult {
  svg: {
    content: string;
    filename: string;
    path: string;
  };
  stl: {
    content: string;
    filename: string;
    path: string;
  };
  structuralData: NLPStructuralData;
  processingTime: number;
  files: {
    svg: string;
    stl: string;
  };
}

export class OpenAIArchitecturalService {
  private static client: OpenAI;

  /**
   * Inicializa el cliente de OpenAI
   */
  private static initializeClient(): OpenAI {
    if (!this.client) {
      try {
        this.client = new OpenAI({
          apiKey: openaiConfig.apiKey,
        });
        console.log('✅ Cliente OpenAI inicializado correctamente');
      } catch (error) {
        console.error('❌ Error inicializando cliente OpenAI:', error);
        throw new Error('No se pudo inicializar el cliente OpenAI');
      }
    }
    return this.client;
  }

  /**
   * Procesa texto en lenguaje natural y genera archivos 2D/3D
   */
  static async processNLPToFiles(
    userDescription: string,
    designId: string,
    outputDirectory: string
  ): Promise<FileGenerationResult> {
    const startTime = Date.now();
    console.log('🚀 Iniciando procesamiento NLP to 2D/3D...');
    console.log('📝 Descripción del usuario:', userDescription);

    try {
      // 1. Procesar texto con OpenAI para extraer estructura arquitectónica
      const structuralData = await this.extractStructuralData(userDescription);
      console.log('✅ Datos estructurales extraídos:', structuralData);

      // 2. Generar SVG (plano 2D)
      const svgResult = await this.generateSVGFile(structuralData, designId, outputDirectory);
      console.log('✅ Archivo SVG generado:', svgResult.filename);

      // 3. Generar STL (modelo 3D)
      const stlResult = await this.generateSTLFile(structuralData, designId, outputDirectory);
      console.log('✅ Archivo STL generado:', stlResult.filename);

      const processingTime = Date.now() - startTime;

      return {
        svg: svgResult,
        stl: stlResult,
        structuralData,
        processingTime,
        files: {
          svg: svgResult.path,
          stl: stlResult.path
        }
      };

    } catch (error) {
      console.error('❌ Error en procesamiento NLP to Files:', error);
      throw new Error(`Error en generación de archivos: ${error instanceof Error ? error.message : 'Error desconocido'}`);
    }
  }

  /**
   * Extrae datos estructurales usando OpenAI
   */
  private static async extractStructuralData(userDescription: string): Promise<NLPStructuralData> {
    const client = this.initializeClient();

    const systemPrompt = `
Eres un arquitecto experto que convierte descripciones en lenguaje natural a estructuras de datos arquitectónicas precisas.

🎯 DISEÑA DENTRO DE UN PLANO CUADRADO PERFECTO:
- Siempre usar dimensiones cuadradas (width = length) 
- Calcular la dimensión del cuadrado basándote en el área total: lado = √(área_total * 1.2)
- TODAS las habitaciones deben estar DENTRO del cuadrado (0,0 hasta lado,lado)
- NO generar habitaciones fuera del área del plano

RESPONDE SOLO CON JSON VÁLIDO siguiendo esta estructura EXACTA:
{
  "metadata": {
    "title": "string",
    "description": "string", 
    "totalArea": number,
    "dimensions": {"width": number, "length": number, "height": number},
    "style": "string",
    "generatedAt": "ISO date string"
  },
  "rooms": [
    {
      "name": "string",
      "type": "bedroom|bathroom|kitchen|living_room|dining_room|office|storage|garage|hallway",
      "area": number,
      "position": {"x": number, "y": number},
      "size": {"width": number, "height": number},
      "doors": [{"position": "north|south|east|west", "width": number}],
      "windows": [{"position": "north|south|east|west", "width": number, "height": number}],
      "features": ["string"]
    }
  ],
  "walls": [
    {
      "start": [number, number],
      "end": [number, number], 
      "thickness": number,
      "material": "string"
    }
  ],
  "connections": [
    {
      "from": "string",
      "to": "string", 
      "type": "door|opening|window",
      "width": number
    }
  ]
}

🔥 REGLAS CRÍTICAS PARA PLANO CUADRADO:
1. DIMENSIONES: width = length = √(área_total * 1.2) 
2. POSICIONAMIENTO: Todas las habitaciones position.x + size.width ≤ width
3. POSICIONAMIENTO: Todas las habitaciones position.y + size.height ≤ length  
4. DISTRIBUCIÓN: Usar grid de 2x2, 3x3 o 4x4 según número de habitaciones
5. HABITACIONES: Tamaños proporcionales al área del cuadrado
6. CONEXIONES: Habitaciones adyacentes deben conectar lógicamente
7. BORDES: Dejar margen de 0.5m desde los bordes del plano
8. VERIFICACIÓN: position.x ≥ 0.5, position.y ≥ 0.5
9. VERIFICACIÓN: position.x + size.width ≤ width - 0.5
10. VERIFICACIÓN: position.y + size.height ≤ length - 0.5
`;

    const userPrompt = `
Convierte esta descripción arquitectónica a la estructura JSON especificada:

"${userDescription}"

Genera un diseño arquitectónico completo, realista y funcional basado en esta descripción.
`;

    try {
      const response = await client.chat.completions.create({
        model: openaiConfig.model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: openaiConfig.temperature,
        max_tokens: openaiConfig.maxTokens,
        response_format: { type: 'json_object' }
      });

      const content = response.choices[0]?.message?.content;
      if (!content) {
        throw new Error('No se recibió respuesta de OpenAI');
      }

      const structuralData = JSON.parse(content) as NLPStructuralData;
      
      // Validar estructura básica
      this.validateStructuralData(structuralData);
      
      return structuralData;

    } catch (error) {
      console.error('❌ Error extrayendo datos estructurales:', error);
      throw new Error(`Error procesando con OpenAI: ${error instanceof Error ? error.message : 'Error desconocido'}`);
    }
  }

  /**
   * Valida la estructura de datos extraída y corrige posiciones si es necesario
   */
  private static validateStructuralData(data: NLPStructuralData): void {
    if (!data.metadata || !data.rooms || !Array.isArray(data.rooms)) {
      throw new Error('Estructura de datos inválida recibida de OpenAI');
    }

    if (data.rooms.length === 0) {
      throw new Error('No se detectaron habitaciones en la descripción');
    }

    // 1) Asegurar plano cuadrado estable.
    const rawWidth = Number.isFinite(data.metadata.dimensions.width) ? data.metadata.dimensions.width : 0;
    const rawLength = Number.isFinite(data.metadata.dimensions.length) ? data.metadata.dimensions.length : 0;
    const squareSize = Math.max(4, Math.max(rawWidth, rawLength));
    data.metadata.dimensions.width = squareSize;
    data.metadata.dimensions.length = squareSize;

    // 2) Normalizar habitaciones de entrada.
    const sanitizedRooms = data.rooms
      .filter(room => !!room?.name)
      .map(room => {
        const safeWidth = Math.max(1.8, Number.isFinite(room.size?.width) ? room.size.width : Math.sqrt(Math.max(room.area, 4)));
        const safeHeight = Math.max(1.8, Number.isFinite(room.size?.height) ? room.size.height : Math.sqrt(Math.max(room.area, 4)));
        const safeArea = Math.max(3, Number.isFinite(room.area) ? room.area : safeWidth * safeHeight);

        return {
          ...room,
          area: safeArea,
          size: {
            width: safeWidth,
            height: safeHeight,
          },
          position: {
            x: Number.isFinite(room.position?.x) ? room.position.x : 0,
            y: Number.isFinite(room.position?.y) ? room.position.y : 0,
          },
          doors: Array.isArray(room.doors) ? room.doors : [],
          windows: Array.isArray(room.windows) ? room.windows : [],
          features: Array.isArray(room.features) ? room.features : []
        };
      });

    if (sanitizedRooms.length === 0) {
      throw new Error('No hay habitaciones válidas para generar el plano');
    }

    // 3) Distribucion por nucleo central de circulacion (no lineal, no en T).
    const margin = 0.5;
    const usableSize = squareSize - (margin * 2);
    const otherRooms = sanitizedRooms.filter(room => room.type !== 'hallway');

    const coreWidth = Math.max(2.0, Math.min(2.8, usableSize * 0.22));
    const coreHeight = Math.max(2.0, Math.min(2.8, usableSize * 0.22));
    const coreX = margin + (usableSize - coreWidth) / 2;
    const coreY = margin + (usableSize - coreHeight) / 2;

    const circulationCore = {
      name: 'Núcleo de Circulación',
      type: 'hallway' as const,
      area: Math.round(coreWidth * coreHeight * 100) / 100,
      position: { x: coreX, y: coreY },
      size: { width: coreWidth, height: coreHeight },
      doors: [] as Array<{ position: string; width: number }>,
      windows: [] as Array<{ position: string; width: number; height: number }>,
      features: ['Conector central']
    };

    const zones = {
      north: { x: margin, y: margin, width: usableSize, height: Math.max(1.8, coreY - margin) },
      south: { x: margin, y: coreY + coreHeight, width: usableSize, height: Math.max(1.8, (margin + usableSize) - (coreY + coreHeight)) },
      west: { x: margin, y: coreY, width: Math.max(1.8, coreX - margin), height: coreHeight },
      east: { x: coreX + coreWidth, y: coreY, width: Math.max(1.8, (margin + usableSize) - (coreX + coreWidth)), height: coreHeight }
    };

    const typology = this.detectProjectTypology(data, otherRooms);
    const profile = this.detectTypologyProfile(data, typology, otherRooms);
    console.log(`🏷️ Tipología detectada: ${typology}`);
    console.log(`🧭 Perfil tipológico: ${profile}`);

    const zoneRooms: Record<ZoneKey, typeof otherRooms> = {
      north: [],
      south: [],
      west: [],
      east: []
    };

    const chooseZoneOrder = (room: (typeof otherRooms)[number]): ZoneKey[] => {
      const roomSignature = `${String(room.type).toLowerCase()} ${String(room.name || '').toLowerCase()} ${String(room.features || []).toLowerCase()}`;
      const tag = this.inferFunctionalTag(roomSignature);
      return this.getPreferredZoneOrderByTypology(typology, profile, tag, roomSignature);
    };

    const zoneAreaUse = { north: 0, south: 0, west: 0, east: 0 };
    for (const room of otherRooms) {
      const orderedZones = chooseZoneOrder(room);

      const fallback = (['north', 'south', 'west', 'east'] as ZoneKey[])
        .sort((a, b) => {
          const capA = zones[a].width * zones[a].height;
          const capB = zones[b].width * zones[b].height;
          const scoreA = zoneAreaUse[a] / Math.max(capA, 0.01);
          const scoreB = zoneAreaUse[b] / Math.max(capB, 0.01);
          return scoreA - scoreB;
        })[0];

      const selected = orderedZones.find(zone => {
        const cap = zones[zone].width * zones[zone].height;
        return zoneAreaUse[zone] + room.area <= cap * 1.15;
      }) || fallback;

      zoneRooms[selected].push(room);
      zoneAreaUse[selected] += room.area;
    }

    const sortRooms = (rooms: typeof otherRooms) =>
      [...rooms].sort((a, b) => {
        const score = (room: (typeof otherRooms)[number]) => {
          const signature = `${String(room.type).toLowerCase()} ${String(room.name || '').toLowerCase()}`;
          let value = room.area;
          if (signature.includes('acceso') || signature.includes('recep')) value += 10;
          if (signature.includes('living') || signature.includes('sala')) value += 8;
          if (signature.includes('kitchen') || signature.includes('cocina')) value += 6;
          if (signature.includes('bedroom') || signature.includes('habit')) value += 5;
          if (signature.includes('bath') || signature.includes('bañ') || signature.includes('bano')) value += 3;
          return value;
        };

        return score(b) - score(a);
      });

    const assignByZone = (zone: ZoneKey) => {
      const rooms = sortRooms(zoneRooms[zone]);
      if (rooms.length === 0) return;

      const z = zones[zone];
      const isHorizontal = zone === 'north' || zone === 'south';
      const fixed = isHorizontal ? z.height : z.width;
      const totalArea = rooms.reduce((sum, room) => sum + room.area, 0);
      const areaScale = Math.min(1, (z.width * z.height) / Math.max(totalArea, 0.01));

      let cursor = isHorizontal ? z.x : z.y;
      for (let i = 0; i < rooms.length; i++) {
        const room = rooms[i];
        const targetArea = room.area * areaScale;
        const dimRules = this.getDimensionRulesByTypology(typology, profile, room);
        const primary = i === rooms.length - 1
          ? (isHorizontal ? z.x + z.width - cursor : z.y + z.height - cursor)
          : Math.max(dimRules.minPrimary, targetArea / Math.max(fixed, 0.01));

        const safePrimary = Math.max(dimRules.minPrimary, primary);
        if (isHorizontal) {
          room.position.x = cursor;
          room.position.y = z.y;
          room.size.width = safePrimary;
          room.size.height = Math.max(dimRules.minSecondary, fixed);
        } else {
          room.position.x = z.x;
          room.position.y = cursor;
          room.size.width = Math.max(dimRules.minSecondary, fixed);
          room.size.height = safePrimary;
        }

        room.area = Math.round(room.size.width * room.size.height * 100) / 100;
        cursor += safePrimary;
      }
    };

    assignByZone('north');
    assignByZone('south');
    assignByZone('west');
    assignByZone('east');

    // 5) Puertas y ventanas detectadas desde backend (solo fachadas exteriores para ventanas).
    for (const room of [...otherRooms, circulationCore]) {
      room.doors = [];
      room.windows = [];
    }

    const makeDoor = (position: 'north' | 'south' | 'east' | 'west', width = 0.9) => ({ position, width });
    const makeWindow = (position: 'north' | 'south' | 'east' | 'west', width = 1.2, height = 1.1) => ({ position, width, height });

    const eps = 0.06;
    const maxX = margin + usableSize;
    const maxY = margin + usableSize;

    const doorOrientationToCore = (room: (typeof otherRooms)[number]): 'north' | 'south' | 'east' | 'west' => {
      const centerX = room.position.x + room.size.width / 2;
      const centerY = room.position.y + room.size.height / 2;
      const coreCenterX = circulationCore.position.x + circulationCore.size.width / 2;
      const coreCenterY = circulationCore.position.y + circulationCore.size.height / 2;

      const dx = coreCenterX - centerX;
      const dy = coreCenterY - centerY;
      if (Math.abs(dx) > Math.abs(dy)) return dx > 0 ? 'east' : 'west';
      return dy > 0 ? 'south' : 'north';
    };

    for (const room of otherRooms) {
      room.doors.push(makeDoor(doorOrientationToCore(room), 0.9));

      // Ventanas solo si el lado toca fachada exterior.
      if (room.position.y <= margin + eps) room.windows.push(makeWindow('north', 1.1));
      if (room.position.y + room.size.height >= maxY - eps) room.windows.push(makeWindow('south', 1.1));
      if (room.position.x <= margin + eps) room.windows.push(makeWindow('west', 1.1));
      if (room.position.x + room.size.width >= maxX - eps) room.windows.push(makeWindow('east', 1.1));
    }

    // Puerta principal exclusiva en núcleo (sin ventana en la misma fachada norte).
    circulationCore.doors.push(makeDoor('north', 1.3));
    circulationCore.doors.push(makeDoor('south', 0.95));

    // Ventanas del núcleo solo en laterales exteriores cuando aplique.
    if (circulationCore.position.x <= margin + eps) circulationCore.windows.push(makeWindow('west', 1.0, 1.1));
    if (circulationCore.position.x + circulationCore.size.width >= maxX - eps) circulationCore.windows.push(makeWindow('east', 1.0, 1.1));

    // 6) Conexiones explícitas para trazado frontend.
    const connections: NLPStructuralData['connections'] = [];
    for (const room of otherRooms) {
      connections.push({
        from: room.name,
        to: circulationCore.name,
        type: 'door',
        width: 0.9
      });
    }
    connections.push({
      from: circulationCore.name,
      to: 'EXTERIOR',
      type: 'door',
      width: 1.3
    });

    // 7) Recalcular muros perimetrales limpios del plano.
    data.walls = [
      { start: [0, 0], end: [squareSize, 0], thickness: 0.2, material: 'concrete' },
      { start: [squareSize, 0], end: [squareSize, squareSize], thickness: 0.2, material: 'concrete' },
      { start: [squareSize, squareSize], end: [0, squareSize], thickness: 0.2, material: 'concrete' },
      { start: [0, squareSize], end: [0, 0], thickness: 0.2, material: 'concrete' }
    ];

    data.connections = connections;
    data.rooms = [
      ...otherRooms,
      circulationCore
    ];

    // Recalcular area total desde geometría final.
    data.metadata.totalArea = Math.round(data.rooms.reduce((sum, room) => sum + room.area, 0) * 100) / 100;

    console.log(`✅ Re-layout arquitectónico aplicado: ${data.rooms.length} habitaciones conectadas sin solapes`);
  }

  private static detectProjectTypology(data: NLPStructuralData, rooms: NLPStructuralData['rooms']): ProjectTypology {
    const text = `${data.metadata.title} ${data.metadata.description} ${rooms.map(r => `${r.name} ${r.type}`).join(' ')}`.toLowerCase();

    const has = (patterns: string[]) => patterns.some(p => text.includes(p));

    if (has(['hospital', 'clínica', 'clinica', 'consultorio', 'urgencias', 'medical'])) return 'healthcare';
    if (has(['escuela', 'colegio', 'universidad', 'aula', 'campus', 'educativo'])) return 'education';
    if (has(['hotel', 'hostal', 'resort', 'suite', 'hospedaje'])) return 'hospitality';
    if (has(['restaurante', 'cafetería', 'cafeteria', 'comedor comercial', 'bar', 'cocina industrial'])) return 'restaurant';
    if (has(['tienda', 'retail', 'boutique', 'supermercado', 'farmacia', 'local comercial'])) return 'retail';
    if (has(['cowork', 'co-working', 'espacio colaborativo'])) return 'coworking';
    if (has(['oficina', 'corporativo', 'despacho', 'business center'])) return 'office';
    if (has(['industrial', 'fábrica', 'fabrica', 'planta'])) return 'industrial';
    if (has(['almacén', 'almacen', 'bodega logística', 'warehouse', 'logística', 'logistica'])) return 'warehouse';
    if (has(['teatro', 'museo', 'auditorio', 'galería', 'galeria', 'cultural'])) return 'cultural';
    if (has(['gimnasio', 'deportivo', 'cancha', 'sports', 'arena'])) return 'sports';
    if (has(['gobierno', 'municipal', 'oficina pública', 'servicio público', 'public service'])) return 'public_service';
    if (has(['mixto', 'mixed use', 'uso mixto'])) return 'mixed_use';
    if (has(['departamento', 'apartment', 'condominio', 'condo'])) return 'apartment';
    if (has(['casa', 'vivienda', 'residencia', 'hogar'])) return 'house';

    return 'default';
  }

  private static detectTypologyProfile(
    data: NLPStructuralData,
    typology: ProjectTypology,
    rooms: NLPStructuralData['rooms']
  ): TypologyProfile {
    const text = `${data.metadata.title} ${data.metadata.description} ${rooms.map(r => `${r.name} ${r.type}`).join(' ')}`.toLowerCase();
    const has = (patterns: string[]) => patterns.some(p => text.includes(p));

    if (typology === 'house' || typology === 'apartment') {
      if (has(['compacta', 'compacto', 'pequeña', 'pequena', 'tiny', 'mini'])) return 'compact_residential';
      if (has(['abierta', 'open concept', 'open-plan', 'integrada', 'social'])) return 'open_social_home';
    }

    if (typology === 'office' || typology === 'coworking') {
      if (has(['open office', 'espacio abierto', 'colaborativo', 'cowork'])) return 'open_office';
    }

    if (typology === 'healthcare') {
      if (has(['flujo', 'triage', 'consultorio', 'clínica', 'clinica', 'pacientes'])) return 'clinic_flow';
    }

    if (typology === 'education') {
      if (has(['cluster', 'aulas', 'patio', 'docentes', 'escolar'])) return 'school_cluster';
    }

    if (typology === 'restaurant') {
      if (has(['cocina central', 'central kitchen', 'barra', 'servicio rápido', 'servicio rapido'])) {
        return 'restaurant_central_kitchen';
      }
    }

    if (typology === 'hospitality') {
      if (has(['pasillo', 'corridor', 'habitaciones', 'suite'])) return 'hotel_corridor';
    }

    if (typology === 'warehouse' || typology === 'industrial') {
      if (has(['lineal', 'linealidad', 'muelle', 'carga', 'logística', 'logistica'])) return 'warehouse_linear';
    }

    if (typology === 'mixed_use') {
      return 'mixed_urban';
    }

    return 'default';
  }

  private static inferFunctionalTag(roomSignature: string): 'public' | 'private' | 'service' | 'operations' {
    if (
      roomSignature.includes('living') || roomSignature.includes('sala') ||
      roomSignature.includes('recep') || roomSignature.includes('lobby') ||
      roomSignature.includes('comedor') || roomSignature.includes('dining') ||
      roomSignature.includes('espera')
    ) {
      return 'public';
    }

    if (
      roomSignature.includes('bedroom') || roomSignature.includes('habit') ||
      roomSignature.includes('suite') || roomSignature.includes('private')
    ) {
      return 'private';
    }

    if (
      roomSignature.includes('kitchen') || roomSignature.includes('cocina') ||
      roomSignature.includes('bath') || roomSignature.includes('bañ') || roomSignature.includes('bano') ||
      roomSignature.includes('storage') || roomSignature.includes('bodega') || roomSignature.includes('lavander')
    ) {
      return 'service';
    }

    return 'operations';
  }

  private static getPreferredZoneOrderByTypology(
    typology: ProjectTypology,
    profile: TypologyProfile,
    tag: 'public' | 'private' | 'service' | 'operations',
    roomSignature: string
  ): ZoneKey[] {
    const baseByTypology: Record<ProjectTypology, Record<'public' | 'private' | 'service' | 'operations', ZoneKey[]>> = {
      house: {
        public: ['north', 'west', 'south', 'east'],
        private: ['east', 'south', 'north', 'west'],
        service: ['west', 'south', 'east', 'north'],
        operations: ['south', 'west', 'east', 'north']
      },
      apartment: {
        public: ['north', 'east', 'west', 'south'],
        private: ['east', 'south', 'north', 'west'],
        service: ['west', 'south', 'east', 'north'],
        operations: ['south', 'east', 'west', 'north']
      },
      office: {
        public: ['north', 'east', 'west', 'south'],
        private: ['east', 'south', 'north', 'west'],
        service: ['west', 'south', 'east', 'north'],
        operations: ['north', 'west', 'east', 'south']
      },
      coworking: {
        public: ['north', 'west', 'east', 'south'],
        private: ['east', 'south', 'north', 'west'],
        service: ['south', 'west', 'east', 'north'],
        operations: ['west', 'north', 'east', 'south']
      },
      retail: {
        public: ['north', 'east', 'west', 'south'],
        private: ['south', 'east', 'west', 'north'],
        service: ['south', 'west', 'east', 'north'],
        operations: ['west', 'east', 'south', 'north']
      },
      restaurant: {
        public: ['north', 'east', 'west', 'south'],
        private: ['south', 'east', 'west', 'north'],
        service: ['west', 'south', 'east', 'north'],
        operations: ['west', 'north', 'east', 'south']
      },
      healthcare: {
        public: ['north', 'east', 'west', 'south'],
        private: ['east', 'west', 'south', 'north'],
        service: ['south', 'west', 'east', 'north'],
        operations: ['east', 'west', 'north', 'south']
      },
      education: {
        public: ['north', 'west', 'east', 'south'],
        private: ['south', 'east', 'west', 'north'],
        service: ['south', 'west', 'east', 'north'],
        operations: ['east', 'north', 'west', 'south']
      },
      hospitality: {
        public: ['north', 'west', 'east', 'south'],
        private: ['east', 'south', 'west', 'north'],
        service: ['west', 'south', 'east', 'north'],
        operations: ['south', 'east', 'west', 'north']
      },
      industrial: {
        public: ['east', 'north', 'south', 'west'],
        private: ['south', 'east', 'west', 'north'],
        service: ['south', 'west', 'east', 'north'],
        operations: ['west', 'north', 'east', 'south']
      },
      warehouse: {
        public: ['north', 'east', 'south', 'west'],
        private: ['south', 'east', 'west', 'north'],
        service: ['south', 'west', 'east', 'north'],
        operations: ['west', 'north', 'east', 'south']
      },
      mixed_use: {
        public: ['north', 'west', 'east', 'south'],
        private: ['east', 'south', 'west', 'north'],
        service: ['west', 'south', 'east', 'north'],
        operations: ['north', 'east', 'west', 'south']
      },
      cultural: {
        public: ['north', 'west', 'east', 'south'],
        private: ['south', 'east', 'west', 'north'],
        service: ['south', 'west', 'east', 'north'],
        operations: ['east', 'north', 'west', 'south']
      },
      sports: {
        public: ['north', 'west', 'east', 'south'],
        private: ['south', 'east', 'west', 'north'],
        service: ['south', 'west', 'east', 'north'],
        operations: ['west', 'east', 'north', 'south']
      },
      public_service: {
        public: ['north', 'east', 'west', 'south'],
        private: ['south', 'east', 'west', 'north'],
        service: ['south', 'west', 'east', 'north'],
        operations: ['east', 'north', 'west', 'south']
      },
      default: {
        public: ['north', 'west', 'east', 'south'],
        private: ['east', 'south', 'west', 'north'],
        service: ['west', 'south', 'east', 'north'],
        operations: ['south', 'east', 'west', 'north']
      }
    };

    let base = [...baseByTypology[typology][tag]];

    const profileOverrides: Partial<Record<TypologyProfile, Partial<Record<'public' | 'private' | 'service' | 'operations', ZoneKey[]>>>> = {
      compact_residential: {
        public: ['north', 'east', 'west', 'south'],
        private: ['east', 'south', 'north', 'west'],
        service: ['west', 'south', 'east', 'north'],
      },
      open_social_home: {
        public: ['north', 'west', 'east', 'south'],
        private: ['south', 'east', 'west', 'north'],
      },
      open_office: {
        public: ['north', 'east', 'west', 'south'],
        operations: ['north', 'west', 'east', 'south'],
        service: ['south', 'west', 'east', 'north'],
      },
      clinic_flow: {
        public: ['north', 'east', 'west', 'south'],
        private: ['east', 'south', 'west', 'north'],
        service: ['south', 'west', 'east', 'north'],
      },
      school_cluster: {
        public: ['north', 'west', 'east', 'south'],
        operations: ['east', 'west', 'north', 'south'],
      },
      restaurant_central_kitchen: {
        public: ['north', 'east', 'west', 'south'],
        service: ['west', 'south', 'east', 'north'],
      },
      hotel_corridor: {
        public: ['north', 'east', 'west', 'south'],
        private: ['east', 'west', 'south', 'north'],
        service: ['south', 'west', 'east', 'north'],
      },
      warehouse_linear: {
        operations: ['west', 'east', 'north', 'south'],
        service: ['south', 'west', 'east', 'north'],
      },
      mixed_urban: {
        public: ['north', 'west', 'east', 'south'],
        private: ['east', 'south', 'west', 'north'],
        service: ['west', 'south', 'east', 'north'],
      }
    };

    const overrideForProfile = profileOverrides[profile]?.[tag];
    if (overrideForProfile) {
      base = [...overrideForProfile];
    }

    if (roomSignature.includes('garage') || roomSignature.includes('estaciona')) {
      return ['west', 'south', 'north', 'east'];
    }
    if (roomSignature.includes('recep') || roomSignature.includes('lobby') || roomSignature.includes('acceso')) {
      return ['north', 'east', 'west', 'south'];
    }

    return base;
  }

  private static getDimensionRulesByTypology(
    typology: ProjectTypology,
    profile: TypologyProfile,
    room: NLPStructuralData['rooms'][number]
  ): { minPrimary: number; minSecondary: number } {
    const signature = `${String(room.type).toLowerCase()} ${String(room.name || '').toLowerCase()}`;

    const defaults = {
      house: { minPrimary: 2.0, minSecondary: 1.8 },
      apartment: { minPrimary: 1.9, minSecondary: 1.7 },
      office: { minPrimary: 2.2, minSecondary: 2.0 },
      coworking: { minPrimary: 2.2, minSecondary: 2.0 },
      retail: { minPrimary: 2.4, minSecondary: 2.0 },
      restaurant: { minPrimary: 2.3, minSecondary: 2.0 },
      healthcare: { minPrimary: 2.2, minSecondary: 2.0 },
      education: { minPrimary: 2.4, minSecondary: 2.1 },
      hospitality: { minPrimary: 2.1, minSecondary: 1.9 },
      industrial: { minPrimary: 2.8, minSecondary: 2.2 },
      warehouse: { minPrimary: 3.0, minSecondary: 2.3 },
      mixed_use: { minPrimary: 2.2, minSecondary: 1.9 },
      cultural: { minPrimary: 2.5, minSecondary: 2.1 },
      sports: { minPrimary: 2.7, minSecondary: 2.2 },
      public_service: { minPrimary: 2.3, minSecondary: 2.0 },
      default: { minPrimary: 2.0, minSecondary: 1.8 }
    };

    let base = defaults[typology];

    const profileDimOverride: Partial<Record<TypologyProfile, { minPrimary: number; minSecondary: number }>> = {
      compact_residential: { minPrimary: 1.8, minSecondary: 1.6 },
      open_social_home: { minPrimary: 2.2, minSecondary: 1.9 },
      open_office: { minPrimary: 2.6, minSecondary: 2.1 },
      clinic_flow: { minPrimary: 2.3, minSecondary: 2.0 },
      school_cluster: { minPrimary: 2.5, minSecondary: 2.1 },
      restaurant_central_kitchen: { minPrimary: 2.4, minSecondary: 2.0 },
      hotel_corridor: { minPrimary: 2.2, minSecondary: 1.9 },
      warehouse_linear: { minPrimary: 3.2, minSecondary: 2.4 },
      mixed_urban: { minPrimary: 2.3, minSecondary: 2.0 }
    };

    if (profileDimOverride[profile]) {
      base = profileDimOverride[profile]!;
    }

    if (signature.includes('bath') || signature.includes('bañ') || signature.includes('bano')) {
      return { minPrimary: 1.6, minSecondary: 1.4 };
    }
    if (signature.includes('storage') || signature.includes('bodega') || signature.includes('lavander')) {
      return { minPrimary: 1.7, minSecondary: 1.5 };
    }
    if (signature.includes('kitchen') || signature.includes('cocina')) {
      return { minPrimary: Math.max(2.0, base.minPrimary), minSecondary: Math.max(1.8, base.minSecondary) };
    }

    return base;
  }

  /**
   * Genera archivo SVG (plano 2D)
   */
  private static async generateSVGFile(
    data: NLPStructuralData, 
    designId: string, 
    outputDirectory: string
  ): Promise<{ content: string; filename: string; path: string }> {
    const TypeScriptSVGGenerator = (await import('./TypeScriptSVGGenerator')).default;
    
    const svgContent = TypeScriptSVGGenerator.generateArchitecturalSVG(data);
    const filename = `${designId}_plan_2d.svg`;
    const fullPath = `${outputDirectory}/${filename}`;

    // Guardar archivo
    const fs = await import('fs');
    const path = await import('path');
    
    // Crear directorio si no existe
    const dir = path.dirname(fullPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    fs.writeFileSync(fullPath, svgContent, 'utf8');

    return {
      content: svgContent,
      filename,
      path: fullPath
    };
  }

  /**
   * Genera archivo STL (modelo 3D)
   */
  private static async generateSTLFile(
    data: NLPStructuralData, 
    designId: string, 
    outputDirectory: string
  ): Promise<{ content: string; filename: string; path: string }> {
    const TypeScriptSTLGenerator = (await import('./TypeScriptSTLGenerator')).default;
    
    const stlContent = TypeScriptSTLGenerator.generateArchitecturalSTL(data);
    const filename = `${designId}_model_3d.stl`;
    const fullPath = `${outputDirectory}/${filename}`;

    // Guardar archivo
    const fs = await import('fs');
    const path = await import('path');
    
    // Crear directorio si no existe
    const dir = path.dirname(fullPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    fs.writeFileSync(fullPath, stlContent, 'utf8');

    return {
      content: stlContent,
      filename,
      path: fullPath
    };
  }

  /**
   * Verifica el estado del servicio OpenAI
   */
  static async checkServiceStatus(): Promise<{
    available: boolean;
    model: string;
    error?: string;
  }> {
    try {
      const client = this.initializeClient();
      
      // Hacer una prueba simple
      const response = await client.chat.completions.create({
        model: openaiConfig.model,
        messages: [{ role: 'user', content: 'Test' }],
        max_tokens: 10
      });

      return {
        available: true,
        model: openaiConfig.model
      };
    } catch (error) {
      return {
        available: false,
        model: openaiConfig.model,
        error: error instanceof Error ? error.message : 'Error desconocido'
      };
    }
  }

  /**
   * Obtiene la configuración del servicio
   */
  static getServiceConfig() {
    return {
      model: openaiConfig.model,
      timeout: openaiConfig.timeout,
      maxRetries: openaiConfig.maxRetries,
      temperature: openaiConfig.temperature,
      maxTokens: openaiConfig.maxTokens
    };
  }
}

export default OpenAIArchitecturalService;