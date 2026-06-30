"use client";

/* eslint-disable react-hooks/purity, react-hooks/immutability, react-hooks/refs --
   This scene is an imperative three.js render loop (useFrame mutates uniforms,
   refs and the camera every frame, particle buffers are randomized once at
   setup time, and a shared THREE.Timer is lazily created via the documented
   `if (ref.current == null) ref.current = ...` pattern) — exactly what React
   Three Fiber is built around. The React Compiler's purity/immutability/refs
   rules assume render output is pure and that ref values are never read or
   mutated outside effects, which doesn't hold for r3f's per-frame mutation
   model and produces false positives throughout this file. */

import { useRef, useState, useMemo } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Html } from "@react-three/drei";
import { AnimatePresence, motion } from "motion/react";
import * as THREE from "three";
import { EASE } from "@/lib/motion";

/* ----------------------------------------------------------------------- */
/* Shared time source                                                      */
/*                                                                         */
/* r3f's `state.clock` is a THREE.Clock under the hood, now deprecated —   */
/* and unsafe to read from many independent useFrame callbacks because     */
/* Clock mutates its internal state on every getDelta() call. THREE.Timer  */
/* is built to be queried many times per frame and always return the same  */
/* value, so every shader/animation in this scene reads time from exactly  */
/* one Timer, updated exactly once per frame (at render-priority -1, which */
/* r3f always runs before priority-0 subscribers). That removes any        */
/* possibility of different orbs/particles animating from slightly         */
/* different "now" values within the same frame, which is what produced    */
/* the flicker on the After-orb side (its shaders are far more sensitive   */
/* to tiny time deltas than the Before orb's matte, slow-moving surface).  */
/* ----------------------------------------------------------------------- */

function useSharedTimer() {
  const timerRef = useRef<THREE.Timer | null>(null);
  if (!timerRef.current) timerRef.current = new THREE.Timer();
  return timerRef as React.RefObject<THREE.Timer>;
}

/* ----------------------------------------------------------------------- */
/* Shared GLSL helpers                                                     */
/* ----------------------------------------------------------------------- */

const NOISE_GLSL = /* glsl */ `
  vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
  vec4 mod289(vec4 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
  vec4 permute(vec4 x) { return mod289(((x * 34.0) + 1.0) * x); }
  vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }

  float snoise(vec3 v) {
    const vec2 C = vec2(1.0 / 6.0, 1.0 / 3.0);
    const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);
    vec3 i  = floor(v + dot(v, C.yyy));
    vec3 x0 = v - i + dot(i, C.xxx);
    vec3 g = step(x0.yzx, x0.xyz);
    vec3 l = 1.0 - g;
    vec3 i1 = min(g.xyz, l.zxy);
    vec3 i2 = max(g.xyz, l.zxy);
    vec3 x1 = x0 - i1 + C.xxx;
    vec3 x2 = x0 - i2 + C.yyy;
    vec3 x3 = x0 - D.yyy;
    i = mod289(i);
    vec4 p = permute(permute(permute(
      i.z + vec4(0.0, i1.z, i2.z, 1.0))
      + i.y + vec4(0.0, i1.y, i2.y, 1.0))
      + i.x + vec4(0.0, i1.x, i2.x, 1.0));
    float n_ = 0.142857142857;
    vec3 ns = n_ * D.wyz - D.xzx;
    vec4 j = p - 49.0 * floor(p * ns.z * ns.z);
    vec4 x_ = floor(j * ns.z);
    vec4 y_ = floor(j - 7.0 * x_);
    vec4 x = x_ * ns.x + ns.yyyy;
    vec4 y = y_ * ns.x + ns.yyyy;
    vec4 h = 1.0 - abs(x) - abs(y);
    vec4 b0 = vec4(x.xy, y.xy);
    vec4 b1 = vec4(x.zw, y.zw);
    vec4 s0 = floor(b0) * 2.0 + 1.0;
    vec4 s1 = floor(b1) * 2.0 + 1.0;
    vec4 sh = -step(h, vec4(0.0));
    vec4 a0 = b0.xzyw + s0.xzyw * sh.xxyy;
    vec4 a1 = b1.xzyw + s1.xzyw * sh.zzww;
    vec3 p0 = vec3(a0.xy, h.x);
    vec3 p1 = vec3(a0.zw, h.y);
    vec3 p2 = vec3(a1.xy, h.z);
    vec3 p3 = vec3(a1.zw, h.w);
    vec4 norm = taylorInvSqrt(vec4(dot(p0, p0), dot(p1, p1), dot(p2, p2), dot(p3, p3)));
    p0 *= norm.x; p1 *= norm.y; p2 *= norm.z; p3 *= norm.w;
    vec4 m = max(0.6 - vec4(dot(x0, x0), dot(x1, x1), dot(x2, x2), dot(x3, x3)), 0.0);
    m = m * m;
    return 42.0 * dot(m * m, vec4(dot(p0, x0), dot(p1, x1), dot(p2, x2), dot(p3, x3)));
  }

  float fbm(vec3 p) {
    float v = 0.0;
    float a = 0.5;
    for (int i = 0; i < 4; i++) {
      v += a * snoise(p);
      p *= 2.02;
      a *= 0.5;
    }
    return v;
  }
`;

/* ----------------------------------------------------------------------- */
/* Before orb: rough charcoal stone with subtle inner amber + cracks       */
/* ----------------------------------------------------------------------- */

const beforeVertexShader = /* glsl */ `
  uniform float uTime;
  uniform float uWobble;
  uniform float uLift;
  uniform float uDissolve;
  varying vec3 vNormal;
  varying vec3 vPos;
  varying float vDisp;

  ${NOISE_GLSL}

  void main() {
    vec3 p = position;
    float n = fbm(p * 1.6 + uTime * 0.04);
    float disp = n * 0.05 * (1.0 - uDissolve * 0.6);
    float wob = sin(uTime * 0.6 + p.y * 2.0) * uWobble * 0.015;
    p += normal * (disp + wob);
    p.y += uLift;

    vDisp = n;
    vNormal = normalize(normalMatrix * normal);
    vPos = p;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
  }
`;

const beforeFragmentShader = /* glsl */ `
  uniform float uTime;
  uniform float uHover;
  uniform float uCrack;
  uniform float uGlow;
  uniform float uStarlight;
  uniform float uDim;
  uniform vec3 uBase;
  uniform vec3 uAmber;
  varying vec3 vNormal;
  varying vec3 vPos;
  varying float vDisp;

  ${NOISE_GLSL}

  void main() {
    vec3 viewDir = normalize(cameraPosition - vPos);
    float fres = pow(1.0 - max(dot(vNormal, viewDir), 0.0), 3.0);

    float rough = fbm(vPos * 4.0 + uTime * 0.02) * 0.5 + 0.5;
    vec3 stone = mix(uBase * 0.75, uBase * 1.3, rough);

    float crackField = fbm(vPos * 6.0 - uTime * 0.01);
    float cracks = smoothstep(0.92, 1.0, abs(crackField)) * uCrack;

    float innerGlow = (0.3 + uGlow * 0.8) * (0.4 + 0.6 * (1.0 - rough));
    vec3 amberGlow = uAmber * innerGlow * (0.3 + uHover * 0.7);

    vec3 color = stone + amberGlow * 0.5 + cracks * uAmber * 1.4;
    color += fres * uAmber * (0.1 + uHover * 0.1 + uGlow * 0.3);

    // Distant starlight gives the orb a believable reason to be visibly lit
    // even at idle, and flares brighter while the transformation runs.
    color += vec3(0.85, 0.82, 0.78) * uStarlight * 0.22;

    // A higher floor keeps the orb visibly matte-charcoal even on faces
    // angled away from the key light, instead of dropping toward black
    // and disappearing into the near-black backdrop.
    float lightWrap = max(dot(vNormal, normalize(vec3(0.4, 0.6, 0.8))), 0.0);
    color *= 0.85 + lightWrap * 0.45 + uStarlight * 0.3;
    color *= 1.0 - uDim * 0.5;

    gl_FragColor = vec4(color, 1.0);
  }
`;

/* The orb lifts ~0.3 world units when selected — at this camera distance
   (~5.2 units) that reads on screen as roughly the 20-40px ceremonial rise
   called for in the design brief. */
const SELECT_LIFT = 0.3;
const SELECT_SCALE = 1.07;

function BeforeOrb({
  position,
  hovered,
  setHovered,
  selected,
  dimmed,
  onClick,
  timeRef,
  starlight,
}: {
  position: [number, number, number];
  hovered: boolean;
  setHovered: (v: boolean) => void;
  selected: boolean;
  dimmed: boolean;
  onClick: () => void;
  timeRef: React.RefObject<THREE.Timer>;
  starlight: React.RefObject<number>;
}) {
  const matRef = useRef<THREE.ShaderMaterial>(null);
  const groupRef = useRef<THREE.Group>(null);
  const glowLightRef = useRef<THREE.PointLight>(null);

  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uWobble: { value: 1 },
      uLift: { value: 0 },
      uDissolve: { value: 0 },
      uHover: { value: 0 },
      uCrack: { value: 0 },
      uGlow: { value: 0 },
      uStarlight: { value: 0.3 },
      uDim: { value: 0 },
      uBase: { value: new THREE.Color("#4a4438") },
      uAmber: { value: new THREE.Color("#c8853a") },
    }),
    []
  );

  useFrame(() => {
    const t = timeRef.current.getElapsed();
    const delta = timeRef.current.getDelta();

    uniforms.uTime.value = t;
    uniforms.uStarlight.value = THREE.MathUtils.damp(
      uniforms.uStarlight.value,
      starlight.current ?? 0.3,
      3,
      delta
    );

    const targetHover = hovered && !selected ? 1 : 0;
    uniforms.uHover.value = THREE.MathUtils.damp(uniforms.uHover.value, targetHover, 4, delta);

    const liftTarget = selected ? SELECT_LIFT : 0;
    const glowTarget = selected ? 1 : 0;
    const wobbleTarget = selected ? 0.35 : hovered ? 0.5 : 1;
    const dimTarget = dimmed ? 1 : 0;

    uniforms.uGlow.value = THREE.MathUtils.damp(uniforms.uGlow.value, glowTarget, 2, delta);
    uniforms.uLift.value = THREE.MathUtils.damp(uniforms.uLift.value, liftTarget, 1.8, delta);
    uniforms.uWobble.value = THREE.MathUtils.damp(uniforms.uWobble.value, wobbleTarget, 2, delta);
    uniforms.uDim.value = THREE.MathUtils.damp(uniforms.uDim.value, dimTarget, 2.5, delta);

    if (groupRef.current) {
      groupRef.current.rotation.y += delta * (0.06 + Math.sin(t * 0.3) * 0.02);
      groupRef.current.rotation.x = Math.sin(t * 0.25) * 0.04;
      groupRef.current.position.y =
        position[1] + Math.sin(t * 0.5) * 0.06 + uniforms.uLift.value;

      const scaleTarget = selected ? SELECT_SCALE : 1;
      const nextScale = THREE.MathUtils.damp(groupRef.current.scale.x, scaleTarget, 1.8, delta);
      groupRef.current.scale.setScalar(nextScale);
    }

    if (glowLightRef.current) {
      glowLightRef.current.intensity = uniforms.uGlow.value * 2.5 * (1 - uniforms.uDim.value * 0.6);
    }
  });

  return (
    <group ref={groupRef} position={position}>
      <mesh
        onPointerOver={(e) => {
          e.stopPropagation();
          setHovered(true);
        }}
        onPointerOut={(e) => {
          e.stopPropagation();
          setHovered(false);
        }}
        onClick={(e) => {
          e.stopPropagation();
          onClick();
        }}
      >
        <icosahedronGeometry args={[0.78, 5]} />
        <shaderMaterial
          ref={matRef}
          vertexShader={beforeVertexShader}
          fragmentShader={beforeFragmentShader}
          uniforms={uniforms}
        />
      </mesh>
      <pointLight ref={glowLightRef} color="#ffb347" intensity={0} distance={3} position={[0, 0, 0]} />
    </group>
  );
}

/* ----------------------------------------------------------------------- */
/* After orb: molten gold core + smooth fresnel shell + energy bands       */
/* ----------------------------------------------------------------------- */

const afterFragmentShader = /* glsl */ `
  uniform float uTime;
  uniform float uHover;
  uniform float uBoost;
  uniform float uDim;
  uniform vec3 uGold;
  uniform vec3 uGoldDeep;
  varying vec3 vNormal;
  varying vec3 vPos;

  ${NOISE_GLSL}

  void main() {
    vec3 viewDir = normalize(cameraPosition - vPos);
    // A soft, low exponent keeps the rim brightening gradual across the
    // surface instead of concentrated in a thin band exactly at the
    // silhouette, where it would be most sensitive to per-frame change.
    float fres = pow(1.0 - max(dot(vNormal, viewDir), 0.0), 1.6);

    // Low spatial frequency so a slow rotation can't sweep wildly different
    // noise values through the same screen pixel from frame to frame —
    // that mismatch (high-frequency noise sampled at a rotating position)
    // is what reads as shimmer right at the rim.
    float energy = fbm(vPos * 0.9 + uTime * 0.08) * 0.35 + 0.5;
    vec3 core = mix(uGoldDeep, uGold, energy);

    float breathe = 0.95 + 0.08 * sin(uTime * 0.5);
    vec3 color = core * breathe * 1.2;
    color += uGold * fres * (0.55 + uHover * 0.35 + uBoost * 0.8);
    color += uGold * 0.18 * (1.0 + uBoost);
    color *= 1.0 - uDim * 0.5;

    gl_FragColor = vec4(color, 1.0);
  }
`;

const afterVertexShader = /* glsl */ `
  uniform float uTime;
  varying vec3 vNormal;
  varying vec3 vPos;
  void main() {
    vec3 p = position * (1.0 + 0.012 * sin(uTime * 1.1 + position.y * 3.0));
    vNormal = normalize(normalMatrix * normal);
    vPos = p;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
  }
`;

const bandVertexShader = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

/* Bands are wide and soft on purpose: a razor-thin bright sliver sweeping a
   low-poly torus is exactly the kind of high-frequency detail that strobes
   under bloom + a moving camera, independent of any timing issue. */
const bandFragmentShader = /* glsl */ `
  uniform float uTime;
  uniform float uSpeed;
  uniform float uBoost;
  uniform float uDim;
  uniform vec3 uColor;
  varying vec2 vUv;
  void main() {
    float flow = fract(vUv.x * 2.0 - uTime * uSpeed);
    float band = smoothstep(0.0, 0.32, flow) * smoothstep(0.62, 0.32, flow);
    float edge = smoothstep(0.0, 0.2, vUv.y) * smoothstep(1.0, 0.8, vUv.y);
    float alpha = band * edge * (0.4 + uBoost * 0.4) * (1.0 - uDim * 0.6);
    gl_FragColor = vec4(uColor * (0.9 + uBoost * 0.5), alpha);
  }
`;

function OrbitingParticles({
  radius,
  count,
  color,
  boost,
  timeRef,
}: {
  radius: number;
  count: number;
  color: string;
  boost: React.RefObject<number>;
  timeRef: React.RefObject<THREE.Timer>;
}) {
  const pointsRef = useRef<THREE.Points>(null);
  const matRef = useRef<THREE.ShaderMaterial>(null);

  const { positions, speeds, offsets } = useMemo(() => {
    const positions = new Float32Array(count * 3);
    const speeds = new Float32Array(count);
    const offsets = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      const r = radius * (0.85 + Math.random() * 0.3);
      positions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta) * 0.6;
      positions[i * 3 + 2] = r * Math.cos(phi);
      speeds[i] = 0.1 + Math.random() * 0.15;
      offsets[i] = Math.random() * Math.PI * 2;
    }
    return { positions, speeds, offsets };
  }, [count, radius]);

  const basePositions = useRef(positions.slice());

  const particleUniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uColor: { value: new THREE.Color(color) },
      uBoost: { value: 0 },
    }),
    [color]
  );

  useFrame(() => {
    const t = timeRef.current.getElapsed();
    const delta = timeRef.current.getDelta();

    particleUniforms.uTime.value = t;
    particleUniforms.uBoost.value = THREE.MathUtils.damp(
      particleUniforms.uBoost.value,
      boost.current ?? 0,
      3,
      delta
    );
    if (pointsRef.current) {
      const geom = pointsRef.current.geometry;
      const posAttr = geom.attributes.position as THREE.BufferAttribute;
      for (let i = 0; i < count; i++) {
        const bx = basePositions.current[i * 3];
        const by = basePositions.current[i * 3 + 1];
        const bz = basePositions.current[i * 3 + 2];
        const ang = t * speeds[i] + offsets[i];
        const cos = Math.cos(ang);
        const sin = Math.sin(ang);
        posAttr.array[i * 3] = bx * cos - bz * sin;
        posAttr.array[i * 3 + 1] = by + Math.sin(t * 0.6 + offsets[i]) * 0.03;
        posAttr.array[i * 3 + 2] = bx * sin + bz * cos;
      }
      posAttr.needsUpdate = true;
    }
  });

  return (
    <points ref={pointsRef} renderOrder={3}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <shaderMaterial
        ref={matRef}
        transparent
        depthWrite={false}
        blending={THREE.AdditiveBlending}
        uniforms={particleUniforms}
        vertexShader={`
          uniform float uTime;
          void main() {
            vec4 mv = modelViewMatrix * vec4(position, 1.0);
            gl_PointSize = (3.2 / -mv.z) * 4.0;
            gl_Position = projectionMatrix * mv;
          }
        `}
        fragmentShader={`
          uniform vec3 uColor;
          uniform float uBoost;
          void main() {
            vec2 c = gl_PointCoord - 0.5;
            float d = length(c);
            float alpha = smoothstep(0.5, 0.0, d);
            gl_FragColor = vec4(uColor * (1.3 + uBoost), alpha * alpha * (0.7 + uBoost * 0.6));
          }
        `}
      />
    </points>
  );
}

function AfterOrb({
  position,
  hovered,
  setHovered,
  selected,
  dimmed,
  onClick,
  arrivalBoost,
  timeRef,
}: {
  position: [number, number, number];
  hovered: boolean;
  setHovered: (v: boolean) => void;
  selected: boolean;
  dimmed: boolean;
  onClick: () => void;
  arrivalBoost: React.RefObject<number>;
  timeRef: React.RefObject<THREE.Timer>;
}) {
  const groupRef = useRef<THREE.Group>(null);
  const glowLightRef = useRef<THREE.PointLight>(null);
  const liftRef = useRef(0);
  const coreUniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uHover: { value: 0 },
      uBoost: { value: 0 },
      uDim: { value: 0 },
      uGold: { value: new THREE.Color("#f3cf6e") },
      uGoldDeep: { value: new THREE.Color("#9c6a1f") },
    }),
    []
  );

  const band1 = useMemo(
    () => ({
      uTime: { value: 0 },
      uSpeed: { value: 0.16 },
      uBoost: { value: 0 },
      uDim: { value: 0 },
      uColor: { value: new THREE.Color("#ffd479") },
    }),
    []
  );
  const band2 = useMemo(
    () => ({
      uTime: { value: 0 },
      uSpeed: { value: -0.11 },
      uBoost: { value: 0 },
      uDim: { value: 0 },
      uColor: { value: new THREE.Color("#e9b85a") },
    }),
    []
  );

  useFrame(() => {
    const t = timeRef.current.getElapsed();
    const delta = timeRef.current.getDelta();

    coreUniforms.uTime.value = t;
    band1.uTime.value = t;
    band2.uTime.value = t;

    const targetHover = hovered && !selected ? 1 : 0;
    coreUniforms.uHover.value = THREE.MathUtils.damp(coreUniforms.uHover.value, targetHover, 4, delta);

    const speedTarget = hovered ? 0.28 : 0.16;
    band1.uSpeed.value = THREE.MathUtils.damp(band1.uSpeed.value, speedTarget, 3, delta);
    band2.uSpeed.value = THREE.MathUtils.damp(band2.uSpeed.value, -speedTarget * 0.7, 3, delta);

    const boostTarget = (hovered && !selected ? 0.4 : 0) + (selected ? 0.6 : 0) + (arrivalBoost.current ?? 0);
    coreUniforms.uBoost.value = THREE.MathUtils.damp(coreUniforms.uBoost.value, boostTarget, 2.5, delta);
    band1.uBoost.value = coreUniforms.uBoost.value;
    band2.uBoost.value = coreUniforms.uBoost.value;

    const dimTarget = dimmed ? 1 : 0;
    coreUniforms.uDim.value = THREE.MathUtils.damp(coreUniforms.uDim.value, dimTarget, 2.5, delta);
    band1.uDim.value = coreUniforms.uDim.value;
    band2.uDim.value = coreUniforms.uDim.value;

    if (groupRef.current) {
      groupRef.current.rotation.y += delta * 0.045;
      const liftTarget = selected ? SELECT_LIFT : 0;
      liftRef.current = THREE.MathUtils.damp(liftRef.current, liftTarget, 1.8, delta);
      groupRef.current.position.y = position[1] + Math.sin(t * 0.4 + 1.3) * 0.05 + liftRef.current;

      const scaleTarget = selected ? SELECT_SCALE : 1;
      const nextScale = THREE.MathUtils.damp(groupRef.current.scale.x, scaleTarget, 1.8, delta);
      groupRef.current.scale.setScalar(nextScale);
    }

    if (glowLightRef.current) {
      glowLightRef.current.intensity = (1.1 + coreUniforms.uBoost.value * 0.8) * (1 - coreUniforms.uDim.value * 0.6);
    }
  });

  return (
    <group ref={groupRef} position={position}>
      <mesh
        onPointerOver={(e) => {
          e.stopPropagation();
          setHovered(true);
        }}
        onPointerOut={(e) => {
          e.stopPropagation();
          setHovered(false);
        }}
        onClick={(e) => {
          e.stopPropagation();
          onClick();
        }}
      >
        <icosahedronGeometry args={[0.72, 4]} />
        <shaderMaterial
          vertexShader={afterVertexShader}
          fragmentShader={afterFragmentShader}
          uniforms={coreUniforms}
        />
      </mesh>

      {/* polygonOffset biases the bands' depth so the two points where each
          ring crosses the sphere's silhouette resolve deterministically
          instead of tying with the sphere's depth — an unbiased tie there
          flickers between "in front" and "behind" every frame. */}
      <mesh rotation={[Math.PI / 2.3, 0, 0.3]} renderOrder={1}>
        <torusGeometry args={[0.95, 0.045, 20, 128]} />
        <shaderMaterial
          vertexShader={bandVertexShader}
          fragmentShader={bandFragmentShader}
          uniforms={band1}
          transparent
          depthWrite={false}
          blending={THREE.AdditiveBlending}
          side={THREE.DoubleSide}
          polygonOffset
          polygonOffsetFactor={-4}
          polygonOffsetUnits={-4}
        />
      </mesh>
      <mesh rotation={[Math.PI / 1.8, 0.4, -0.2]} renderOrder={2}>
        <torusGeometry args={[1.08, 0.03, 20, 128]} />
        <shaderMaterial
          vertexShader={bandVertexShader}
          fragmentShader={bandFragmentShader}
          uniforms={band2}
          transparent
          depthWrite={false}
          blending={THREE.AdditiveBlending}
          side={THREE.DoubleSide}
          polygonOffset
          polygonOffsetFactor={-4}
          polygonOffsetUnits={-4}
        />
      </mesh>

      <OrbitingParticles radius={1.3} count={70} color="#ffd98a" boost={arrivalBoost} timeRef={timeRef} />
      <pointLight ref={glowLightRef} color="#f3cf6e" intensity={1.1} distance={4} />
    </group>
  );
}

/* ----------------------------------------------------------------------- */
/* Energy bridge                                                           */
/* ----------------------------------------------------------------------- */

const bridgeVertexShader = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const bridgeFragmentShader = /* glsl */ `
  uniform float uTime;
  uniform float uIntensity;
  uniform float uPulse;
  uniform vec3 uColorA;
  uniform vec3 uColorB;
  varying vec2 vUv;

  void main() {
    float edge = smoothstep(0.0, 0.45, vUv.y) * smoothstep(1.0, 0.55, vUv.y);

    // A gentle flowing brightening on top of an already-bright base, rather
    // than the dominant source of brightness — otherwise the bridge reads
    // as a series of dots instead of one continuous glowing line.
    float flow = fract(vUv.x * 1.0 - uTime * 0.1);
    float streaks = pow(sin(flow * 6.2831 * 2.0) * 0.5 + 0.5, 1.5);

    vec3 base = mix(uColorA, uColorB, vUv.x);
    float gradientAlpha = mix(0.55, 1.0, vUv.x) * uIntensity;

    float pulseDist = abs(vUv.x - uPulse);
    float pulse = smoothstep(0.08, 0.0, pulseDist) * 1.3;

    float alpha = (gradientAlpha + streaks * 0.15 * uIntensity + pulse) * edge;
    vec3 color = base * 2.2 + vec3(1.0, 0.92, 0.7) * pulse * 0.7;

    gl_FragColor = vec4(color, alpha);
  }
`;

function EnergyBridge({
  start,
  end,
  pulseRef,
  intensityRef,
  timeRef,
}: {
  start: [number, number, number];
  end: [number, number, number];
  pulseRef: React.RefObject<number>;
  intensityRef: React.RefObject<number>;
  timeRef: React.RefObject<THREE.Timer>;
}) {
  const geometry = useMemo(() => {
    const startV = new THREE.Vector3(...start);
    const endV = new THREE.Vector3(...end);
    const mid = startV.clone().lerp(endV, 0.5).add(new THREE.Vector3(0, 0.28, 0));
    const curve = new THREE.QuadraticBezierCurve3(startV, mid, endV);
    const points = curve.getPoints(64);

    const width = 0.22;
    const positions: number[] = [];
    const uvs: number[] = [];
    const indices: number[] = [];

    for (let i = 0; i < points.length; i++) {
      const p = points[i];
      const next = points[Math.min(i + 1, points.length - 1)];
      const tangent = next.clone().sub(p).normalize();
      const up = new THREE.Vector3(0, 1, 0);
      const side = new THREE.Vector3().crossVectors(tangent, up).normalize().multiplyScalar(width);

      positions.push(p.x - side.x, p.y - side.y, p.z - side.z);
      positions.push(p.x + side.x, p.y + side.y, p.z + side.z);

      const u = i / (points.length - 1);
      uvs.push(u, 0, u, 1);

      if (i < points.length - 1) {
        const a = i * 2;
        const b = i * 2 + 1;
        const c = i * 2 + 2;
        const d = i * 2 + 3;
        indices.push(a, b, c, b, d, c);
      }
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
    geo.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
    geo.setIndex(indices);
    return geo;
  }, [start, end]);

  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uIntensity: { value: 0.85 },
      uPulse: { value: -1 },
      uColorA: { value: new THREE.Color("#6b5530") },
      uColorB: { value: new THREE.Color("#f3cf6e") },
    }),
    []
  );

  useFrame(() => {
    const delta = timeRef.current.getDelta();
    uniforms.uTime.value = timeRef.current.getElapsed();
    uniforms.uIntensity.value = THREE.MathUtils.damp(
      uniforms.uIntensity.value,
      0.85 + (intensityRef.current ?? 0),
      3,
      delta
    );
    uniforms.uPulse.value = pulseRef.current ?? -1;
  });

  return (
    <mesh geometry={geometry} renderOrder={0}>
      <shaderMaterial
        vertexShader={bridgeVertexShader}
        fragmentShader={bridgeFragmentShader}
        uniforms={uniforms}
        transparent
        depthWrite={false}
        blending={THREE.AdditiveBlending}
        side={THREE.DoubleSide}
      />
    </mesh>
  );
}

/* ----------------------------------------------------------------------- */
/* Dust particles                                                          */
/* ----------------------------------------------------------------------- */

function DustField({ timeRef }: { timeRef: React.RefObject<THREE.Timer> }) {
  const count = 220;
  const pointsRef = useRef<THREE.Points>(null);

  const { positions, seeds } = useMemo(() => {
    const positions = new Float32Array(count * 3);
    const seeds = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      positions[i * 3] = (Math.random() - 0.5) * 12;
      positions[i * 3 + 1] = (Math.random() - 0.5) * 6;
      positions[i * 3 + 2] = (Math.random() - 0.5) * 6 - 1;
      seeds[i] = Math.random() * Math.PI * 2;
    }
    return { positions, seeds };
  }, [count]);

  const base = useRef(positions.slice());

  useFrame(() => {
    if (!pointsRef.current) return;
    const posAttr = pointsRef.current.geometry.attributes.position as THREE.BufferAttribute;
    const t = timeRef.current.getElapsed();
    for (let i = 0; i < count; i++) {
      posAttr.array[i * 3] = base.current[i * 3] + Math.sin(t * 0.05 + seeds[i]) * 0.4;
      posAttr.array[i * 3 + 1] =
        base.current[i * 3 + 1] + Math.sin(t * 0.08 + seeds[i] * 1.7) * 0.3 + ((t * 0.01) % 6) - 3;
      posAttr.array[i * 3 + 2] = base.current[i * 3 + 2] + Math.cos(t * 0.04 + seeds[i]) * 0.3;
    }
    posAttr.needsUpdate = true;
  });

  return (
    <points ref={pointsRef} renderOrder={4}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <shaderMaterial
        transparent
        depthWrite={false}
        blending={THREE.AdditiveBlending}
        vertexShader={`
          void main() {
            vec4 mv = modelViewMatrix * vec4(position, 1.0);
            gl_PointSize = (1.6 / -mv.z) * 3.0;
            gl_Position = projectionMatrix * mv;
          }
        `}
        fragmentShader={`
          void main() {
            vec2 c = gl_PointCoord - 0.5;
            float d = length(c);
            float alpha = smoothstep(0.5, 0.0, d);
            gl_FragColor = vec4(vec3(0.85, 0.82, 0.75), alpha * 0.25);
          }
        `}
      />
    </points>
  );
}

/* ----------------------------------------------------------------------- */
/* Starfield: distant twinkling stars that flare with the transformation   */
/* and otherwise sit at a steady idle brightness — narratively, this is the */
/* light source that keeps the Before orb visible in idle.                 */
/* ----------------------------------------------------------------------- */

function Starfield({
  timeRef,
  boostRef,
}: {
  timeRef: React.RefObject<THREE.Timer>;
  boostRef: React.RefObject<number>;
}) {
  const count = 260;
  const pointsRef = useRef<THREE.Points>(null);

  const { positions, seeds, twinkleSpeeds } = useMemo(() => {
    const positions = new Float32Array(count * 3);
    const seeds = new Float32Array(count);
    const twinkleSpeeds = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      positions[i * 3] = (Math.random() - 0.5) * 22;
      positions[i * 3 + 1] = (Math.random() - 0.5) * 12;
      positions[i * 3 + 2] = -5 - Math.random() * 4;
      seeds[i] = Math.random() * Math.PI * 2;
      twinkleSpeeds[i] = 0.4 + Math.random() * 0.8;
    }
    return { positions, seeds, twinkleSpeeds };
  }, [count]);

  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uBoost: { value: 0 },
    }),
    []
  );

  useFrame(() => {
    const t = timeRef.current.getElapsed();
    const delta = timeRef.current.getDelta();
    uniforms.uTime.value = t;
    uniforms.uBoost.value = THREE.MathUtils.damp(uniforms.uBoost.value, boostRef.current ?? 0, 2.5, delta);

    if (pointsRef.current) {
      const sizes = pointsRef.current.geometry.attributes.twinkle as THREE.BufferAttribute;
      for (let i = 0; i < count; i++) {
        sizes.array[i] = 0.5 + 0.5 * Math.sin(t * twinkleSpeeds[i] + seeds[i]);
      }
      sizes.needsUpdate = true;
    }
  });

  return (
    <points ref={pointsRef} renderOrder={5}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
        <bufferAttribute attach="attributes-twinkle" args={[new Float32Array(count), 1]} />
      </bufferGeometry>
      <shaderMaterial
        transparent
        depthWrite={false}
        blending={THREE.AdditiveBlending}
        uniforms={uniforms}
        vertexShader={`
          attribute float twinkle;
          uniform float uBoost;
          varying float vTwinkle;
          void main() {
            vTwinkle = twinkle;
            vec4 mv = modelViewMatrix * vec4(position, 1.0);
            // Fixed pixel size (not distance-attenuated): the stars all sit
            // in roughly the same far depth range, and dividing by camera
            // distance there was shrinking them to well under a pixel,
            // which is why they were invisible regardless of brightness.
            gl_PointSize = 2.4 + uBoost * 2.5 + vTwinkle * 1.2;
            gl_Position = projectionMatrix * mv;
          }
        `}
        fragmentShader={`
          uniform float uBoost;
          varying float vTwinkle;
          void main() {
            vec2 c = gl_PointCoord - 0.5;
            float d = length(c);
            float alpha = smoothstep(0.5, 0.0, d);
            float brightness = (0.6 + vTwinkle * 0.6) * (1.0 + uBoost * 1.8);
            gl_FragColor = vec4(vec3(1.0, 0.97, 0.9) * brightness, alpha * brightness);
          }
        `}
      />
    </points>
  );
}

/* ----------------------------------------------------------------------- */
/* Background                                                              */
/* ----------------------------------------------------------------------- */

function Backdrop() {
  const uniforms = useMemo(
    () => ({
      uColor: { value: new THREE.Color("#050403") },
      uGlow: { value: new THREE.Color("#16110a") },
    }),
    []
  );
  return (
    <mesh position={[0, 0, -4]} scale={[20, 12, 1]}>
      <planeGeometry args={[1, 1]} />
      <shaderMaterial
        uniforms={uniforms}
        vertexShader={`
          varying vec2 vUv;
          void main() {
            vUv = uv;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }
        `}
        fragmentShader={`
          uniform vec3 uColor;
          uniform vec3 uGlow;
          varying vec2 vUv;
          void main() {
            float d = distance(vUv, vec2(0.5));
            float g = smoothstep(0.75, 0.0, d);
            vec3 color = mix(uColor, uGlow, g * 0.6);
            gl_FragColor = vec4(color, 1.0);
          }
        `}
      />
    </mesh>
  );
}

/* ----------------------------------------------------------------------- */
/* Camera rig: mouse parallax + transformation dolly                      */
/* ----------------------------------------------------------------------- */

function CameraRig({
  dollyRef,
  tiltRef,
  timeRef,
}: {
  dollyRef: React.RefObject<number>;
  tiltRef: React.RefObject<number>;
  timeRef: React.RefObject<THREE.Timer>;
}) {
  const { camera, pointer } = useThree();
  const base = useMemo(() => new THREE.Vector3(0, 0.1, 5.2), []);

  useFrame(() => {
    const delta = timeRef.current.getDelta();
    const dolly = dollyRef.current ?? 0;
    const tilt = tiltRef.current ?? 0;
    const targetX = base.x + pointer.x * 0.18 + tilt * 0.3;
    const targetY = base.y + pointer.y * 0.1;
    const targetZ = base.z - dolly * 0.22;

    camera.position.x = THREE.MathUtils.damp(camera.position.x, targetX, 2, delta);
    camera.position.y = THREE.MathUtils.damp(camera.position.y, targetY, 2.5, delta);
    camera.position.z = THREE.MathUtils.damp(camera.position.z, targetZ, 2, delta);
    camera.lookAt(tilt * 0.4, 0.05, 0);

    if (camera instanceof THREE.PerspectiveCamera) {
      const targetFov = 45 - dolly * 1.2;
      camera.fov = THREE.MathUtils.damp(camera.fov, targetFov, 2, delta);
      camera.updateProjectionMatrix();
    }
  });

  return null;
}

/* ----------------------------------------------------------------------- */
/* Transformation state machine                                           */
/* ----------------------------------------------------------------------- */

export type Selected = "before" | "after" | null;

function Scene({
  selected,
  setSelected,
}: {
  selected: Selected;
  setSelected: (v: Selected) => void;
}) {
  const timeRef = useSharedTimer();

  const [hoverBefore, setHoverBefore] = useState(false);
  const [hoverAfter, setHoverAfter] = useState(false);

  const dollyRef = useRef(0);
  const tiltRef = useRef(0);
  const arrivalBoostRef = useRef(0);
  const bridgeIntensityRef = useRef(0);
  const pulseRef = useRef(-1);
  const starBoostRef = useRef(0.3);

  const beforePos: [number, number, number] = [-1.9, 0, 0];
  const afterPos: [number, number, number] = [1.9, 0, 0];

  // Render priority -1 guarantees this runs before every other useFrame
  // subscriber in the tree (all default to priority 0), so the timer is
  // always up to date before any orb/particle/bridge reads it this frame.
  useFrame(() => {
    timeRef.current.update();
    const t = timeRef.current.getElapsed();
    const delta = timeRef.current.getDelta();

    // Stars sit at a steady idle glow (which is what keeps the Before orb
    // lit even when nothing is happening) and flare gently while a panel
    // is open, easing back to idle afterward.
    const starTarget = selected ? 0.6 : 0.3 + (arrivalBoostRef.current ?? 0) * 0.4;
    starBoostRef.current = THREE.MathUtils.damp(starBoostRef.current, starTarget, 1.5, delta);

    const dollyTarget = selected ? 1 : 0;
    dollyRef.current = THREE.MathUtils.damp(dollyRef.current, dollyTarget, 1.6, delta);

    const tiltTarget = selected === "before" ? -1 : selected === "after" ? 1 : 0;
    tiltRef.current = THREE.MathUtils.damp(tiltRef.current, tiltTarget, 1.6, delta);

    bridgeIntensityRef.current = Math.max(bridgeIntensityRef.current - 0.01, 0);

    const cycle = 5.5;
    const cyclePos = t % cycle;
    const pulseProgress = cyclePos / 1.8;
    if (pulseProgress <= 1) {
      pulseRef.current = pulseProgress;
      if (pulseProgress > 0.92) {
        arrivalBoostRef.current = Math.min(arrivalBoostRef.current + 0.15, 0.8);
      }
    } else {
      pulseRef.current = -1;
    }
    arrivalBoostRef.current = Math.max(arrivalBoostRef.current - 0.012, 0);
  }, -1);

  return (
    <>
      <CameraRig dollyRef={dollyRef} tiltRef={tiltRef} timeRef={timeRef} />
      <Backdrop />
      <ambientLight intensity={0.18} />
      <directionalLight position={[3, 4, 5]} intensity={0.3} color="#fff3da" />

      <Starfield timeRef={timeRef} boostRef={starBoostRef} />
      <DustField timeRef={timeRef} />

      <EnergyBridge
        start={[beforePos[0] + 0.85, 0, 0]}
        end={[afterPos[0] - 0.85, 0, 0]}
        pulseRef={pulseRef}
        intensityRef={bridgeIntensityRef}
        timeRef={timeRef}
      />

      <BeforeOrb
        position={beforePos}
        hovered={hoverBefore}
        setHovered={setHoverBefore}
        selected={selected === "before"}
        dimmed={selected === "after"}
        onClick={() => setSelected("before")}
        timeRef={timeRef}
        starlight={starBoostRef}
      />

      <AfterOrb
        position={afterPos}
        hovered={hoverAfter}
        setHovered={setHoverAfter}
        selected={selected === "after"}
        dimmed={selected === "before"}
        onClick={() => setSelected("after")}
        arrivalBoost={arrivalBoostRef}
        timeRef={timeRef}
      />

      <Html position={[beforePos[0], -1.25, 0]} center distanceFactor={8} zIndexRange={[10, 0]}>
        <div className="pointer-events-none select-none whitespace-nowrap text-center font-light tracking-[0.25em] text-[#b9a98a]" style={{ fontSize: "13px" }}>
          BEFORE DWARKA
        </div>
      </Html>
      <Html position={[afterPos[0], -1.25, 0]} center distanceFactor={8} zIndexRange={[10, 0]}>
        <div className="pointer-events-none select-none whitespace-nowrap text-center font-light tracking-[0.25em] text-[#f3d98a]" style={{ fontSize: "13px" }}>
          AFTER DWARKA
        </div>
      </Html>

    </>
  );
}

/* ----------------------------------------------------------------------- */
/* Public component                                                        */
/*                                                                         */
/* No @react-three/postprocessing here on purpose: its Bloom pass renders   */
/* through an internal multi-resolution blur pyramid, and on some GPU/driver */
/* combinations a corrupted texel in that pyramid shows up as small black   */
/* blocks baked into the glow — a renderer-level bug, not something fixable */
/* by tuning Bloom's props. The glow is faked entirely in the orb shaders   */
/* (emissive core + fresnel rim) and the vignette is a plain CSS radial      */
/* gradient over the canvas, so there's no extra GPU render-target pipeline  */
/* left that could corrupt.                                                 */
/* ----------------------------------------------------------------------- */

const PANEL_CONTENT: Record<
  "before" | "after",
  { title: string; intro: string; items: { label: string; text: string }[] }
> = {
  before: {
    title: "BEFORE DWARKA",
    intro: "The struggle most brands know too well.",
    items: [
      { label: "Speed", text: "Months of revisions, missed launches" },
      { label: "Impact", text: "Visuals people forget" },
      { label: "Identity", text: "Generic, templated, soulless" },
      { label: "Simplicity", text: "Juggling separate vendors" },
    ],
  },
  after: {
    title: "AFTER DWARKA",
    intro: "What it feels like to partner with Dwarka.",
    items: [
      { label: "Speed", text: "Quarters become weeks, AI-accelerated" },
      { label: "Impact", text: "Experiences they never forget" },
      { label: "Identity", text: "Culturally rich, unmistakably yours" },
      { label: "Simplicity", text: "One integrated studio, end to end" },
    ],
  },
};

function SelectionPanel({
  selected,
  onClose,
}: {
  selected: Selected;
  onClose: () => void;
}) {
  const side = selected;
  const content = side ? PANEL_CONTENT[side] : null;

  const panelPosition =
    side === "before"
      ? "sm:left-[52%]"
      : "sm:right-[52%] sm:left-auto";

  return (
    <AnimatePresence>
      {content && (
        <>
          <motion.div
            key="scrim"
            className="absolute inset-0 z-10"
            style={{ background: "rgba(3,2,1,0.5)" }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.6, ease: EASE }}
            onClick={onClose}
          />
          <motion.div
            key={side}
            className={`absolute z-20 left-1/2 bottom-6 w-[clamp(260px,88vw,380px)] -translate-x-1/2 sm:bottom-auto sm:top-1/2 sm:w-[340px] sm:-translate-y-1/2 sm:translate-x-0 ${panelPosition}`}
            initial={{ opacity: 0, x: side === "before" ? -24 : 24, y: 0 }}
            animate={{ opacity: 1, x: 0, y: 0 }}
            exit={{ opacity: 0, x: side === "before" ? -24 : 24, y: 0 }}
            transition={{ duration: 0.7, ease: EASE }}
          >
            <div className="relative rounded-2xl border border-[#c8a24a]/35 bg-[rgba(12,10,6,0.72)] p-6 shadow-[0_12px_50px_rgba(0,0,0,0.55)] backdrop-blur-xl">
              <button
                type="button"
                onClick={onClose}
                aria-label="Close panel"
                className="absolute right-4 top-4 text-base text-[#c8a24a]/70 transition-colors hover:text-[#e6cd86]"
              >
                &#10005;
              </button>

              <p className="font-display text-xl tracking-[0.12em] text-[#e6cd86]">
                {content.title}
              </p>
              <p className="mt-3 text-sm leading-relaxed text-[#cfc6b4]/85">
                {content.intro}
              </p>

              <div className="mt-6 flex flex-col gap-3">
                {content.items.map((item, i) => (
                  <motion.div
                    key={item.label}
                    initial={{ opacity: 0, y: 14 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5, delay: 0.18 + i * 0.09, ease: EASE }}
                    className="rounded-xl border border-[#c8a24a]/20 bg-[linear-gradient(135deg,rgba(230,205,134,0.08),rgba(0,0,0,0))] px-4 py-3"
                  >
                    <p className="text-[11px] tracking-[0.2em] text-[#c8a24a]">
                      {item.label.toUpperCase()}
                    </p>
                    <p className="mt-1 text-sm text-[#e9e3d4]">{item.text}</p>
                  </motion.div>
                ))}
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

export default function BeforeAfterDwarka() {
  const [selected, setSelected] = useState<Selected>(null);

  return (
    <div style={{ position: "relative", width: "100%", height: "100vh", background: "#050403" }}>
      <Canvas
        camera={{ position: [0, 0.1, 5.2], fov: 45, near: 0.1, far: 50 }}
        dpr={[1, 1.75]}
        gl={{ antialias: true, powerPreference: "high-performance" }}
      >
        <Scene selected={selected} setSelected={setSelected} />
      </Canvas>
      <div
        style={{
          position: "absolute",
          inset: 0,
          pointerEvents: "none",
          background:
            "radial-gradient(ellipse at center, transparent 55%, rgba(0,0,0,0.4) 100%)",
        }}
      />
      <SelectionPanel selected={selected} onClose={() => setSelected(null)} />
    </div>
  );
}
