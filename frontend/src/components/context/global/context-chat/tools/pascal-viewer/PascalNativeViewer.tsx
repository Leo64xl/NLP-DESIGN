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
        const centerX = start.x + dx / 2;
        const centerY = start.y + dy / 2;
        const isWindow = op.isWindow;
        const targetWidth = isWindow ? (length * 0.3) : op.width;
        const safeWidth = Math.min(Math.max(0.25, targetWidth), Math.max(0.25, length - 0.08));
        return {
          x: isWindow ? centerX : projected.x,
          y: isWindow ? centerY : projected.y,
          width: safeWidth,
          height: op.height,
          elevation: op.elevation,
          angle,
          isWindow,
        };
      });

      resolvedOpenings.forEach(op => {
        const drillBrush = new Brush(new THREE.BoxGeometry(op.width, op.height, wall.thickness * 2));
        drillBrush.position.set(op.x, op.elevation + (op.height / 2), op.y);
        drillBrush.rotation.y = -op.angle;
        drillBrush.updateMatrixWorld();

        currentWallBrush = csgEvaluator.evaluate(currentWallBrush, drillBrush, SUBTRACTION);

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