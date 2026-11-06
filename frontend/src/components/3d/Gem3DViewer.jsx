import React, { useRef, useState, useEffect, Suspense } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, useGLTF, Center } from "@react-three/drei";
import { useLanguage } from "../../context/LanguageContext";

// Sub-component to load a GLB/GLTF model dynamically with error boundary
function DynamicGLBModel({ url, wireframe }) {
  const { scene } = useGLTF(url);

  // Apply wireframe override if requested
  useEffect(() => {
    if (scene) {
      scene.traverse((child) => {
        if (child.isMesh && child.material) {
          child.material.wireframe = Boolean(wireframe);
        }
      });
    }
  }, [scene, wireframe]);

  return (
    <Center>
      <primitive object={scene} scale={1.5} />
    </Center>
  );
}

// Fallback mesh if model is loading or URL is procedural
function ProceduralGemFallback({ wireframe, method }) {
  const isPhotogrammetry = method === "photogrammetry";

  return (
    <Center>
      <group position={[0, -0.5, 0]}>
        {/* Mountainous natural base */}
        <mesh position={[0, 0.4, 0]}>
          <coneGeometry args={[2.8, 2.2, 16]} />
          <meshStandardMaterial
            color={isPhotogrammetry ? "#a68868" : "#7d9183"}
            roughness={0.8}
            wireframe={wireframe}
          />
        </mesh>
        {/* Ridge detail */}
        <mesh position={[0.6, 1.2, 0.3]}>
          <coneGeometry args={[1.5, 1.8, 12]} />
          <meshStandardMaterial
            color={isPhotogrammetry ? "#876848" : "#5d7363"}
            roughness={0.85}
            wireframe={wireframe}
          />
        </mesh>
      </group>
    </Center>
  );
}

export default function Gem3DViewer({
  modelUrl,
  method = "photogrammetry",
  title = "3D Tourist Model",
  customChildren = null,
  hotspots = [],
  activeHotspot = null,
  onHotspotClick = () => {},
}) {
  const { t } = useLanguage();
  const controlsRef = useRef();
  const containerRef = useRef();

  const [lightingMode, setLightingMode] = useState("day"); // 'day', 'sunset', 'night'
  const [autoRotate, setAutoRotate] = useState(false);
  const [wireframe, setWireframe] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [hasWebGL, setHasWebGL] = useState(true);

  // Check WebGL availability
  useEffect(() => {
    try {
      const canvas = document.createElement("canvas");
      const gl = canvas.getContext("webgl") || canvas.getContext("experimental-webgl");
      setHasWebGL(Boolean(gl));
    } catch (e) {
      setHasWebGL(false);
    }
  }, []);

  const handleResetCamera = () => {
    if (controlsRef.current) {
      controlsRef.current.reset();
    }
  };

  const handleToggleFullscreen = () => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen?.().then(() => setIsFullscreen(true)).catch(() => {});
    } else {
      document.exitFullscreen?.().then(() => setIsFullscreen(false)).catch(() => {});
    }
  };

  if (!hasWebGL) {
    return (
      <div className="webgl-fallback-card">
        <h3>⚠️ {t("three_d_webgl_error_title")}</h3>
        <p>{t("three_d_webgl_error_desc")}</p>
      </div>
    );
  }

  // Lighting configurations
  const lightingConfigs = {
    day: {
      ambient: { color: "#ffffff", intensity: 1.1 },
      dir1: { color: "#fff7e6", intensity: 1.6, position: [8, 12, 6] },
      dir2: { color: "#b3d9ff", intensity: 0.6, position: [-6, 4, -6] },
      bg: "#eaf0ed",
    },
    sunset: {
      ambient: { color: "#ffd4aa", intensity: 0.8 },
      dir1: { color: "#ff7733", intensity: 2.2, position: [10, 4, 8] },
      dir2: { color: "#994466", intensity: 0.8, position: [-8, 2, -6] },
      bg: "#2b1c24",
    },
    night: {
      ambient: { color: "#223355", intensity: 0.6 },
      dir1: { color: "#88bbff", intensity: 1.2, position: [6, 12, 4] },
      dir2: { color: "#446688", intensity: 0.4, position: [-6, 2, -4] },
      bg: "#0c1219",
    },
  };

  const currentLighting = lightingConfigs[lightingMode] || lightingConfigs.day;

  return (
    <div
      ref={containerRef}
      className={`gem-3d-viewer-container ${isFullscreen ? "fullscreen" : ""}`}
      style={{ position: "relative", width: "100%", height: "520px", background: currentLighting.bg, borderRadius: "14px", overflow: "hidden" }}
    >
      {/* 3D Toolbar Controls */}
      <div className="viewer-toolbar-overlay">
        <div className="toolbar-left">
          <span className="viewer-title-badge">🕹️ 3D: {title}</span>
        </div>

        <div className="toolbar-right">
          {/* Lighting Mode Selector */}
          <div className="toolbar-btn-group">
            <button
              type="button"
              className={`toolbar-btn ${lightingMode === "day" ? "active" : ""}`}
              onClick={() => setLightingMode("day")}
              title="Daylight Mode"
            >
              ☀️ {t("three_d_lighting_day")}
            </button>
            <button
              type="button"
              className={`toolbar-btn ${lightingMode === "sunset" ? "active" : ""}`}
              onClick={() => setLightingMode("sunset")}
              title="Sunset Mode"
            >
              🌅 {t("three_d_lighting_sunset")}
            </button>
            <button
              type="button"
              className={`toolbar-btn ${lightingMode === "night" ? "active" : ""}`}
              onClick={() => setLightingMode("night")}
              title="Night Illumination"
            >
              🌙 {t("three_d_lighting_night")}
            </button>
          </div>

          {/* Auto Rotate Toggle */}
          <button
            type="button"
            className={`toolbar-btn ${autoRotate ? "active" : ""}`}
            onClick={() => setAutoRotate(!autoRotate)}
            title="Toggle 360° Auto-Rotation"
          >
            🔄 {autoRotate ? t("three_d_stop_rotate") : t("three_d_auto_rotate")}
          </button>

          {/* Wireframe Mode Toggle */}
          <button
            type="button"
            className={`toolbar-btn ${wireframe ? "active" : ""}`}
            onClick={() => setWireframe(!wireframe)}
            title="Toggle 3D Wireframe Mesh"
          >
            📐 {t("three_d_wireframe")}
          </button>

          {/* Reset View Button */}
          <button
            type="button"
            className="toolbar-btn"
            onClick={handleResetCamera}
            title="Reset Camera Viewpoint"
          >
            🎯 {t("three_d_reset_view")}
          </button>

          {/* Fullscreen Toggle */}
          <button
            type="button"
            className="toolbar-btn"
            onClick={handleToggleFullscreen}
            title="Toggle Fullscreen"
          >
            ⛶ {isFullscreen ? t("three_d_exit_fullscreen") : t("three_d_fullscreen")}
          </button>
        </div>
      </div>

      {/* Three.js R3F Canvas */}
      <Canvas
        camera={{ position: [0, 4, 9], fov: 45 }}
        style={{ width: "100%", height: "100%" }}
      >
        {/* Lights */}
        <ambientLight
          color={currentLighting.ambient.color}
          intensity={currentLighting.ambient.intensity}
        />
        <directionalLight
          position={currentLighting.dir1.position}
          color={currentLighting.dir1.color}
          intensity={currentLighting.dir1.intensity}
          castShadow
        />
        <directionalLight
          position={currentLighting.dir2.position}
          color={currentLighting.dir2.color}
          intensity={currentLighting.dir2.intensity}
        />

        {/* Orbit Controls */}
        <OrbitControls
          ref={controlsRef}
          enableDamping
          dampingFactor={0.06}
          minDistance={2.5}
          maxDistance={25}
          maxPolarAngle={Math.PI / 2 + 0.05} // Prevent camera from dropping below ground
          autoRotate={autoRotate}
          autoRotateSpeed={1.5}
        />

        {/* 3D Model Content */}
        <Suspense fallback={null}>
          {customChildren ? (
            customChildren
          ) : modelUrl ? (
            <DynamicGLBModel url={modelUrl} wireframe={wireframe} />
          ) : (
            <ProceduralGemFallback wireframe={wireframe} method={method} />
          )}
        </Suspense>

        {/* Ground grid shadow plane */}
        <mesh position={[0, -0.65, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[30, 30]} />
          <shadowMaterial opacity={0.15} />
        </mesh>
      </Canvas>

      {/* Floating Instructions Helper */}
      <div className="viewer-instructions-helper">
        <span>🖱️ {t("three_d_drag_rotate")}</span>
        <span>•</span>
        <span>🔍 {t("three_d_scroll_zoom")}</span>
        <span>•</span>
        <span>🖐️ {t("three_d_right_click_pan")}</span>
      </div>
    </div>
  );
}
