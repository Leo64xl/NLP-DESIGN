import OpenAI from 'openai';
import {
  adaptRoomsToSymmetricFootprint,
  enforceMandatoryAdjacencyRules,
  ensureHallwayRoom,
  partitionRoomsInBounds,
} from './layout/SharedRoomLayout';

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
    orientation?: 'north' | 'south' | 'east' | 'west';
    style: string;
    generatedAt: string;
    qualityAudit?: {
      typology: ProjectTypology;
      profile: TypologyProfile;
      score: number;
      threshold: number;
      repairPassesApplied: number;
      findings: string[];
      status: 'pass' | 'needs_review';
    };
  };
  rooms: Array<{
    name: string;
    type: 'bedroom' | 'bathroom' | 'kitchen' | 'living_room' | 'dining_room' | 'office' | 'storage' | 'garage' | 'hallway';
    area: number;
    position: { x: number; y: number };
    size: { width: number; height: number };
    doors: Array<{
      position: string;
      width: number;
      x?: number;
      y?: number;
      angle?: number;
    }>;
    windows: Array<{
      position: string;
      width: number;
      height: number;
      x?: number;
      y?: number;
      angle?: number;
    }>;
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
type Orientation = 'north' | 'south' | 'east' | 'west';

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
- Distribuir las habitaciones usando un GRID lógico (2x2, 3x3 o 4x4) según la cantidad de habitaciones
- Asignar tamaños proporcionales al área total del plano
- Conectar habitaciones adyacentes lógicamente (ej: cocina cerca de comedor)
- Dejar un margen de 0.5m desde los bordes del plano para circulación y estética
- Verificar que position.x + size.width ≤ width - 0.5 y position.y + size.height ≤ length - 0.5 para cada habitación
- Generar conexiones lógicas entre habitaciones adyacentes (puertas, aberturas)
- Evitar generar habitaciones extremadamente pequeñas o grandes (mínimo 1.8m x 1.8m)
- Si la descripción es ambigua, prioriza una distribución funcional y estética dentro del plano cuadrado

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
6. CONEXIONES: Habitaciones adyacentes deben conectar lógicamente (ej: cocina cerca de comedor, baño cerca de dormitorio)
7. BORDES: Dejar margen de 0.5m desde los bordes del plano para circulación y estética
8. VERIFICACIÓN: position.x ≥ 0.5, position.y ≥ 0.5 
9. VERIFICACIÓN: position.x + size.width ≤ width - 0.5
10. VERIFICACIÓN: position.y + size.height ≤ length - 0.5
11. EVITAR: Habitaciones menores a 1.8m x 1.8m
12. EVITAR: Habitaciones mayores a 10m x 10m 
13. AMBIGÜEDADES: Si la descripción es ambigua, prioriza una distribución funcional y estética dentro del plano cuadrados
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
      this.validateStructuralData(structuralData, userDescription);
      
      return structuralData;

    } catch (error) {
      console.error('❌ Error extrayendo datos estructurales:', error);
      throw new Error(`Error procesando con OpenAI: ${error instanceof Error ? error.message : 'Error desconocido'}`);
    }
  }

  /**
   * Valida la estructura de datos extraída y corrige posiciones si es necesario
   */
  private static validateStructuralData(data: NLPStructuralData, userDescription: string): void {
    if (!data.metadata || !data.rooms || !Array.isArray(data.rooms)) {
      throw new Error('Estructura de datos inválida recibida de OpenAI');
    }

    if (data.rooms.length === 0) {
      throw new Error('No se detectaron habitaciones en la descripción');
    }

    // 1) Asegurar plano cuadrado estable usando area de terreno ingresada por el usuario.
    const rawWidth = Number.isFinite(data.metadata.dimensions.width) ? data.metadata.dimensions.width : 0;
    const rawLength = Number.isFinite(data.metadata.dimensions.length) ? data.metadata.dimensions.length : 0;
    const fallbackArea = Number.isFinite(data.metadata.totalArea) && data.metadata.totalArea > 0
      ? data.metadata.totalArea
      : Math.max(rawWidth * rawLength, 16);
    const requestedLotArea = this.parseRequestedLotArea(userDescription);
    const requestedOrientation = this.parseRequestedOrientation(userDescription);
    const orientation: Orientation = requestedOrientation || 'north';
    const lotArea = requestedLotArea ?? fallbackArea;
    const squareSize = Math.max(4, Number(Math.sqrt(Math.max(lotArea, 16)).toFixed(4)));
    data.metadata.dimensions.width = squareSize;
    data.metadata.dimensions.length = squareSize;
    data.metadata.orientation = orientation;
    data.metadata.totalArea = Math.round(lotArea * 100) / 100;

    // 2) Normalizar habitaciones de entrada.
    const sanitizedRooms = data.rooms
      .filter(room => !!room?.name)
      .filter(room => {
        const signature = `${String(room.name || '').toLowerCase()} ${String(room.features || []).toLowerCase()}`;
        const isEntradaLike = signature.includes('entrada') || signature.includes('acceso');
        return !isEntradaLike;
      })
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

    // 3) Reglas programaticas base antes de distribuir.
    const preliminaryTypology = this.detectProjectTypology(
      data,
      sanitizedRooms.filter(room => room.type !== 'hallway')
    );
    this.enforceProgramRules(sanitizedRooms, preliminaryTypology, squareSize);

    // 4) Distribucion por nucleo central de circulacion (no lineal, no en T).
    const margin = 0.5;
    const usableSize = squareSize - (margin * 2);
    const otherRooms = sanitizedRooms.filter(room => room.type !== 'hallway');

    const typology = this.detectProjectTypology(data, otherRooms);
    const profile = this.detectTypologyProfile(data, typology, otherRooms);
    console.log(`🏷️ Tipología detectada: ${typology}`);
    console.log(`🧭 Perfil tipológico: ${profile}`);

    const circulationRatioByTypology: Record<ProjectTypology, number> = {
      house: 0.11,
      apartment: 0.1,
      office: 0.14,
      coworking: 0.14,
      retail: 0.1,
      restaurant: 0.11,
      healthcare: 0.16,
      education: 0.14,
      hospitality: 0.13,
      industrial: 0.09,
      warehouse: 0.08,
      mixed_use: 0.13,
      cultural: 0.12,
      sports: 0.11,
      public_service: 0.12,
      default: 0.11,
    };

    const minCirculationAreaByTypology: Record<ProjectTypology, number> = {
      house: 7.5,
      apartment: 7,
      office: 10,
      coworking: 10,
      retail: 8,
      restaurant: 8,
      healthcare: 12,
      education: 10,
      hospitality: 10,
      industrial: 8,
      warehouse: 8,
      mixed_use: 10,
      cultural: 9,
      sports: 9,
      public_service: 9,
      default: 8,
    };

    const profileCirculationBonus: Partial<Record<TypologyProfile, number>> = {
      compact_residential: -0.01,
      open_social_home: 0.01,
      open_office: 0.02,
      clinic_flow: 0.02,
      school_cluster: 0.015,
      restaurant_central_kitchen: 0.01,
      hotel_corridor: 0.02,
      warehouse_linear: 0.01,
      mixed_urban: 0.015,
    };

    const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));
    const footprintArea = usableSize * usableSize;
    const estimatedProgramArea = Math.max(
      Number.isFinite(data.metadata.totalArea) ? data.metadata.totalArea : 0,
      otherRooms.reduce((sum, room) => sum + Math.max(room.area, 3), 0)
    );
    const isResidentialTypology = typology === 'house' || typology === 'apartment';
    const normalizedProgramArea = clamp(
      estimatedProgramArea,
      Math.max(20, otherRooms.length * 4.2),
      isResidentialTypology ? (footprintArea * 0.998) : (footprintArea * 0.94)
    );

    const circulationRatio = Math.min(
      0.2,
      Math.max(
        0.08,
        circulationRatioByTypology[typology] + (profileCirculationBonus[profile] || 0)
      )
    );

    const minCirculationArea = minCirculationAreaByTypology[typology];
    const targetCirculationArea = Math.max(minCirculationArea, normalizedProgramArea * circulationRatio);
    const maxCirculationArea = isResidentialTypology ? (footprintArea * 0.17) : (footprintArea * 0.24);
    const minCirculationBound = isResidentialTypology ? 5.6 : 6.5;

    // Regla estricta residencial: área de circulación basada en número de habitaciones.
    const residentialCirculationTargetArea = clamp(
      4.8 + (otherRooms.length * 0.72),
      5.6,
      9.2
    );

    const circulationArea = isResidentialTypology
      ? clamp(residentialCirculationTargetArea, minCirculationBound, maxCirculationArea)
      : Math.max(minCirculationBound, Math.min(targetCirculationArea, maxCirculationArea));

    // Distribucion robusta por porcentajes para habitaciones no-circulacion.
    const roomAreaBudget = Math.max(otherRooms.length * 3.2, normalizedProgramArea - circulationArea);
    this.rebalanceRoomAreasByPercentages(otherRooms, roomAreaBudget, typology, profile);

    const circulationRooms: NLPStructuralData['rooms'] = [];
    if (!isResidentialTypology) {
      // Tipologías no residenciales: circulación interior compacta.
      const maxAspectRatio = 2.6; // alto/ancho
      let corridorMainWidth = clamp(
        Math.sqrt(circulationArea / 2.3),
        1.6,
        Math.min(2.9, usableSize * 0.34)
      );
      let corridorMainHeight = clamp(
        circulationArea / Math.max(corridorMainWidth, 0.01),
        3.6,
        Math.min(usableSize * 0.74, corridorMainWidth * maxAspectRatio)
      );

      if ((corridorMainHeight / Math.max(corridorMainWidth, 0.01)) > maxAspectRatio) {
        corridorMainHeight = corridorMainWidth * maxAspectRatio;
      }
      corridorMainWidth = Math.max(1.6, circulationArea / Math.max(corridorMainHeight, 0.01));

      const corridorMainX = margin;
      const corridorMainY = margin + (usableSize - corridorMainHeight) / 2;
      circulationRooms.push({
        name: 'Núcleo de Circulación',
        type: 'hallway',
        area: Math.round(corridorMainWidth * corridorMainHeight * 100) / 100,
        position: { x: corridorMainX, y: corridorMainY },
        size: { width: corridorMainWidth, height: corridorMainHeight },
        doors: [],
        windows: [],
        features: ['Circulación perimetral']
      });
    }

    const maxX = margin + usableSize;
    const maxY = margin + usableSize;

    // Blindaje: toda circulacion debe quedar dentro del perimetro util.
    for (const room of circulationRooms) {
      room.position.x = clamp(room.position.x, margin, maxX - 1.1);
      room.position.y = clamp(room.position.y, margin, maxY - 1.1);
      room.size.width = clamp(room.size.width, 1.05, maxX - room.position.x);
      room.size.height = clamp(room.size.height, 1.05, maxY - room.position.y);
      room.area = Math.round(room.size.width * room.size.height * 100) / 100;
    }
  const frontZones = this.getFrontZoneCandidates(orientation);
  const privateZones = this.getPrivateZoneCandidates(orientation);


    // Zonas de cuartos sobre el area remanente (lado interior opuesto a la circulacion perimetral).
    const corridorRight = circulationRooms.length > 0
      ? Math.max(...circulationRooms.map(room => room.position.x + room.size.width))
      : margin;
    const usableStartX = isResidentialTypology
      ? margin
      : clamp(corridorRight, margin + 0.8, maxX - 3.6);
    const remX = usableStartX;
    const remY = margin;
    const remW = Math.max(3.4, maxX - remX);
    const remH = usableSize;

    // Particion completa 2x2 sin huecos internos.
    const splitX = remX + remW * 0.52;
    const splitY = remY + remH * 0.5;
    const zones = {
      north: {
        x: remX,
        y: remY,
        width: Math.max(1.8, splitX - remX),
        height: Math.max(1.8, splitY - remY)
      },
      east: {
        x: splitX,
        y: remY,
        width: Math.max(1.8, (remX + remW) - splitX),
        height: Math.max(1.8, splitY - remY)
      },
      west: {
        x: remX,
        y: splitY,
        width: Math.max(1.8, splitX - remX),
        height: Math.max(1.8, (remY + remH) - splitY)
      },
      south: {
        x: splitX,
        y: splitY,
        width: Math.max(1.8, (remX + remW) - splitX),
        height: Math.max(1.8, (remY + remH) - splitY)
      }
    };

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
    const roomZone = new Map<(typeof otherRooms)[number], ZoneKey>();

    const roomPriority = (room: (typeof otherRooms)[number]) => {
      const signature = `${String(room.type).toLowerCase()} ${String(room.name || '').toLowerCase()} ${String(room.features || []).toLowerCase()}`;
      if (room.type === 'kitchen' || signature.includes('cocina')) return 100;
      if (room.type === 'dining_room' || signature.includes('comedor')) return 95;
      if (room.type === 'living_room' || signature.includes('sala')) return 90;
      if (room.type === 'bedroom' || signature.includes('habit')) return 80;
      if (room.type === 'bathroom' || signature.includes('bañ') || signature.includes('bano') || signature.includes('bath')) return 70;
      return 50;
    };

    const orderedRooms = [...otherRooms].sort((a, b) => roomPriority(b) - roomPriority(a));
    const zonesAdjacent: Record<ZoneKey, ZoneKey[]> = {
      north: ['east', 'west'],
      east: ['north', 'south'],
      west: ['north', 'south'],
      south: ['east', 'west'],
    };

    const kitchenZone = () => {
      const kitchen = orderedRooms.find(room => {
        const sig = `${String(room.type).toLowerCase()} ${String(room.name || '').toLowerCase()}`;
        return room.type === 'kitchen' || sig.includes('cocina');
      });
      return kitchen ? roomZone.get(kitchen) : undefined;
    };

    const diningZone = () => {
      const dining = orderedRooms.find(room => {
        const sig = `${String(room.type).toLowerCase()} ${String(room.name || '').toLowerCase()}`;
        return room.type === 'dining_room' || sig.includes('comedor') || sig.includes('dining');
      });
      return dining ? roomZone.get(dining) : undefined;
    };

    const bedroomZones = () => {
      const zonesList: ZoneKey[] = [];
      for (const room of orderedRooms) {
        const sig = `${String(room.type).toLowerCase()} ${String(room.name || '').toLowerCase()}`;
        if (room.type === 'bedroom' || sig.includes('habit')) {
          const z = roomZone.get(room);
          if (z) zonesList.push(z);
        }
      }
      return zonesList;
    };

    const bathroomZones = () => {
      const zonesList: ZoneKey[] = [];
      for (const room of orderedRooms) {
        const sig = `${String(room.type).toLowerCase()} ${String(room.name || '').toLowerCase()}`;
        if (room.type === 'bathroom' || sig.includes('bañ') || sig.includes('bano') || sig.includes('bath')) {
          const z = roomZone.get(room);
          if (z) zonesList.push(z);
        }
      }
      return zonesList;
    };

    for (const room of orderedRooms) {
      const orderedZones = chooseZoneOrder(room);
      const signature = `${String(room.type).toLowerCase()} ${String(room.name || '').toLowerCase()} ${String(room.features || []).toLowerCase()}`;
      const isDining = room.type === 'dining_room' || signature.includes('comedor');
      const isLiving = room.type === 'living_room' || signature.includes('sala') || signature.includes('estar') || signature.includes('living');
      const isBathroom = room.type === 'bathroom' || signature.includes('bañ') || signature.includes('bano') || signature.includes('bath');
      const isBedroom = room.type === 'bedroom' || signature.includes('habit') || signature.includes('bedroom');
      const isKitchen = room.type === 'kitchen' || signature.includes('cocina') || signature.includes('kitchen');
      const isOfficeSpace = room.type === 'office' || signature.includes('oficina') || signature.includes('junta') || signature.includes('meeting');
      const isReception = signature.includes('recep') || signature.includes('lobby') || signature.includes('acceso');

      const preferred = new Set<ZoneKey>();
      const blocked = new Set<ZoneKey>();

      const kZone = kitchenZone();
      if (isDining && kZone) {
        preferred.add(kZone);
        zonesAdjacent[kZone].forEach(zone => preferred.add(zone));
      }

      if (isLiving) {
        const dZone = diningZone();
        const socialAnchor = dZone || kZone;
        if (socialAnchor) {
          preferred.add(socialAnchor);
          zonesAdjacent[socialAnchor].forEach(zone => preferred.add(zone));
        }
      }

      if (isBathroom) {
        const bZones = bedroomZones();
        for (const z of bZones) {
          preferred.add(z);
          zonesAdjacent[z].forEach(adj => preferred.add(adj));
        }
        if (kZone) {
          blocked.add(kZone);
        }
      }

      if ((typology === 'house' || typology === 'apartment') && isBedroom && kZone) {
        blocked.add(kZone);
        zonesAdjacent[kZone].forEach(adj => blocked.add(adj));
      }

      if ((typology === 'house' || typology === 'apartment') && isKitchen) {
        frontZones.forEach(zone => preferred.add(zone));
      }

      if ((typology === 'house' || typology === 'apartment') && isLiving) {
        frontZones.forEach(zone => preferred.add(zone));
      }

      if ((typology === 'office' || typology === 'coworking') && isReception) {
        frontZones.forEach(zone => preferred.add(zone));
      }

      if ((typology === 'office' || typology === 'coworking') && isOfficeSpace) {
        privateZones.forEach(zone => preferred.add(zone));
      }

      if ((typology === 'office' || typology === 'coworking') && isKitchen) {
        const bZones = bathroomZones();
        for (const z of bZones) {
          blocked.add(z);
        }
      }

      if ((typology === 'office' || typology === 'coworking') && isBathroom) {
        for (const z of bathroomZones()) {
          preferred.add(z);
        }
        for (const zone of ['west', 'north'] as ZoneKey[]) {
          const receptionLikely = zoneRooms[zone].some(r => {
            const sig = `${String(r.name || '').toLowerCase()} ${String(r.features || []).toLowerCase()}`;
            return sig.includes('recep') || sig.includes('lobby') || sig.includes('acceso');
          });
          if (receptionLikely) blocked.add(zone);
        }
      }

      const fallback = (['north', 'south', 'west', 'east'] as ZoneKey[])
        .sort((a, b) => {
          const capA = zones[a].width * zones[a].height;
          const capB = zones[b].width * zones[b].height;
          const scoreA = zoneAreaUse[a] / Math.max(capA, 0.01);
          const scoreB = zoneAreaUse[b] / Math.max(capB, 0.01);
          return scoreA - scoreB;
        })[0];

      const baseSelection = orderedZones.find(zone => {
        if (blocked.has(zone)) return false;
        const cap = zones[zone].width * zones[zone].height;
        return zoneAreaUse[zone] + room.area <= cap * 1.15;
      }) || orderedZones.find(zone => !blocked.has(zone)) || fallback;

      const selected = preferred.size > 0
        ? (Array.from(preferred).find(zone => {
            if (blocked.has(zone)) return false;
            const cap = zones[zone].width * zones[zone].height;
            return zoneAreaUse[zone] + room.area <= cap * 1.15;
          }) || baseSelection)
        : baseSelection;

      zoneRooms[selected].push(room);
      zoneAreaUse[selected] += room.area;
      roomZone.set(room, selected);
    }

    // Evitar cuadrantes vacíos para no dejar espacios muertos.
    const emptyZones = (['north', 'south', 'west', 'east'] as ZoneKey[]).filter(zone => zoneRooms[zone].length === 0);
    for (const targetZone of emptyZones) {
      const donorZone = (['north', 'south', 'west', 'east'] as ZoneKey[])
        .filter(zone => zoneRooms[zone].length > 1)
        .sort((a, b) => zoneAreaUse[b] - zoneAreaUse[a])[0];

      if (!donorZone) break;
      const movable = zoneRooms[donorZone]
        .sort((a, b) => b.area - a.area)[0];

      if (!movable) break;
      zoneRooms[donorZone] = zoneRooms[donorZone].filter(room => room !== movable);
      zoneAreaUse[donorZone] -= movable.area;
      zoneRooms[targetZone].push(movable);
      zoneAreaUse[targetZone] += movable.area;
      roomZone.set(movable, targetZone);
    }

    // Hard rules por tipologia: corrige zonificacion antes de geometrizar.
    const allZones: ZoneKey[] = ['north', 'south', 'west', 'east'];
    const isZoneAdjacent = (a: ZoneKey, b: ZoneKey) => a === b || zonesAdjacent[a].includes(b);
    const roomSignature = (room: (typeof otherRooms)[number]) =>
      `${String(room.type).toLowerCase()} ${String(room.name || '').toLowerCase()} ${String(room.features || []).toLowerCase()}`;

    const findRooms = (predicate: (room: (typeof otherRooms)[number]) => boolean) =>
      orderedRooms.filter(predicate);

    const leastLoadedZone = (candidates: ZoneKey[]): ZoneKey =>
      [...candidates].sort((a, b) => zoneAreaUse[a] - zoneAreaUse[b])[0];

    const moveRoomToZone = (room: (typeof otherRooms)[number], targetZone: ZoneKey): void => {
      const currentZone = roomZone.get(room);
      if (!currentZone || currentZone === targetZone) return;

      zoneRooms[currentZone] = zoneRooms[currentZone].filter(r => r !== room);
      zoneAreaUse[currentZone] = Math.max(0, zoneAreaUse[currentZone] - room.area);
      zoneRooms[targetZone].push(room);
      zoneAreaUse[targetZone] += room.area;
      roomZone.set(room, targetZone);
    };

    const isKitchen = (room: (typeof otherRooms)[number]) => {
      const sig = roomSignature(room);
      return room.type === 'kitchen' || sig.includes('cocina') || sig.includes('kitchen');
    };
    const isDining = (room: (typeof otherRooms)[number]) => {
      const sig = roomSignature(room);
      return room.type === 'dining_room' || sig.includes('comedor') || sig.includes('dining');
    };
    const isLiving = (room: (typeof otherRooms)[number]) => {
      const sig = roomSignature(room);
      return room.type === 'living_room' || sig.includes('sala') || sig.includes('estar') || sig.includes('living');
    };
    const isBathroom = (room: (typeof otherRooms)[number]) => {
      const sig = roomSignature(room);
      return room.type === 'bathroom' || sig.includes('bañ') || sig.includes('bano') || sig.includes('bath');
    };
    const isBedroom = (room: (typeof otherRooms)[number]) => {
      const sig = roomSignature(room);
      return room.type === 'bedroom' || sig.includes('habit') || sig.includes('bedroom');
    };
    const isReception = (room: (typeof otherRooms)[number]) => {
      const sig = roomSignature(room);
      return room.type === 'living_room' && (sig.includes('recep') || sig.includes('lobby') || sig.includes('acceso'));
    };
    const isOfficeSpace = (room: (typeof otherRooms)[number]) => {
      const sig = roomSignature(room);
      return room.type === 'office' || sig.includes('oficina') || sig.includes('junta') || sig.includes('meeting') || sig.includes('work');
    };
    const isGarage = (room: (typeof otherRooms)[number]) => {
      const sig = roomSignature(room);
      return room.type === 'garage' || sig.includes('garage') || sig.includes('cochera') || sig.includes('estacion');
    };

    if (typology === 'house' || typology === 'apartment') {
      const kitchens = findRooms(isKitchen);
      const diningRooms = findRooms(isDining);
      const livingRooms = findRooms(isLiving);
      const bathrooms = findRooms(isBathroom);
      const bedrooms = findRooms(isBedroom);
      const garages = findRooms(isGarage);

      const kitchenZone = kitchens.length > 0 ? roomZone.get(kitchens[0]) : undefined;
      const bedroomZones = Array.from(new Set(bedrooms.map(room => roomZone.get(room)).filter(Boolean) as ZoneKey[]));

      // Comedor junto a cocina.
      if (kitchenZone) {
        for (const dining of diningRooms) {
          const dz = roomZone.get(dining);
          if (!dz || !isZoneAdjacent(dz, kitchenZone)) {
            const candidates = [kitchenZone, ...zonesAdjacent[kitchenZone]];
            moveRoomToZone(dining, leastLoadedZone(candidates));
          }
        }
      }

      // Sala junto a nucleo social (cocina/comedor).
      const socialAnchorZone = kitchenZone || (diningRooms[0] ? roomZone.get(diningRooms[0]) : undefined);
      if (socialAnchorZone) {
        for (const living of livingRooms) {
          const lz = roomZone.get(living);
          if (!lz || !isZoneAdjacent(lz, socialAnchorZone)) {
            const candidates = [socialAnchorZone, ...zonesAdjacent[socialAnchorZone]];
            moveRoomToZone(living, leastLoadedZone(candidates));
          }
        }
      }

      // Cochera siempre en fachada principal (misma banda frontal de acceso).
      for (const garage of garages) {
        const gz = roomZone.get(garage);
        if (!gz || !frontZones.includes(gz)) {
          moveRoomToZone(garage, leastLoadedZone(frontZones));
        }
      }

      // Baños cerca de dormitorios y lejos de cocina.
      if (bedroomZones.length > 0) {
        for (const bathroom of bathrooms) {
          const bz = roomZone.get(bathroom);
          const nearBedrooms = bz ? bedroomZones.some(zone => isZoneAdjacent(bz, zone)) : false;
          const inKitchenZone = kitchenZone ? bz === kitchenZone : false;

          if (!nearBedrooms || inKitchenZone) {
            const preferred = bedroomZones.flatMap(zone => [zone, ...zonesAdjacent[zone]]);
            const uniquePreferred = Array.from(new Set(preferred));
            const filtered = kitchenZone
              ? uniquePreferred.filter(zone => zone !== kitchenZone)
              : uniquePreferred;
            if (filtered.length > 0) {
              moveRoomToZone(bathroom, leastLoadedZone(filtered));
            }
          }
        }
      }
    }

    if (typology === 'office' || typology === 'coworking') {
      const receptions = findRooms(isReception);
      const bathrooms = findRooms(isBathroom);
      const officeSpaces = findRooms(isOfficeSpace);
      const pantrySpaces = findRooms(room => {
        const sig = roomSignature(room);
        return room.type === 'kitchen' && (sig.includes('pantry') || sig.includes('coffee') || sig.includes('cafeter'));
      });

      // Recepcion en frente/acceso (norte-oeste).
      for (const reception of receptions) {
        const rz = roomZone.get(reception);
        if (!rz || (rz !== 'west' && rz !== 'north')) {
          moveRoomToZone(reception, leastLoadedZone(['west', 'north']));
        }
      }

      // Oficinas/juntas agrupadas hacia zona productiva (este-sur).
      for (const officeRoom of officeSpaces) {
        const oz = roomZone.get(officeRoom);
        if (!oz || (oz !== 'east' && oz !== 'south')) {
          moveRoomToZone(officeRoom, leastLoadedZone(['east', 'south']));
        }
      }

      // Baños lejos de recepcion.
      const receptionZones = new Set(receptions.map(room => roomZone.get(room)).filter(Boolean) as ZoneKey[]);
      for (const bathroom of bathrooms) {
        const bz = roomZone.get(bathroom);
        if (bz && receptionZones.has(bz)) {
          const candidates = allZones.filter(zone => !receptionZones.has(zone));
          if (candidates.length > 0) {
            moveRoomToZone(bathroom, leastLoadedZone(candidates));
          }
        }
      }

      // Pantry alejada de baños y cercana a oficinas.
      const bathroomZones = new Set(bathrooms.map(room => roomZone.get(room)).filter(Boolean) as ZoneKey[]);
      for (const pantry of pantrySpaces) {
        const pz = roomZone.get(pantry);
        if (!pz || bathroomZones.has(pz)) {
          const officeZones = Array.from(new Set(officeSpaces.map(room => roomZone.get(room)).filter(Boolean) as ZoneKey[]));
          const candidates = officeZones.length > 0
            ? officeZones.filter(zone => !bathroomZones.has(zone))
            : allZones.filter(zone => !bathroomZones.has(zone));
          if (candidates.length > 0) {
            moveRoomToZone(pantry, leastLoadedZone(candidates));
          }
        }
      }
    }

    const computeTypologyAudit = (): { score: number; findings: string[] } => {
      let score = 100;
      const findings: string[] = [];

      if (typology === 'house' || typology === 'apartment') {
        const kitchens = findRooms(isKitchen);
        const diningRooms = findRooms(isDining);
        const livingRooms = findRooms(isLiving);
        const bathrooms = findRooms(isBathroom);
        const bedrooms = findRooms(isBedroom);
        const garages = findRooms(isGarage);

        const kitchenZone = kitchens.length > 0 ? roomZone.get(kitchens[0]) : undefined;
        const socialAnchorZone = kitchenZone || (diningRooms[0] ? roomZone.get(diningRooms[0]) : undefined);
        const bedroomZoneSet = new Set(bedrooms.map(room => roomZone.get(room)).filter(Boolean) as ZoneKey[]);

        if (kitchenZone) {
          for (const dining of diningRooms) {
            const dz = roomZone.get(dining);
            if (!dz || !isZoneAdjacent(dz, kitchenZone)) {
              score -= 14;
              findings.push(`Comedor no adyacente a cocina: ${dining.name}`);
            }
          }
        }

        if (socialAnchorZone) {
          for (const living of livingRooms) {
            const lz = roomZone.get(living);
            if (!lz || !isZoneAdjacent(lz, socialAnchorZone)) {
              score -= 10;
              findings.push(`Sala desconectada del núcleo social: ${living.name}`);
            }
          }
        }

        for (const bathroom of bathrooms) {
          const bz = roomZone.get(bathroom);
          const nearBedrooms = bz ? Array.from(bedroomZoneSet).some(zone => isZoneAdjacent(bz, zone)) : false;
          if (!nearBedrooms) {
            score -= 8;
            findings.push(`Baño lejos de dormitorios: ${bathroom.name}`);
          }
          if (kitchenZone && bz === kitchenZone) {
            score -= 12;
            findings.push(`Baño en misma zona que cocina: ${bathroom.name}`);
          }
        }

        for (const bedroom of bedrooms) {
          const bz = roomZone.get(bedroom);
          if (bz && frontZones.includes(bz)) {
            score -= 4;
            findings.push(`Dormitorio en zona demasiado pública: ${bedroom.name}`);
          }
        }

        for (const garage of garages) {
          const gz = roomZone.get(garage);
          if (!gz || !frontZones.includes(gz)) {
            score -= 12;
            findings.push(`Cochera fuera de fachada principal: ${garage.name}`);
          }
        }

      }

      if (typology === 'office' || typology === 'coworking') {
        const receptions = findRooms(isReception);
        const bathrooms = findRooms(isBathroom);
        const officeSpaces = findRooms(isOfficeSpace);
        const pantrySpaces = findRooms(room => {
          const sig = roomSignature(room);
          return room.type === 'kitchen' && (sig.includes('pantry') || sig.includes('coffee') || sig.includes('cafeter'));
        });
        const meetingRooms = findRooms(room => {
          const sig = roomSignature(room);
          return room.type === 'office' && (sig.includes('junta') || sig.includes('meeting') || sig.includes('conferencia'));
        });

        for (const reception of receptions) {
          const rz = roomZone.get(reception);
          if (!rz || !frontZones.includes(rz)) {
            score -= 16;
            findings.push(`Recepción fuera de zona de acceso: ${reception.name}`);
          }
        }

        for (const officeRoom of officeSpaces) {
          const oz = roomZone.get(officeRoom);
          if (!oz || !privateZones.includes(oz)) {
            score -= 7;
            findings.push(`Oficina fuera de zona productiva: ${officeRoom.name}`);
          }
        }

        const receptionZones = new Set(receptions.map(room => roomZone.get(room)).filter(Boolean) as ZoneKey[]);
        for (const bathroom of bathrooms) {
          const bz = roomZone.get(bathroom);
          if (bz && receptionZones.has(bz)) {
            score -= 12;
            findings.push(`Baño comparte zona con recepción: ${bathroom.name}`);
          }
          if (bz && Array.from(receptionZones).some(zone => isZoneAdjacent(zone, bz))) {
            score -= 6;
            findings.push(`Baño adyacente a recepción: ${bathroom.name}`);
          }
        }

        const bathroomZones = new Set(bathrooms.map(room => roomZone.get(room)).filter(Boolean) as ZoneKey[]);
        for (const pantry of pantrySpaces) {
          const pz = roomZone.get(pantry);
          if (pz && bathroomZones.has(pz)) {
            score -= 10;
            findings.push(`Pantry comparte zona con baño: ${pantry.name}`);
          }
        }

        const officeZones = new Set(officeSpaces.map(room => roomZone.get(room)).filter(Boolean) as ZoneKey[]);
        for (const meeting of meetingRooms) {
          const mz = roomZone.get(meeting);
          const nearOffice = mz ? Array.from(officeZones).some(zone => isZoneAdjacent(zone, mz)) : false;
          if (!nearOffice) {
            score -= 10;
            findings.push(`Sala de juntas alejada de oficinas: ${meeting.name}`);
          }
        }

      }

      const uniqueFindings = Array.from(new Set(findings));
      return {
        score: Math.max(0, score),
        findings: uniqueFindings
      };
    };

    const runStrictRepairPass = () => {
      if (typology === 'house' || typology === 'apartment') {
        const kitchens = findRooms(isKitchen);
        const diningRooms = findRooms(isDining);
        const livingRooms = findRooms(isLiving);
        const bathrooms = findRooms(isBathroom);
        const bedrooms = findRooms(isBedroom);
        const garages = findRooms(isGarage);

        const kitchenZone = kitchens.length > 0 ? roomZone.get(kitchens[0]) : undefined;
        const socialAnchorZone = kitchenZone || (diningRooms[0] ? roomZone.get(diningRooms[0]) : undefined);
        const bedroomZones = Array.from(new Set(bedrooms.map(room => roomZone.get(room)).filter(Boolean) as ZoneKey[]));

        if (kitchenZone) {
          for (const dining of diningRooms) {
            const dz = roomZone.get(dining);
            if (!dz || !isZoneAdjacent(dz, kitchenZone)) {
              moveRoomToZone(dining, leastLoadedZone([kitchenZone, ...zonesAdjacent[kitchenZone]]));
            }
          }
        }

        if (socialAnchorZone) {
          for (const living of livingRooms) {
            const lz = roomZone.get(living);
            if (!lz || !isZoneAdjacent(lz, socialAnchorZone)) {
              moveRoomToZone(living, leastLoadedZone([socialAnchorZone, ...zonesAdjacent[socialAnchorZone]]));
            }
          }
        }

        if (bedroomZones.length > 0) {
          for (const bathroom of bathrooms) {
            const bz = roomZone.get(bathroom);
            const nearBedrooms = bz ? bedroomZones.some(zone => isZoneAdjacent(bz, zone)) : false;
            const inKitchenZone = kitchenZone ? bz === kitchenZone : false;
            if (!nearBedrooms || inKitchenZone) {
              const preferred = Array.from(new Set(bedroomZones.flatMap(zone => [zone, ...zonesAdjacent[zone]])));
              const filtered = kitchenZone ? preferred.filter(zone => zone !== kitchenZone) : preferred;
              if (filtered.length > 0) moveRoomToZone(bathroom, leastLoadedZone(filtered));
            }
          }
        }

        for (const bedroom of bedrooms) {
          const bz = roomZone.get(bedroom);
          if (bz && frontZones.includes(bz)) {
            moveRoomToZone(bedroom, leastLoadedZone(privateZones));
          }
        }

        for (const garage of garages) {
          const gz = roomZone.get(garage);
          if (!gz || !frontZones.includes(gz)) {
            moveRoomToZone(garage, leastLoadedZone(frontZones));
          }
        }

      }

      if (typology === 'office' || typology === 'coworking') {
        const receptions = findRooms(isReception);
        const bathrooms = findRooms(isBathroom);
        const officeSpaces = findRooms(isOfficeSpace);
        const pantrySpaces = findRooms(room => {
          const sig = roomSignature(room);
          return room.type === 'kitchen' && (sig.includes('pantry') || sig.includes('coffee') || sig.includes('cafeter'));
        });
        const meetingRooms = findRooms(room => {
          const sig = roomSignature(room);
          return room.type === 'office' && (sig.includes('junta') || sig.includes('meeting') || sig.includes('conferencia'));
        });

        for (const reception of receptions) {
          const rz = roomZone.get(reception);
          if (!rz || !frontZones.includes(rz)) {
            moveRoomToZone(reception, leastLoadedZone(frontZones));
          }
        }

        for (const officeRoom of officeSpaces) {
          const oz = roomZone.get(officeRoom);
          if (!oz || !privateZones.includes(oz)) {
            moveRoomToZone(officeRoom, leastLoadedZone(privateZones));
          }
        }

        const receptionZones = new Set(receptions.map(room => roomZone.get(room)).filter(Boolean) as ZoneKey[]);
        const bathroomZones = new Set(bathrooms.map(room => roomZone.get(room)).filter(Boolean) as ZoneKey[]);
        for (const bathroom of bathrooms) {
          const bz = roomZone.get(bathroom);
          if (bz && Array.from(receptionZones).some(zone => isZoneAdjacent(zone, bz))) {
            const candidates = allZones.filter(zone => !Array.from(receptionZones).some(rz => isZoneAdjacent(rz, zone)));
            if (candidates.length > 0) moveRoomToZone(bathroom, leastLoadedZone(candidates));
          }
        }

        const officeZones = Array.from(new Set(officeSpaces.map(room => roomZone.get(room)).filter(Boolean) as ZoneKey[]));
        for (const pantry of pantrySpaces) {
          const pz = roomZone.get(pantry);
          const invalid = pz ? bathroomZones.has(pz) : true;
          if (invalid) {
            const candidates = officeZones.filter(zone => !bathroomZones.has(zone));
            if (candidates.length > 0) moveRoomToZone(pantry, leastLoadedZone(candidates));
          }
        }

        for (const meeting of meetingRooms) {
          const mz = roomZone.get(meeting);
          const nearOffice = mz ? officeZones.some(zone => isZoneAdjacent(zone, mz)) : false;
          if (!nearOffice && officeZones.length > 0) {
            moveRoomToZone(meeting, leastLoadedZone(officeZones));
          }
        }

      }
    };

    const minScore = (typology === 'office' || typology === 'coworking') ? 90 : ((typology === 'house' || typology === 'apartment') ? 88 : 80);
    let repairPassesApplied = 0;
    for (let pass = 0; pass < 4; pass++) {
      const audit = computeTypologyAudit();
      if (audit.score >= minScore) break;
      runStrictRepairPass();
      repairPassesApplied += 1;
    }
    const finalAudit = computeTypologyAudit();

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
      const laneCount = isHorizontal
        ? ((rooms.length >= 3 && z.height >= 4.6) ? 2 : 1)
        : ((rooms.length >= 3 && z.width >= 4.6) ? 2 : 1);

      const lanes: Array<Array<(typeof otherRooms)[number]>> = Array.from({ length: laneCount }, () => []);
      const laneLoads = Array.from({ length: laneCount }, () => 0);
      for (const room of rooms) {
        const targetLane = laneLoads.indexOf(Math.min(...laneLoads));
        lanes[targetLane].push(room);
        laneLoads[targetLane] += room.area;
      }

      for (let lane = 0; lane < laneCount; lane++) {
        const laneRooms = lanes[lane];
        if (laneRooms.length === 0) continue;

        const laneFixed = isHorizontal ? (z.height / laneCount) : (z.width / laneCount);
        const safeFixed = Math.max(0.95, laneFixed);
        const laneStartPrimary = isHorizontal ? z.x : z.y;
        const laneEndPrimary = isHorizontal ? (z.x + z.width) : (z.y + z.height);
        let cursor = laneStartPrimary;

        const laneArea = laneRooms.reduce((sum, room) => sum + room.area, 0);
        const laneCapacity = (isHorizontal ? z.width : z.height) * safeFixed;
        const areaScale = Math.min(1, laneCapacity / Math.max(laneArea, 0.01));

        for (let i = 0; i < laneRooms.length; i++) {
          const room = laneRooms[i];
          const dimRules = this.getDimensionRulesByTypology(typology, profile, room);
          const targetArea = room.area * areaScale;
          const remainingPrimary = Math.max(0.8, laneEndPrimary - cursor);
          const roomsLeft = laneRooms.length - i - 1;
          const reserveForRest = roomsLeft * Math.max(0.9, dimRules.minPrimary * 0.75);

          const suggestedPrimary = targetArea / Math.max(safeFixed, 0.01);
          const upperLimit = Math.max(0.8, remainingPrimary - reserveForRest);
          const primary = i === laneRooms.length - 1
            ? remainingPrimary
            : clamp(suggestedPrimary, 0.9, upperLimit);

          const safePrimary = Math.max(0.8, Math.min(primary, remainingPrimary));

          if (isHorizontal) {
            room.position.x = cursor;
            room.position.y = z.y + (lane * safeFixed);
            room.size.width = safePrimary;
            room.size.height = safeFixed;
          } else {
            room.position.x = z.x + (lane * safeFixed);
            room.position.y = cursor;
            room.size.width = safeFixed;
            room.size.height = safePrimary;
          }

          room.area = Math.round(room.size.width * room.size.height * 100) / 100;
          cursor += safePrimary;
        }
      }
    };

    assignByZone('north');
    assignByZone('south');
    assignByZone('west');
    assignByZone('east');

    const isGarageForFacade = (room: (typeof otherRooms)[number]) => {
      const sig = `${String(room.type).toLowerCase()} ${String(room.name || '').toLowerCase()} ${String(room.features || []).toLowerCase()}`;
      return room.type === 'garage' || sig.includes('garage') || sig.includes('cochera') || sig.includes('estacion');
    };
    const isLivingForFacade = (room: (typeof otherRooms)[number]) => {
      const sig = `${String(room.type).toLowerCase()} ${String(room.name || '').toLowerCase()} ${String(room.features || []).toLowerCase()}`;
      return room.type === 'living_room' || sig.includes('sala') || sig.includes('estar') || sig.includes('living');
    };

    // Alineación obligatoria en residencial: Sala y Cochera deben tocar la fachada principal.
    if (isResidentialTypology) {
      const frontRooms = otherRooms
        .filter(room => isGarageForFacade(room) || isLivingForFacade(room))
        .sort((a, b) => {
          const aGarage = isGarageForFacade(a) ? 1 : 0;
          const bGarage = isGarageForFacade(b) ? 1 : 0;
          return bGarage - aGarage;
        });

      if (frontRooms.length > 0) {
        const frontBandMin = 1.8;
        const frontBandMax = Math.max(frontBandMin, usableSize - 1.8);

        if (orientation === 'north' || orientation === 'south') {
          const targetDepth = frontRooms.reduce((maxDepth, room) => Math.max(maxDepth, room.size.height), frontBandMin);
          const commonDepth = clamp(targetDepth, frontBandMin, frontBandMax);
          const totalPreferred = frontRooms.reduce((sum, room) => sum + Math.max(1.8, room.size.width), 0);
          const scale = totalPreferred > usableSize ? (usableSize / totalPreferred) : 1;
          let cursor = margin;
          const facadeY = orientation === 'north' ? margin : (maxY - commonDepth);

          for (let i = 0; i < frontRooms.length; i++) {
            const room = frontRooms[i];
            const roomsLeft = frontRooms.length - i - 1;
            const remaining = Math.max(1.8, (margin + usableSize) - cursor);
            const reserve = roomsLeft * 1.8;
            const target = Math.max(1.8, room.size.width * scale);
            const width = i === frontRooms.length - 1
              ? remaining
              : clamp(target, 1.8, Math.max(1.8, remaining - reserve));

            room.size.width = width;
            room.size.height = commonDepth;
            room.position.x = cursor;
            room.position.y = facadeY;
            cursor += width;
          }
        } else {
          const targetDepth = frontRooms.reduce((maxDepth, room) => Math.max(maxDepth, room.size.width), frontBandMin);
          const commonDepth = clamp(targetDepth, frontBandMin, frontBandMax);
          const totalPreferred = frontRooms.reduce((sum, room) => sum + Math.max(1.8, room.size.height), 0);
          const scale = totalPreferred > usableSize ? (usableSize / totalPreferred) : 1;
          let cursor = margin;
          const facadeX = orientation === 'west' ? margin : (maxX - commonDepth);

          for (let i = 0; i < frontRooms.length; i++) {
            const room = frontRooms[i];
            const roomsLeft = frontRooms.length - i - 1;
            const remaining = Math.max(1.8, (margin + usableSize) - cursor);
            const reserve = roomsLeft * 1.8;
            const target = Math.max(1.8, room.size.height * scale);
            const height = i === frontRooms.length - 1
              ? remaining
              : clamp(target, 1.8, Math.max(1.8, remaining - reserve));

            room.size.height = height;
            room.size.width = commonDepth;
            room.position.y = cursor;
            room.position.x = facadeX;
            cursor += height;
          }
        }

        // Empujar interiores hacia adentro para evitar colisiones con banda frontal.
        const frontBottom = Math.max(...frontRooms.map(room => room.position.y + room.size.height));
        const frontTop = Math.min(...frontRooms.map(room => room.position.y));
        const frontRight = Math.max(...frontRooms.map(room => room.position.x + room.size.width));
        const frontLeft = Math.min(...frontRooms.map(room => room.position.x));

        for (const room of otherRooms) {
          if (frontRooms.includes(room)) continue;
          if (orientation === 'north' && room.position.y < frontBottom + 0.12) {
            room.position.y = frontBottom + 0.12;
          }
          if (orientation === 'south' && (room.position.y + room.size.height) > frontTop - 0.12) {
            room.position.y = (frontTop - 0.12) - room.size.height;
          }
          if (orientation === 'west' && room.position.x < frontRight + 0.12) {
            room.position.x = frontRight + 0.12;
          }
          if (orientation === 'east' && (room.position.x + room.size.width) > frontLeft - 0.12) {
            room.position.x = (frontLeft - 0.12) - room.size.width;
          }
        }

        // Partición estable del resto del programa en el rectángulo remanente (sin solapes).
        const innerGap = 0;
        let remX2 = margin;
        let remY2 = margin;
        let remW2 = usableSize;
        let remH2 = usableSize;

        if (orientation === 'north') {
          remY2 = Math.min(maxY - 1.8, frontBottom + innerGap);
          remH2 = Math.max(1.8, maxY - remY2);
        } else if (orientation === 'south') {
          remY2 = margin;
          remH2 = Math.max(1.8, (frontTop - innerGap) - margin);
        } else if (orientation === 'west') {
          remX2 = Math.min(maxX - 1.8, frontRight + innerGap);
          remW2 = Math.max(1.8, maxX - remX2);
        } else {
          remX2 = margin;
          remW2 = Math.max(1.8, (frontLeft - innerGap) - margin);
        }

        const interiorRooms = otherRooms.filter(room => !frontRooms.includes(room));
        if (interiorRooms.length > 0 && remW2 > 1.7 && remH2 > 1.7) {
          partitionRoomsInBounds(interiorRooms, {
            x: remX2,
            y: remY2,
            width: remW2,
            height: remH2,
          }, {
            weight: (room) => Math.max(1, room.area),
          });
        }
      } else if (otherRooms.length > 0) {
        // Fallback residencial: si no hay sala/cochera detectables, se llena todo el cuadrado.
        partitionRoomsInBounds(otherRooms, {
          x: margin,
          y: margin,
          width: usableSize,
          height: usableSize,
        }, {
          weight: (room) => Math.max(1, room.area),
        });
      }
    }

    // Resolución geométrica de colisiones para evitar solapes tras reanclajes.
    const overlaps = (a: (typeof otherRooms)[number], b: (typeof otherRooms)[number]) => {
      const overlapX = Math.min(a.position.x + a.size.width, b.position.x + b.size.width) - Math.max(a.position.x, b.position.x);
      const overlapY = Math.min(a.position.y + a.size.height, b.position.y + b.size.height) - Math.max(a.position.y, b.position.y);
      return { overlapX, overlapY };
    };

    for (let iter = 0; iter < 24; iter++) {
      let moved = false;
      for (let i = 0; i < otherRooms.length; i++) {
        for (let j = i + 1; j < otherRooms.length; j++) {
          const a = otherRooms[i];
          const b = otherRooms[j];
          const { overlapX, overlapY } = overlaps(a, b);
          if (overlapX <= 0 || overlapY <= 0) continue;

          const aProtected = isResidentialTypology && (isGarageForFacade(a) || isLivingForFacade(a));
          const bProtected = isResidentialTypology && (isGarageForFacade(b) || isLivingForFacade(b));
          const movable = aProtected && !bProtected ? b : (bProtected && !aProtected ? a : a);
          const fixed = movable === a ? b : a;

          const movableCenterX = movable.position.x + (movable.size.width / 2);
          const movableCenterY = movable.position.y + (movable.size.height / 2);
          const fixedCenterX = fixed.position.x + (fixed.size.width / 2);
          const fixedCenterY = fixed.position.y + (fixed.size.height / 2);

          const requiredX = overlapX + 0.08;
          const requiredY = overlapY + 0.08;

          const spaceRight = Math.max(0, maxX - (movable.position.x + movable.size.width));
          const spaceLeft = Math.max(0, movable.position.x - margin);
          const spaceDown = Math.max(0, maxY - (movable.position.y + movable.size.height));
          const spaceUp = Math.max(0, movable.position.y - margin);

          const xDirection = movableCenterX >= fixedCenterX ? 1 : -1;
          const yDirection = movableCenterY >= fixedCenterY ? 1 : -1;

          const candidates: Array<{ dx: number; dy: number; distance: number }> = [];

          const addHorizontalCandidate = (sign: 1 | -1) => {
            const capacity = sign > 0 ? spaceRight : spaceLeft;
            if (capacity >= requiredX) {
              candidates.push({ dx: sign * requiredX, dy: 0, distance: requiredX });
            }
          };
          const addVerticalCandidate = (sign: 1 | -1) => {
            const capacity = sign > 0 ? spaceDown : spaceUp;
            if (capacity >= requiredY) {
              candidates.push({ dx: 0, dy: sign * requiredY, distance: requiredY });
            }
          };

          addHorizontalCandidate(xDirection as 1 | -1);
          addVerticalCandidate(yDirection as 1 | -1);
          addHorizontalCandidate((xDirection * -1) as 1 | -1);
          addVerticalCandidate((yDirection * -1) as 1 | -1);

          if (candidates.length > 0) {
            const best = candidates.sort((m, n) => m.distance - n.distance)[0];
            movable.position.x += best.dx;
            movable.position.y += best.dy;
          } else {
            // Ultimo recurso: reducir ligeramente el cuarto movible para romper solape.
            if (overlapX >= overlapY) {
              movable.size.width = Math.max(0.8, movable.size.width - (overlapX + 0.08));
            } else {
              movable.size.height = Math.max(0.8, movable.size.height - (overlapY + 0.08));
            }
          }

          moved = true;
        }
      }
      if (!moved) break;

      for (const room of otherRooms) {
        room.position.x = clamp(room.position.x, margin, maxX - 0.8);
        room.position.y = clamp(room.position.y, margin, maxY - 0.8);
        room.size.width = clamp(room.size.width, 0.8, maxX - room.position.x);
        room.size.height = clamp(room.size.height, 0.8, maxY - room.position.y);
      }
    }

    // Cap duro para baños: evitar dimensiones excesivas tras layout geométrico.
    for (const room of otherRooms) {
      const sig = `${String(room.type).toLowerCase()} ${String(room.name || '').toLowerCase()}`;
      const isBathroom = room.type === 'bathroom' || sig.includes('bañ') || sig.includes('bano') || sig.includes('bath');
      if (!isBathroom) continue;

      const maxBathroomArea = isResidentialTypology ? 7.2 : 9;
      const minSide = 1.45;
      const currentArea = room.size.width * room.size.height;
      if (currentArea <= maxBathroomArea) continue;

      if (room.size.width >= room.size.height) {
        room.size.width = Math.max(minSide, maxBathroomArea / Math.max(room.size.height, minSide));
      } else {
        room.size.height = Math.max(minSide, maxBathroomArea / Math.max(room.size.width, minSide));
      }
    }

    // Blindaje final: ningun cuarto puede salirse del terreno.
    for (const room of otherRooms) {
      room.position.x = clamp(room.position.x, margin, maxX - 0.8);
      room.position.y = clamp(room.position.y, margin, maxY - 0.8);
      room.size.width = clamp(room.size.width, 0.8, maxX - room.position.x);
      room.size.height = clamp(room.size.height, 0.8, maxY - room.position.y);
      room.area = Math.round(room.size.width * room.size.height * 100) / 100;
    }

    // 4.5) Post-proceso unificado de conectividad lógica (pasillo + adyacencias obligatorias).
    const connectedRooms = [...otherRooms, ...circulationRooms];

    ensureHallwayRoom(connectedRooms, {
      x: margin,
      y: margin,
      width: usableSize,
      height: usableSize,
    }, ({ area, position, size }) => ({
      name: 'Pasillo Central',
      type: 'hallway' as const,
      area,
      position,
      size,
      doors: [],
      windows: [],
      features: ['Conectividad interna']
    }));

    enforceMandatoryAdjacencyRules(connectedRooms, {
      x: margin,
      y: margin,
      width: usableSize,
      height: usableSize,
    });

    adaptRoomsToSymmetricFootprint(connectedRooms, {
      x: margin,
      y: margin,
      width: usableSize,
      height: usableSize,
    }, {
      roomCount: connectedRooms.length,
      orientation,
    });

    enforceMandatoryAdjacencyRules(connectedRooms, {
      x: margin,
      y: margin,
      width: usableSize,
      height: usableSize,
    });

    otherRooms.length = 0;
    circulationRooms.length = 0;
    for (const room of connectedRooms) {
      if (room.type === 'hallway') {
        circulationRooms.push(room);
      } else {
        otherRooms.push(room);
      }
    }

    // 5) Puertas y ventanas detectadas desde backend (solo fachadas exteriores para ventanas).
    for (const room of [...otherRooms, ...circulationRooms]) {
      room.doors = [];
      room.windows = [];
    }

    const openingGeometry = (
      room: NLPStructuralData['rooms'][number],
      position: 'north' | 'south' | 'east' | 'west'
    ) => {
      const x1 = room.position.x;
      const y1 = room.position.y;
      const x2 = room.position.x + room.size.width;
      const y2 = room.position.y + room.size.height;

      if (position === 'north') {
        return { x: (x1 + x2) / 2, y: y1, angle: 0 };
      }
      if (position === 'south') {
        return { x: (x1 + x2) / 2, y: y2, angle: 0 };
      }
      if (position === 'east') {
        return { x: x2, y: (y1 + y2) / 2, angle: Math.PI / 2 };
      }
      return { x: x1, y: (y1 + y2) / 2, angle: Math.PI / 2 };
    };

    const makeDoor = (
      room: NLPStructuralData['rooms'][number],
      position: 'north' | 'south' | 'east' | 'west',
      width = 0.9
    ) => {
      const geom = openingGeometry(room, position);
      return { position, width, x: geom.x, y: geom.y, angle: geom.angle };
    };

    const makeWindow = (
      room: NLPStructuralData['rooms'][number],
      position: 'north' | 'south' | 'east' | 'west',
      width = 1.2,
      height = 1.1
    ) => {
      const geom = openingGeometry(room, position);
      return { position, width, height, x: geom.x, y: geom.y, angle: geom.angle };
    };

    const eps = 0.06;
    const corridorCenters = circulationRooms.map(room => ({
      room,
      x: room.position.x + room.size.width / 2,
      y: room.position.y + room.size.height / 2,
    }));

    const nearestCirculation = (room: (typeof otherRooms)[number]) => {
      const cx = room.position.x + room.size.width / 2;
      const cy = room.position.y + room.size.height / 2;
      return corridorCenters.reduce((best, current) => {
        const dBest = Math.hypot(best.x - cx, best.y - cy);
        const dCurrent = Math.hypot(current.x - cx, current.y - cy);
        return dCurrent < dBest ? current : best;
      }, corridorCenters[0]);
    };

    const sharedEdge = (
      a: (typeof otherRooms)[number],
      b: (typeof otherRooms)[number],
      tol = 0.06
    ): { sideA: 'north' | 'south' | 'east' | 'west'; sideB: 'north' | 'south' | 'east' | 'west'; overlap: number } | null => {
      const aLeft = a.position.x;
      const aRight = a.position.x + a.size.width;
      const aTop = a.position.y;
      const aBottom = a.position.y + a.size.height;
      const bLeft = b.position.x;
      const bRight = b.position.x + b.size.width;
      const bTop = b.position.y;
      const bBottom = b.position.y + b.size.height;

      const verticalOverlap = Math.max(0, Math.min(aBottom, bBottom) - Math.max(aTop, bTop));
      const horizontalOverlap = Math.max(0, Math.min(aRight, bRight) - Math.max(aLeft, bLeft));

      if (Math.abs(aRight - bLeft) <= tol && verticalOverlap > 0.45) {
        return { sideA: 'east', sideB: 'west', overlap: verticalOverlap };
      }
      if (Math.abs(aLeft - bRight) <= tol && verticalOverlap > 0.45) {
        return { sideA: 'west', sideB: 'east', overlap: verticalOverlap };
      }
      if (Math.abs(aBottom - bTop) <= tol && horizontalOverlap > 0.45) {
        return { sideA: 'south', sideB: 'north', overlap: horizontalOverlap };
      }
      if (Math.abs(aTop - bBottom) <= tol && horizontalOverlap > 0.45) {
        return { sideA: 'north', sideB: 'south', overlap: horizontalOverlap };
      }

      return null;
    };

    const getSharedNeighborDoorSide = (
      room: (typeof otherRooms)[number],
      candidates: (typeof otherRooms)
    ): ('north' | 'south' | 'east' | 'west') | null => {
      let best: { side: 'north' | 'south' | 'east' | 'west'; overlap: number } | null = null;
      for (const candidate of candidates) {
        if (candidate === room) continue;
        const edge = sharedEdge(room, candidate);
        if (!edge) continue;
        if (!best || edge.overlap > best.overlap) {
          best = { side: edge.sideA, overlap: edge.overlap };
        }
      }
      return best?.side || null;
    };

    const doorOrientationToCore = (room: (typeof otherRooms)[number]): 'north' | 'south' | 'east' | 'west' => {
      const centerX = room.position.x + room.size.width / 2;
      const centerY = room.position.y + room.size.height / 2;
      if (corridorCenters.length === 0) {
        const touchSide = getSharedNeighborDoorSide(room, otherRooms);
        if (touchSide) return touchSide;

        const planCenterX = margin + (usableSize / 2);
        const planCenterY = margin + (usableSize / 2);
        const dx = planCenterX - centerX;
        const dy = planCenterY - centerY;
        return Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'east' : 'west') : (dy > 0 ? 'south' : 'north');
      }

      const target = nearestCirculation(room);
      const tol = 0.08;

      const roomLeft = room.position.x;
      const roomRight = room.position.x + room.size.width;
      const roomTop = room.position.y;
      const roomBottom = room.position.y + room.size.height;

      const targetLeft = target.room.position.x;
      const targetRight = target.room.position.x + target.room.size.width;
      const targetTop = target.room.position.y;
      const targetBottom = target.room.position.y + target.room.size.height;

      const verticalOverlap = Math.max(0, Math.min(roomBottom, targetBottom) - Math.max(roomTop, targetTop));
      const horizontalOverlap = Math.max(0, Math.min(roomRight, targetRight) - Math.max(roomLeft, targetLeft));

      if (Math.abs(roomRight - targetLeft) <= tol && verticalOverlap > 0.45) return 'east';
      if (Math.abs(roomLeft - targetRight) <= tol && verticalOverlap > 0.45) return 'west';
      if (Math.abs(roomBottom - targetTop) <= tol && horizontalOverlap > 0.45) return 'south';
      if (Math.abs(roomTop - targetBottom) <= tol && horizontalOverlap > 0.45) return 'north';

      const coreCenterX = target.x;
      const coreCenterY = target.y;

      const dx = coreCenterX - centerX;
      const dy = coreCenterY - centerY;
      if (Math.abs(dx) > Math.abs(dy)) return dx > 0 ? 'east' : 'west';
      return dy > 0 ? 'south' : 'north';
    };

    const isLivingRoom = (room: (typeof otherRooms)[number]) => {
      const sig = `${String(room.type).toLowerCase()} ${String(room.name || '').toLowerCase()} ${String(room.features || []).toLowerCase()}`;
      return room.type === 'living_room' || sig.includes('sala') || sig.includes('estar') || sig.includes('living');
    };

    const isGarageRoom = (room: (typeof otherRooms)[number]) => {
      const sig = `${String(room.type).toLowerCase()} ${String(room.name || '').toLowerCase()} ${String(room.features || []).toLowerCase()}`;
      return room.type === 'garage' || sig.includes('garage') || sig.includes('cochera') || sig.includes('estacion');
    };

    for (const room of otherRooms) {
      const garage = isGarageRoom(room);

      room.doors.push(makeDoor(room, doorOrientationToCore(room), garage ? 1.0 : 0.9));

      // Ventanas solo si el lado toca fachada exterior y nunca en cochera.
      if (!garage) {
        if (room.position.y <= margin + eps) room.windows.push(makeWindow(room, 'north', 1.1));
        if (room.position.y + room.size.height >= maxY - eps) room.windows.push(makeWindow(room, 'south', 1.1));
        if (room.position.x <= margin + eps) room.windows.push(makeWindow(room, 'west', 1.1));
        if (room.position.x + room.size.width >= maxX - eps) room.windows.push(makeWindow(room, 'east', 1.1));
      }
    }

    // Puerta principal siempre en circulacion y sobre fachada exterior real.
    const exteriorSidesForRoom = (room: NLPStructuralData['rooms'][number]): Array<'north' | 'south' | 'east' | 'west'> => {
      const sides: Array<'north' | 'south' | 'east' | 'west'> = [];
      if (room.position.y <= margin + eps) sides.push('north');
      if (room.position.y + room.size.height >= maxY - eps) sides.push('south');
      if (room.position.x <= margin + eps) sides.push('west');
      if (room.position.x + room.size.width >= maxX - eps) sides.push('east');
      return sides;
    };

    const chooseMainDoorSide = (availableSides: Array<'north' | 'south' | 'east' | 'west'>): 'north' | 'south' | 'east' | 'west' => {
      const priority = this.getOrientationPriority(orientation);
      return priority.find(side => availableSides.includes(side)) || availableSides[0] || 'north';
    };

    const livingExteriorCandidates = otherRooms
      .filter(room => isLivingRoom(room))
      .map(room => {
        const sides = exteriorSidesForRoom(room);
        const preferredOrder = this.getOrientationPriority(orientation);
        const sideScore = sides.reduce((sum, side) => {
          const idx = preferredOrder.indexOf(side);
          const score = idx >= 0 ? (5 - idx) : 1;
          return sum + score;
        }, 0) + (sides.length * 0.5);
        return { room, sides, priority: sideScore + Math.min(room.area, 20) };
      })
      .filter(candidate => candidate.sides.length > 0)
      .sort((a, b) => b.priority - a.priority);

    let mainDoorOwner: NLPStructuralData['rooms'][number] | null = null;
    let mainDoorSide: 'north' | 'south' | 'east' | 'west' = 'north';
    if (livingExteriorCandidates.length > 0) {
      const selected = livingExteriorCandidates[0];
      const side = chooseMainDoorSide(selected.sides);
      selected.room.doors.push(makeDoor(selected.room, side, 1.3));
      mainDoorOwner = selected.room;
      mainDoorSide = side;
    }

    // Cochera: sin ventanas y con puerta vehicular al 80% de la arista exterior,
    // priorizando el mismo lado de fachada de la puerta principal.
    const garageExteriorConnections: NLPStructuralData['connections'] = [];
    for (const room of otherRooms) {
      if (!isGarageRoom(room)) continue;

      room.windows = [];
      const exteriorSides = exteriorSidesForRoom(room);
      if (exteriorSides.length === 0) continue;

      const garageDoorSide = exteriorSides.includes(mainDoorSide)
        ? mainDoorSide
        : (exteriorSides.includes('west') ? 'west' : exteriorSides[0]);

      const sideLength = (garageDoorSide === 'north' || garageDoorSide === 'south')
        ? room.size.width
        : room.size.height;

      const garageDoorWidth = Math.max(1.8, sideLength * 0.8);
      room.doors.push(makeDoor(room, garageDoorSide, garageDoorWidth));
      garageExteriorConnections.push({
        from: room.name,
        to: 'EXTERIOR',
        type: 'door',
        width: garageDoorWidth
      });
    }

    // Ventanas de circulacion solo en laterales exteriores cuando aplique.
    for (const circulationRoom of circulationRooms) {
      const blockedSides = new Set(
        circulationRoom.doors
          .filter(door => door.width >= 1.2)
          .map(door => door.position as 'north' | 'south' | 'east' | 'west')
      );

      if (circulationRoom.position.x <= margin + eps && !blockedSides.has('west')) circulationRoom.windows.push(makeWindow(circulationRoom, 'west', 1.0, 1.1));
      if (circulationRoom.position.x + circulationRoom.size.width >= maxX - eps && !blockedSides.has('east')) circulationRoom.windows.push(makeWindow(circulationRoom, 'east', 1.0, 1.1));
      if (circulationRoom.position.y <= margin + eps && !blockedSides.has('north')) circulationRoom.windows.push(makeWindow(circulationRoom, 'north', 1.0, 1.1));
      if (circulationRoom.position.y + circulationRoom.size.height >= maxY - eps && !blockedSides.has('south')) circulationRoom.windows.push(makeWindow(circulationRoom, 'south', 1.0, 1.1));
    }

    // Garantía: solo Sala y Garage pueden tener puertas en fachadas exteriores.
    for (const room of otherRooms) {
      const allowExteriorDoor = isLivingRoom(room) || isGarageRoom(room);
      if (allowExteriorDoor) continue;

      const exteriorSides = new Set(exteriorSidesForRoom(room));
      room.doors = room.doors.filter(door => !exteriorSides.has(door.position as 'north' | 'south' | 'east' | 'west'));
      if (room.doors.length === 0) {
        const interiorSide = (['west', 'east', 'north', 'south'] as Array<'west' | 'east' | 'north' | 'south'>)
          .find(side => !exteriorSides.has(side));
        room.doors.push(makeDoor(room, interiorSide || 'west', 0.9));
      }
    }

    // 6) Conexiones explícitas para trazado frontend.
    const connections: NLPStructuralData['connections'] = [];
    if (circulationRooms.length > 0) {
      for (const room of otherRooms) {
        const nearest = nearestCirculation(room);
        connections.push({
          from: room.name,
          to: nearest.room.name,
          type: 'door',
          width: 0.9
        });
      }
    } else {
      for (const room of otherRooms) {
        if (isLivingRoom(room) || isGarageRoom(room)) continue;
        const touchingTarget = otherRooms.find(candidate => {
          if (candidate === room) return false;
          return sharedEdge(room, candidate) !== null;
        });

        const fallbackTarget = touchingTarget
          || otherRooms.find(candidate => candidate !== room && (isLivingRoom(candidate) || isGarageRoom(candidate)))
          || otherRooms.find(candidate => candidate !== room);
        if (!fallbackTarget) continue;
        connections.push({
          from: room.name,
          to: fallbackTarget.name,
          type: 'door',
          width: 0.9
        });
      }
    }

    if (circulationRooms.length > 1) {
      for (let i = 1; i < circulationRooms.length; i++) {
        connections.push({
          from: circulationRooms[i].name,
          to: circulationRooms[0].name,
          type: 'door',
          width: 0.95
        });
      }
    }

    if (mainDoorOwner) {
      connections.push({
        from: mainDoorOwner.name,
        to: 'EXTERIOR',
        type: 'door',
        width: 1.3
      });
    }

    connections.push(...garageExteriorConnections);

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
      ...circulationRooms
    ];

    // Mantener area total como area de terreno solicitada por el usuario.
    data.metadata.totalArea = Math.round(squareSize * squareSize * 100) / 100;
    data.metadata.qualityAudit = {
      typology,
      profile,
      score: finalAudit.score,
      threshold: minScore,
      repairPassesApplied,
      findings: finalAudit.findings,
      status: finalAudit.score >= minScore ? 'pass' : 'needs_review'
    };

    console.log(`✅ Re-layout arquitectónico aplicado: ${data.rooms.length} habitaciones conectadas sin solapes`);
  }

  private static parseRequestedLotArea(description: string): number | null {
    if (!description) return null;

    const text = description.toLowerCase();
    const parseNumeric = (value: string) => Number(value.replace(',', '.'));

    const terrainFirstPatterns = [
      /(?:area|área)?\s*(?:de\s*)?(?:terreno|lote|lot)(?:\s*total)?\s*(?:de|:)?\s*(\d+(?:[\.,]\d+)?)\s*(?:m2|m²|mts2|metros\s*cuadrados?)?/i,
      /(?:terreno|lote|lot)(?:\s*total)?\s*(?:de|:)?\s*(\d+(?:[\.,]\d+)?)\s*(?:m2|m²|mts2|metros\s*cuadrados?)?/i,
      /(\d+(?:[\.,]\d+)?)\s*(?:m2|m²|mts2|metros\s*cuadrados?)\s*(?:de\s*)?(?:terreno|lote|lot)/i,
    ];

    for (const pattern of terrainFirstPatterns) {
      const match = text.match(pattern);
      if (!match) continue;
      const area = parseNumeric(match[1]);
      if (Number.isFinite(area) && area > 0) {
        return area;
      }
    }

    return null;
  }

  private static parseRequestedOrientation(description: string): Orientation | null {
    if (!description) return null;

    const text = description.toLowerCase();
    const rules: Array<{ dir: Orientation; patterns: RegExp[] }> = [
      {
        dir: 'north',
        patterns: [
          /(?:orientaci[oó]n|fachada|frente|principal|apunt(?:ar|ando)|hacia)\s*(?:al|a)?\s*norte/i,
          /north-facing|facing north/i,
        ]
      },
      {
        dir: 'south',
        patterns: [
          /(?:orientaci[oó]n|fachada|frente|principal|apunt(?:ar|ando)|hacia)\s*(?:al|a)?\s*sur/i,
          /south-facing|facing south/i,
        ]
      },
      {
        dir: 'east',
        patterns: [
          /(?:orientaci[oó]n|fachada|frente|principal|apunt(?:ar|ando)|hacia)\s*(?:al|a)?\s*este/i,
          /east-facing|facing east/i,
        ]
      },
      {
        dir: 'west',
        patterns: [
          /(?:orientaci[oó]n|fachada|frente|principal|apunt(?:ar|ando)|hacia)\s*(?:al|a)?\s*oeste/i,
          /west-facing|facing west/i,
        ]
      },
    ];

    for (const rule of rules) {
      if (rule.patterns.some(pattern => pattern.test(text))) {
        return rule.dir;
      }
    }

    return null;
  }

  private static getOrientationPriority(orientation: Orientation): Orientation[] {
    switch (orientation) {
      case 'south':
        return ['south', 'east', 'west', 'north'];
      case 'east':
        return ['east', 'north', 'south', 'west'];
      case 'west':
        return ['west', 'north', 'south', 'east'];
      case 'north':
      default:
        return ['north', 'west', 'east', 'south'];
    }
  }

  private static getFrontZoneCandidates(orientation: Orientation): ZoneKey[] {
    switch (orientation) {
      case 'south':
        return ['south', 'east'];
      case 'east':
        return ['east', 'north'];
      case 'west':
        return ['west', 'north'];
      case 'north':
      default:
        return ['north', 'west'];
    }
  }

  private static getPrivateZoneCandidates(orientation: Orientation): ZoneKey[] {
    const front = this.getFrontZoneCandidates(orientation);
    return (['north', 'south', 'east', 'west'] as ZoneKey[]).filter(zone => !front.includes(zone));
  }

  private static getExteriorEntryPlacement(
    orientation: Orientation,
    margin: number,
    usableSize: number,
    entryWidth: number,
    entryHeight: number
  ): { x: number; y: number } {
    const centerX = margin + ((usableSize - entryWidth) / 2);
    const centerY = margin + ((usableSize - entryHeight) / 2);
    const maxY = margin + usableSize;
    const maxX = margin + usableSize;

    switch (orientation) {
      case 'south':
        return { x: centerX, y: maxY - entryHeight };
      case 'east':
        return { x: maxX - entryWidth, y: centerY };
      case 'west':
        return { x: margin, y: centerY };
      case 'north':
      default:
        return { x: centerX, y: margin };
    }
  }

  private static getExteriorEntryBounds(
    orientation: Orientation,
    margin: number,
    maxX: number,
    maxY: number,
    roomWidth: number,
    roomHeight: number
  ): { minX: number; maxX: number; minY: number; maxY: number } {
    const edgeTol = 0.03;

    switch (orientation) {
      case 'south':
        return {
          minX: margin,
          maxX: Math.max(margin, maxX - roomWidth),
          minY: Math.max(margin, maxY - roomHeight - edgeTol),
          maxY: Math.max(margin, maxY - roomHeight + edgeTol),
        };
      case 'east':
        return {
          minX: Math.max(margin, maxX - roomWidth - edgeTol),
          maxX: Math.max(margin, maxX - roomWidth + edgeTol),
          minY: margin,
          maxY: Math.max(margin, maxY - roomHeight),
        };
      case 'west':
        return {
          minX: margin - edgeTol,
          maxX: margin + edgeTol,
          minY: margin,
          maxY: Math.max(margin, maxY - roomHeight),
        };
      case 'north':
      default:
        return {
          minX: margin,
          maxX: Math.max(margin, maxX - roomWidth),
          minY: margin - edgeTol,
          maxY: margin + edgeTol,
        };
    }
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
      roomSignature.includes('espera') || roomSignature.includes('venta') ||
      roomSignature.includes('showroom') || roomSignature.includes('aula')
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
      roomSignature.includes('storage') || roomSignature.includes('bodega') || roomSignature.includes('lavander') ||
      roomSignature.includes('mantenimiento') || roomSignature.includes('servicio')
    ) {
      return 'service';
    }

    return 'operations';
  }

  private static enforceProgramRules(
    rooms: NLPStructuralData['rooms'],
    typology: ProjectTypology,
    squareSize: number
  ): void {
    const signatureOf = (room: NLPStructuralData['rooms'][number]) =>
      `${String(room.type).toLowerCase()} ${String(room.name || '').toLowerCase()} ${String(room.features || []).toLowerCase()}`;

    const hasByPredicate = (predicate: (room: NLPStructuralData['rooms'][number]) => boolean) => rooms.some(predicate);
    const hasKitchen = () => hasByPredicate(room => room.type === 'kitchen' || signatureOf(room).includes('cocina') || signatureOf(room).includes('kitchen'));
    const hasDining = () => hasByPredicate(room => room.type === 'dining_room' || signatureOf(room).includes('comedor') || signatureOf(room).includes('dining'));
    const hasLiving = () => hasByPredicate(room => room.type === 'living_room' || signatureOf(room).includes('sala') || signatureOf(room).includes('estar') || signatureOf(room).includes('living'));
    const hasOffice = () => hasByPredicate(room => room.type === 'office' || signatureOf(room).includes('oficina') || signatureOf(room).includes('consultorio') || signatureOf(room).includes('aula'));
    const hasStorage = () => hasByPredicate(room => room.type === 'storage' || signatureOf(room).includes('bodega') || signatureOf(room).includes('storage'));
    const hasReception = () => hasByPredicate(room => room.type === 'living_room' && (signatureOf(room).includes('recep') || signatureOf(room).includes('lobby') || signatureOf(room).includes('acceso')));
    const hasMeetingRoom = () => hasByPredicate(room => room.type === 'office' && (signatureOf(room).includes('junta') || signatureOf(room).includes('meeting') || signatureOf(room).includes('conferencia')));
    const hasPantry = () => hasByPredicate(room => room.type === 'kitchen' && (signatureOf(room).includes('pantry') || signatureOf(room).includes('coffee') || signatureOf(room).includes('cafeter')));
    const hasLaundry = () => hasByPredicate(room => room.type === 'storage' && (signatureOf(room).includes('lavander') || signatureOf(room).includes('lavado')));
    const hasGarage = () => hasByPredicate(room => room.type === 'garage' || signatureOf(room).includes('garage') || signatureOf(room).includes('estacion'));
    const bathroomCount = () => rooms.filter(room => room.type === 'bathroom' || signatureOf(room).includes('bañ') || signatureOf(room).includes('bano') || signatureOf(room).includes('bath')).length;
    const bedroomCount = () => rooms.filter(room => room.type === 'bedroom' || signatureOf(room).includes('habit') || signatureOf(room).includes('bedroom')).length;
    const storageCount = () => rooms.filter(room => room.type === 'storage' || signatureOf(room).includes('bodega') || signatureOf(room).includes('storage')).length;

    const buildArea = Math.max(squareSize * squareSize, rooms.reduce((sum, room) => sum + Math.max(room.area, 3), 0));
    const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

    const createRoom = (
      name: string,
      type: NLPStructuralData['rooms'][number]['type'],
      ratio: number,
      minArea: number,
      maxArea: number,
      features: string[]
    ) => {
      const area = Math.round(clamp(buildArea * ratio, minArea, maxArea) * 100) / 100;
      const side = Math.max(1.8, Math.sqrt(area));
      rooms.push({
        name,
        type,
        area,
        position: { x: 0, y: 0 },
        size: { width: side, height: side },
        doors: [],
        windows: [],
        features,
      });
    };

    const ensureRoom = (
      exists: () => boolean,
      name: string,
      type: NLPStructuralData['rooms'][number]['type'],
      ratio: number,
      minArea: number,
      maxArea: number,
      features: string[]
    ) => {
      if (!exists()) {
        createRoom(name, type, ratio, minArea, maxArea, features);
      }
    };

    // Regla global: si hay cocina, debe haber comedor.
    ensureRoom(
      () => !hasKitchen() || hasDining(),
      'Comedor',
      'dining_room',
      0.08,
      7,
      18,
      ['Auto-generado: adyacente a cocina']
    );

    // Regla residencial: casa/departamento siempre con sala de estar.
    if (typology === 'house' || typology === 'apartment') {
      ensureRoom(
        hasLiving,
        'Sala de Estar',
        'living_room',
        0.1,
        9,
        24,
        ['Auto-generado: espacio social obligatorio']
      );
    }

    // Regla residencial: asegurar cocina base en vivienda si faltara.
    if (typology === 'house' || typology === 'apartment') {
      ensureRoom(
        hasKitchen,
        'Cocina',
        'kitchen',
        0.08,
        6.5,
        16,
        ['Auto-generado: servicio básico residencial']
      );

      // Casa/departamento: compatibilidad familiar y soporte diario.
      if (bedroomCount() >= 2) {
        ensureRoom(
          hasLaundry,
          'Lavandería',
          'storage',
          0.03,
          2.8,
          8,
          ['Auto-generado: soporte doméstico']
        );
      }

      if (typology === 'house' && buildArea >= 95) {
        ensureRoom(
          () => hasOffice() || hasStorage(),
          'Estudio',
          'office',
          0.06,
          6,
          14,
          ['Auto-generado: espacio flexible residencial']
        );
      }

      if (typology === 'house' && buildArea >= 120) {
        ensureRoom(
          hasGarage,
          'Garage',
          'garage',
          0.12,
          12,
          28,
          ['Auto-generado: estacionamiento residencial']
        );
      }

      // Banos residenciales por capacidad (1 cada 2 dormitorios, minimo 1).
      const requiredResidentialBathrooms = Math.max(1, Math.ceil(bedroomCount() / 2));
      while (bathroomCount() < requiredResidentialBathrooms) {
        createRoom(
          bathroomCount() === 0 ? 'Baño General' : `Baño ${bathroomCount() + 1}`,
          'bathroom',
          0.04,
          3.4,
          8.5,
          ['Auto-generado: dotación sanitaria residencial']
        );
      }
    }

    // Regla sanitaria minima: dormitorios requieren baños suficientes.
    const bedrooms = bedroomCount();
    const bathrooms = bathroomCount();
    if (bedrooms > 0 && bathrooms === 0) {
      createRoom('Baño General', 'bathroom', 0.05, 3.8, 9, ['Auto-generado: servicio sanitario mínimo']);
    }
    if (bedrooms >= 3 && bathroomCount() < 2) {
      createRoom('Baño Secundario', 'bathroom', 0.04, 3.4, 8, ['Auto-generado: soporte para múltiples dormitorios']);
    }

    // Programas de oficina/coworking: bano y apoyo logístico.
    if ((typology === 'office' || typology === 'coworking') && bathroomCount() === 0) {
      createRoom('Baño de Servicio', 'bathroom', 0.04, 3.5, 8, ['Auto-generado: norma sanitaria de oficina']);
    }
    if ((typology === 'office' || typology === 'coworking') && rooms.length >= 6 && storageCount() === 0) {
      createRoom('Almacen', 'storage', 0.03, 2.5, 7, ['Auto-generado: soporte operativo']);
    }

    if (typology === 'office' || typology === 'coworking') {
      ensureRoom(
        hasReception,
        'Recepción',
        'living_room',
        0.08,
        7,
        18,
        ['Auto-generado: control de acceso y bienvenida']
      );

      ensureRoom(
        hasMeetingRoom,
        'Sala de Juntas',
        'office',
        0.08,
        7,
        20,
        ['Auto-generado: coordinación operativa']
      );

      if (rooms.length >= 5) {
        ensureRoom(
          hasPantry,
          'Pantry',
          'kitchen',
          0.035,
          3.5,
          9,
          ['Auto-generado: apoyo para personal']
        );
      }

      const officeWorkRooms = rooms.filter(room => room.type === 'office').length;
      const requiredOfficeBathrooms = officeWorkRooms >= 3 || rooms.length >= 8 ? 2 : 1;
      while (bathroomCount() < requiredOfficeBathrooms) {
        createRoom(
          bathroomCount() === 0 ? 'Baño de Personal' : `Baño ${bathroomCount() + 1}`,
          'bathroom',
          0.03,
          3.2,
          8,
          ['Auto-generado: cumplimiento sanitario de oficina']
        );
      }
    }

    // Reglas por tipologia extendidas.
    if (typology === 'restaurant') {
      ensureRoom(hasKitchen, 'Cocina', 'kitchen', 0.12, 10, 26, ['Auto-generado: cocina obligatoria restaurante']);
      ensureRoom(hasDining, 'Comedor Principal', 'dining_room', 0.22, 16, 50, ['Auto-generado: área de comensales']);
      if (bathroomCount() < 1) {
        createRoom('Baño Clientes', 'bathroom', 0.04, 4, 10, ['Auto-generado: norma sanitaria restaurante']);
      }
      if (storageCount() < 1) {
        createRoom('Despensa', 'storage', 0.04, 3, 9, ['Auto-generado: soporte de cocina']);
      }
    }

    if (typology === 'retail') {
      ensureRoom(hasLiving, 'Área de Venta', 'living_room', 0.24, 16, 60, ['Auto-generado: área comercial principal']);
      if (bathroomCount() < 1) {
        createRoom('Baño de Servicio', 'bathroom', 0.035, 3.5, 8, ['Auto-generado: norma sanitaria retail']);
      }
      if (storageCount() < 1) {
        createRoom('Bodega', 'storage', 0.05, 4, 14, ['Auto-generado: inventario y apoyo']);
      }
    }

    if (typology === 'healthcare') {
      ensureRoom(hasLiving, 'Sala de Espera', 'living_room', 0.12, 10, 24, ['Auto-generado: recepción y espera']);
      ensureRoom(hasOffice, 'Consultorio', 'office', 0.09, 8, 18, ['Auto-generado: atención clínica']);
      if (bathroomCount() < 1) {
        createRoom('Baño Pacientes', 'bathroom', 0.04, 4, 9, ['Auto-generado: norma sanitaria clínica']);
      }
      if (rooms.filter(room => room.type === 'office').length >= 2 && bathroomCount() < 2) {
        createRoom('Baño de Personal', 'bathroom', 0.03, 3.2, 8, ['Auto-generado: soporte clínico']);
      }
    }

    if (typology === 'education') {
      ensureRoom(hasOffice, 'Aula Principal', 'office', 0.16, 12, 36, ['Auto-generado: espacio académico']);
      ensureRoom(hasLiving, 'Área Común', 'living_room', 0.1, 8, 22, ['Auto-generado: encuentro estudiantil']);
      if (bathroomCount() < 1) {
        createRoom('Baño Estudiantes', 'bathroom', 0.04, 4, 10, ['Auto-generado: norma sanitaria educativa']);
      }
    }

    if (typology === 'hospitality') {
      if (bedroomCount() < 1) {
        createRoom('Suite', 'bedroom', 0.14, 11, 28, ['Auto-generado: unidad de hospedaje']);
      }
      ensureRoom(hasLiving, 'Lobby', 'living_room', 0.1, 8, 22, ['Auto-generado: recepción hotelera']);
      if (bathroomCount() < bedroomCount()) {
        createRoom('Baño de Suite', 'bathroom', 0.04, 3.5, 9, ['Auto-generado: soporte de hospedaje']);
      }
    }

    if (typology === 'industrial' || typology === 'warehouse') {
      ensureRoom(hasStorage, 'Almacen Principal', 'storage', 0.22, 20, 80, ['Auto-generado: núcleo logístico']);
      ensureRoom(hasOffice, 'Oficina Operativa', 'office', 0.06, 6, 14, ['Auto-generado: control operativo']);
      if (bathroomCount() < 1) {
        createRoom('Baño de Personal', 'bathroom', 0.03, 3.2, 8, ['Auto-generado: norma sanitaria industrial']);
      }
    }

    if (typology === 'mixed_use') {
      ensureRoom(hasLiving, 'Área Social', 'living_room', 0.12, 10, 24, ['Auto-generado: componente público mixto']);
      ensureRoom(hasOffice, 'Área de Trabajo', 'office', 0.08, 7, 18, ['Auto-generado: componente productivo mixto']);
      if (hasKitchen() && !hasDining()) {
        createRoom('Comedor Mixto', 'dining_room', 0.07, 6.5, 16, ['Auto-generado: soporte cocina en uso mixto']);
      }
    }
  }

  private static getAllocationProfileByTypology(
    typology: ProjectTypology,
    profile: TypologyProfile
  ): Record<'public' | 'private' | 'service' | 'operations', number> {
    const base: Record<ProjectTypology, Record<'public' | 'private' | 'service' | 'operations', number>> = {
      house: { public: 0.3, private: 0.38, service: 0.2, operations: 0.12 },
      apartment: { public: 0.32, private: 0.34, service: 0.22, operations: 0.12 },
      office: { public: 0.2, private: 0.18, service: 0.16, operations: 0.46 },
      coworking: { public: 0.26, private: 0.14, service: 0.14, operations: 0.46 },
      retail: { public: 0.44, private: 0.06, service: 0.18, operations: 0.32 },
      restaurant: { public: 0.42, private: 0.06, service: 0.32, operations: 0.2 },
      healthcare: { public: 0.16, private: 0.28, service: 0.2, operations: 0.36 },
      education: { public: 0.18, private: 0.08, service: 0.16, operations: 0.58 },
      hospitality: { public: 0.18, private: 0.46, service: 0.14, operations: 0.22 },
      industrial: { public: 0.08, private: 0.06, service: 0.12, operations: 0.74 },
      warehouse: { public: 0.06, private: 0.04, service: 0.12, operations: 0.78 },
      mixed_use: { public: 0.3, private: 0.24, service: 0.18, operations: 0.28 },
      cultural: { public: 0.38, private: 0.08, service: 0.18, operations: 0.36 },
      sports: { public: 0.28, private: 0.08, service: 0.2, operations: 0.44 },
      public_service: { public: 0.28, private: 0.08, service: 0.18, operations: 0.46 },
      default: { public: 0.3, private: 0.3, service: 0.18, operations: 0.22 },
    };

    const result = { ...base[typology] };
    const apply = (updates: Partial<Record<'public' | 'private' | 'service' | 'operations', number>>) => {
      for (const [key, value] of Object.entries(updates)) {
        if (typeof value === 'number') {
          result[key as 'public' | 'private' | 'service' | 'operations'] = value;
        }
      }
    };

    if (profile === 'compact_residential') apply({ public: 0.28, private: 0.34, service: 0.24, operations: 0.14 });
    if (profile === 'open_social_home') apply({ public: 0.42, private: 0.3, service: 0.16, operations: 0.12 });
    if (profile === 'open_office') apply({ public: 0.24, private: 0.12, service: 0.14, operations: 0.5 });
    if (profile === 'clinic_flow') apply({ public: 0.2, private: 0.28, service: 0.2, operations: 0.32 });
    if (profile === 'school_cluster') apply({ public: 0.16, private: 0.08, service: 0.14, operations: 0.62 });
    if (profile === 'restaurant_central_kitchen') apply({ public: 0.36, private: 0.04, service: 0.4, operations: 0.2 });
    if (profile === 'hotel_corridor') apply({ public: 0.16, private: 0.5, service: 0.14, operations: 0.2 });
    if (profile === 'warehouse_linear') apply({ public: 0.05, private: 0.03, service: 0.12, operations: 0.8 });
    if (profile === 'mixed_urban') apply({ public: 0.34, private: 0.2, service: 0.18, operations: 0.28 });

    const total = Object.values(result).reduce((sum, value) => sum + value, 0) || 1;
    return {
      public: result.public / total,
      private: result.private / total,
      service: result.service / total,
      operations: result.operations / total,
    };
  }

  private static getRoomWeight(
    room: NLPStructuralData['rooms'][number],
    typology: ProjectTypology,
    profile: TypologyProfile
  ): number {
    const signature = `${String(room.type).toLowerCase()} ${String(room.name || '').toLowerCase()} ${String(room.features || []).toLowerCase()}`;
    const inputAreaHint = Math.max(0.65, Math.min(1.85, Math.sqrt(Math.max(room.area, 4)) / 3.5));

    let baseByType: Record<NLPStructuralData['rooms'][number]['type'], number> = {
      bedroom: 1.05,
      bathroom: 0.6,
      kitchen: 0.95,
      living_room: 1.2,
      dining_room: 0.95,
      office: 0.9,
      storage: 0.5,
      garage: 1.1,
      hallway: 0.7,
    };

    if (typology === 'office' || typology === 'coworking') {
      baseByType = { ...baseByType, office: 1.2, living_room: 1.0, bedroom: 0.65, garage: 0.8 };
    }
    if (typology === 'healthcare') {
      baseByType = { ...baseByType, office: 1.1, bathroom: 0.85, storage: 0.7 };
    }

    let weight = baseByType[room.type] || 1;
    if (signature.includes('principal') || signature.includes('master') || signature.includes('main')) weight *= 1.2;
    if (signature.includes('acceso') || signature.includes('entrada') || signature.includes('lobby') || signature.includes('recep')) weight *= 1.18;
    if (signature.includes('lavado') || signature.includes('lavander') || signature.includes('closet')) weight *= 0.85;

    if (profile === 'open_social_home' && (room.type === 'living_room' || room.type === 'dining_room' || room.type === 'kitchen')) {
      weight *= 1.15;
    }
    if (profile === 'compact_residential' && room.type === 'storage') {
      weight *= 0.8;
    }

    return Math.max(0.35, weight * inputAreaHint);
  }

  private static getRoomAreaBounds(room: NLPStructuralData['rooms'][number]): { minArea: number; maxShare: number } {
    const signature = `${String(room.type).toLowerCase()} ${String(room.name || '').toLowerCase()} ${String(room.features || []).toLowerCase()}`;

    const defaults: Record<NLPStructuralData['rooms'][number]['type'], { minArea: number; maxShare: number }> = {
      bedroom: { minArea: 7.8, maxShare: 0.32 },
      bathroom: { minArea: 3.2, maxShare: 0.07 },
      kitchen: { minArea: 6.2, maxShare: 0.22 },
      living_room: { minArea: 10, maxShare: 0.38 },
      dining_room: { minArea: 7, maxShare: 0.25 },
      office: { minArea: 6.2, maxShare: 0.25 },
      storage: { minArea: 2.2, maxShare: 0.1 },
      garage: { minArea: 11, maxShare: 0.28 },
      hallway: { minArea: 4, maxShare: 0.16 },
    };

    const bounds = { ...defaults[room.type] };
    if (signature.includes('principal') || signature.includes('master')) {
      bounds.minArea = Math.max(bounds.minArea, 10);
      bounds.maxShare = Math.max(bounds.maxShare, 0.34);
    }

    return bounds;
  }

  private static rebalanceRoomAreasByPercentages(
    rooms: NLPStructuralData['rooms'],
    totalBudget: number,
    typology: ProjectTypology,
    profile: TypologyProfile
  ): void {
    if (rooms.length === 0 || totalBudget <= 0) return;

    const tags: Array<'public' | 'private' | 'service' | 'operations'> = ['public', 'private', 'service', 'operations'];
    const roomsByTag: Record<'public' | 'private' | 'service' | 'operations', NLPStructuralData['rooms']> = {
      public: [],
      private: [],
      service: [],
      operations: [],
    };

    for (const room of rooms) {
      const signature = `${String(room.type).toLowerCase()} ${String(room.name || '').toLowerCase()} ${String(room.features || []).toLowerCase()}`;
      const tag = this.inferFunctionalTag(signature);
      roomsByTag[tag].push(room);
    }

    const allocation = this.getAllocationProfileByTypology(typology, profile);
    const activeTags = tags.filter(tag => roomsByTag[tag].length > 0);
    const activeSum = activeTags.reduce((sum, tag) => sum + allocation[tag], 0) || 1;

    const targetByTag: Record<'public' | 'private' | 'service' | 'operations', number> = {
      public: 0,
      private: 0,
      service: 0,
      operations: 0,
    };

    for (const tag of activeTags) {
      targetByTag[tag] = totalBudget * (allocation[tag] / activeSum);
    }

    const assignedArea = new Map<NLPStructuralData['rooms'][number], number>();
    for (const tag of activeTags) {
      const list = roomsByTag[tag];
      const weights = list.map(room => this.getRoomWeight(room, typology, profile));
      const weightSum = weights.reduce((sum, value) => sum + value, 0) || 1;
      list.forEach((room, index) => {
        assignedArea.set(room, targetByTag[tag] * (weights[index] / weightSum));
      });
    }

    const bounds = rooms.map(room => this.getRoomAreaBounds(room));
    const mins = bounds.map((value) => value.minArea);
    const maxs = bounds.map((value) => Math.max(value.minArea, totalBudget * value.maxShare));
    const weights = rooms.map(room => this.getRoomWeight(room, typology, profile));

    const minSum = mins.reduce((sum, value) => sum + value, 0);
    if (minSum >= totalBudget * 0.98) {
      const factor = totalBudget / Math.max(minSum, 0.01);
      rooms.forEach((room, index) => {
        const area = Math.max(2.2, mins[index] * factor);
        room.area = Math.round(area * 100) / 100;
      });
      return;
    }

    const current = rooms.map((room, index) => {
      const proposed = assignedArea.get(room) ?? room.area;
      return Math.max(mins[index], Math.min(maxs[index], proposed));
    });

    let currentSum = current.reduce((sum, value) => sum + value, 0);
    const tolerance = 0.01;

    if (currentSum > totalBudget + tolerance) {
      let overflow = currentSum - totalBudget;
      let guard = 0;
      while (overflow > tolerance && guard < 8) {
        const reducible = current
          .map((value, index) => ({ index, room: value - mins[index] }))
          .filter(item => item.room > tolerance);
        const reducibleSum = reducible.reduce((sum, item) => sum + item.room, 0);
        if (reducibleSum <= tolerance) break;

        for (const item of reducible) {
          const take = overflow * (item.room / reducibleSum);
          current[item.index] = Math.max(mins[item.index], current[item.index] - take);
        }

        currentSum = current.reduce((sum, value) => sum + value, 0);
        overflow = currentSum - totalBudget;
        guard += 1;
      }
    } else if (currentSum < totalBudget - tolerance) {
      let remaining = totalBudget - currentSum;
      let guard = 0;
      while (remaining > tolerance && guard < 8) {
        const expandable = current
          .map((value, index) => ({ index, room: maxs[index] - value, weight: weights[index] }))
          .filter(item => item.room > tolerance);
        const expandableWeight = expandable.reduce((sum, item) => sum + (item.weight * item.room), 0);
        if (expandableWeight <= tolerance) break;

        for (const item of expandable) {
          const gain = remaining * ((item.weight * item.room) / expandableWeight);
          current[item.index] = Math.min(maxs[item.index], current[item.index] + gain);
        }

        currentSum = current.reduce((sum, value) => sum + value, 0);
        remaining = totalBudget - currentSum;
        guard += 1;
      }
    }

    rooms.forEach((room, index) => {
      room.area = Math.round(Math.max(2.2, current[index]) * 100) / 100;
    });
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