"use client";

import { Canvas, useFrame, useLoader, useThree } from "@react-three/fiber";
import {
  Component,
  Suspense,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import * as THREE from "three";

/**
 * Physical render of a competition artwork.
 *
 * Mounted only where a single large artwork is the focus (landing hero,
 * collection hero). Grid rows and board fragments keep the CSS artwork, so a
 * route never holds more than one WebGL context.
 */

export type SceneTheme = "explorer" | "bloom" | "chrome" | "orbit";

const THEMES: SceneTheme[] = ["explorer", "bloom", "chrome", "orbit"];

export function isSceneTheme(theme: string): theme is SceneTheme {
  return (THEMES as string[]).includes(theme);
}

const CONTEXT_ATTRIBUTES: WebGLContextAttributes = {
  alpha: true,
  antialias: true,
  powerPreference: "high-performance",
};

let webglSupport: boolean | null = null;

/**
 * Three renders with WebGL2 only, so probe WebGL2 once on a throwaway canvas
 * and release the context immediately. Asking one canvas for a second context
 * type is what makes browsers refuse the request with "Canvas has an existing
 * context of a different type".
 */
function supportsWebgl() {
  if (webglSupport !== null) return webglSupport;
  try {
    const probe = document.createElement("canvas");
    const context = probe.getContext("webgl2");
    webglSupport = Boolean(context);
    context?.getExtension("WEBGL_lose_context")?.loseContext();
  } catch {
    webglSupport = false;
  }
  return webglSupport;
}

export default function ArtworkScene({
  theme,
  onReady,
}: {
  theme: SceneTheme;
  onReady?: () => void;
}) {
  const host = useRef<HTMLDivElement>(null);
  const disposeStudio = useRef<(() => void) | null>(null);
  const [live, setLive] = useState(false);
  const [motion, setMotion] = useState(true);

  useEffect(() => {
    const element = host.current;
    if (!element) return;
    if (typeof IntersectionObserver === "undefined") {
      const frame = requestAnimationFrame(() => {
        if (supportsWebgl()) setLive(true);
      });
      return () => cancelAnimationFrame(frame);
    }
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        observer.disconnect();
        if (supportsWebgl()) setLive(true);
      },
      { rootMargin: "240px 0px" },
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const apply = () => setMotion(!query.matches);
    apply();
    query.addEventListener("change", apply);
    return () => query.removeEventListener("change", apply);
  }, []);

  useEffect(() => () => disposeStudio.current?.(), []);

  return (
    <div className="artwork-scene" ref={host} aria-hidden="true">
      {live && (
        <SceneBoundary>
          <Canvas
            dpr={[1, 1.75]}
            frameloop={motion ? "always" : "demand"}
            camera={{ position: [0, 0, 5.4], fov: 38 }}
            gl={(defaults) =>
              studioRenderer(defaults.canvas as HTMLCanvasElement)
            }
            onCreated={({ gl, scene }) => {
              gl.setClearColor(0x000000, 0);
              disposeStudio.current?.();
              disposeStudio.current = buildStudio(gl, scene);
            }}
          >
            <Suspense fallback={null}>
              <Study theme={theme} motion={motion} onReady={onReady} />
            </Suspense>
          </Canvas>
        </SceneBoundary>
      )}
    </div>
  );
}

/* A GL or asset failure must never leave a blank hero behind: the CSS poster
   underneath stays visible because we simply stop rendering. */
class SceneBoundary extends Component<
  { children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? null : this.props.children;
  }
}

function Study({
  theme,
  motion,
  onReady,
}: {
  theme: SceneTheme;
  motion: boolean;
  onReady?: () => void;
}) {
  const parallax = useRef<THREE.Group>(null);

  useFrame((state, delta) => {
    const group = parallax.current;
    if (!group || !motion) return;
    const step = Math.min(delta, 0.05);
    group.rotation.x = THREE.MathUtils.damp(
      group.rotation.x,
      state.pointer.y * 0.16,
      3,
      step,
    );
    group.rotation.y = THREE.MathUtils.damp(
      group.rotation.y,
      state.pointer.x * 0.3,
      3,
      step,
    );
    group.position.y = Math.sin(state.clock.elapsedTime * 0.5) * 0.055;
  });

  return (
    <>
      <ambientLight intensity={0.55} />
      <directionalLight
        position={[4, 5.5, 6]}
        intensity={2.6}
        color="#fbf8f2"
      />
      <spotLight
        position={[-5.2, -1.6, -3.2]}
        angle={0.85}
        penumbra={1}
        intensity={4}
        distance={18}
        color="#eef2e8"
      />
      <group ref={parallax}>
        <group rotation={basePose(theme)}>
          {theme === "bloom" && <Bloom />}
          {theme === "chrome" && <Chrome />}
          {theme === "orbit" && <Orbit />}
          {theme === "explorer" && <Mounted />}
        </group>
      </group>
      <FirstFrame motion={motion} onReady={onReady} />
    </>
  );
}

function basePose(theme: SceneTheme): [number, number, number] {
  if (theme === "bloom") return [0.06, -0.18, 0];
  if (theme === "explorer") return [0.04, -0.24, 0];
  return [0.14, -0.26, 0];
}

/**
 * Three asks the canvas for its own context and logs a hard console error when
 * the canvas already holds a context of another type. Creating the context
 * here keeps that failure silent: without one the poster underneath stays.
 */
function studioRenderer(canvas: HTMLCanvasElement) {
  const context = canvas.getContext("webgl2", CONTEXT_ATTRIBUTES);
  if (!context) throw new Error("WebGL2 is unavailable for this artwork.");
  return new THREE.WebGLRenderer({
    canvas,
    context: context as unknown as WebGLRenderingContext,
    ...CONTEXT_ATTRIBUTES,
  });
}

/**
 * A procedural studio environment. Metals need an environment map to read as
 * metal; building it from emissive panels keeps the render offline (no HDR
 * fetch, no extra dependency) and lets the key, rim and brand lights be tuned
 * for Ryvo's black canvas.
 *
 * Runs from the renderer's creation callback rather than an effect so the
 * scene is never mutated during React's render or commit phase.
 */
function buildStudio(gl: THREE.WebGLRenderer, scene: THREE.Scene) {
  const pmrem = new THREE.PMREMGenerator(gl);
  const studio = new THREE.Scene();
  studio.background = new THREE.Color("#262b23");

  const panels: [string, number, [number, number, number], number][] = [
    ["#f4f7ef", 4.4, [0, 3.6, 2.4], 5.5],
    ["#dfe4dc", 1.6, [0, 1.2, 5], 6],
    ["#60b800", 1.1, [-2.6, 1.9, -3.6], 3.6],
    ["#5b47a8", 1.4, [3.6, 1.2, -1.8], 4.2],
    ["#f0f3ec", 1.1, [4.6, 0.4, -0.6], 3.4],
    ["#9aa396", 1.2, [-4.2, 2.2, -2.6], 5],
    ["#1d211a", 1, [0, -3.2, -2.4], 7],
  ];

  const meshes = panels.map(([color, intensity, position, size]) => {
    const mesh = new THREE.Mesh(
      new THREE.PlaneGeometry(size, size),
      new THREE.MeshBasicMaterial({
        color: new THREE.Color(color).multiplyScalar(intensity),
        side: THREE.DoubleSide,
      }),
    );
    mesh.position.set(...position);
    mesh.lookAt(0, 0, 0);
    studio.add(mesh);
    return mesh;
  });

  const target = pmrem.fromScene(studio, 0.03);
  scene.environment = target.texture;
  scene.environmentIntensity = 1.15;

  return () => {
    scene.environment = null;
    target.dispose();
    pmrem.dispose();
    meshes.forEach((mesh) => {
      mesh.geometry.dispose();
      (mesh.material as THREE.Material).dispose();
    });
  };
}

function CastMetal({
  color = "#c6cfca",
  roughness = 0.14,
}: {
  color?: string;
  roughness?: number;
}) {
  return (
    <meshPhysicalMaterial
      color={color}
      metalness={1}
      roughness={roughness}
      clearcoat={0.7}
      clearcoatRoughness={0.18}
      envMapIntensity={1.2}
    />
  );
}

function Bloom() {
  const petals = useMemo(
    () => Array.from({ length: 8 }, (_, index) => (index / 8) * Math.PI * 2),
    [],
  );

  return (
    <group scale={0.96}>
      {petals.map((angle, index) => (
        <mesh
          key={angle}
          position={[Math.cos(angle) * 0.6, Math.sin(angle) * 0.6, 0]}
          rotation={[0, 0, angle]}
          scale={[0.94, 0.54, 0.32]}
        >
          <sphereGeometry args={[0.64, 48, 32]} />
          <CastMetal
            color={index % 2 ? "#bba6e6" : "#8f7bbd"}
            roughness={0.24}
          />
        </mesh>
      ))}
      <mesh scale={0.6}>
        <sphereGeometry args={[0.64, 48, 32]} />
        <meshPhysicalMaterial
          color="#e0c268"
          metalness={1}
          roughness={0.17}
          clearcoat={1}
          clearcoatRoughness={0.07}
          envMapIntensity={1.3}
        />
      </mesh>
    </group>
  );
}

function Chrome() {
  const rings = [
    { angle: -Math.PI / 9, scale: 1 },
    { angle: THREE.MathUtils.degToRad(65), scale: 0.82 },
    { angle: THREE.MathUtils.degToRad(130), scale: 0.74 },
  ];

  return (
    <group scale={0.84}>
      {rings.map((ring) => (
        <mesh
          key={ring.angle}
          rotation={[0.16, 0, ring.angle]}
          scale={ring.scale}
        >
          <torusGeometry args={[1.18, 0.26, 48, 128]} />
          <CastMetal color="#dae1de" roughness={0.15} />
        </mesh>
      ))}
    </group>
  );
}

function Orbit() {
  return (
    <group scale={0.8}>
      <mesh rotation={[1.05, 0.2, 0]}>
        <torusGeometry args={[1.28, 0.055, 24, 144]} />
        <CastMetal color="#d6d4c2" roughness={0.26} />
      </mesh>
      <mesh rotation={[0.5, -0.42, 0.92]}>
        <torusGeometry args={[0.94, 0.042, 20, 120]} />
        <CastMetal color="#9b9779" roughness={0.3} />
      </mesh>
      <mesh scale={0.52}>
        <sphereGeometry args={[0.62, 48, 32]} />
        <CastMetal color="#e4dfc7" roughness={0.12} />
      </mesh>
      <mesh position={[1.14, 0.24, 0.32]} scale={0.11}>
        <sphereGeometry args={[0.55, 24, 24]} />
        <meshPhysicalMaterial
          color="#60b800"
          metalness={0.5}
          roughness={0.2}
          emissive="#60b800"
          emissiveIntensity={0.45}
        />
      </mesh>
    </group>
  );
}

/**
 * The complete picture, presented as an object instead of a flat banner: the
 * artwork sits in a metal mount, angled so the hero reads as a collectible.
 */
function Mounted() {
  const source = useLoader(THREE.TextureLoader, "/other-side.png");

  const texture = useMemo(() => {
    const copy = source.clone();
    copy.colorSpace = THREE.SRGBColorSpace;
    copy.anisotropy = 8;
    copy.needsUpdate = true;
    return copy;
  }, [source]);

  useEffect(() => () => texture.dispose(), [texture]);

  const aspect =
    texture.image?.width && texture.image?.height
      ? texture.image.width / texture.image.height
      : 0.78;

  const height = 2.34;
  const width = height * aspect;

  return (
    <group rotation={[0, 0, -0.015]}>
      <mesh position={[0, 0, -0.07]}>
        <planeGeometry args={[width + 0.13, height + 0.13]} />
        <CastMetal color="#8b9591" roughness={0.3} />
      </mesh>
      <mesh>
        <planeGeometry args={[width, height]} />
        <meshStandardMaterial
          map={texture}
          emissiveMap={texture}
          emissive="#ffffff"
          emissiveIntensity={0.42}
          roughness={0.68}
          metalness={0.04}
        />
      </mesh>
      <mesh
        position={[0, -height / 2 - 0.18, -0.32]}
        rotation={[-Math.PI / 2.2, 0, 0]}
      >
        <planeGeometry args={[width * 1.05, 1.4]} />
        <meshBasicMaterial color="#000000" transparent opacity={0.18} />
      </mesh>
    </group>
  );
}

function FirstFrame({
  motion,
  onReady,
}: {
  motion: boolean;
  onReady?: () => void;
}) {
  const invalidate = useThree((state) => state.invalidate);
  const reported = useRef(false);

  useEffect(() => {
    if (!motion) invalidate();
  }, [invalidate, motion]);

  useFrame(() => {
    if (reported.current) return;
    reported.current = true;
    onReady?.();
  });

  return null;
}
