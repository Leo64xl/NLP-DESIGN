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
}

interface WallSegment {
  id: string;
  start: { x: number; y: number };
  end: { x: number; y: number };
  length: number;
  angle: number;
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

    const normalizeAngle = (value: number): number => {
      if (!Number.isFinite(value)) return 0;
      if (Math.abs(value) > (Math.PI * 2 + 0.01)) return (value * Math.PI) / 180;
      return value;
    };

    const addOpening = (opening: RealOpening) => {
      const key = `${opening.isWindow ? 'w' : 'd'}_${Math.round(opening.x * 100)}_${Math.round(opening.y * 100)}_${Math.round(opening.angle * 100)}_${Math.round(opening.width * 100)}_${Math.round(opening.height * 100)}`;
      if (seenOpenings.has(key)) return;
      seenOpenings.add(key);
      realOpenings.push(opening);
    };

    const toOpening = (room: any, item: any, isWindow: boolean): RealOpening | null => {
      const directX = Number(item?.x);
      const directY = Number(item?.y);
      const side = String(item?.position || '').toLowerCase();
      const width = Math.max(0.5, Number(item?.width) || (isWindow ? 1.2 : 0.9));
      const height = isWindow
        ? Math.max(0.6, Number(item?.height) || 1.1)
        : 2.1;

      if (Number.isFinite(directX) && Number.isFinite(directY)) {
        return {
          x: directX,
          y: directY,
          width,
          height,
          elevation: isWindow ? 1.0 : 0,
          angle: normalizeAngle(Number(item?.angle)),
          isWindow,
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
          };
        }
      }

      const x1 = room.position.x;
      const y1 = room.position.y;
      const x2 = room.position.x + room.size.width;
      const y2 = room.position.y + room.size.height;

      if (side === 'north') {
        return {
          x: (x1 + x2) / 2,
          y: y1,
          width,
          height,
          elevation: isWindow ? 1.0 : 0,
          angle: 0,
          isWindow,
        };
      }

      if (side === 'south') {
        return {
          x: (x1 + x2) / 2,
          y: y2,
          width,
          height,
          elevation: isWindow ? 1.0 : 0,
          angle: 0,
          isWindow,
        };
      }

      if (side === 'east') {
        return {
          x: x2,
          y: (y1 + y2) / 2,
          width,
          height,
          elevation: isWindow ? 1.0 : 0,
          angle: Math.PI / 2,
          isWindow,
        };
      }

      if (side === 'west') {
        return {
          x: x1,
          y: (y1 + y2) / 2,
          width,
          height,
          elevation: isWindow ? 1.0 : 0,
          angle: Math.PI / 2,
          isWindow,
        };
      }

      return null;
    };

    pascalData.rooms.forEach((room: any) => {
      (room?.doors || []).forEach((door: any) => {
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
          angle: Math.atan2(dy, dx)
        };
      })
      .filter((segment: WallSegment | null): segment is WallSegment => Boolean(segment));

    const normalizeDeltaAngle = (a: number, b: number): number => {
      let d = Math.abs(a - b) % Math.PI;
      if (d > Math.PI / 2) d = Math.PI - d;
      return Math.abs(d);
    };

    const openingByWall = new Map<string, RealOpening[]>();
    realOpenings.forEach((opening) => {
      let best: { wallId: string; score: number } | null = null;
      for (const wall of wallSegments) {
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
      wallOpenings.forEach(op => {
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