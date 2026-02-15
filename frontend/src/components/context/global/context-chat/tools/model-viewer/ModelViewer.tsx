import React, { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import "./ModelViewer.css";

// 🏗️ INTERFACES PARA EL PLAN ARQUITECTÓNICO
interface RoomData {
  name: string;
  type: string;
  area: number;
  position: { x: number; y: number };
  size: { width: number; height: number };
  doors?: Array<{ position: string; width: number }>;
  windows?: Array<{ position: string; width: number; height: number }>;
  features?: string[];
}

interface PlanData {
  metadata: {
    title: string;
    totalArea: number;
    dimensions: { width: number; length: number };
    style: string;
  };
  rooms: RoomData[];
  walls?: Array<{
    start: [number, number];
    end: [number, number];
    thickness: number;
  }>;
}

interface ModelViewerProps {
  planData: PlanData | null; // 🔥 CAMBIO CLAVE: JSON en vez de URLs
  is3DMode: boolean;
  onToggleViewMode: () => void;
}

const ModelViewer: React.FC<ModelViewerProps> = ({
  planData,
  is3DMode,
  onToggleViewMode,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sceneReady, setSceneReady] = useState(false); // 🔥 NUEVO: Flag para saber cuándo la escena está lista
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<
    THREE.PerspectiveCamera | THREE.OrthographicCamera | null
  >(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  // 🎨 FUNCIÓN AUXILIAR: Obtener color por tipo de habitación
  const getRoomColor = (roomType: string): number => {
    const colors: { [key: string]: number } = {
      bedroom: 0xe8f4f8,        // Azul claro
      bathroom: 0xf0f8ff,       // Azul muy claro
      kitchen: 0xfff5ee,        // Naranja claro
      living_room: 0xf0fff0,    // Verde claro
      dining_room: 0xfff8dc,    // Beige claro
      office: 0xf5f5dc,         // Beige
      hallway: 0xf5f5f5,        // Gris claro
      storage: 0xfafad2,        // Amarillo claro
      garage: 0xe0e0e0,         // Gris
      default: 0xf8f9fa         // Blanco gris
    };
    
    return colors[roomType.toLowerCase()] || colors.default;
  };

  // 🏗️ RENDERIZAR PLAN ARQUITECTÓNICO DESDE JSON
  useEffect(() => {
    if (!planData) {
      console.log("⏸️ No hay datos de plano");
      return;
    }

    if (!sceneRef.current || !sceneReady) {
      console.log("⏸️ Esperando a que la escena esté lista...");
      return;
    }

    console.log("🎨 Renderizando plano arquitectónico:", planData);
    setIsLoading(true);
    setError(null);

    const scene = sceneRef.current;

    try {
      // Limpiar modelos previos (mantener luces y grid)
      scene.children = scene.children.filter(
        (child) =>
          child instanceof THREE.Light || 
          child instanceof THREE.GridHelper ||
          child instanceof THREE.AxesHelper
      );

      const houseGroup = new THREE.Group();
      houseGroup.name = "architectural-model"; // 🔥 Identificador
      const scale = 1; // Escala de metros a unidades Three.js

      // 📐 RENDERIZAR CADA HABITACIÓN
      planData.rooms.forEach((room, index) => {
        console.log(`📦 Renderizando habitación ${index + 1}:`, room.name, {
          position: room.position,
          size: room.size,
          area: room.area
        });

        // --- PISO DE LA HABITACIÓN ---
        const floorGeometry = new THREE.BoxGeometry(
          room.size.width * scale,
          0.1,
          room.size.height * scale
        );
        
        const floorMaterial = new THREE.MeshStandardMaterial({
          color: getRoomColor(room.type),
          roughness: 0.8,
          metalness: 0.2,
        });
        
        const floor = new THREE.Mesh(floorGeometry, floorMaterial);
        floor.position.set(
          room.position.x * scale + (room.size.width * scale) / 2,
          0,
          room.position.y * scale + (room.size.height * scale) / 2
        );
        floor.castShadow = true;
        floor.receiveShadow = true;
        houseGroup.add(floor);

        // 🔥 AGREGAR BORDES AL PISO PARA MEJOR VISIBILIDAD
        const floorEdges = new THREE.EdgesGeometry(floorGeometry);
        const floorEdgeMaterial = new THREE.LineBasicMaterial({
          color: 0x000000,
          linewidth: 3,
        });
        const floorEdgeLines = new THREE.LineSegments(floorEdges, floorEdgeMaterial);
        floorEdgeLines.position.copy(floor.position);
        houseGroup.add(floorEdgeLines);

        // --- PAREDES EN MODO 3D ---
        if (is3DMode) {
          const wallHeight = 2.5;
          const wallThickness = 0.15;
          const wallMaterial = new THREE.MeshStandardMaterial({
            color: 0xcccccc,
            roughness: 0.9,
            metalness: 0.1,
          });

          // Pared frontal
          const frontWall = new THREE.BoxGeometry(
            room.size.width * scale,
            wallHeight,
            wallThickness
          );
          const frontWallMesh = new THREE.Mesh(frontWall, wallMaterial);
          frontWallMesh.position.set(
            room.position.x * scale + (room.size.width * scale) / 2,
            wallHeight / 2,
            room.position.y * scale
          );
          frontWallMesh.castShadow = true;
          frontWallMesh.receiveShadow = true;
          houseGroup.add(frontWallMesh);

          // Pared trasera
          const backWall = new THREE.BoxGeometry(
            room.size.width * scale,
            wallHeight,
            wallThickness
          );
          const backWallMesh = new THREE.Mesh(backWall, wallMaterial);
          backWallMesh.position.set(
            room.position.x * scale + (room.size.width * scale) / 2,
            wallHeight / 2,
            room.position.y * scale + room.size.height * scale
          );
          backWallMesh.castShadow = true;
          backWallMesh.receiveShadow = true;
          houseGroup.add(backWallMesh);

          // Pared izquierda
          const leftWall = new THREE.BoxGeometry(
            wallThickness,
            wallHeight,
            room.size.height * scale
          );
          const leftWallMesh = new THREE.Mesh(leftWall, wallMaterial);
          leftWallMesh.position.set(
            room.position.x * scale,
            wallHeight / 2,
            room.position.y * scale + (room.size.height * scale) / 2
          );
          leftWallMesh.castShadow = true;
          leftWallMesh.receiveShadow = true;
          houseGroup.add(leftWallMesh);

          // Pared derecha
          const rightWall = new THREE.BoxGeometry(
            wallThickness,
            wallHeight,
            room.size.height * scale
          );
          const rightWallMesh = new THREE.Mesh(rightWall, wallMaterial);
          rightWallMesh.position.set(
            room.position.x * scale + room.size.width * scale,
            wallHeight / 2,
            room.position.y * scale + (room.size.height * scale) / 2
          );
          rightWallMesh.castShadow = true;
          rightWallMesh.receiveShadow = true;
          houseGroup.add(rightWallMesh);
          
          // 🔥 AGREGAR BORDES A LAS PAREDES PARA VISIBILIDAD
          const wallEdges = new THREE.EdgesGeometry(rightWall);
          const wallEdgeMaterial = new THREE.LineBasicMaterial({ color: 0x000000, linewidth: 2 });
          const wallEdgeLines = new THREE.LineSegments(wallEdges, wallEdgeMaterial);
          wallEdgeLines.position.copy(rightWallMesh.position);
          houseGroup.add(wallEdgeLines);
        }
      });

      // Centrar el grupo en la escena
      const box = new THREE.Box3().setFromObject(houseGroup);
      const center = box.getCenter(new THREE.Vector3());
      const size = box.getSize(new THREE.Vector3());
      
      console.log("📐 DIAGNÓSTICO DEL MODELO:", {
        roomCount: planData.rooms.length,
        childCount: houseGroup.children.length,
        boundingBox: { min: box.min, max: box.max },
        center: center,
        size: size,
        maxDimension: Math.max(size.x, size.y, size.z)
      });

      houseGroup.position.sub(center);
      scene.add(houseGroup);
      
      console.log("📊 Escena después de agregar grupo:", {
        totalChildren: scene.children.length,
        hasHouseGroup: scene.children.includes(houseGroup)
      });

      // Ajustar cámara
      if (cameraRef.current) {
        const maxDim = Math.max(size.x, size.y, size.z);
        
        if (is3DMode && cameraRef.current instanceof THREE.PerspectiveCamera) {
          const distance = maxDim * 2.5; // Un poco más lejos para mejor vista
          cameraRef.current.position.set(distance, distance * 0.8, distance);
          cameraRef.current.lookAt(0, 0, 0);
          console.log("📷 Cámara 3D ajustada:", {
            position: cameraRef.current.position,
            distance: distance,
            lookingAt: '(0,0,0)'
          });
        } else if (!is3DMode && cameraRef.current instanceof THREE.OrthographicCamera) {
          cameraRef.current.position.set(0, maxDim * 2, 0);
          cameraRef.current.lookAt(0, 0, 0);
          console.log("📷 Cámara 2D ajustada:", { height: maxDim * 2 });
        }
        cameraRef.current.updateProjectionMatrix();
      }

      // 🔥 FORZAR RENDER MANUAL
      if (rendererRef.current && cameraRef.current) {
        rendererRef.current.render(scene, cameraRef.current);
        console.log("🎬 Frame renderizado manualmente");
      }

      console.log("✅ Plano renderizado exitosamente");
      setIsLoading(false);

    } catch (err) {
      console.error("❌ Error renderizando plano:", err);
      setError("Error al renderizar el modelo 3D");
      setIsLoading(false);
    }
  }, [planData, is3DMode, sceneReady]);

  // Inicializar escena 3D
  useEffect(() => {
    if (!containerRef.current) {
      console.log("⚠️ ContainerRef aún no existe");
      return;
    }

    const width = containerRef.current.clientWidth;
    const height = containerRef.current.clientHeight;
    
    console.log("🎬 INICIALIZANDO RENDERER:", {
      containerWidth: width,
      containerHeight: height,
      containerElement: containerRef.current,
      parentElement: containerRef.current.parentElement,
      parentSize: {
        width: containerRef.current.parentElement?.clientWidth,
        height: containerRef.current.parentElement?.clientHeight
      }
    });

    // Crear escena
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x1a1a2e); // 🔥 Fondo oscuro para ver geometrías claras
    sceneRef.current = scene;

    // Crear cámara apropiada basada en modo
    let camera: THREE.PerspectiveCamera | THREE.OrthographicCamera; // 👈 Tipo explícito añadido
    if (is3DMode) {
      // Cámara perspectiva para 3D
      camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
      camera.position.set(10, 10, 10);
    } else {
      // Cámara ortográfica para 2D (vista planta)
      const aspect = width / height;
      const frustumSize = 10;
      camera = new THREE.OrthographicCamera(
        (frustumSize * aspect) / -2,
        (frustumSize * aspect) / 2,
        frustumSize / 2,
        frustumSize / -2,
        0.1,
        1000
      );
      camera.position.set(0, 10, 0);
      camera.lookAt(0, 0, 0);
    }
    cameraRef.current = camera;

    // Iluminación mejorada
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.9); // Más luz ambiental
    scene.add(ambientLight);

    const directionalLight1 = new THREE.DirectionalLight(0xffffff, 1.2);
    directionalLight1.position.set(5, 10, 5);
    scene.add(directionalLight1);

    const directionalLight2 = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight2.position.set(-5, 5, -5);
    scene.add(directionalLight2);

    // Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(window.devicePixelRatio);
    containerRef.current.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // Controles
    const controls = new OrbitControls(camera, renderer.domElement);
    if (!is3DMode) {
      // Limitar rotación para modo 2D
      controls.maxPolarAngle = Math.PI / 2; // Limitar a vista superior
      controls.minPolarAngle = Math.PI / 2; // Limitar a vista superior
      controls.enableRotate = false;
    }
    controls.update();
    controlsRef.current = controls;

    // Grid helper (especialmente útil para 2D)
    const gridHelper = new THREE.GridHelper(20, 20);
    scene.add(gridHelper);

    // 🔥 MARCAR ESCENA COMO LISTA
    setTimeout(() => {
      setSceneReady(true);
      console.log("✅ Escena inicializada y lista para renderizar");
    }, 100);

    // Función de renderizado
    let frameCount = 0;
    const animate = () => {
      animationFrameRef.current = requestAnimationFrame(animate);
      controls.update();
      renderer.render(scene, camera);
      
      // Log cada 60 frames (aprox 1 segundo)
      if (frameCount % 60 === 0 && frameCount < 180) {
        console.log(`🎬 Frame ${frameCount}: Renderizando escena con ${scene.children.length} objetos`);
      }
      frameCount++;
    };
    animate();
    console.log("▶️ Loop de animación iniciado");

    // Manejar cambio de tamaño
    const handleResize = () => {
      if (!containerRef.current || !cameraRef.current || !rendererRef.current)
        return;

      const newWidth = containerRef.current.clientWidth;
      const newHeight = containerRef.current.clientHeight;

      if (cameraRef.current instanceof THREE.PerspectiveCamera) {
        cameraRef.current.aspect = newWidth / newHeight;
      } else if (cameraRef.current instanceof THREE.OrthographicCamera) {
        const aspect = newWidth / newHeight;
        const frustumSize = 10;
        cameraRef.current.left = (frustumSize * aspect) / -2;
        cameraRef.current.right = (frustumSize * aspect) / 2;
        cameraRef.current.top = frustumSize / 2;
        cameraRef.current.bottom = frustumSize / -2;
      }

      cameraRef.current.updateProjectionMatrix();
      rendererRef.current.setSize(newWidth, newHeight);
    };

    window.addEventListener("resize", handleResize);

    // Guardar referencia para cleanup
    const currentContainer = containerRef.current;
    const currentRenderer = renderer;

    // Limpieza al desmontar
    return () => {
      window.removeEventListener("resize", handleResize);

      setSceneReady(false); // 🔥 Resetear flag

      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }

      if (currentRenderer && currentContainer) {
        currentContainer.removeChild(currentRenderer.domElement);
      }

      if (controlsRef.current) {
        controlsRef.current.dispose();
      }

      if (currentRenderer) {
        currentRenderer.dispose();
      }
    };
  }, [is3DMode]);

  // 🎯 La carga de modelos OBJ/MTL fue eliminada - ahora renderizamos directo desde JSON
  
  return (
    <div className="model-viewer-container">
      <div className="model-viewer-header">
        <h3>Vista {is3DMode ? "3D" : "2D"}</h3>
        <button className="view-toggle-button" onClick={onToggleViewMode}>
          Cambiar a vista {is3DMode ? "2D" : "3D"}
        </button>
      </div>

      <div className="model-viewport" ref={containerRef}>
        {isLoading && (
          <div className="loading-overlay">
            <div className="spinner"></div>
            <p>Cargando modelo...</p>
          </div>
        )}

        {error && (
          <div className="error-overlay">
            <p>Error: {error}</p>
            <button onClick={() => setError(null)}>Reintentar</button>
          </div>
        )}
      </div>
    </div>
  );
};

export default ModelViewer;
