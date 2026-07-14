/* -----------------------------------------------------------------------
   Opening Sequence — tunables
   ─────────────────────────────────────────────────────────────────────
   Two frame-locked videos of an ancient temple gate crossfade as the user
   discovers a glowing peacock feather. Everything here is data so the feel
   can be tuned without touching logic.
   ----------------------------------------------------------------------- */

export const VIDEO_SOURCES = {
  /** Calm state — subtle feather glow, ambient motion only. */
  base: "/videos/video1.mp4",
  /** Awakened state — stronger glow, magical particles, gate reacts. */
  charged: "/videos/video2.mp4",
} as const;

/* ---- Crossfade (Video 1 ⇄ Video 2) ---------------------------------- */

/** ~300ms. Short enough to feel responsive, long enough to be invisible. */
export const CROSSFADE_DURATION = 0.3; // seconds
/** Ease-out (expo). Fast to commit, gentle to settle — no perceptible seam. */
export const CROSSFADE_EASE = [0.16, 1, 0.3, 1] as const;

/** Drift tolerance before we re-align the hidden video (seconds). Correction
 *  only ever happens while a video is fully transparent, so it's never seen. */
export const SYNC_THRESHOLD = 0.06;

/* ---- Hold / charging ------------------------------------------------- */

/** Time from press to maximum intensity. */
export const CHARGE_DURATION = 1.2; // seconds
/** Smooth decay when released before completion. */
export const CHARGE_RESET_DURATION = 0.45; // seconds
export const CHARGE_RESET_EASE = [0.4, 0, 0.2, 1] as const;

/** Charge progress (0→1) at which each layer of feedback comes alive.
 *  Mirrors the beat sheet: bloom → particles → shimmer → pulse → max. */
export const CHARGE_STAGES = {
  bloom: 0.0,
  particles: 0.25,
  shimmer: 0.5,
  pulse: 0.75,
  max: 1.0,
} as const;

/* ---- Unlock (charge complete → reveal the landing page) -------------- */

/** Champagne light floods out from the feather once the hold completes. */
export const UNLOCK_FLOOD_DURATION = 0.8; // seconds
/** Beat held at full-white before the splash lifts. */
export const UNLOCK_HOLD = 0.12; // seconds
/** Splash fades away, revealing the already-mounted landing page beneath. */
export const UNLOCK_FADE_DURATION = 0.7; // seconds

/* ---- Feather hitbox -------------------------------------------------- */

/** Feather location as a fraction of the stage, center-anchored. The overlay
 *  and the invisible hitbox both key off this box. Tune to the video's feather
 *  (flip DEBUG_HITBOX to see it). Values assume object-cover framing. */
export const FEATHER_HITBOX = {
  cx: 0.5, // center X
  cy: 0.44, // center Y
  w: 0.11, // width
  h: 0.26, // height
} as const;

/** Outline the hitbox + overlay bounds while positioning the feather. */
export const DEBUG_HITBOX = false;

/* ---- Overlay particles ----------------------------------------------- */

/** Stable (SSR-safe) particle field — tiny iridescent motes that drift up
 *  around the feather. Positions are relative to the feather box. */
export const PARTICLES = [
  { x: 0.32, y: 0.72, size: 3, drift: 6, delay: 0.0, duration: 4.2 },
  { x: 0.58, y: 0.80, size: 2, drift: -8, delay: 0.7, duration: 5.1 },
  { x: 0.46, y: 0.62, size: 4, drift: 4, delay: 1.4, duration: 4.7 },
  { x: 0.68, y: 0.55, size: 2, drift: -5, delay: 0.4, duration: 5.6 },
  { x: 0.40, y: 0.48, size: 3, drift: 7, delay: 2.1, duration: 4.4 },
  { x: 0.54, y: 0.38, size: 2, drift: -4, delay: 1.1, duration: 6.0 },
  { x: 0.30, y: 0.30, size: 3, drift: 5, delay: 1.8, duration: 5.3 },
] as const;
