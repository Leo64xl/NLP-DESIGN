import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { Evaluator, Brush, SUBTRACTION } from 'three-bvh-csg';

interface PascalNativeViewerProps {
  pascalData: any; // Recibimos tu JSON actual con 'rooms'
}

const PascalNativeViewer: React.FC<PascalNativeViewerProps> = ({ pascalData }) => {
  const mountRef = useRef<HTMLDivElement>(null);
  const [processedData, setProcessedData] = useState<any>(null);

  // --- PASO 1: TRADUCCIÓN (De 'rooms' a Nodos y Muros) ---
  useEffect(() => {
    if (!pascalData || !pascalData.rooms) return;

    console.log("⚙️ Procesando habitaciones a Nodos...");
    const nodesMap: Record<string, { id: string; x: number; y: number }> = {};
    const walls: any[] = [];
    let wallCounter = 1;

    const addNode = (x: number, y: number) => {
      const cleanX = Math.round(x * 100) / 100;
      const cleanY = Math.round(y * 100) / 100;
      const id = `n_${cleanX}_${cleanY}`;
      if (!nodesMap[id]) {
        nodesMap[id] = { id, x: cleanX, y: cleanY };
      }
      return id;
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

      // Usamos startNode y endNode para mantener coherencia con tu interfaz
      walls.push({ id: `w_${wallCounter++}`, startNode: nTL, endNode: nTR, thickness: 0.15, height: 2.8 });
      walls.push({ id: `w_${wallCounter++}`, startNode: nTR, endNode: nBR, thickness: 0.15, height: 2.8 });
      walls.push({ id: `w_${wallCounter++}`, startNode: nBR, endNode: nBL, thickness: 0.15, height: 2.8 });
      walls.push({ id: `w_${wallCounter++}`, startNode: nBL, endNode: nTL, thickness: 0.15, height: 2.8 });
    });

    const finalObject = {
      project: {
        nodes: Object.values(nodesMap),
        walls: walls
      }
    };

    setProcessedData(finalObject);
    console.log("✅ Traducción completada:", finalObject);

  }, [pascalData]);


  // --- PASO 2: RENDERIZADO 3D ---
  // --- PASO 2: RENDERIZADO 3D (CON FORMA Y ESTILO) ---
  // --- PASO 2: RENDERIZADO 3D (CON PUERTAS REALES INTELIGENTES) ---
  // --- PASO 2: RENDERIZADO 3D (CON CRISTALES, PUERTAS Y VENTANAS) ---
  // --- PASO 2: RENDERIZADO 3D (CORRECCIÓN DE CRISTALES Y VENTANAS) ---
  useEffect(() => {
    if (!processedData || !mountRef.current || !pascalData) return;

    const mountEl = mountRef.current;
    while (mountEl.firstChild) {
      mountEl.removeChild(mountEl.firstChild);
    }

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

    // 1. EL TERRENO
    const groundGeo = new THREE.PlaneGeometry(100, 100);
    const groundMat = new THREE.MeshStandardMaterial({ color: 0x8ebf6a, roughness: 1 });
    const ground = new THREE.Mesh(groundGeo, groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.05;
    ground.receiveShadow = true;
    scene.add(ground);

    // 2. LOS PISOS DE LAS HABITACIONES
    if (pascalData.rooms) {
      pascalData.rooms.forEach((room: any) => {
        const floorGeo = new THREE.BoxGeometry(room.size.width, 0.1, room.size.height);
        const floorColor = (room.type === 'bathroom' || room.type === 'kitchen') ? 0xe0e0e0 : 0xcfa574;
        const floorMat = new THREE.MeshStandardMaterial({ color: floorColor, roughness: 0.8 });
        const floor = new THREE.Mesh(floorGeo, floorMat);
        floor.position.set(room.position.x + room.size.width / 2, 0, room.position.y + room.size.height / 2);
        floor.receiveShadow = true;
        scene.add(floor);
      });
    }

    // ---------------------------------------------------------
    // 🧠 CEREBRO CSG: SEPARAR PUERTAS DE VENTANAS EXTERIORES
    // ---------------------------------------------------------
    const realOpenings: { x: number, y: number, width: number, height: number, elevation: number, angle: number, isWindow: boolean }[] = [];
    
    if (pascalData.connections && pascalData.rooms) {
      // A. Mapear puertas interiores desde las conexiones
      pascalData.connections.forEach((conn: any) => {
        if (conn.type === 'door') {
          const rA = pascalData.rooms.find((r: any) => r.name === conn.from);
          const rB = pascalData.rooms.find((r: any) => r.name === conn.to);

          if (rA && rB) {
            const aL = rA.position.x, aR = rA.position.x + rA.size.width;
            const aT = rA.position.y, aB = rA.position.y + rA.size.height;
            const bL = rB.position.x, bR = rB.position.x + rB.size.width;
            const bT = rB.position.y, bB = rB.position.y + rB.size.height;

            const margin = 0.2; 
            if (Math.abs(aR - bL) < margin || Math.abs(aL - bR) < margin) {
              realOpenings.push({
                x: Math.abs(aR - bL) < margin ? aR : aL,
                y: (Math.max(aT, bT) + Math.min(aB, bB)) / 2,
                width: conn.width || 0.9, height: 2.1, elevation: 0, angle: Math.PI / 2, isWindow: false
              });
            } else if (Math.abs(aB - bT) < margin || Math.abs(aT - bB) < margin) {
              realOpenings.push({
                x: (Math.max(aL, bL) + Math.min(aR, bR)) / 2,
                y: Math.abs(aB - bT) < margin ? aB : aT,
                width: conn.width || 0.9, height: 2.1, elevation: 0, angle: 0, isWindow: false
              });
            }
          }
        }
      });

      // B. Mapear ventanas (Si el JSON las trae, o autogenerarlas en muros exteriores)
      pascalData.rooms.forEach((room: any) => {
        if (room.windows && Array.isArray(room.windows) && room.windows.length > 0) {
          room.windows.forEach((win: any) => {
            // 🛡️ PROGRAMACIÓN DEFENSIVA: Evitamos el crash si position o size son undefined
            const posX = win.position && win.position.length > 0 ? win.position[0] : (room.position.x + room.size.width / 2);
            const posY = win.position && win.position.length > 1 ? win.position[1] : room.position.y;
            const posZ = win.position && win.position.length > 2 ? win.position[2] : 1.0;
            
            const winWidth = win.size && win.size.length > 0 ? win.size[0] : 1.2;
            const winHeight = win.size && win.size.length > 1 ? win.size[1] : 1.0;

            realOpenings.push({
              x: posX, 
              y: posY, 
              width: winWidth, 
              height: winHeight, 
              elevation: posZ, 
              angle: (win.orientation === 'north' || win.orientation === 'south') ? 0 : Math.PI / 2, 
              isWindow: true
            });
          });
        } else {
          // Algoritmo de autocompletado: Si la habitación toca el borde exterior, ponerle ventana
          if (room.position.y === 0) { // Pared Norte exterior
            realOpenings.push({
              x: room.position.x + room.size.width / 2, y: 0, width: 1.5, height: 1.2, elevation: 1.0, angle: 0, isWindow: true
            });
          } else if (room.position.x === 0) { // Pared Oeste exterior
            realOpenings.push({
              x: 0, y: room.position.y + room.size.height / 2, width: 1.5, height: 1.2, elevation: 1.0, angle: Math.PI / 2, isWindow: true
            });
          }
        }
      });

      // Puerta principal
      if (pascalData.rooms.length > 0) {
        const r0 = pascalData.rooms[0];
        realOpenings.push({ 
          x: r0.position.x + r0.size.width / 2, y: r0.position.y + r0.size.height, width: 1.2, height: 2.1, elevation: 0, angle: 0, isWindow: false 
        });
      }
    }

    const distToSegment = (px: number, py: number, x1: number, y1: number, x2: number, y2: number) => {
      const l2 = (x2 - x1)**2 + (y2 - y1)**2;
      if (l2 === 0) return Math.sqrt((px - x1)**2 + (py - y1)**2);
      let t = ((px - x1) * (x2 - x1) + (py - y1) * (y2 - y1)) / l2;
      t = Math.max(0, Math.min(1, t));
      return Math.sqrt((px - (x1 + t * (x2 - x1)))**2 + (py - (y1 + t * (y2 - y1)))**2);
    };

    // ---------------------------------------------------------
    // 3. LOS MUROS (CON MARCOS Y CRISTALES CORREGIDOS)
    // ---------------------------------------------------------
    const nodes = new Map<string, any>();
    processedData.project.nodes.forEach((n: any) => nodes.set(n.id, n));

    const wallMaterial = new THREE.MeshStandardMaterial({ color: 0xf5f5f0, roughness: 0.9 });
    const frameMaterial = new THREE.MeshStandardMaterial({ color: 0x2a2a2a, roughness: 0.5, metalness: 0.8 });
    
    const glassMaterial = new THREE.MeshPhysicalMaterial({
      color: 0x88ccff, metalness: 0.1, roughness: 0.05, transmission: 0.9, opacity: 1, transparent: true, ior: 1.5, side: THREE.DoubleSide
    });

    const csgEvaluator = new Evaluator();
    csgEvaluator.useGroups = true;

    processedData.project.walls.forEach((wall: any) => {
      const start = nodes.get(wall.startNode || wall.start);
      const end = nodes.get(wall.endNode || wall.end);

      if (start && end) {
        const dx = end.x - start.x;
        const dy = end.y - start.y;
        const length = Math.sqrt(dx * dx + dy * dy);
        const angle = Math.atan2(dy, dx);

        const wallGeo = new THREE.BoxGeometry(length, wall.height, wall.thickness);
        let currentWallBrush = new Brush(wallGeo, wallMaterial);
        currentWallBrush.position.set(start.x + dx / 2, wall.height / 2, start.y + dy / 2);
        currentWallBrush.rotation.y = -angle; 
        currentWallBrush.updateMatrixWorld();

        realOpenings.forEach(op => {
          const dist = distToSegment(op.x, op.y, start.x, start.y, end.x, end.y);
          
          if (dist < 0.2) { 
            // 1. EL TALADRO
            const drillGeo = new THREE.BoxGeometry(op.width, op.height, wall.thickness * 2);
            const drillBrush = new Brush(drillGeo);
            drillBrush.position.set(op.x, op.elevation + (op.height / 2), op.y);
            drillBrush.rotation.y = -op.angle;
            drillBrush.updateMatrixWorld();

            currentWallBrush = csgEvaluator.evaluate(currentWallBrush, drillBrush, SUBTRACTION);

            // 2. EL MARCO
            const frameGeo = new THREE.BoxGeometry(op.width, op.height, wall.thickness + 0.05);
            const innerDrillHeight = op.isWindow ? op.height - 0.08 : op.height - 0.04;
            const innerDrill = new THREE.BoxGeometry(op.width - 0.08, innerDrillHeight, wall.thickness * 3);
            
            const frameBrush = new Brush(frameGeo, frameMaterial);
            const innerBrush = new Brush(innerDrill);
            frameBrush.position.copy(drillBrush.position);
            frameBrush.rotation.y = drillBrush.rotation.y;
            frameBrush.updateMatrixWorld();
            
            innerBrush.position.copy(frameBrush.position);
            if (!op.isWindow) innerBrush.position.y -= 0.02; // Abrir la parte inferior del marco si es puerta
            innerBrush.rotation.y = frameBrush.rotation.y;
            innerBrush.updateMatrixWorld();

            const frame = csgEvaluator.evaluate(frameBrush, innerBrush, SUBTRACTION);
            frame.castShadow = true;
            scene.add(frame);

            // 3. EL CRISTAL (¡AHORA SÍ, SOLO PARA VENTANAS!)
            if (op.isWindow) {
              const glassGeo = new THREE.BoxGeometry(op.width - 0.06, innerDrillHeight - 0.02, 0.02);
              const glass = new THREE.Mesh(glassGeo, glassMaterial);
              glass.position.copy(drillBrush.position);
              glass.rotation.y = drillBrush.rotation.y;
              scene.add(glass);
            }
          }
        });

        currentWallBrush.castShadow = true;
        currentWallBrush.receiveShadow = true;
        scene.add(currentWallBrush);
      }
    });

    // 4. ILUMINACIÓN Y CÁMARA
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
      if (animationFrameId !== null) cancelAnimationFrame(animationFrameId);
      controls.dispose();
      renderer.dispose();
    };
  }, [processedData, pascalData]);

  return (
    <div style={{ padding: '20px', backgroundColor: '#fff', borderRadius: '8px' }}>
      <h3>Vista Estructural 3D</h3>
      {!processedData && <p>Calculando nodos estructurales...</p>}
      <div ref={mountRef} style={{ width: '100%', height: '500px', border: '1px solid #ccc', borderRadius: '4px' }} />
    </div>
  );
};

export default PascalNativeViewer;