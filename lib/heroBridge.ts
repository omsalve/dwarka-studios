/* -----------------------------------------------------------------------
   Hero → About "descent into the threshold" bridge — shared scroll timeline
   ─────────────────────────────────────────────────────────────────────

   One source of truth so three independent pieces stay frame-locked:

     • Hero.tsx           — dives into the temple, warms, sheds its text
     • HeroLightBridge    — ignites the temple's light, holds the threshold
                            over the section seam, then fades it away
     • About.tsx          — the gilded room the light turns out to have been,
                            lighting its manifesto word by word

   All thresholds are expressed in multiples of the viewport height H
   (= window.innerHeight), measured from document scrollY = 0 (page top,
   Hero pinned). They line up with the sticky-container layout in page.tsx:

     container 1 (Hero)   = 200vh  → Hero pinned  scrollY 0 … 1.0·H
                                    → About fills viewport at scrollY 2.0·H
     container 2 (About)  = 200vh  → About pinned scrollY 2.0·H … 3.0·H
                                    → InkTransition floods 2.95·H … 4.0·H

   The unavoidable ~1·H seam (where the two stacked sticky sections cross)
   is the stretch we deliberately hold full-champagne — HOLD phase below.

   The forge (BeforeAfterDwarka) is no longer part of this timeline: it now
   closes the page, several sections down, where an absolute page depth would
   be hostage to every section's height above it. Its arrival is measured
   against its own container instead — see FORGE_ARRIVAL there.
   ----------------------------------------------------------------------- */

export const BRIDGE = {
  /** Temple ignition + Hero dive begin accelerating. Below this the Hero is
   *  fully legible and only breathing (intro zoom + parallax). */
  igniteStart: 0.3,
  /** Frame fully engulfed in champagne light; Hero is gone beneath it. */
  bloomFull: 0.98,
  /** Light held over the section seam until About fills the viewport. */
  holdEnd: 2.0,
  /** Light has fully cleared; the threshold stands revealed. */
  clearEnd: 2.3,

  /** Scroll depth (in viewport-heights) the timed descent comes to rest at —
   *  mid-way through the About reveal, so the visitor stops with the sentence
   *  half-lit and the rest of it is what asks them to scroll on. */
  restDepth: 2.5,
  /** Duration of the self-playing descent, in milliseconds (~3s). */
  playMs: 3000,

  /** Screen-space anchor the descent focuses on (fraction of W, H) — the
   *  centre of the frame, so the Hero dives straight into the middle and the
   *  ignition bloom grows from there rather than off to one side. */
  templeX: 0.5,
  templeY: 0.5,

  /** The wash itself, as CSS. HeroLightBridge paints these three stops onto
   *  its canvas and the About panel carries them as its background, which is
   *  the entire trick: fading the canvas out reveals an identical gradient,
   *  so there is no dissolve to see. Change one and you must change both —
   *  which is why they live here rather than in either component. */
  gradient:
    "linear-gradient(180deg, #e7ce8c 0%, #96743c 50%, #584428 100%)",
  /** The same three stops as "R,G,B" triplets, for the canvas. */
  champagne: "231,206,140", // #e7ce8c
  goldField: "150,116,60", //  #96743c
  deepGold: "88,68,40", //     #584428
} as const;

/** Beats inside the About panel, in the same page-depth units as BRIDGE.
 *  All of them start at or after BRIDGE.clearEnd — nothing in the room may
 *  move while the wash is still covering it, or the "flat light" illusion
 *  the seamless dissolve depends on is broken. */
export const ABOUT = {
  /** The chamber's shadow deepens around the words. */
  scrimStart: 2.28,
  scrimEnd: 2.5,
  /** The manifesto lights word by word. */
  wordsStart: 2.3,
  wordsEnd: 2.8,
  /** The invitation arrives once the sentence has finished. */
  ctaStart: 2.62,
  ctaEnd: 2.85,
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
