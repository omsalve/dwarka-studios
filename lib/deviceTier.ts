"use client";

/* -----------------------------------------------------------------------
   deviceTier — one honest answer to "how much can this machine take?"
   ─────────────────────────────────────────────────────────────────────
   Every expensive subsystem on this site (two WebGL scenes, a 30MB video
   splash, per-frame canvas painting) asks the same question at mount, so
   it is answered exactly once, cached for the session, and expressed as a
   *budget* rather than a set of on/off switches. Nothing is ever disabled
   outright here — a "low" tier still gets the forge, the book and the
   splash, just at a resolution and particle density the GPU can hold 60fps
   at.

   The probe is deliberately cheap and synchronous-after-first-call:

     · hardwareConcurrency / deviceMemory  — the CPU side (decode, JS)
     · navigator.connection                — bytes we're allowed to spend
     · a throwaway WebGL context + UNMASKED_RENDERER — the GPU side, which
       is the only reliable way to tell an M-series Mac from a software
       rasterizer or a low-end mobile Mali/Adreno part
     · devicePixelRatio                    — how many pixels that GPU is
       being asked to fill

   The GPU probe is the one thing worth the 1-2ms: dpr alone lies badly
   (a cheap 3x phone and a 3x MacBook Pro look identical to it).
   ----------------------------------------------------------------------- */

import { useSyncExternalStore } from "react";

export type Tier = "low" | "mid" | "high";

export interface DeviceBudget {
  tier: Tier;
  /** Hard ceiling for renderer pixel ratio. The single most effective GPU dial. */
  maxDpr: number;
  /** MSAA is nearly free on desktop GPUs and brutal on mobile tilers. */
  antialias: boolean;
  /** Real-time shadow maps at all, and at what resolution. */
  shadowMapSize: number;
  /** Multiplier applied to every particle/point count in the 3D scenes. */
  particleScale: number;
  /** Ceiling for procedurally-baked canvas textures, as a scale factor. */
  textureScale: number;
  /** Whether to spend ~30MB on the cinematic video splash. */
  allowHeavyVideo: boolean;
  /** Whether pointer-tracked lighting/parallax is worth its repaints. */
  allowPointerFx: boolean;
  /**
   * Whether large *animated* CSS filters are affordable — in practice
   * `blur()` over a big element.
   *
   * A blur cannot be composited: every frame of an animating blur is a fresh
   * rasterisation of the element and its blur skirt, on the main thread's
   * raster workers. A 46px blur ramping across a near-full-viewport masked
   * layer is one of the most expensive things a browser can be asked to do,
   * and it is the hero parchment's entrance.
   *
   * False on every touch device and on low-tier laptops. Static filters are
   * unaffected — those rasterise once and then just composite.
   */
  allowHeavyFilters: boolean;
  /** Primary input is a touch screen — a phone or tablet, not a laptop. */
  coarsePointer: boolean;
  /**
   * A phone specifically: touch primary AND a short side under 700px.
   *
   * Distinct from `coarsePointer`, which also catches tablets, and from
   * `tier`, which can be wrong (Safari masks the GPU, so an iPhone and a
   * budget Android can score alike). Both halves are required: a tablet is
   * touch but roomy and usually capable, and a narrow desktop window is
   * small but has a mouse and a real GPU.
   *
   * Used where the right answer is a different *layout*, not a cheaper
   * version of the same one — see components/scenes/DeferredBook.
   */
  isPhone: boolean;
  /** The visitor asked the OS to keep motion down. */
  reducedMotion: boolean;
  /** Save-Data header or a 2g/3g-class connection. */
  frugalNetwork: boolean;
  /**
   * False for the one render that happens before the probe can run (SSR and
   * hydration). Anything that would *remove* markup on a weak device must
   * wait for this, or the server and client disagree about what to render.
   */
  measured: boolean;
}

/* --- GPU class ------------------------------------------------------- */

/** Renderer substrings that reliably mean "budget part or no part at all". */
const WEAK_GPU = [
  "swiftshader", "llvmpipe", "software", "microsoft basic",
  "mali-4", "mali-t6", "mali-t7", "mali-t8", "mali-g31", "mali-g51", "mali-g52",
  "adreno (tm) 3", "adreno (tm) 4", "adreno (tm) 5", "adreno (tm) 60",
  "powervr", "videocore", "intel(r) hd graphics 3", "intel(r) hd graphics 4",
];

/** Renderer substrings that mean "spend freely". */
const STRONG_GPU = [
  "apple m", "nvidia", "geforce", "rtx", "radeon rx", "quadro",
  "arc(tm) a", "apple a1", "apple a2", "adreno (tm) 7", "adreno (tm) 8",
];

/* Safari (iOS and macOS) masks UNMASKED_RENDERER_WEBGL to this exact vendor
   string rather than the model, as an anti-fingerprinting measure. It does not
   tell us which Apple GPU — but it is a floor, and a high one: Apple has not
   shipped a browser-capable device with a genuinely weak GPU in years.

   Without this, every Safari device scored the same as a machine we know
   nothing about, which put an iPhone 15 Pro in the same bucket as a Mali-G52
   budget Android and an M3 MacBook below a Pixel. */
const MASKED_APPLE = "apple gpu";

type GpuClass = "weak" | "unknown" | "decent" | "strong";

function probeGpu(): GpuClass {
  try {
    const canvas = document.createElement("canvas");
    const gl = (canvas.getContext("webgl2") ??
      canvas.getContext("webgl")) as WebGLRenderingContext | null;
    if (!gl) return "weak"; // no WebGL at all — everything below must degrade

    const ext = gl.getExtension("WEBGL_debug_renderer_info");
    const raw = ext
      ? String(gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) ?? "")
      : String(gl.getParameter(gl.RENDERER) ?? "");
    const name = raw.toLowerCase();

    // Release the probe context immediately — browsers cap live contexts at
    // ~8-16 and this page legitimately wants two of them.
    gl.getExtension("WEBGL_lose_context")?.loseContext();

    if (!name) return "unknown";
    if (WEAK_GPU.some((k) => name.includes(k))) return "weak";
    if (STRONG_GPU.some((k) => name.includes(k))) return "strong";
    if (name.includes(MASKED_APPLE)) return "decent";
    return "unknown";
  } catch {
    return "unknown";
  }
}

/* --- Network --------------------------------------------------------- */

interface NetworkInformation {
  effectiveType?: string;
  saveData?: boolean;
  downlink?: number;
}

function connection(): NetworkInformation | undefined {
  return (navigator as Navigator & { connection?: NetworkInformation }).connection;
}

function isFrugalNetwork(): boolean {
  const c = connection();
  if (!c) return false;
  if (c.saveData) return true;
  if (c.effectiveType && /(^|-)2g$|^slow-2g$|^3g$/.test(c.effectiveType)) return true;
  if (typeof c.downlink === "number" && c.downlink > 0 && c.downlink < 1.5) return true;
  return false;
}

/* --- The budget ------------------------------------------------------ */

/**
 * What we assume before the probe has run. Deliberately middle-of-the-road:
 * every WebGL consumer is client-only and never sees this, and the one thing
 * that does render on the server (the video splash) is guarded on `measured`
 * rather than on these values, so hydration always matches.
 */
const SERVER_BUDGET: DeviceBudget = {
  tier: "mid",
  maxDpr: 1.5,
  antialias: true,
  shadowMapSize: 1024,
  particleScale: 0.7,
  textureScale: 1,
  allowHeavyVideo: false,
  allowPointerFx: false,
  // Effect flags default OFF before the probe, so the one render that happens
  // without a measurement always fails toward cheap rather than toward a
  // blur a phone cannot afford.
  allowHeavyFilters: false,
  coarsePointer: false,
  // False before measurement so the server and the hydrating client always
  // agree on which layout to render. See DeferredBook for why that is safe.
  isPhone: false,
  reducedMotion: false,
  frugalNetwork: false,
  measured: false,
};

let cached: DeviceBudget | null = null;

export function getDeviceBudget(): DeviceBudget {
  if (cached) return cached;
  if (typeof window === "undefined") return SERVER_BUDGET;

  const cores = navigator.hardwareConcurrency ?? 4;
  const memory =
    (navigator as Navigator & { deviceMemory?: number }).deviceMemory ?? 4;
  const dpr = window.devicePixelRatio || 1;
  const gpu = probeGpu();
  const frugalNetwork = isFrugalNetwork();
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const coarsePointer = window.matchMedia("(pointer: coarse)").matches;
  // A phone-sized viewport is a strong signal on its own: even a fast SoC is
  // pushing a 3x display through a thermally-limited part.
  const smallViewport = Math.min(window.innerWidth, window.innerHeight) < 700;

  // Score, rather than a decision tree, so no single weak signal (an old
  // browser hiding deviceMemory, say) can misclassify an otherwise fine machine.
  let score = 0;
  score += cores >= 8 ? 2 : cores >= 4 ? 1 : 0;
  score += memory >= 8 ? 2 : memory >= 4 ? 1 : 0;
  score += gpu === "strong" ? 3 : gpu === "decent" ? 2 : gpu === "weak" ? -3 : 0;
  score += coarsePointer ? -1 : 1;
  score += smallViewport ? -1 : 0;
  // A 3x display on a GPU we know to be weak is a warning, not a compliment:
  // it means 9x the fragments for the same scene. This deliberately does NOT
  // fire on "unknown" — Safari reports unknown for everything, so penalising
  // it here charged every Apple device twice for the same missing signal.
  score += dpr >= 2.5 && gpu === "weak" ? -1 : 0;

  const tier: Tier = score >= 5 ? "high" : score >= 2 ? "mid" : "low";

  cached = {
    tier,
    // The dial that matters most. Capping a "high" tier at 2 rather than the
    // native 3 costs nothing visible on this content (soft gradient shaders,
    // no fine geometry) and saves 55% of the fragments on a 3x screen.
    maxDpr: tier === "high" ? 2 : tier === "mid" ? 1.5 : 1,
    antialias: tier !== "low",
    shadowMapSize: tier === "high" ? 1536 : tier === "mid" ? 1024 : 0,
    particleScale: tier === "high" ? 1 : tier === "mid" ? 0.6 : 0.3,
    textureScale: tier === "high" ? 1.6 : tier === "mid" ? 1.1 : 0.75,
    // Deliberately NOT gated on tier. That threshold was written when the
    // splash was two 1080p masters totalling 29MB, where a weak device was a
    // real reason to withhold it. The encode ladder has since taken it to
    // 1.22MB on the 720 rung — less than this page's own JavaScript — and a
    // 720p24 clip is trivial for any phone of the last decade to decode. What
    // remains is a bandwidth question, not a device-class one.
    allowHeavyVideo: !frugalNetwork && !reducedMotion,
    allowPointerFx: !coarsePointer && tier !== "low" && !reducedMotion,
    // Phones and tablets are excluded outright rather than by score: even a
    // fast phone SoC is pushing a 3x panel through a thermally-limited part,
    // and a full-viewport animated blur is where that shows up first.
    allowHeavyFilters: !coarsePointer && tier !== "low" && !reducedMotion,
    coarsePointer,
    isPhone: coarsePointer && smallViewport,
    reducedMotion,
    frugalNetwork,
    measured: true,
  };

  return cached;
}

/** Test/debug hook — forget the probe so the next call re-measures. */
export function resetDeviceBudget() {
  cached = null;
}

/* --- React binding --------------------------------------------------- */

/**
 * SSR-safe access to the budget. Hydration renders with the conservative
 * server budget (identical markup on both sides), then swaps to the measured
 * one on the client's first commit — so nothing capability-dependent is ever
 * baked into the HTML.
 */
export function useDeviceBudget(): DeviceBudget {
  return useSyncExternalStore(subscribeToBudget, getDeviceBudget, () => SERVER_BUDGET);
}

/** The probe never changes after mount, so there is nothing to subscribe to. */
function subscribeToBudget() {
  return () => {};
}
