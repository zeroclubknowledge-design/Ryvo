"use client";

import { LiquidMetal } from "@paper-design/shaders-react";
import { Canvas, useFrame } from "@react-three/fiber";
import { useMemo, useRef, useSyncExternalStore } from "react";
import * as THREE from "three";

/**
 * WebGL layers for the landing close.
 *
 * BrandGradient ports the "water plane" from ruucm/shadergradient onto this
 * project's react-three-fiber: a dense plane displaced by animated Perlin
 * noise, shaded from its own slope and coloured across three brand stops,
 * finished with film grain. (The published @shadergradient/react bundle is
 * pinned to an older three.js and rewrites three's global shader chunks, which
 * would break the artwork scene, so the shader lives here instead.)
 *
 * LiquidLogo renders the Ryvo mark through Paper's liquid-metal shader, the
 * effect behind paper-design/liquid-logo.
 *
 * Both are loaded with next/dynamic and mounted only while the section is near
 * the viewport, so they never share the screen with the hero artwork context.
 */

const reducedMotionQuery = "(prefers-reduced-motion: reduce)";
function subscribe(callback: () => void) {
  const query = window.matchMedia(reducedMotionQuery);
  query.addEventListener("change", callback);
  return () => query.removeEventListener("change", callback);
}
const useReducedMotion = () =>
  useSyncExternalStore(subscribe, () => window.matchMedia(reducedMotionQuery).matches, () => true);

const noise = /* glsl */ `
vec4 permute(vec4 x){return mod(((x*34.0)+1.0)*x,289.0);}
vec4 taylorInvSqrt(vec4 r){return 1.79284291400159-0.85373472095314*r;}
vec3 fade(vec3 t){return t*t*t*(t*(t*6.0-15.0)+10.0);}
float cnoise(vec3 P){
  vec3 Pi0=floor(P),Pi1=Pi0+vec3(1.0);Pi0=mod(Pi0,289.0);Pi1=mod(Pi1,289.0);
  vec3 Pf0=fract(P),Pf1=Pf0-vec3(1.0);
  vec4 ix=vec4(Pi0.x,Pi1.x,Pi0.x,Pi1.x),iy=vec4(Pi0.yy,Pi1.yy),iz0=Pi0.zzzz,iz1=Pi1.zzzz;
  vec4 ixy=permute(permute(ix)+iy),ixy0=permute(ixy+iz0),ixy1=permute(ixy+iz1);
  vec4 gx0=ixy0/7.0,gy0=fract(floor(gx0)/7.0)-0.5;gx0=fract(gx0);
  vec4 gz0=vec4(0.5)-abs(gx0)-abs(gy0),sz0=step(gz0,vec4(0.0));gx0-=sz0*(step(0.0,gx0)-0.5);gy0-=sz0*(step(0.0,gy0)-0.5);
  vec4 gx1=ixy1/7.0,gy1=fract(floor(gx1)/7.0)-0.5;gx1=fract(gx1);
  vec4 gz1=vec4(0.5)-abs(gx1)-abs(gy1),sz1=step(gz1,vec4(0.0));gx1-=sz1*(step(0.0,gx1)-0.5);gy1-=sz1*(step(0.0,gy1)-0.5);
  vec3 g000=vec3(gx0.x,gy0.x,gz0.x),g100=vec3(gx0.y,gy0.y,gz0.y),g010=vec3(gx0.z,gy0.z,gz0.z),g110=vec3(gx0.w,gy0.w,gz0.w);
  vec3 g001=vec3(gx1.x,gy1.x,gz1.x),g101=vec3(gx1.y,gy1.y,gz1.y),g011=vec3(gx1.z,gy1.z,gz1.z),g111=vec3(gx1.w,gy1.w,gz1.w);
  vec4 n0=taylorInvSqrt(vec4(dot(g000,g000),dot(g010,g010),dot(g100,g100),dot(g110,g110)));g000*=n0.x;g010*=n0.y;g100*=n0.z;g110*=n0.w;
  vec4 n1=taylorInvSqrt(vec4(dot(g001,g001),dot(g011,g011),dot(g101,g101),dot(g111,g111)));g001*=n1.x;g011*=n1.y;g101*=n1.z;g111*=n1.w;
  float n000=dot(g000,Pf0),n100=dot(g100,vec3(Pf1.x,Pf0.yz)),n010=dot(g010,vec3(Pf0.x,Pf1.y,Pf0.z)),n110=dot(g110,vec3(Pf1.xy,Pf0.z));
  float n001=dot(g001,vec3(Pf0.xy,Pf1.z)),n101=dot(g101,vec3(Pf1.x,Pf0.y,Pf1.z)),n011=dot(g011,vec3(Pf0.x,Pf1.yz)),n111=dot(g111,Pf1);
  vec3 f=fade(Pf0);
  vec4 nz=mix(vec4(n000,n100,n010,n110),vec4(n001,n101,n011,n111),f.z);
  vec2 nyz=mix(nz.xy,nz.zw,f.y);
  return 2.2*mix(nyz.x,nyz.y,f.x);
}`;

const vertexShader = /* glsl */ `
uniform float uTime, uSpeed, uDensity, uStrength, uFrequency;
varying vec2 vUv;
varying float vDistort;
varying vec3 vPos;
${noise}
void main(){
  vUv = uv;
  float t = uTime * uSpeed;
  // Water plane: low-frequency swell plus finer ripples, travelling along the plane.
  float swell = cnoise(vec3(position.x * uDensity * 0.18 + t, position.y * uDensity * 0.18, t * 0.6));
  float ripple = cnoise(vec3(position.xy * uDensity * 0.5 * (uFrequency / 5.5), t * 1.4)) * 0.25;
  vDistort = swell + ripple;
  vec3 p = position + normal * vDistort * uStrength * 0.22;
  vPos = p;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
}`;

const fragmentShader = /* glsl */ `
uniform vec3 uColor1, uColor2, uColor3;
uniform float uBrightness, uGrain, uTime;
varying vec2 vUv;
varying float vDistort;
varying vec3 vPos;
float hash(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
void main(){
  float d = clamp(vDistort * 0.5 + 0.5, 0.0, 1.0);
  vec3 color = mix(uColor1, uColor2, smoothstep(0.0, 0.85, vUv.x * 0.6 + d * 0.7));
  color = mix(color, uColor3, smoothstep(0.55, 1.0, d) * smoothstep(0.15, 0.9, vUv.y));
  // Light from the surface slope so the swell reads as a physical sheet.
  vec3 n = normalize(cross(dFdx(vPos), dFdy(vPos)));
  float light = 0.62 + 0.38 * clamp(dot(n, normalize(vec3(-0.4, 0.6, 0.9))), 0.0, 1.0);
  float sheen = pow(clamp(dot(n, normalize(vec3(0.2, 0.3, 1.0))), 0.0, 1.0), 24.0) * 0.18;
  color = color * light * uBrightness + sheen;
  color += (hash(gl_FragCoord.xy + fract(uTime)) - 0.5) * uGrain;
  gl_FragColor = vec4(color, 1.0);
}`;

function WaterPlane({ still }: { still: boolean }) {
  const material = useRef<THREE.ShaderMaterial>(null);
  const uniforms = useMemo(() => ({
    uTime: { value: 0.4 },
    uSpeed: { value: 0.09 },
    uDensity: { value: 1.3 },
    uStrength: { value: 3.2 },
    uFrequency: { value: 5.5 },
    uColor1: { value: new THREE.Color("#6338bc") },
    uColor2: { value: new THREE.Color("#140826") },
    uColor3: { value: new THREE.Color("#c31dc3") },
    uBrightness: { value: 1.15 },
    uGrain: { value: 0.06 },
  }), []);
  useFrame((_, delta) => {
    if (!still && material.current) material.current.uniforms.uTime.value += Math.min(delta, 0.1);
  });
  return (
    <mesh rotation={[-0.35, 0, -1.05]} scale={[1.6, 1, 1]}>
      <planeGeometry args={[10, 10, 160, 160]} />
      <shaderMaterial
        ref={material}
        uniforms={uniforms}
        vertexShader={vertexShader}
        fragmentShader={fragmentShader}
        side={THREE.DoubleSide}
      />
    </mesh>
  );
}

export function BrandGradient() {
  const still = useReducedMotion();
  return (
    <Canvas
      className="brand-gradient-canvas"
      dpr={1}
      frameloop={still ? "demand" : "always"}
      camera={{ position: [0, 0, 3.4], fov: 45 }}
      gl={{ antialias: false, alpha: false, powerPreference: "low-power" }}
      style={{ pointerEvents: "none" }}
    >
      <color attach="background" args={["#050505"]} />
      <WaterPlane still={still} />
    </Canvas>
  );
}

export function LiquidLogo({ size = 148 }: { size?: number }) {
  const still = useReducedMotion();
  return (
    <LiquidMetal
      className="liquid-logo"
      width={size}
      height={size}
      image="/ryvo-logo-mark.png"
      colorBack="#00000000"
      colorTint="#f6e9ff"
      repetition={3}
      softness={0.35}
      shiftRed={0.35}
      shiftBlue={0.35}
      distortion={0.08}
      contour={0.45}
      angle={70}
      fit="contain"
      scale={0.9}
      speed={still ? 0 : 0.55}
      maxPixelCount={size * size * 4}
    />
  );
}
