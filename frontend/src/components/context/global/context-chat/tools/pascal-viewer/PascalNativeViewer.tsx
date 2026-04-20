import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { Evaluator, Brush, SUBTRACTION } from 'three-bvh-csg';

interface PascalNativeViewerProps {
  pascalData: any;
}

interface RealOpening {
  x: number;
  y: number;
  width: number;
  height: number;
  elevation: number;
  angle: number;
  isWindow: boolean;
  isInteriorDoor?: boolean;
  roomName?: string;
  side?: 'north' | 'south' | 'east' | 'west';
}

interface ResolvedWallOpening {
  x: number;
  y: number;
  width: number;
  height: number;
  elevation: number;
  angle: number;
  isWindow: boolean;
  isInteriorDoor?: boolean;
}

interface WallSegment {
  id: string;
  start: { x: number; y: number };
  end: { x: number; y: number };
  length: number;
  angle: number;
  rooms: string[];
}

const PascalNativeViewer: React.FC<PascalNativeViewerProps> = ({ pascalData }) => {
  const mountRef = useRef<HTMLDivElement>(null);
  const [processedData, setProcessedData] = useState<any>(null);

  // ---------------------------------------------------------
  // PASO 1: CEREBRO MATEMÁTICO (DEDUPLICACIÓN DE MUROS)
  // ---------------------------------------------------------
  useEffect(() => {
    if (!pascalData || !pascalData.rooms) return;

    const nodesMap: Record<string, any> = {};
    const walls: any[] = [];
    
    const clean = (val: number) => Math.round(val * 100) / 100;
    
    const addNode = (x: number, y: number) => {
      const id = `n_${clean(x)}_${clean(y)}`;
      if (!nodesMap[id]) nodesMap[id] = { id, x: clean(x), y: clean(y) };
      return id;
    };

    // Agregar muro SOLO si no existe. Si existe, registrar que es compartido.
    const addUniqueWall = (n1: string, n2: string, roomName: string) => {
      const wallId1 = `${n1}-${n2}`;
      const wallId2 = `${n2}-${n1}`;
      
      const existingWall = walls.find(w => w.id === wallId1 || w.id === wallId2);
      
      if (existingWall) {
        if (!existingWall.rooms.includes(roomName)) {
          existingWall.rooms.push(roomName); // Muro interior compartido
        }
      } else {
        walls.push({
          id: wallId1,
          startNode: n1,
          endNode: n2,
          thickness: 0.15,
          height: 2.8,
          rooms: [roomName] // Si se queda en 1, es muro exterior
        });
      }
    };

    pascalData.rooms.forEach((room: any) => {
      const x1 = room.position.x;
      const y1 = room.position.y;
      const x2 = room.position.x + room.size.width;
      const y2 = room.position.y + room.size.height;

      const nTL = addNode(x1, y1);
      const nTR = addNode(x2, y1);
      const nBR = addNode(x2, y2);
      const nBL = addNode(x1, y2);

      addUniqueWall(nTL, nTR, room.name);
      addUniqueWall(nTR, nBR, room.name);
      addUniqueWall(nBR, nBL, room.name);
      addUniqueWall(nBL, nTL, room.name);
    });

    setProcessedData({
      project: { nodes: Object.values(nodesMap), walls: walls }
    });
  }, [pascalData]);

  // ---------------------------------------------------------
  // PASO 2: RENDERIZADO 3D (CSG INTELIGENTE)
  // ---------------------------------------------------------
  useEffect(() => {
    if (!processedData || !mountRef.current || !pascalData) return;

    const mountEl = mountRef.current;
    while (mountEl.firstChild) mountEl.removeChild(mountEl.firstChild);

    let animationFrameId: number | null = null;
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xddecff);
    scene.fog = new THREE.Fog(0xddecff, 10, 50);

    const camera = new THREE.PerspectiveCamera(60, mountEl.clientWidth / mountEl.clientHeight, 0.1, 1000);
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(mountEl.clientWidth, mountEl.clientHeight);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    mountEl.appendChild(renderer.domElement);

    // 1. TERRENO Y PISOS
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(100, 100),
      new THREE.MeshStandardMaterial({ color: 0x8ebf6a, roughness: 1 })
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.05;
    ground.receiveShadow = true;
    scene.add(ground);

    const getRoomFloorColor = (room: any): number => {
      const rawType = String(room?.type || '').toLowerCase();
      const rawName = String(room?.name || '').toLowerCase();
      const key = `${rawType} ${rawName}`;

      if (key.includes('bathroom') || key.includes('baño') || key.includes('bano')) return 0xd8dde3;
      if (key.includes('kitchen') || key.includes('cocina')) return 0xd7d2c8;
      if (key.includes('hallway') || key.includes('circulación') || key.includes('circulacion') || key.includes('pasillo')) return 0xd4c7a3;
      if (key.includes('bedroom') || key.includes('habitación') || key.includes('habitacion')) return 0xc8ae8a;
      if (key.includes('living') || key.includes('sala') || key.includes('dining') || key.includes('comedor')) return 0xc9a57a;
      if (key.includes('garage') || key.includes('estacionamiento')) return 0xb6b6b6;
      if (key.includes('office') || key.includes('oficina')) return 0xc7b091;
      if (key.includes('storage') || key.includes('lavandería') || key.includes('lavanderia') || key.includes('bodega')) return 0xbda88b;

      // Fallback para cualquier otro espacio.
      return 0xcfa574;
    };

    pascalData.rooms.forEach((room: any) => {
      const floorColor = getRoomFloorColor(room);
      const floor = new THREE.Mesh(
        new THREE.BoxGeometry(room.size.width, 0.1, room.size.height),
        new THREE.MeshStandardMaterial({ color: floorColor, roughness: 0.8 })
      );
      floor.position.set(room.position.x + room.size.width / 2, 0, room.position.y + room.size.height / 2);
      floor.receiveShadow = true;
      scene.add(floor);
    });

    // 2. ABERTURAS REALES DESDE BACKEND (SIN HEURÍSTICAS)
    const nodes = new Map<string, any>();
    processedData.project.nodes.forEach((n: any) => nodes.set(n.id, n));
    const realOpenings: RealOpening[] = [];
    const seenOpenings = new Set<string>();
    const rooms = Array.isArray(pascalData?.rooms) ? pascalData.rooms : [];
    const roomByName = new Map<string, any>();
    rooms.forEach((room: any) => {
      roomByName.set(room.name, room);
    });
    const connections = Array.isArray(pascalData?.connections) ? pascalData.connections : [];

    const normalizeAngle = (value: number): number => {
      if (!Number.isFinite(value)) return 0;
      if (Math.abs(value) > (Math.PI * 2 + 0.01)) return (value * Math.PI) / 180;
      return value;
    };

    const parseSide = (value: any): 'north' | 'south' | 'east' | 'west' | undefined => {
      const normalized = String(value || '').toLowerCase();
      if (normalized === 'north' || normalized === 'south' || normalized === 'east' || normalized === 'west') {
        return normalized;
      }
      return undefined;
    };

    const parseOrientationAngle = (orientation: any): number | undefined => {
      const text = String(orientation || '').toLowerCase();
      if (!text) return undefined;
      if (text.includes('vertical') || text === 'east' || text === 'west') return Math.PI / 2;
      if (text.includes('horizontal') || text === 'north' || text === 'south') return 0;
      return undefined;
    };

    const addOpening = (opening: RealOpening) => {
      const key = `${opening.isWindow ? 'w' : 'd'}_${Math.round(opening.x * 100)}_${Math.round(opening.y * 100)}_${Math.round(opening.angle * 100)}_${Math.round(opening.width * 100)}_${Math.round(opening.height * 100)}`;
      if (seenOpenings.has(key)) return;
      seenOpenings.add(key);
      realOpenings.push(opening);
    };

    const isNear = (a: number, b: number, tolerance = 0.22) => Math.abs(a - b) <= tolerance;

    const getSharedBoundaryDoor = (
      roomA: any,
      roomB: any,
      width: number
    ): { x: number; y: number; angle: number; sideA: 'north' | 'south' | 'east' | 'west'; overlap: number } | null => {
      const ax1 = roomA.position.x;
      const ay1 = roomA.position.y;
      const ax2 = roomA.position.x + roomA.size.width;
      const ay2 = roomA.position.y + roomA.size.height;

      const bx1 = roomB.position.x;
      const by1 = roomB.position.y;
      const bx2 = roomB.position.x + roomB.size.width;
      const by2 = roomB.position.y + roomB.size.height;

      const minOverlap = Math.max(0.35, width * 0.6);
      const candidates: Array<{ x: number; y: number; angle: number; sideA: 'north' | 'south' | 'east' | 'west'; overlap: number }> = [];

      if (isNear(ax2, bx1, 0.25)) {
        const overlapStart = Math.max(ay1, by1);
        const overlapEnd = Math.min(ay2, by2);
        const overlap = overlapEnd - overlapStart;
        if (overlap >= minOverlap) {
          candidates.push({ x: ax2, y: (overlapStart + overlapEnd) / 2, angle: Math.PI / 2, sideA: 'east', overlap });
        }
      }

      if (isNear(ax1, bx2, 0.25)) {
        const overlapStart = Math.max(ay1, by1);
        const overlapEnd = Math.min(ay2, by2);
        const overlap = overlapEnd - overlapStart;
        if (overlap >= minOverlap) {
          candidates.push({ x: ax1, y: (overlapStart + overlapEnd) / 2, angle: Math.PI / 2, sideA: 'west', overlap });
        }
      }

      if (isNear(ay2, by1, 0.25)) {
        const overlapStart = Math.max(ax1, bx1);
        const overlapEnd = Math.min(ax2, bx2);
        const overlap = overlapEnd - overlapStart;
        if (overlap >= minOverlap) {
          candidates.push({ x: (overlapStart + overlapEnd) / 2, y: ay2, angle: 0, sideA: 'south', overlap });
        }
      }

      if (isNear(ay1, by2, 0.25)) {
        const overlapStart = Math.max(ax1, bx1);
        const overlapEnd = Math.min(ax2, bx2);
        const overlap = overlapEnd - overlapStart;
        if (overlap >= minOverlap) {
          candidates.push({ x: (overlapStart + overlapEnd) / 2, y: ay1, angle: 0, sideA: 'north', overlap });
        }
      }

      if (candidates.length === 0) return null;
      candidates.sort((a, b) => b.overlap - a.overlap);
      return candidates[0];
    };

    const findSharedBoundaryCenter = (
      room: any,
      side: 'north' | 'south' | 'east' | 'west',
      width: number
    ): { x: number; y: number } | null => {
      const roomName = String(room?.name || '');
      const candidates = connections
        .filter((c: any) => String(c?.type || '').toLowerCase() !== 'window')
        .filter((c: any) => c?.from === roomName || c?.to === roomName)
        .map((c: any) => (c.from === roomName ? c.to : c.from));

      const x1 = room.position.x;
      const y1 = room.position.y;
      const x2 = room.position.x + room.size.width;
      const y2 = room.position.y + room.size.height;

      type SharedCandidate = { centerX: number; centerY: number; overlap: number };
      const shared: SharedCandidate[] = [];

      rooms.forEach((other: any) => {
        if (!other || other.name === roomName) return;
        if (candidates.length > 0 && !candidates.includes(other.name)) return;

        const ox1 = other.position.x;
        const oy1 = other.position.y;
        const ox2 = other.position.x + other.size.width;
        const oy2 = other.position.y + other.size.height;

        if (side === 'north' && isNear(y1, oy2, 0.25)) {
          const overlapStart = Math.max(x1, ox1);
          const overlapEnd = Math.min(x2, ox2);
          const overlap = overlapEnd - overlapStart;
          if (overlap >= Math.max(0.4, width * 0.7)) {
            shared.push({ centerX: (overlapStart + overlapEnd) / 2, centerY: y1, overlap });
          }
        }

        if (side === 'south' && isNear(y2, oy1, 0.25)) {
          const overlapStart = Math.max(x1, ox1);
          const overlapEnd = Math.min(x2, ox2);
          const overlap = overlapEnd - overlapStart;
          if (overlap >= Math.max(0.4, width * 0.7)) {
            shared.push({ centerX: (overlapStart + overlapEnd) / 2, centerY: y2, overlap });
          }
        }

        if (side === 'east' && isNear(x2, ox1, 0.25)) {
          const overlapStart = Math.max(y1, oy1);
          const overlapEnd = Math.min(y2, oy2);
          const overlap = overlapEnd - overlapStart;
          if (overlap >= Math.max(0.4, width * 0.7)) {
            shared.push({ centerX: x2, centerY: (overlapStart + overlapEnd) / 2, overlap });
          }
        }

        if (side === 'west' && isNear(x1, ox2, 0.25)) {
          const overlapStart = Math.max(y1, oy1);
          const overlapEnd = Math.min(y2, oy2);
          const overlap = overlapEnd - overlapStart;
          if (overlap >= Math.max(0.4, width * 0.7)) {
            shared.push({ centerX: x1, centerY: (overlapStart + overlapEnd) / 2, overlap });
          }
        }
      });

      if (shared.length === 0) return null;
      shared.sort((a, b) => b.overlap - a.overlap);
      return { x: shared[0].centerX, y: shared[0].centerY };
    };

    const hasAdjacentRoomOnSide = (
      room: any,
      side: 'north' | 'south' | 'east' | 'west',
      width: number
    ): boolean => {
      for (const other of rooms) {
        if (!other || other.name === room.name) continue;
        const shared = getSharedBoundaryDoor(room, other, width);
        if (shared && shared.sideA === side) return true;
      }
      return false;
    };

    const toOpening = (room: any, item: any, isWindow: boolean): RealOpening | null => {
      const directX = Number(item?.x);
      const directY = Number(item?.y);
      const side = parseSide(item?.position);
      const orientationAngle = parseOrientationAngle(item?.orientation);
      const width = Math.max(0.2, Number(item?.width) || (isWindow ? 1.2 : 0.9));
      const height = isWindow
        ? Math.max(0.6, Number(item?.height) || 1.1)
        : 2.1;

      const tuplePosition = Array.isArray(item?.position) ? item.position : null;
      if (tuplePosition?.length === 2) {
        const px = Number(tuplePosition[0]);
        const py = Number(tuplePosition[1]);
        if (Number.isFinite(px) && Number.isFinite(py)) {
          return {
            x: px,
            y: py,
            width,
            height,
            elevation: isWindow ? 1.0 : 0,
            angle: normalizeAngle(Number(item?.angle)) || orientationAngle || 0,
            isWindow,
            roomName: room.name,
            side,
          };
        }
      }

      if (Number.isFinite(directX) && Number.isFinite(directY)) {
        return {
          x: directX,
          y: directY,
          width,
          height,
          elevation: isWindow ? 1.0 : 0,
          angle: normalizeAngle(Number(item?.angle)) || orientationAngle || 0,
          isWindow,
          roomName: room.name,
          side,
        };
      }

      const start = Array.isArray(item?.start) ? item.start : null;
      const end = Array.isArray(item?.end) ? item.end : null;
      if (start?.length === 2 && end?.length === 2) {
        const sx = Number(start[0]);
        const sy = Number(start[1]);
        const ex = Number(end[0]);
        const ey = Number(end[1]);
        if ([sx, sy, ex, ey].every(Number.isFinite)) {
          return {
            x: (sx + ex) / 2,
            y: (sy + ey) / 2,
            width,
            height,
            elevation: isWindow ? 1.0 : 0,
            angle: normalizeAngle(Math.atan2(ey - sy, ex - sx)),
            isWindow,
            roomName: room.name,
            side,
          };
        }
      }

      const x1 = room.position.x;
      const y1 = room.position.y;
      const x2 = room.position.x + room.size.width;
      const y2 = room.position.y + room.size.height;

      if (side === 'north') {
        const shared = findSharedBoundaryCenter(room, 'north', width);
        return {
          x: shared?.x ?? (x1 + x2) / 2,
          y: shared?.y ?? y1,
          width,
          height,
          elevation: isWindow ? 1.0 : 0,
          angle: 0,
          isWindow,
          roomName: room.name,
          side,
        };
      }

      if (side === 'south') {
        const shared = findSharedBoundaryCenter(room, 'south', width);
        return {
          x: shared?.x ?? (x1 + x2) / 2,
          y: shared?.y ?? y2,
          width,
          height,
          elevation: isWindow ? 1.0 : 0,
          angle: 0,
          isWindow,
          roomName: room.name,
          side,
        };
      }

      if (side === 'east') {
        const shared = findSharedBoundaryCenter(room, 'east', width);
        return {
          x: shared?.x ?? x2,
          y: shared?.y ?? (y1 + y2) / 2,
          width,
          height,
          elevation: isWindow ? 1.0 : 0,
          angle: Math.PI / 2,
          isWindow,
          roomName: room.name,
          side,
        };
      }

      if (side === 'west') {
        const shared = findSharedBoundaryCenter(room, 'west', width);
        return {
          x: shared?.x ?? x1,
          y: shared?.y ?? (y1 + y2) / 2,
          width,
          height,
          elevation: isWindow ? 1.0 : 0,
          angle: Math.PI / 2,
          isWindow,
          roomName: room.name,
          side,
        };
      }

      return null;
    };

    connections.forEach((conn: any) => {
      const type = String(conn?.type || '').toLowerCase();
      if (type !== 'door' && type !== 'opening') return;

      const fromRoom = roomByName.get(conn?.from);
      const toRoom = roomByName.get(conn?.to);
      if (!fromRoom || !toRoom) return;

      const refWidth = Math.max(0.2, Number(conn?.width) || 0.9);
      const shared = getSharedBoundaryDoor(fromRoom, toRoom, refWidth);
      if (!shared) return;

      addOpening({
        x: shared.x,
        y: shared.y,
        width: refWidth,
        height: 2.1,
        elevation: 0,
        angle: shared.angle,
        isWindow: false,
        isInteriorDoor: true,
        roomName: fromRoom.name,
        side: shared.sideA,
      });
    });

    rooms.forEach((room: any) => {
      (room?.doors || []).forEach((door: any) => {
        const side = parseSide(door?.position);
        const width = Math.max(0.2, Number(door?.width) || 0.9);
        const declaredType = String(door?.type || '').toLowerCase();

        const shouldSkipAsInterior = Boolean(
          declaredType === 'interior' ||
          (side && hasAdjacentRoomOnSide(room, side, width))
        );

        if (shouldSkipAsInterior) {
          return;
        }

        const op = toOpening(room, door, false);
        if (op) addOpening(op);
      });

      (room?.windows || []).forEach((window: any) => {
        const op = toOpening(room, window, true);
        if (op) addOpening(op);
      });
    });

    // Fuente de verdad final: replicar exactamente la segmentacion del SVG backend.
    // Se recalculan todas las aberturas para evitar heuristicas inconsistentes en 3D.
    realOpenings.length = 0;
    seenOpenings.clear();

    const bounds = rooms.reduce(
      (acc: { minX: number; minY: number; maxX: number; maxY: number }, room: any) => {
        const x1 = Number(room?.position?.x) || 0;
        const y1 = Number(room?.position?.y) || 0;
        const x2 = x1 + (Number(room?.size?.width) || 0);
        const y2 = y1 + (Number(room?.size?.height) || 0);
        return {
          minX: Math.min(acc.minX, x1),
          minY: Math.min(acc.minY, y1),
          maxX: Math.max(acc.maxX, x2),
          maxY: Math.max(acc.maxY, y2),
        };
      },
      { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity }
    );

    const extentWidth = Math.max(0.01, bounds.maxX - bounds.minX);
    const extentHeight = Math.max(0.01, bounds.maxY - bounds.minY);
    const maxRealDimension = Math.max(extentWidth, extentHeight);
    const svgLikeScale = 900 / maxRealDimension;

    type SvgRoomRect = { x: number; y: number; width: number; height: number; right: number; bottom: number };

    const roomRects: SvgRoomRect[] = rooms.map((room: any) => {
      const x = (Number(room?.position?.x) || 0) * svgLikeScale;
      const y = (Number(room?.position?.y) || 0) * svgLikeScale;
      const width = (Number(room?.size?.width) || 0) * svgLikeScale;
      const height = (Number(room?.size?.height) || 0) * svgLikeScale;
      return {
        x,
        y,
        width,
        height,
        right: x + width,
        bottom: y + height,
      };
    });

    const drawnSegments = new Set<string>();
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

      const vertices = {
        nw: { x: roomX, y: roomY },
        ne: { x: roomX + roomWidth, y: roomY },
        se: { x: roomX + roomWidth, y: roomY + roomHeight },
        sw: { x: roomX, y: roomY + roomHeight },
      };

      const edgeVertices: Record<string, [{ x: number; y: number }, { x: number; y: number }]> = {
        north: [vertices.nw, vertices.ne],
        south: [vertices.sw, vertices.se],
        east: [vertices.ne, vertices.se],
        west: [vertices.nw, vertices.sw],
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

      const sharedIntervals: Array<{ start: number; end: number }> = [];
      roomRects.forEach((other: SvgRoomRect, idx: number) => {
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

      const breakpoints = new Set<number>([axisStart, axisEnd]);
      roomRects.forEach((rect: SvgRoomRect) => {
        const v = [
          { x: rect.x, y: rect.y },
          { x: rect.right, y: rect.y },
          { x: rect.right, y: rect.bottom },
          { x: rect.x, y: rect.bottom },
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
        if (len > 1.2) segments.push({ start, end, mid: (start + end) / 2, len });
      }

      let selectedSegment = segments.sort((s1, s2) => s2.len - s1.len)[0] || {
        start: axisStart,
        end: axisEnd,
        mid: axisMid,
        len: axisEnd - axisStart,
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
            return oLen > 1.2 ? { start: oStart, end: oEnd, mid: (oStart + oEnd) / 2, len: oLen } : null;
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
        y2: midY + (uy * half),
      };
    };

    const addSegmentOpening = (
      room: any,
      side: string,
      spanRatio: number,
      isWindow: boolean,
      isInteriorDoor: boolean,
      dedupeKind: 'door' | 'window',
      height: number,
      elevation: number
    ) => {
      const roomIndex = rooms.findIndex((r: any) => r?.name === room?.name);
      if (roomIndex < 0) return;

      const seg = getOpeningSegmentFromEdge(roomIndex, String(side || 'west').toLowerCase(), spanRatio);
      const key = segmentKey(seg.x1, seg.y1, seg.x2, seg.y2, dedupeKind);
      if (drawnSegments.has(key)) return;
      drawnSegments.add(key);

      const x1 = seg.x1 / svgLikeScale;
      const y1 = seg.y1 / svgLikeScale;
      const x2 = seg.x2 / svgLikeScale;
      const y2 = seg.y2 / svgLikeScale;

      addOpening({
        x: (x1 + x2) / 2,
        y: (y1 + y2) / 2,
        width: Math.max(0.25, Math.hypot(x2 - x1, y2 - y1)),
        height,
        elevation,
        angle: Math.atan2(y2 - y1, x2 - x1),
        isWindow,
        isInteriorDoor,
        roomName: room.name,
        side: parseSide(side),
      });
    };

    rooms.forEach((room: any) => {
      const doors = Array.isArray(room?.doors) ? room.doors : [];
      doors.forEach((door: any) => {
        const side = String(door?.position || 'west').toLowerCase();
        const roomWidth = Number(room?.size?.width) || 0;
        const roomHeight = Number(room?.size?.height) || 0;
        const edgeLength = (side === 'north' || side === 'south') ? roomWidth : roomHeight;
        const doorWidth = Math.max(0.2, Number(door?.width) || 0.9);
        const proportionalSpan = edgeLength > 0.01 ? doorWidth / edgeLength : 0.25;
        const spanRatio = doorWidth >= 2
          ? Math.max(0.25, Math.min(0.85, proportionalSpan))
          : 0.25;

        const declaredType = String(door?.type || '').toLowerCase();
        const interiorByAdjacency = Boolean(
          parseSide(side) && hasAdjacentRoomOnSide(room, parseSide(side) as 'north' | 'south' | 'east' | 'west', doorWidth)
        );
        const isInteriorDoor = declaredType === 'interior' || interiorByAdjacency;

        addSegmentOpening(room, side, spanRatio, false, isInteriorDoor, 'door', 2.1, 0);
      });

      const windows = Array.isArray(room?.windows) ? room.windows : [];
      windows.forEach((window: any) => {
        const side = String(window?.position || 'west').toLowerCase();
        const h = Math.max(0.6, Number(window?.height) || 1.1);
        addSegmentOpening(room, side, 0.3, true, false, 'window', h, 1.0);
      });
    });

    const distToSegment = (px: number, py: number, x1: number, y1: number, x2: number, y2: number) => {
      const l2 = (x2 - x1)**2 + (y2 - y1)**2;
      if (l2 === 0) return Math.sqrt((px - x1)**2 + (py - y1)**2);
      let t = Math.max(0, Math.min(1, ((px - x1) * (x2 - x1) + (py - y1) * (y2 - y1)) / l2));
      return Math.sqrt((px - (x1 + t * (x2 - x1)))**2 + (py - (y1 + t * (y2 - y1)))**2);
    };

    const wallSegments: WallSegment[] = processedData.project.walls
      .map((wall: any) => {
        const start = nodes.get(wall.startNode);
        const end = nodes.get(wall.endNode);
        if (!start || !end) return null;

        const dx = end.x - start.x;
        const dy = end.y - start.y;
        return {
          id: wall.id,
          start,
          end,
          length: Math.hypot(dx, dy),
          angle: Math.atan2(dy, dx),
          rooms: Array.isArray(wall.rooms) ? wall.rooms : [],
        };
      })
      .filter((segment: WallSegment | null): segment is WallSegment => Boolean(segment));

    const sideMatchesWall = (room: any, side: 'north' | 'south' | 'east' | 'west', wall: WallSegment): boolean => {
      const x1 = room.position.x;
      const y1 = room.position.y;
      const x2 = room.position.x + room.size.width;
      const y2 = room.position.y + room.size.height;
      const horizontal = Math.abs(wall.start.y - wall.end.y) <= 0.06;
      const vertical = Math.abs(wall.start.x - wall.end.x) <= 0.06;

      if (side === 'north') return horizontal && isNear(wall.start.y, y1) && isNear(wall.end.y, y1);
      if (side === 'south') return horizontal && isNear(wall.start.y, y2) && isNear(wall.end.y, y2);
      if (side === 'east') return vertical && isNear(wall.start.x, x2) && isNear(wall.end.x, x2);
      return vertical && isNear(wall.start.x, x1) && isNear(wall.end.x, x1);
    };

    const normalizeDeltaAngle = (a: number, b: number): number => {
      let d = Math.abs(a - b) % Math.PI;
      if (d > Math.PI / 2) d = Math.PI - d;
      return Math.abs(d);
    };

    const openingByWall = new Map<string, RealOpening[]>();
    realOpenings.forEach((opening) => {
      const room = opening.roomName ? roomByName.get(opening.roomName) : undefined;
      const roomWalls = room
        ? wallSegments.filter((w) => w.rooms.includes(opening.roomName as string))
        : wallSegments;

      const sideFilteredWalls = opening.side && room
        ? roomWalls.filter((w) => sideMatchesWall(room, opening.side as 'north' | 'south' | 'east' | 'west', w))
        : roomWalls;

      const candidateWalls = sideFilteredWalls.length > 0 ? sideFilteredWalls : (roomWalls.length > 0 ? roomWalls : wallSegments);

      let best: { wallId: string; score: number } | null = null;
      for (const wall of candidateWalls) {
        const dist = distToSegment(opening.x, opening.y, wall.start.x, wall.start.y, wall.end.x, wall.end.y);
        const anglePenalty = normalizeDeltaAngle(opening.angle, wall.angle);
        const score = dist + (anglePenalty * 0.18);

        if (!best || score < best.score) {
          best = { wallId: wall.id, score };
        }
      }

      if (!best) return;
      const list = openingByWall.get(best.wallId) || [];
      list.push(opening);
      openingByWall.set(best.wallId, list);
    });

    const projectPointToSegment = (
      px: number,
      py: number,
      x1: number,
      y1: number,
      x2: number,
      y2: number
    ): { x: number; y: number; t: number } => {
      const dx = x2 - x1;
      const dy = y2 - y1;
      const l2 = dx * dx + dy * dy;
      if (l2 === 0) return { x: x1, y: y1, t: 0 };
      const rawT = ((px - x1) * dx + (py - y1) * dy) / l2;
      const t = Math.max(0, Math.min(1, rawT));
      return {
        x: x1 + t * dx,
        y: y1 + t * dy,
        t,
      };
    };

    // 3. CONSTRUCCIÓN DE MUROS CON CSG
    const wallMaterial = new THREE.MeshStandardMaterial({ color: 0xf5f5f0, roughness: 0.9 });
    const frameMaterial = new THREE.MeshStandardMaterial({ color: 0x2a2a2a, roughness: 0.5, metalness: 0.8 });
    const doorMaterial = new THREE.MeshStandardMaterial({ color: 0xf5f5f0, roughness: 0.7, metalness: 0.05 });
    const glassMaterial = new THREE.MeshPhysicalMaterial({
      color: 0x88ccff, metalness: 0.1, roughness: 0.05, transmission: 0.9, opacity: 1, transparent: true, ior: 1.5, side: THREE.DoubleSide
    });

    const csgEvaluator = new Evaluator();
    csgEvaluator.useGroups = true;

    processedData.project.walls.forEach((wall: any) => {
      const start = nodes.get(wall.startNode);
      const end = nodes.get(wall.endNode);
      if (!start || !end) return;

      const dx = end.x - start.x;
      const dy = end.y - start.y;
      const length = Math.sqrt(dx * dx + dy * dy);
      const angle = Math.atan2(dy, dx);

      let currentWallBrush = new Brush(new THREE.BoxGeometry(length, wall.height, wall.thickness), wallMaterial);
      currentWallBrush.position.set(start.x + dx / 2, wall.height / 2, start.y + dy / 2);
      currentWallBrush.rotation.y = -angle; 
      currentWallBrush.updateMatrixWorld();

      const wallOpenings = openingByWall.get(wall.id) || [];
      const resolvedOpenings: ResolvedWallOpening[] = wallOpenings.map((op) => {
        const projected = projectPointToSegment(op.x, op.y, start.x, start.y, end.x, end.y);
        const safeWidth = Math.min(Math.max(0.25, op.width), Math.max(0.25, length - 0.08));
        return {
          x: projected.x,
          y: projected.y,
          width: safeWidth,
          height: op.height,
          elevation: op.elevation,
          angle,
          isWindow: op.isWindow,
          isInteriorDoor: op.isInteriorDoor,
        };
      });

      resolvedOpenings.forEach(op => {
        const drillBrush = new Brush(new THREE.BoxGeometry(op.width, op.height, wall.thickness * 2));
        drillBrush.position.set(op.x, op.elevation + (op.height / 2), op.y);
        drillBrush.rotation.y = -op.angle;
        drillBrush.updateMatrixWorld();

        // Solo las ventanas generan abertura real en el muro.
        if (op.isWindow) {
          currentWallBrush = csgEvaluator.evaluate(currentWallBrush, drillBrush, SUBTRACTION);
        }

        const frameBrush = new Brush(new THREE.BoxGeometry(op.width, op.height, wall.thickness + 0.05), frameMaterial);
        const innerDrill = new Brush(new THREE.BoxGeometry(op.width - 0.08, op.isWindow ? op.height - 0.08 : op.height - 0.04, wall.thickness * 3));

        frameBrush.position.copy(drillBrush.position);
        frameBrush.rotation.y = drillBrush.rotation.y;
        frameBrush.updateMatrixWorld();

        innerDrill.position.copy(frameBrush.position);
        if (!op.isWindow) innerDrill.position.y -= 0.02;
        innerDrill.rotation.y = frameBrush.rotation.y;
        innerDrill.updateMatrixWorld();

        const frame = csgEvaluator.evaluate(frameBrush, innerDrill, SUBTRACTION);
        frame.castShadow = true;
        scene.add(frame);

        if (op.isWindow) {
          const glass = new THREE.Mesh(new THREE.BoxGeometry(op.width - 0.06, op.height - 0.1, 0.02), glassMaterial);
          glass.position.copy(drillBrush.position);
          glass.rotation.y = drillBrush.rotation.y;
          scene.add(glass);
        } else {
          // Puerta cerrada: hoja visible en ambas caras del muro, sin abertura.
          const normalX = -Math.sin(op.angle);
          const normalZ = Math.cos(op.angle);
          const offset = (wall.thickness / 2) + 0.015;

          const makeLeaf = (dir: 1 | -1) => {
            const leaf = new THREE.Mesh(
              new THREE.BoxGeometry(op.width - 0.06, op.height - 0.08, 0.03),
              doorMaterial
            );
            leaf.position.set(
              op.x + (normalX * offset * dir),
              op.elevation + (op.height / 2),
              op.y + (normalZ * offset * dir)
            );
            leaf.rotation.y = drillBrush.rotation.y;
            leaf.castShadow = true;
            leaf.receiveShadow = true;
            scene.add(leaf);
          };

          makeLeaf(1);
          makeLeaf(-1);
        }
      });

      currentWallBrush.castShadow = true;
      currentWallBrush.receiveShadow = true;
      scene.add(currentWallBrush);
    });

    // 4. LUCES Y CONTROLES
    scene.add(new THREE.AmbientLight(0xffffff, 0.6));
    const sunLight = new THREE.DirectionalLight(0xffffff, 1.2);
    sunLight.position.set(15, 20, 10);
    sunLight.castShadow = true;
    sunLight.shadow.mapSize.width = 2048;
    sunLight.shadow.mapSize.height = 2048;
    scene.add(sunLight);
    
    camera.position.set(15, 18, 20); 
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.target.set(5, 0, 5);
    controls.maxPolarAngle = Math.PI / 2 - 0.05;

    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);
      controls.update();
      renderer.render(scene, camera);
    };
    animate();

    return () => {
      if (animationFrameId) cancelAnimationFrame(animationFrameId);
      controls.dispose();
      renderer.dispose();
    };
  }, [processedData, pascalData]);

  return (
    <div style={{ padding: '20px', backgroundColor: '#fff', borderRadius: '8px', width: '100%' }}>
      <h3 style={{ margin: '0 0 15px 0', color: '#333' }}>Vista Estructural 3D</h3>
      {!processedData && <p style={{ color: '#666' }}>Optimizando geometría de muros...</p>}
      <div ref={mountRef} style={{ width: '100%', height: '500px', border: '1px solid #e0e0e0', borderRadius: '8px', overflow: 'hidden' }} />
    </div>
  );
};

export default PascalNativeViewer;