import React, { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls";
import { OBJLoader } from "three/examples/jsm/loaders/OBJLoader";
import { MTLLoader } from "three/examples/jsm/loaders/MTLLoader";
import "./ModelViewer.css";

interface ModelViewerProps {
  objUrl?: string;
  mtlUrl?: string;
  is3DMode: boolean;
  onToggleViewMode: () => void;
}

const ModelViewer: React.FC<ModelViewerProps> = ({
  objUrl,
  mtlUrl,
  is3DMode,
  onToggleViewMode,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<
    THREE.PerspectiveCamera | THREE.OrthographicCamera | null
  >(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  // Inicializar escena 3D
  // Inicializar escena 3D
  useEffect(() => {
    if (!containerRef.current) return;

    // Crear escena
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xf5f5f5);
    sceneRef.current = scene;

    // Configurar tamaño
    const width = containerRef.current.clientWidth;
    const height = containerRef.current.clientHeight;

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

    // Iluminación
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.7);
    scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(1, 2, 1);
    scene.add(directionalLight);

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

    // Función de renderizado
    const animate = () => {
      animationFrameRef.current = requestAnimationFrame(animate);
      controls.update();
      renderer.render(scene, camera);
    };
    animate();

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

    // Limpieza al desmontar
    return () => {
      window.removeEventListener("resize", handleResize);

      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }

      if (rendererRef.current && containerRef.current) {
        containerRef.current.removeChild(rendererRef.current.domElement);
      }

      if (controlsRef.current) {
        controlsRef.current.dispose();
      }

      if (rendererRef.current) {
        rendererRef.current.dispose();
      }
    };
  }, [is3DMode]);

  // Cargar modelo cuando cambian las URLs
  useEffect(() => {
    if (!objUrl || !sceneRef.current) return;

    setIsLoading(true);
    setError(null);

    // Limpiar modelos previos
    if (sceneRef.current) {
      sceneRef.current.children = sceneRef.current.children.filter(
        (child) =>
          child instanceof THREE.Light || child instanceof THREE.GridHelper
      );
    }

    const loadModel = async () => {
      try {
        const objLoader = new OBJLoader();

        if (mtlUrl) {
          // Cargar materiales si están disponibles
          const mtlLoader = new MTLLoader();
          const materials = await new Promise<MTLLoader.MaterialCreator>(
            (resolve, reject) => {
              mtlLoader.load(mtlUrl, resolve, undefined, reject);
            }
          );

          materials.preload();
          objLoader.setMaterials(materials);
        }

        // Cargar el modelo OBJ
        const object = await new Promise<THREE.Group>((resolve, reject) => {
          objLoader.load(objUrl, resolve, undefined, reject);
        });

        // Centrar el modelo
        const box = new THREE.Box3().setFromObject(object);
        const center = box.getCenter(new THREE.Vector3());
        const size = box.getSize(new THREE.Vector3());

        // Ajustar escala del modelo
        const maxDim = Math.max(size.x, size.y, size.z);
        if (maxDim > 0) {
          const scale = 5 / maxDim;
          object.scale.set(scale, scale, scale);
        }

        // Centrar el modelo
        object.position.x = -center.x;
        object.position.y = -center.y;
        object.position.z = -center.z;

        if (sceneRef.current) {
          sceneRef.current.add(object);

          // Ajustar cámara si es necesario
          if (cameraRef.current) {
            if (
              is3DMode &&
              cameraRef.current instanceof THREE.PerspectiveCamera
            ) {
              cameraRef.current.position.set(5, 5, 5);
              cameraRef.current.lookAt(0, 0, 0);
            }
          }
        }

        setIsLoading(false);
      } catch (err) {
        console.error("Error cargando modelo:", err);
        setError("No se pudo cargar el modelo");
        setIsLoading(false);
      }
    };

    loadModel();
  }, [objUrl, mtlUrl, is3DMode]);

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
