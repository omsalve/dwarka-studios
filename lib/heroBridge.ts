/* -----------------------------------------------------------------------
   Hero → Dwarka "descent into the forge" bridge — shared scroll timeline
   ─────────────────────────────────────────────────────────────────────

   One source of truth so three independent pieces stay frame-locked:

     • Hero.tsx              — dives into the temple, warms, sheds its text
     • HeroForgeTransition   — ignites the temple's light, holds the
                               threshold over the section seam, then parts
     • BeforeAfterDwarka.tsx — the forge camera arrives and the orbs
                               condense out of the parting light

   All thresholds are expressed in multiples of the viewport height H
   (= window.innerHeight), measured from document scrollY = 0 (page top,
   Hero pinned). They mirror the vh-based scheme the old InkTransition used,
   so they line up with the existing sticky-container layout in page.tsx:

     container 1 (Hero)   = 200vh  → Hero pinned  scrollY 0 … 1.0·H
                                    → forge fills viewport at scrollY 2.0·H
     container 2 (forge)  = 180vh  → forge pinned scrollY 2.0·H … 2.8·H

   The unavoidable ~1·H seam (where the two stacked sticky sections cross)
   is the stretch we deliberately hold full-champagne — HOLD phase below.
   ----------------------------------------------------------------------- */

export const BRIDGE = {
  /** Temple ignition + Hero dive begin accelerating. Below this the Hero is
   *  fully legible and only breathing (intro zoom + parallax). */
  igniteStart: 0.3,
  /** Frame fully engulfed in champagne light; Hero is gone beneath it. */
  bloomFull: 0.98,
  /** Light held over the section seam until the forge fills the viewport. */
  holdEnd: 2.0,
  /** Light has fully parted; the forge stands revealed. */
  clearEnd: 2.3,
  /** Forge camera + orbs begin settling (behind the still-parting light). */
  arriveStart: 2.0,
  /** Forge fully settled and at rest — where the timed descent comes to rest. */
  arriveEnd: 2.5,

  /** Scroll depth (in viewport-heights) the timed descent comes to rest at —
   *  the forge, settled, just before the forge→services transition begins. */
  restDepth: 2.5,
  /** Duration of the self-playing descent, in milliseconds (~2s). */
  playMs: 3000,

  /** Screen-space anchor the descent focuses on (fraction of W, H) — the
   *  centre of the frame, so the Hero dives straight into the middle and the
   *  ignition bloom grows from there rather than off to one side. */
  templeX: 0.5,
  templeY: 0.5,
} as const;

export function clamp01(x: number): number {
  return x < 0 ? 0 : x > 1 ? 1 : x;
}

/** Hermite smoothstep from a→b, clamped to [0,1]. */
export function smoothstep(a: number, b: number, x: number): number {
  if (a === b) return x < a ? 0 : 1;
  const t = clamp01((x - a) / (b - a));
  return t * t * (3 - 2 * t);
}

export function easeInOut(t: number): number {
  return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
}

export function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - clamp01(t), 3);
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/** Current scroll depth as a fraction of the viewport height. */
export function bridgeDepth(): number {
  const h = window.innerHeight || 1;
  return window.scrollY / h;
}

export function prefersReducedMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}
