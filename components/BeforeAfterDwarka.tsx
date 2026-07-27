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

import { useEffect, useRef, useState, useMemo } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Html } from "@react-three/drei";
import { AnimatePresence, motion } from "motion/react";
import * as THREE from "three";
import { useIntro } from "@/components/GateIntro/IntroContext";
import { EASE } from "@/lib/motion";
import {
  BRIDGE,
  easeOutCubic,
  prefersReducedMotion,
  smoothstep,
} from "@/lib/heroBridge";

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
/* Peacock iridescence                                                     */
/*                                                                         */
/* A smooth, cyclic sweep through the brand's own peacock palette — emerald */
/* → teal → turquoise → sapphire → violet, with a warm-gold accent so the   */
/* wheel never lands on a cold, RGB-looking primary. Each stop is a muted,  */
/* slightly-desaturated hue (not a neon primary), and neighbours are joined */
/* with a smoothstep so there are no hard bands. Callers add their own warm  */
/* bias and keep intensity low, so this reads as light refracting through an */
/* exotic material rather than a rainbow painted on top of it.              */
/* ----------------------------------------------------------------------- */

const IRIDESCENCE_GLSL = /* glsl */ `
  vec3 peacockHue(float t) {
    vec3 emerald   = vec3(0.05, 0.40, 0.28);
    vec3 teal      = vec3(0.03, 0.52, 0.52);
    vec3 turquoise = vec3(0.10, 0.68, 0.74);
    vec3 sapphire  = vec3(0.11, 0.28, 0.66);
    vec3 violet    = vec3(0.34, 0.22, 0.52);
    vec3 gold      = vec3(0.72, 0.56, 0.28);

    float x = fract(t) * 6.0;
    float i = floor(x);
    float f = smoothstep(0.0, 1.0, fract(x));

    vec3 c;
    if      (i < 0.5) c = mix(emerald, teal, f);
    else if (i < 1.5) c = mix(teal, turquoise, f);
    else if (i < 2.5) c = mix(turquoise, sapphire, f);
    else if (i < 3.5) c = mix(sapphire, violet, f);
    else if (i < 4.5) c = mix(violet, gold, f);
    else              c = mix(gold, emerald, f);
    return c;
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
    float NdotV = max(dot(vNormal, viewDir), 0.0);
    float fres = pow(1.0 - NdotV, 3.0);

    // Weathered, pitted surface: broad roughness patches plus fine pitting so
    // the sphere reads as a raw cast-bronze / gold-ore body — an unfinished
    // masterpiece — rather than a smooth matte blob.
    float rough = fbm(vPos * 4.5 + uTime * 0.02) * 0.5 + 0.5;
    float pit = smoothstep(0.30, 0.62, fbm(vPos * 9.0 + 4.0));
    vec3 metal = mix(uBase * 0.6, uBase * 1.6, rough);
    metal *= 1.0 - pit * 0.45;
    // A muted gold undertone bled through the whole raw body — this is the
    // "unrealized potential": the same gold the After orb has fully forged,
    // still dormant and oxidised here rather than a dead grey stone.
    metal = mix(metal, uAmber * 0.7, 0.16);

    // Shared warm key light — the SAME direction the After orb is lit from —
    // so the two orbs read as one object in one room. A metallic diffuse
    // gradient plus a broad, rough specular makes the material catch light
    // like unpolished bronze instead of sitting flat.
    vec3 L = normalize(vec3(0.45, 0.55, 0.75));
    vec3 H = normalize(L + viewDir);
    float diff = max(dot(vNormal, L), 0.0);
    float spec = pow(max(dot(vNormal, H), 0.0), 16.0) * (0.35 + rough * 0.5);
    vec3 color = metal * (0.42 + diff * 0.75);

    // Brighter veins of gold where the ore runs richest; they wake further as
    // the orb is selected.
    float veinField = fbm(vPos * 4.0 - uTime * 0.012);
    float veins = smoothstep(0.84, 1.0, abs(veinField));
    color += uAmber * veins * (0.5 + uHover * 0.5 + uGlow * 1.0);
    color += uAmber * uGlow * 0.35 * (1.0 - rough);

    // Warm metallic highlight + warm fresnel rim.
    color += uAmber * spec * 0.7;
    color += fres * uAmber * (0.14 + uHover * 0.12 + uGlow * 0.3);

    // Warm-neutral fill bounce from the opposite side reads as a second light
    // source without the cold blue cast that was draining the orb's warmth —
    // and carries no time term, so it can't reintroduce the rim flicker these
    // shaders were tuned to avoid.
    float fillWrap = max(dot(vNormal, normalize(vec3(-0.5, -0.15, 0.35))), 0.0);
    color += vec3(0.52, 0.47, 0.42) * fillWrap * 0.1;

    // Warm ambient from the surrounding scene keeps the orb believably lit at
    // idle instead of dropping toward black against the bronze backdrop.
    color += vec3(0.96, 0.84, 0.66) * uStarlight * 0.24;
    color *= 0.92 + uStarlight * 0.2;

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
  introRef,
}: {
  position: [number, number, number];
  hovered: boolean;
  setHovered: (v: boolean) => void;
  selected: boolean;
  dimmed: boolean;
  onClick: () => void;
  timeRef: React.RefObject<THREE.Timer>;
  starlight: React.RefObject<number>;
  introRef: React.RefObject<number>;
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
      // Weathered antique-bronze body, veined with dormant antique gold — the
      // same gold the After orb has fully forged, so they read as two stages
      // of one object rather than two unrelated assets.
      uBase: { value: new THREE.Color("#4a3726") },
      uAmber: { value: new THREE.Color("#b98a44") },
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

    // Condense out of the parting light: the Before orb resolves first
    // (it's the "raw" state the sequence starts from). reveal 0 → a point,
    // 1 → full size. An emergence bell adds a brief forging flare mid-arrival.
    const intro = introRef.current ?? 1;
    const reveal = easeOutCubic(THREE.MathUtils.clamp(intro / 0.82, 0, 1));
    const emerge = reveal * (1 - reveal) * 4;

    if (groupRef.current) {
      groupRef.current.rotation.y += delta * (0.06 + Math.sin(t * 0.3) * 0.02);
      groupRef.current.rotation.x = Math.sin(t * 0.25) * 0.04;
      groupRef.current.position.y =
        position[1] + Math.sin(t * 0.5) * 0.06 + uniforms.uLift.value;

      const scaleTarget = (selected ? SELECT_SCALE : 1) * reveal;
      const nextScale = THREE.MathUtils.damp(groupRef.current.scale.x, scaleTarget, 1.8, delta);
      groupRef.current.scale.setScalar(nextScale);
    }

    if (glowLightRef.current) {
      glowLightRef.current.intensity =
        (uniforms.uGlow.value * 2.5 + emerge * 1.6) * (1 - uniforms.uDim.value * 0.6);
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
        <icosahedronGeometry args={[0.78, 7]} />
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
  ${IRIDESCENCE_GLSL}

  void main() {
    vec3 viewDir = normalize(cameraPosition - vPos);
    float NdotV = max(dot(vNormal, viewDir), 0.0);
    // A soft, low exponent keeps the rim brightening gradual across the
    // surface instead of concentrated in a thin band exactly at the
    // silhouette, where it would be most sensitive to per-frame change.
    float fres = pow(1.0 - NdotV, 1.6);

    // Low spatial frequency so a slow rotation can't sweep wildly different
    // noise values through the same screen pixel from frame to frame —
    // that mismatch (high-frequency noise sampled at a rotating position)
    // is what reads as shimmer right at the rim.
    float energy = fbm(vPos * 0.9 + uTime * 0.08) * 0.35 + 0.5;
    vec3 core = mix(uGoldDeep, uGold, energy);

    // Shared warm key light — the SAME direction as the Before orb — gives the
    // forged sphere real form (a diffuse gradient) and a tight, polished-metal
    // specular. Shaping the emissive core with that gradient is what keeps it
    // reading as refined gold rather than a uniformly bright glowing ball.
    vec3 L = normalize(vec3(0.45, 0.55, 0.75));
    vec3 H = normalize(L + viewDir);
    float diff = max(dot(vNormal, L), 0.0);
    float spec = pow(max(dot(vNormal, H), 0.0), 55.0);

    float breathe = 0.95 + 0.07 * sin(uTime * 0.5);
    vec3 color = core * (0.6 + diff * 0.55) * breathe;
    color += uGold * fres * (0.5 + uHover * 0.35 + uBoost * 0.8);
    color += vec3(1.0, 0.95, 0.82) * spec * (0.7 + uBoost * 0.6);
    color += uGold * 0.16 * (1.0 + uBoost);

    // Thin-film iridescence at the grazing rim only — the polished gold shell
    // refracting light into peacock hues right at its edge, the same family of
    // colour the surrounding aura carries. The hue is driven by view angle
    // (like real thin-film interference) with a slow drift, then pulled halfway
    // back toward gold so the body stays unmistakably a gold orb.
    float rim = pow(fres, 2.2);
    vec3 irid = peacockHue(NdotV * 0.6 + uTime * 0.015);
    irid = mix(irid, uGold, 0.5);
    color += irid * rim * (0.22 + uHover * 0.18 + uBoost * 0.35);

    // Cool fill bounce from a fixed direction opposite the shell's warm
    // glow — reads as a second light source so the shell isn't lit from
    // fresnel alone in every direction at once.
    float fillWrap = max(dot(vNormal, normalize(vec3(-0.4, -0.3, 0.5))), 0.0);
    color += vec3(0.5, 0.55, 0.65) * fillWrap * 0.1;

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

/* Star-dust aura for the After orb — a medium-density cloud of peacock-hued
   cosmic dust and faint sparkling stars swirling in a calm orbital flow. Every
   mote's motion is computed on the GPU from per-particle attributes + uTime (no
   per-frame JS loop over the buffer), so it stays cheap: an analytic orbit plus
   gentle turbulence, with each mote drifting slowly outward over its lifetime
   and fading at both ends. No rings, no bands, no solid halo — just drifting
   light that wraps the gold orb (dust behind it is naturally occluded by the
   orb's depth, dust in front adds over it). */
function StarDustAura({
  count,
  boostUniform,
  dimUniform,
  timeRef,
}: {
  count: number;
  boostUniform: { value: number };
  dimUniform: { value: number };
  timeRef: React.RefObject<THREE.Timer>;
}) {
  const { positions, radii, heights, angles, speeds, hues, stars, seeds } = useMemo(() => {
    const positions = new Float32Array(count * 3);
    const radii = new Float32Array(count);
    const heights = new Float32Array(count);
    const angles = new Float32Array(count);
    const speeds = new Float32Array(count);
    const hues = new Float32Array(count);
    const stars = new Float32Array(count);
    const seeds = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      // Denser toward the orb, thinning outward; flattened into an oblate cloud
      // so it reads as an orbital swirl rather than a uniform sphere.
      const r = 0.9 + Math.pow(Math.random(), 1.7) * 1.15;
      const ang = Math.random() * Math.PI * 2;
      const h = (Math.random() - 0.5) * 1.4 * (1 - ((r - 0.9) / 1.15) * 0.45);
      radii[i] = r;
      angles[i] = ang;
      heights[i] = h;
      speeds[i] = 0.12 + Math.random() * 0.22;
      hues[i] = Math.random();
      stars[i] = Math.random() < 0.22 ? 1 : 0;
      seeds[i] = Math.random();
      positions[i * 3] = Math.cos(ang) * r;
      positions[i * 3 + 1] = h;
      positions[i * 3 + 2] = Math.sin(ang) * r;
    }
    return { positions, radii, heights, angles, speeds, hues, stars, seeds };
  }, [count]);

  const uniforms = useMemo(
    () => ({ uTime: { value: 0 }, uBoost: { value: 0 }, uDim: { value: 0 } }),
    []
  );

  useFrame(() => {
    uniforms.uTime.value = timeRef.current.getElapsed();
    uniforms.uBoost.value = boostUniform.value;
    uniforms.uDim.value = dimUniform.value;
  });

  return (
    <points renderOrder={3} frustumCulled={false}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
        <bufferAttribute attach="attributes-aRadius" args={[radii, 1]} />
        <bufferAttribute attach="attributes-aHeight" args={[heights, 1]} />
        <bufferAttribute attach="attributes-aAngle" args={[angles, 1]} />
        <bufferAttribute attach="attributes-aSpeed" args={[speeds, 1]} />
        <bufferAttribute attach="attributes-aHue" args={[hues, 1]} />
        <bufferAttribute attach="attributes-aStar" args={[stars, 1]} />
        <bufferAttribute attach="attributes-aSeed" args={[seeds, 1]} />
      </bufferGeometry>
      <shaderMaterial
        transparent
        depthWrite={false}
        blending={THREE.AdditiveBlending}
        uniforms={uniforms}
        vertexShader={`
          uniform float uTime;
          uniform float uBoost;
          attribute float aRadius;
          attribute float aHeight;
          attribute float aAngle;
          attribute float aSpeed;
          attribute float aHue;
          attribute float aStar;
          attribute float aSeed;
          varying float vHue;
          varying float vStar;
          varying float vFade;
          varying float vSeed;
          void main() {
            // Lifetime loop: each mote drifts slowly outward, then recycles.
            float lifeSpeed = 0.05 + aSeed * 0.05;
            float life = fract(aSeed + uTime * lifeSpeed);
            float rad = aRadius + life * 0.45 + uBoost * 0.15;

            // Calm orbital swirl + a little turbulence (cosmic wind).
            float ang = aAngle + uTime * aSpeed;
            float turbX = sin(uTime * 0.35 + aSeed * 6.2831) * 0.06;
            float turbZ = cos(uTime * 0.28 + aRadius * 3.0 + aSeed * 4.0) * 0.06;
            float turbY = sin(uTime * 0.22 + aSeed * 6.2831) * 0.05;

            vec3 pos;
            pos.x = cos(ang) * rad + turbX;
            pos.z = sin(ang) * rad + turbZ;
            pos.y = aHeight + turbY + sin(uTime * 0.2 + aSeed * 3.0) * 0.04;

            // Fade in near the inner edge, fade out as it drifts away.
            vFade = smoothstep(0.0, 0.12, life) * smoothstep(1.0, 0.55, life);
            vHue = aHue;
            vStar = aStar;
            vSeed = aSeed;

            vec4 mv = modelViewMatrix * vec4(pos, 1.0);
            float base = mix(3.4, 6.8, aStar);
            gl_PointSize = base * (1.0 + uBoost * 0.5) * (4.0 / -mv.z);
            gl_Position = projectionMatrix * mv;
          }
        `}
        fragmentShader={`
          uniform float uTime;
          uniform float uBoost;
          uniform float uDim;
          varying float vHue;
          varying float vStar;
          varying float vFade;
          varying float vSeed;

          ${IRIDESCENCE_GLSL}

          void main() {
            vec2 c = gl_PointCoord - 0.5;
            float dd = length(c);
            float soft = smoothstep(0.5, 0.0, dd);
            float core = smoothstep(0.16, 0.0, dd);
            // Dust motes are soft; stars keep a brighter, tighter core.
            float shape = soft * soft + core * vStar * 0.9;

            // Peacock dust — its saturation is boosted so the cooler hues
            // survive being added over the warm gold field, then stars pull
            // toward warm gold-white so they read as sparkles rather than hue.
            vec3 col = peacockHue(vHue + uTime * 0.02);
            float lum = dot(col, vec3(0.299, 0.587, 0.114));
            col = mix(vec3(lum), col, 1.35);
            col = mix(col, vec3(1.0, 0.94, 0.82), vStar * 0.6);

            // Slow twinkle for the stars only.
            float tw = 0.7 + 0.3 * sin(uTime * 2.4 + vSeed * 40.0);
            float bright = (1.0 + uBoost * 0.8) * mix(1.0, tw, vStar);

            float alpha = shape * vFade * bright * (1.0 - uDim * 0.6);
            gl_FragColor = vec4(col * bright, alpha);
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
  introRef,
}: {
  position: [number, number, number];
  hovered: boolean;
  setHovered: (v: boolean) => void;
  selected: boolean;
  dimmed: boolean;
  onClick: () => void;
  arrivalBoost: React.RefObject<number>;
  timeRef: React.RefObject<THREE.Timer>;
  introRef: React.RefObject<number>;
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

  useFrame(() => {
    const t = timeRef.current.getElapsed();
    const delta = timeRef.current.getDelta();

    coreUniforms.uTime.value = t;

    const targetHover = hovered && !selected ? 1 : 0;
    coreUniforms.uHover.value = THREE.MathUtils.damp(coreUniforms.uHover.value, targetHover, 4, delta);

    const boostTarget = (hovered && !selected ? 0.4 : 0) + (selected ? 0.6 : 0) + (arrivalBoost.current ?? 0);
    coreUniforms.uBoost.value = THREE.MathUtils.damp(coreUniforms.uBoost.value, boostTarget, 2.5, delta);

    const dimTarget = dimmed ? 1 : 0;
    coreUniforms.uDim.value = THREE.MathUtils.damp(coreUniforms.uDim.value, dimTarget, 2.5, delta);

    // Condense out of the parting light, a beat behind the Before orb, so the
    // pair resolves left-then-right — the forged gold is the destination.
    const intro = introRef.current ?? 1;
    const reveal = easeOutCubic(THREE.MathUtils.clamp((intro - 0.14) / 0.86, 0, 1));
    const emerge = reveal * (1 - reveal) * 4;

    if (groupRef.current) {
      groupRef.current.rotation.y += delta * 0.045;
      const liftTarget = selected ? SELECT_LIFT : 0;
      liftRef.current = THREE.MathUtils.damp(liftRef.current, liftTarget, 1.8, delta);
      groupRef.current.position.y = position[1] + Math.sin(t * 0.4 + 1.3) * 0.05 + liftRef.current;

      const scaleTarget = (selected ? SELECT_SCALE : 1) * reveal;
      const nextScale = THREE.MathUtils.damp(groupRef.current.scale.x, scaleTarget, 1.8, delta);
      groupRef.current.scale.setScalar(nextScale);
    }

    if (glowLightRef.current) {
      glowLightRef.current.intensity =
        (1.1 + coreUniforms.uBoost.value * 0.8 + emerge * 1.4) * (1 - coreUniforms.uDim.value * 0.6);
    }
  });

  return (
    <group position={position}>
      {/* Star-dust aura — a peacock-hued cloud of cosmic dust and faint stars
          swirling around the orb. It sits on the outer, non-rotating group and
          does all its own motion in the shader, so it's independent of the
          orb's spin and selection scale. No halo, no rings. */}
      <StarDustAura
        count={900}
        boostUniform={coreUniforms.uBoost}
        dimUniform={coreUniforms.uDim}
        timeRef={timeRef}
      />

      <group ref={groupRef}>
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
        <icosahedronGeometry args={[0.76, 7]} />
        <shaderMaterial
          vertexShader={afterVertexShader}
          fragmentShader={afterFragmentShader}
          uniforms={coreUniforms}
        />
      </mesh>

      <pointLight ref={glowLightRef} color="#f3cf6e" intensity={1.1} distance={4} />
      </group>
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
            // Warm gold-lit dust rather than neutral grey, so the motes belong
            // to the same warm room as the orbs and bronze backdrop.
            gl_FragColor = vec4(vec3(0.95, 0.83, 0.62), alpha * 0.26);
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

/* A single, smooth champagne / antique-gold surface — no metal grain or
   texture, just clean light on gold. A soft vertical wash (champagne toward the
   top, deeper antique gold below), gentle reflection pools where each orb's
   light falls on the surface (warm bronze under the raw Before orb, champagne +
   a whisper of peacock under the forged After orb), a broad camera-responsive
   sheen, and a slow polish sweep. Deliberately understated: the gold is the
   luxury canvas, the orbs remain the focal points. The corners only deepen
   gently — the field stays gold everywhere, never black.

   auraRef feeds the After orb's transformation energy into the reflection so the
   iridescence gently tints the surrounding gold as it flares. */
function Backdrop({
  timeRef,
  auraRef,
}: {
  timeRef: React.RefObject<THREE.Timer>;
  auraRef: React.RefObject<number>;
}) {
  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uAura: { value: 0 },
      uDeep: { value: new THREE.Color("#281d0f") },      // deep antique gold, lower/edges
      uGold: { value: new THREE.Color("#7d6234") },      // main gold field
      uChampagne: { value: new THREE.Color("#c2a165") }, // champagne highlight, upper/pools
      uReflBefore: { value: new THREE.Color("#54401f") },
      uReflAfter: { value: new THREE.Color("#8a6f3a") },
    }),
    []
  );

  useFrame(() => {
    const delta = timeRef.current.getDelta();
    uniforms.uTime.value = timeRef.current.getElapsed();
    uniforms.uAura.value = THREE.MathUtils.damp(
      uniforms.uAura.value,
      auraRef.current ?? 0,
      3,
      delta
    );
  });

  return (
    <mesh position={[0, 0, -4]} scale={[20, 12, 1]}>
      <planeGeometry args={[1, 1]} />
      <shaderMaterial
        uniforms={uniforms}
        vertexShader={`
          varying vec2 vUv;
          varying vec3 vWorld;
          void main() {
            vUv = uv;
            vWorld = (modelMatrix * vec4(position, 1.0)).xyz;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }
        `}
        fragmentShader={`
          uniform float uTime;
          uniform float uAura;
          uniform vec3 uDeep;
          uniform vec3 uGold;
          uniform vec3 uChampagne;
          uniform vec3 uReflBefore;
          uniform vec3 uReflAfter;
          varying vec2 vUv;
          varying vec3 vWorld;

          ${IRIDESCENCE_GLSL}

          void main() {
            vec2 uv = vUv;
            vec2 cc = uv - 0.5;
            cc.x *= 1.7;
            float d = length(cc);

            // Smooth vertical wash: deep antique gold low, gold through the
            // middle, champagne toward the top — a clean lit gold field.
            vec3 col = mix(uDeep, uGold, smoothstep(-0.05, 0.5, uv.y));
            col = mix(col, uChampagne, smoothstep(0.45, 1.05, uv.y) * 0.6);

            // Soft reflection pools where each orb's light lands on the surface.
            float lb = smoothstep(0.42, 0.0, distance(uv, vec2(0.30, 0.5)));
            float la = smoothstep(0.48, 0.0, distance(uv, vec2(0.70, 0.5)));
            col += uReflBefore * lb * 0.26;
            col += uReflAfter * la * 0.34;

            // Broad polished sheen that responds to the camera: reflect the view
            // ray off the flat surface and read one soft environment light lobe,
            // so the highlight glides as the camera parallaxes.
            vec3 vd = normalize(cameraPosition - vWorld);
            vec3 refl = reflect(-vd, vec3(0.0, 0.0, 1.0));
            float sheen = smoothstep(0.1, 0.95, dot(refl, normalize(vec3(0.4, 0.7, 0.6))) * 0.5 + 0.5);
            col += uChampagne * sheen * 0.10;

            // A slow broad polish sweep gives the gold life without motion that
            // draws the eye from the orbs.
            float sweep = 0.5 + 0.5 * sin(uv.x * 2.6 - uv.y * 1.4 + uTime * 0.1);
            col += uChampagne * pow(sweep, 3.0) * 0.04;

            // The After orb's iridescence gently tints the gold around it,
            // rising as its transformation energy flares.
            vec3 auraTint = peacockHue(uTime * 0.03 + uv.x * 0.4);
            auraTint = mix(auraTint, uChampagne, 0.4);
            col += auraTint * la * (0.04 + uAura * 0.12);

            // Gentle radial vignette — the corners only deepen into antique
            // gold to frame the orbs; the field never falls to black.
            col *= mix(0.72, 1.0, smoothstep(1.25, 0.15, d));

            gl_FragColor = vec4(col, 1.0);
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
  introRef,
  timeRef,
}: {
  dollyRef: React.RefObject<number>;
  tiltRef: React.RefObject<number>;
  introRef: React.RefObject<number>;
  timeRef: React.RefObject<THREE.Timer>;
}) {
  const { camera, pointer } = useThree();
  const base = useMemo(() => new THREE.Vector3(0, 0.1, 5.2), []);

  useFrame(() => {
    const delta = timeRef.current.getDelta();
    const dolly = dollyRef.current ?? 0;
    const tilt = tiltRef.current ?? 0;

    // Arrival: at intro 0 the camera is still inside the parting light —
    // pushed in, lifted, looking slightly down into the forming forge — and
    // eases back to its resting frame as intro → 1. The offset vanishes
    // completely at rest, so idle behaviour is byte-for-byte unchanged.
    const arrival = 1 - easeOutCubic(introRef.current ?? 1);

    const targetX = base.x + pointer.x * 0.18 + tilt * 0.3;
    const targetY = base.y + pointer.y * 0.1 + arrival * 0.5;
    const targetZ = base.z - dolly * 0.22 - arrival * 1.7;

    // Snap-follow while the light still hides the arrival (fast damp), then
    // relax to the gentle idle damping once we're on screen.
    const posDamp = 2 + arrival * 2.5;
    camera.position.x = THREE.MathUtils.damp(camera.position.x, targetX, posDamp, delta);
    camera.position.y = THREE.MathUtils.damp(camera.position.y, targetY, posDamp + 0.5, delta);
    camera.position.z = THREE.MathUtils.damp(camera.position.z, targetZ, posDamp, delta);
    camera.lookAt(tilt * 0.4, 0.05 - arrival * 0.15, 0);

    if (camera instanceof THREE.PerspectiveCamera) {
      const targetFov = 45 - dolly * 1.2 + arrival * 4;
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
  introRef,
}: {
  selected: Selected;
  setSelected: (v: Selected) => void;
  introRef: React.RefObject<number>;
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
      <CameraRig dollyRef={dollyRef} tiltRef={tiltRef} introRef={introRef} timeRef={timeRef} />
      <Backdrop timeRef={timeRef} auraRef={arrivalBoostRef} />
      <ambientLight intensity={0.18} />
      <directionalLight position={[3, 4, 5]} intensity={0.3} color="#fff3da" />

      {/* No ambientLight/directionalLight here on purpose: every visible
          surface in this scene is a plain THREE.ShaderMaterial (not
          `lights: true`), so scene lights never reach them — the only
          real "lighting" is the fresnel/wrap terms hand-rolled inside
          each fragment shader below, plus the two dynamic pointLights
          used for the glow flicker. */}

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
        introRef={introRef}
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
        introRef={introRef}
      />

      <Html position={[beforePos[0], -1.25, 0]} center distanceFactor={8} zIndexRange={[10, 0]}>
        <div
          className="pointer-events-none select-none whitespace-nowrap text-center font-light tracking-[0.25em] text-white/80"
          style={{ fontSize: "13px", textShadow: "0 1px 1px rgba(227, 144, 42, 0.4)" }}
        >
          BEFORE DWARKA
        </div>
      </Html>
      <Html position={[afterPos[0], -1.25, 0]} center distanceFactor={8} zIndexRange={[10, 0]}>
        <div
          className="pointer-events-none select-none whitespace-nowrap text-center font-light tracking-[0.25em] text-white/80"
          style={{ fontSize: "13px", textShadow: "0 1px 1px rgba(227, 144, 42, 0.4)" }}
        >
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

  // The splash sits on top of this section for the whole intro, but r3f's
  // default frameloop renders regardless of visibility — a continuous
  // high-performance WebGL loop competing with the splash video's decode for
  // the same GPU. Hold the loop until the intro hands off. Outside
  // IntroProvider `introComplete` defaults to true, so this scene renders
  // normally anywhere else.
  const { introComplete } = useIntro();

  // Arrival progress, fed from the shared bridge timeline. 0 while the forge
  // is still hidden inside the parting light, 1 once it has fully settled.
  // Read imperatively inside the r3f render loop (camera + orbs), so scrolling
  // never triggers a React re-render of the WebGL tree.
  const introRef = useRef(1);

  useEffect(() => {
    if (prefersReducedMotion()) {
      introRef.current = 1;
      return;
    }

    let ticking = false;
    function apply() {
      ticking = false;
      const h = window.innerHeight || 1;
      const depth = window.scrollY / h;
      introRef.current = smoothstep(BRIDGE.arriveStart, BRIDGE.arriveEnd, depth);
    }
    function onScroll() {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(apply);
    }

    apply();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <div
      style={{ position: "relative", width: "100%", height: "100vh", background: "#6a5330" }}
      data-navbar-bg="#d9be86"
      data-navbar-fg="#2a1e0d"
    >
      <Canvas
        camera={{ position: [0, 0.1, 5.2], fov: 45, near: 0.1, far: 50 }}
        frameloop={introComplete ? "always" : "never"}
        dpr={[1, 2]}
        gl={{ antialias: true, powerPreference: "high-performance" }}
        style={{ filter: "contrast(1.03) saturate(1.05)" }}
      >
        <Scene selected={selected} setSelected={setSelected} introRef={introRef} />
      </Canvas>
      <div
        style={{
          position: "absolute",
          inset: 0,
          pointerEvents: "none",
          // A very soft warm deepening at the corners — keeps the gold field
          // reading as gold everywhere (never black), just gently framed.
          background:
            "radial-gradient(ellipse at center, transparent 62%, rgba(24,15,5,0.20) 100%)",
        }}
      />
      <SelectionPanel selected={selected} onClose={() => setSelected(null)} />
    </div>
  );
}
