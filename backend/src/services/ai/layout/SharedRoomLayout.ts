import { SpacePartitioner } from '../../../utils/SpacePartitioner';

export interface RoomRectLike {
  name: string;
  type: string;
  area: number;
  position: { x: number; y: number };
  size: { width: number; height: number };
  placement?: string;
}

export interface LayoutBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

export type FootprintShape = 'square' | 'rectangle' | 'l_shape';

interface SymmetryOptions {
  roomCount?: number;
  shape?: FootprintShape;
  orientation?: 'north' | 'south' | 'east' | 'west';
}

interface PartitionOptions<T extends RoomRectLike> {
  weight?: (room: T) => number;
  placement?: (room: T) => string | undefined;
}

const MIN_SIDE = 0.8;

export function partitionRoomsInBounds<T extends RoomRectLike>(
  rooms: T[],
  bounds: LayoutBounds,
  options?: PartitionOptions<T>,
): T[] {
  if (!(Number.isFinite(bounds.width) && bounds.width > 0 && Number.isFinite(bounds.height) && bounds.height > 0)) {
    return rooms;
  }

  const keyed = rooms.map((room, index) => ({
    room,
    key: `${room.name}__idx_${index}`,
  }));

  const partitionInput = keyed.map(({ room, key }) => ({
    name: key,
    type: room.type,
    weight: Math.max(1, options?.weight ? options.weight(room) : room.area),
    placement: options?.placement ? options.placement(room) : room.placement,
  }));

  const partitioned = SpacePartitioner.generateLayout(partitionInput, bounds.width, bounds.height);
  const byKey = new Map(partitioned.map((entry) => [entry.name, entry] as const));

  for (const { room, key } of keyed) {
    const next = byKey.get(key);
    if (!(next?.position && next?.size)) {
      continue;
    }

    room.position.x = clean(bounds.x + next.position.x);
    room.position.y = clean(bounds.y + next.position.y);
    room.size.width = clean(Math.max(MIN_SIDE, next.size.width));
    room.size.height = clean(Math.max(MIN_SIDE, next.size.height));
    room.area = clean(room.size.width * room.size.height);
  }

  clampRoomsToBounds(rooms, bounds);
  return rooms;
}

export function ensureHallwayRoom<T extends RoomRectLike>(
  rooms: T[],
  bounds: LayoutBounds,
  createHallway: (seed: {
    area: number;
    position: { x: number; y: number };
    size: { width: number; height: number };
  }) => T,
): T[] {
  const hasHallway = rooms.some((room) => isHallway(room));
  if (hasHallway) {
    return rooms;
  }

  const donorCandidates = rooms
    .filter((room) => !isBathroom(room) && !isStorage(room))
    .sort((a, b) => b.area - a.area);

  const donor = donorCandidates[0];
  if (!donor) {
    return rooms;
  }

  const longHorizontal = donor.size.width >= donor.size.height;
  const hallwayThickness = longHorizontal
    ? clamp(donor.size.width * 0.24, 1.1, 1.6)
    : clamp(donor.size.height * 0.24, 1.1, 1.6);

  if (longHorizontal && donor.size.width - hallwayThickness < 1.4) {
    return rooms;
  }
  if (!longHorizontal && donor.size.height - hallwayThickness < 1.4) {
    return rooms;
  }

  const hallwaySeed = longHorizontal
    ? {
        position: {
          x: donor.position.x + donor.size.width - hallwayThickness,
          y: donor.position.y,
        },
        size: {
          width: hallwayThickness,
          height: donor.size.height,
        },
      }
    : {
        position: {
          x: donor.position.x,
          y: donor.position.y + donor.size.height - hallwayThickness,
        },
        size: {
          width: donor.size.width,
          height: hallwayThickness,
        },
      };

  if (longHorizontal) {
    donor.size.width = clean(donor.size.width - hallwayThickness);
  } else {
    donor.size.height = clean(donor.size.height - hallwayThickness);
  }
  donor.area = clean(donor.size.width * donor.size.height);

  const hallway = createHallway({
    area: clean(hallwaySeed.size.width * hallwaySeed.size.height),
    position: {
      x: clean(hallwaySeed.position.x),
      y: clean(hallwaySeed.position.y),
    },
    size: {
      width: clean(hallwaySeed.size.width),
      height: clean(hallwaySeed.size.height),
    },
  });

  rooms.push(hallway);
  clampRoomsToBounds(rooms, bounds);
  return rooms;
}

export function enforceMandatoryAdjacencyRules<T extends RoomRectLike>(
  rooms: T[],
  bounds: LayoutBounds,
): T[] {
  const kitchens = rooms.filter((room) => isKitchen(room));
  const diningRooms = rooms.filter((room) => isDining(room));
  const bathrooms = rooms.filter((room) => isBathroom(room));
  const bedrooms = rooms.filter((room) => isBedroom(room));

  if (kitchens.length > 0) {
    for (const dining of diningRooms) {
      if (!isAdjacentToAny(dining, kitchens)) {
        tryMoveNearAnchor(dining, kitchens[0], rooms, bounds);
      }
    }
  }

  if (bedrooms.length > 0) {
    for (const bathroom of bathrooms) {
      if (!isAdjacentToAny(bathroom, bedrooms)) {
        tryMoveNearAnchor(bathroom, bedrooms[0], rooms, bounds);
      }
    }
  }

  clampRoomsToBounds(rooms, bounds);
  return rooms;
}

export function adaptRoomsToSymmetricFootprint<T extends RoomRectLike>(
  rooms: T[],
  bounds: LayoutBounds,
  options?: SymmetryOptions,
): T[] {
  if (rooms.length === 0) {
    return rooms;
  }

  const shape = options?.shape || inferFootprintShape(rooms, bounds, options);
  const orientation = options?.orientation || 'north';

  if (shape === 'square') {
    partitionRoomsInBounds(rooms, bounds, {
      weight: (room) => Math.max(room.area, 1),
      placement: (room) => room.placement,
    });
    return rooms;
  }

  if (shape === 'rectangle') {
    const target = getCenteredRectangle(bounds, orientation);
    partitionRoomsInBounds(rooms, target, {
      weight: (room) => Math.max(room.area, 1),
      placement: (room) => room.placement,
    });
    clampRoomsToBounds(rooms, target);
    return rooms;
  }

  applyLShapePartition(rooms, bounds, orientation);
  return rooms;
}

function inferFootprintShape<T extends RoomRectLike>(
  rooms: T[],
  bounds: LayoutBounds,
  options?: SymmetryOptions,
): FootprintShape {
  const roomCount = Math.max(1, options?.roomCount ?? rooms.length);
  const footprintArea = Math.max(bounds.width * bounds.height, 0.01);
  const totalArea = rooms.reduce((sum, room) => sum + Math.max(room.area, 0.1), 0);
  const density = totalArea / footprintArea;
  const densityNorm = clamp((density - 0.45) / 0.5, 0, 1);
  const countNorm = clamp((roomCount - 4) / 12, 0, 1);

  const socialRooms = rooms.filter((room) => isKitchen(room) || isDining(room) || isSocial(room)).length;
  const privateRooms = rooms.filter((room) => isBedroom(room) || isBathroom(room)).length;
  const serviceRooms = rooms.filter((room) => isStorage(room) || isHallway(room) || isService(room)).length;
  const activeGroups = [socialRooms > 0, privateRooms > 0, serviceRooms > 0].filter(Boolean).length;
  const diversityNorm = clamp((activeGroups - 1) / 2, 0, 1);

  const roomAspectValues = rooms.map((room) => {
    const width = Math.max(room.size.width, 0.1);
    const height = Math.max(room.size.height, 0.1);
    return Math.max(width, height) / Math.min(width, height);
  });
  const avgAspect = average(roomAspectValues);
  const elongatedNorm = clamp((avgAspect - 1.2) / 1.4, 0, 1);

  const squareScore =
    (1 - countNorm) * 0.38 +
    densityNorm * 0.34 +
    (1 - elongatedNorm) * 0.18 +
    (1 - diversityNorm) * 0.1;

  const rectangleScore =
    elongatedNorm * 0.42 +
    densityNorm * 0.22 +
    (1 - Math.abs(0.65 - densityNorm)) * 0.2 +
    countNorm * 0.16;

  const lShapeScore =
    countNorm * 0.42 +
    diversityNorm * 0.3 +
    (1 - densityNorm) * 0.2 +
    (socialRooms > 0 && privateRooms > 0 ? 0.08 : 0);

  const candidates: Array<{ shape: FootprintShape; score: number }> = [
    { shape: 'square' as FootprintShape, score: squareScore },
    { shape: 'rectangle' as FootprintShape, score: rectangleScore },
    { shape: 'l_shape' as FootprintShape, score: lShapeScore },
  ].sort((a, b) => b.score - a.score);

  const selected = candidates[0].shape;

  // Fallbacks de seguridad para no forzar huellas inviables.
  if (selected === 'l_shape') {
    const hasEnoughRooms = roomCount >= 8;
    const hasEnoughVoidTolerance = density <= 0.9;
    if (!(hasEnoughRooms && hasEnoughVoidTolerance)) {
      return elongatedNorm > 0.52 ? 'rectangle' : 'square';
    }
  }

  return selected;
}

function getCenteredRectangle(
  bounds: LayoutBounds,
  orientation: 'north' | 'south' | 'east' | 'west',
): LayoutBounds {
  const longHorizontal = orientation === 'north' || orientation === 'south';
  const widthFactor = longHorizontal ? 0.94 : 0.76;
  const heightFactor = longHorizontal ? 0.76 : 0.94;
  const width = clean(bounds.width * widthFactor);
  const height = clean(bounds.height * heightFactor);

  return {
    x: clean(bounds.x + (bounds.width - width) / 2),
    y: clean(bounds.y + (bounds.height - height) / 2),
    width,
    height,
  };
}

function applyLShapePartition<T extends RoomRectLike>(
  rooms: T[],
  bounds: LayoutBounds,
  orientation: 'north' | 'south' | 'east' | 'west',
) {
  const lBounds = getLShapeBounds(bounds, orientation);
  const totalArea = rooms.reduce((sum, room) => sum + Math.max(room.area, 1), 0);
  const firstCapacity = lBounds.first.width * lBounds.first.height;
  const secondCapacity = lBounds.second.width * lBounds.second.height;
  const firstTarget = totalArea * (firstCapacity / Math.max(firstCapacity + secondCapacity, 0.01));

  const sorted = [...rooms].sort((a, b) => {
    const aHall = isHallway(a) ? 1 : 0;
    const bHall = isHallway(b) ? 1 : 0;
    if (aHall !== bHall) return bHall - aHall;
    return b.area - a.area;
  });

  const first: T[] = [];
  const second: T[] = [];
  let firstLoad = 0;

  for (const room of sorted) {
    const preferFirst = firstLoad < firstTarget || isHallway(room) || isKitchen(room) || isDining(room);
    if (preferFirst) {
      first.push(room);
      firstLoad += Math.max(room.area, 1);
    } else {
      second.push(room);
    }
  }

  if (first.length === 0 && second.length > 0) {
    first.push(second.shift() as T);
  }
  if (second.length === 0 && first.length > 1) {
    second.push(first.pop() as T);
  }

  partitionRoomsInBounds(first, lBounds.first, {
    weight: (room) => Math.max(room.area, 1),
    placement: (room) => room.placement,
  });
  partitionRoomsInBounds(second, lBounds.second, {
    weight: (room) => Math.max(room.area, 1),
    placement: (room) => room.placement,
  });

  clampRoomsToBounds(rooms, bounds);
}

function getLShapeBounds(
  bounds: LayoutBounds,
  orientation: 'north' | 'south' | 'east' | 'west',
): { first: LayoutBounds; second: LayoutBounds } {
  const firstWidth = clean(bounds.width * 0.48);
  const secondHeight = clean(bounds.height * 0.44);

  if (orientation === 'north') {
    return {
      first: {
        x: bounds.x,
        y: bounds.y,
        width: firstWidth,
        height: bounds.height,
      },
      second: {
        x: bounds.x + firstWidth,
        y: bounds.y + bounds.height - secondHeight,
        width: bounds.width - firstWidth,
        height: secondHeight,
      },
    };
  }

  if (orientation === 'south') {
    return {
      first: {
        x: bounds.x,
        y: bounds.y,
        width: firstWidth,
        height: bounds.height,
      },
      second: {
        x: bounds.x + firstWidth,
        y: bounds.y,
        width: bounds.width - firstWidth,
        height: secondHeight,
      },
    };
  }

  if (orientation === 'west') {
    const firstHeight = clean(bounds.height * 0.48);
    return {
      first: {
        x: bounds.x,
        y: bounds.y,
        width: bounds.width,
        height: firstHeight,
      },
      second: {
        x: bounds.x,
        y: bounds.y + firstHeight,
        width: clean(bounds.width * 0.44),
        height: bounds.height - firstHeight,
      },
    };
  }

  const firstHeight = clean(bounds.height * 0.48);
  return {
    first: {
      x: bounds.x,
      y: bounds.y,
      width: bounds.width,
      height: firstHeight,
    },
    second: {
      x: bounds.x + bounds.width - clean(bounds.width * 0.44),
      y: bounds.y + firstHeight,
      width: clean(bounds.width * 0.44),
      height: bounds.height - firstHeight,
    },
  };
}

function tryMoveNearAnchor<T extends RoomRectLike>(
  room: T,
  anchor: T,
  rooms: T[],
  bounds: LayoutBounds,
) {
  const gap = 0.02;

  const candidates = [
    {
      x: anchor.position.x + anchor.size.width + gap,
      y: anchor.position.y,
    },
    {
      x: anchor.position.x - room.size.width - gap,
      y: anchor.position.y,
    },
    {
      x: anchor.position.x,
      y: anchor.position.y + anchor.size.height + gap,
    },
    {
      x: anchor.position.x,
      y: anchor.position.y - room.size.height - gap,
    },
  ].map((point) => ({
    x: clamp(point.x, bounds.x, bounds.x + bounds.width - room.size.width),
    y: clamp(point.y, bounds.y, bounds.y + bounds.height - room.size.height),
  }));

  const others = rooms.filter((candidate) => candidate !== room);

  for (const candidate of candidates) {
    const moved = {
      position: { x: candidate.x, y: candidate.y },
      size: room.size,
    };

    const overlaps = others.some((other) =>
      overlapsStrict(moved.position.x, moved.position.y, moved.size.width, moved.size.height, other),
    );

    if (!overlaps) {
      room.position.x = clean(candidate.x);
      room.position.y = clean(candidate.y);
      return;
    }
  }
}

function isAdjacentToAny<T extends RoomRectLike>(room: T, targets: T[]): boolean {
  return targets.some((target) => areAdjacent(room, target));
}

function areAdjacent<T extends RoomRectLike>(a: T, b: T, tolerance = 0.16): boolean {
  const aLeft = a.position.x;
  const aRight = a.position.x + a.size.width;
  const aTop = a.position.y;
  const aBottom = a.position.y + a.size.height;

  const bLeft = b.position.x;
  const bRight = b.position.x + b.size.width;
  const bTop = b.position.y;
  const bBottom = b.position.y + b.size.height;

  const verticalOverlap = Math.min(aBottom, bBottom) - Math.max(aTop, bTop);
  const horizontalOverlap = Math.min(aRight, bRight) - Math.max(aLeft, bLeft);

  if (Math.abs(aRight - bLeft) <= tolerance || Math.abs(aLeft - bRight) <= tolerance) {
    return verticalOverlap > 0.6;
  }

  if (Math.abs(aBottom - bTop) <= tolerance || Math.abs(aTop - bBottom) <= tolerance) {
    return horizontalOverlap > 0.6;
  }

  return false;
}

function clampRoomsToBounds<T extends RoomRectLike>(rooms: T[], bounds: LayoutBounds) {
  for (const room of rooms) {
    room.position.x = clean(clamp(room.position.x, bounds.x, bounds.x + bounds.width - MIN_SIDE));
    room.position.y = clean(clamp(room.position.y, bounds.y, bounds.y + bounds.height - MIN_SIDE));

    room.size.width = clean(
      clamp(room.size.width, MIN_SIDE, bounds.x + bounds.width - room.position.x),
    );
    room.size.height = clean(
      clamp(room.size.height, MIN_SIDE, bounds.y + bounds.height - room.position.y),
    );

    room.area = clean(room.size.width * room.size.height);
  }
}

function overlapsStrict<T extends RoomRectLike>(
  x: number,
  y: number,
  width: number,
  height: number,
  other: T,
): boolean {
  const overlapX = Math.min(x + width, other.position.x + other.size.width) - Math.max(x, other.position.x);
  const overlapY = Math.min(y + height, other.position.y + other.size.height) - Math.max(y, other.position.y);
  return overlapX > 0.001 && overlapY > 0.001;
}

function isKitchen(room: RoomRectLike) {
  const signature = `${room.type.toLowerCase()} ${room.name.toLowerCase()}`;
  return room.type === 'kitchen' || signature.includes('cocina') || signature.includes('kitchen');
}

function isDining(room: RoomRectLike) {
  const signature = `${room.type.toLowerCase()} ${room.name.toLowerCase()}`;
  return room.type === 'dining_room' || signature.includes('comedor') || signature.includes('dining');
}

function isBathroom(room: RoomRectLike) {
  const signature = `${room.type.toLowerCase()} ${room.name.toLowerCase()}`;
  return room.type === 'bathroom' || signature.includes('bañ') || signature.includes('bano') || signature.includes('bath');
}

function isSocial(room: RoomRectLike) {
  const signature = `${room.type.toLowerCase()} ${room.name.toLowerCase()}`;
  return (
    room.type === 'living_room' ||
    signature.includes('sala') ||
    signature.includes('living') ||
    signature.includes('estar') ||
    signature.includes('recepcion') ||
    signature.includes('lobby')
  );
}

function isService(room: RoomRectLike) {
  const signature = `${room.type.toLowerCase()} ${room.name.toLowerCase()}`;
  return (
    signature.includes('lavander') ||
    signature.includes('service') ||
    signature.includes('oficina') ||
    signature.includes('office')
  );
}

function isBedroom(room: RoomRectLike) {
  const signature = `${room.type.toLowerCase()} ${room.name.toLowerCase()}`;
  return room.type === 'bedroom' || signature.includes('habit') || signature.includes('bedroom');
}

function isStorage(room: RoomRectLike) {
  const signature = `${room.type.toLowerCase()} ${room.name.toLowerCase()}`;
  return room.type === 'storage' || signature.includes('almacen') || signature.includes('bodega') || signature.includes('storage');
}

function isHallway(room: RoomRectLike) {
  const signature = `${room.type.toLowerCase()} ${room.name.toLowerCase()}`;
  return room.type === 'hallway' || signature.includes('pasillo') || signature.includes('circul');
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function clean(value: number) {
  return Number(value.toFixed(2));
}

function average(values: number[]): number {
  if (values.length === 0) {
    return 1;
  }
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}
