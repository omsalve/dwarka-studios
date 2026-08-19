"use client";

import { useEffect, useRef } from "react";
import { onScrollFrame } from "@/lib/scrollScheduler";

/* -----------------------------------------------------------------------
   Ink-wash scroll transition  —  reusable between any two stacked sections
   ─────────────────────────────────────────────────────────────────────

   Layout contract  (page.tsx)
   ───────────────────────────
   Each transition is paired with a sibling veil div (absolute, z-30,
   solid background matching the section being hidden) placed inside that
   section's own sticky wrapper. We fade the veil in from *within* its own
   stacking context — bypassing the GPU compositor layer that Framer
   Motion / WebGL canvases can create for animated elements, which would
   otherwise be able to escape the z-index of this component's fixed
   overlay canvas.

   Animation phases  (all in multiples of window.innerHeight, configurable
   via props so the same component can drive multiple transitions at
   different scroll depths)
   ────────────────────────────────────────────────────────────
   scrollY  0 → spreadStart        │ no ink; incoming section fully visible
            spreadStart → spreadEnd│ ink RISES from bottom
            spreadEnd → fadeEnd    │ ink holds, canvas FADES OUT
            ≥  fadeEnd             │ canvas invisible; next section fills viewport

   The critical alignment: fadeEnd must equal the scroll position at which
   the next section starts filling the viewport, so when the ink finishes
   fading there's no gap or overshoot.

   Visual design
   ─────────────
   Ink floods upward from the viewport's bottom edge. The leading edge is
   shaped by three summed sine frequencies so it undulates organically. A
   thin gold shimmer hovers just above the rising edge on every transition,
   suggesting warmth passing between the two sections it bridges.
   ----------------------------------------------------------------------- */

type InkTransitionProps = {
  /** Final ink color painted across the canvas — should exactly match the
   *  background of the section this transition floods into. */
  color?: string;
  /** Gold shimmer color along the ink's leading edge, as an "R,G,B" triplet. */
  glowColor?: string;
  /** id of the veil element (rendered by the page) that backstops this
   *  transition's own sticky section from bleeding through the canvas. */
  veilId?: string;
  spreadStartVh?: number;
  spreadEndVh?: number;
  fadeEndVh?: number;
};

const DEFAULT_COLOR = "#050403"; // exact match: BeforeAfterDwarka Backdrop + page bg
const DEFAULT_GLOW = "200,162,74"; // --gold, #c8a24a
const DEFAULT_VEIL_ID = "hero-veil";
const DEFAULT_SPREAD_START_VH = 0.50;
const DEFAULT_SPREAD_END_VH = 1.65;
const DEFAULT_FADE_END_VH = 2.00;

function edgeWave(t: number, amp: number): number {
  return (
    Math.sin(t * Math.PI * 2.1 + 0.70) * 0.50 +
    Math.sin(t * Math.PI * 5.4 + 2.10) * 0.32 +
    Math.sin(t * Math.PI * 11.8 + 0.90) * 0.18
  ) * amp;
}

export function InkTransition({
  color = DEFAULT_COLOR,
  glowColor = DEFAULT_GLOW,
  veilId = DEFAULT_VEIL_ID,
  spreadStartVh = DEFAULT_SPREAD_START_VH,
  spreadEndVh = DEFAULT_SPREAD_END_VH,
  fadeEndVh = DEFAULT_FADE_END_VH,
}: InkTransitionProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const canvasEl = canvasRef.current;
    if (!canvasEl) return;
    const context = canvasEl.getContext("2d");
    if (!context) return;
    // Explicitly-typed non-null aliases so the nested draw/update closures
    // keep the narrowed types under `strict` (they'd otherwise re-widen to
    // `… | null` inside the callbacks).
    const canvas: HTMLCanvasElement = canvasEl;
    const ctx: CanvasRenderingContext2D = context;

    let W = 0, H = 0;
    let spreadStart = 0, spreadEnd = 0, fadeEnd = 0;

    /** Re-reads the viewport; returns true if anything actually changed.
     *  Width matters as much as height here — a window dragged narrower
     *  without changing height still needs a new backing store, or the ink
     *  stops spanning the frame. */
    function measure(): boolean {
      const nextW = window.innerWidth;
      const nextH = window.innerHeight;
      if (nextW === W && nextH === H) return false;
      W = nextW;
      H = nextH;
      // Assigning width/height also clears the backing store, so whatever was
      // painted is gone and the paint gate has to be reset by the caller.
      canvas.width = W;
      canvas.height = H;
      spreadStart = spreadStartVh * H;
      spreadEnd   = spreadEndVh   * H;
      fadeEnd     = fadeEndVh     * H;
      return true;
    }

    function drawInk(spreadP: number) {
      ctx.clearRect(0, 0, W, H);
      if (spreadP <= 0) return;

      if (spreadP >= 1) {
        ctx.fillStyle = color;
        ctx.fillRect(0, 0, W, H);
        return;
      }

      // Ease-in-out quad — gentle ramp up and down around the midpoint
      const eased = spreadP < 0.5
        ? 2 * spreadP * spreadP
        : 1 - Math.pow(-2 * spreadP + 2, 2) / 2;

      // Edge y-position rises from H (bottom) toward 0 (top)
      const edgeY = H * (1 - eased);

      // Wave amplitude peaks at 50 % spread then subsides — ink "settles" as it fills
      const amp = 54 * Math.sin(spreadP * Math.PI) * Math.min(1, W / 1280);

      // ── Ink-fill polygon ──────────────────────────────────────────────
      const SEGS = 90;
      ctx.beginPath();
      ctx.moveTo(0, H);
      ctx.lineTo(W, H);
      ctx.lineTo(W, edgeY + edgeWave(1, amp));
      for (let i = SEGS - 1; i >= 0; i--) {
        const t = i / SEGS;
        ctx.lineTo(t * W, edgeY + edgeWave(t, amp));
      }
      ctx.closePath();
      ctx.fillStyle = color;
      ctx.fill();

      // ── Gold shimmer just above the leading edge ──────────────────────
      // Implies warmth passing between the two sections before the ink settles
      const glowH = 72 + Math.abs(amp);
      const glowGrad = ctx.createLinearGradient(0, edgeY - glowH, 0, edgeY + 22);
      glowGrad.addColorStop(0,    `rgba(${glowColor},0)`);
      glowGrad.addColorStop(0.48, `rgba(${glowColor},0.10)`);
      glowGrad.addColorStop(0.78, `rgba(${glowColor},0.04)`);
      glowGrad.addColorStop(1,    "rgba(0,0,0,0)");
      ctx.fillStyle = glowGrad;
      ctx.fillRect(0, edgeY - glowH, W, glowH + 22);
    }

    // Resolved once, not re-queried on every scroll event. getElementById is
    // cheap but it was running several times per frame for the life of the
    // page; the veil never moves.
    let veil: HTMLElement | null = null;
    function veilElement() {
      if (!veil) veil = document.getElementById(veilId) as HTMLElement | null;
      return veil;
    }

    // The ink polygon is a 90-segment path plus a gradient fill across the
    // whole viewport. Quantising the spread to ~1/600 of its range means a
    // frame that has not moved the edge by even a third of a pixel does not
    // redraw at all — invisible, and it removes the majority of the paints
    // during a slow scrub.
    let paintedStep = -1;
    const STEPS = 600;

    function update(sy: number) {
      // ── veil: covers this section's content from inside its own stacking
      // context. GPU-composited elements (Framer Motion divs, WebGL canvases)
      // can escape CSS z-index ordering. The veil (z-30 within the sticky
      // wrapper) is guaranteed to sit above all of this section's children,
      // hiding them before the ink reaches them — no compositor fights needed.
      const veil = veilElement();
      if (veil) {
        if (sy <= spreadStart) {
          veil.style.opacity = "0";
        } else if (sy <= spreadEnd) {
          const p = (sy - spreadStart) / (spreadEnd - spreadStart);
          const eased = p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2;
          // Hold off until the ink edge has nearly reached the top of the
          // viewport, so the section stays visible above the rising ink
          // instead of the whole screen changing early.
          veil.style.opacity = String(Math.min(1, Math.max(0, (eased - 0.9) / 0.1)));
        } else {
          // Hold fully opaque through the fade phase (section is out of view anyway)
          veil.style.opacity = "1";
        }
      }

      // ── Canvas ink ────────────────────────────────────────────────────
      if (sy <= spreadStart || sy >= fadeEnd) {
        if (canvas.style.opacity !== "0") {
          canvas.style.opacity = "0";
          paintedStep = -1;
        }
        return;
      }

      // The fade phase only changes the canvas's *opacity* — a compositor
      // property. The ink underneath is already at full coverage, so it must
      // not be repainted for every step of the fade.
      const spread = sy <= spreadEnd ? (sy - spreadStart) / (spreadEnd - spreadStart) : 1;

      if (sy <= spreadEnd) {
        canvas.style.opacity = "1";
      } else {
        const fp = (sy - spreadEnd) / (fadeEnd - spreadEnd);
        canvas.style.opacity = String(Math.max(0, 1 - Math.pow(fp, 1.6)));
      }

      const step = Math.round(spread * STEPS);
      if (step === paintedStep) return;
      paintedStep = step;
      drawInk(spread);
    }

    measure();
    return onScrollFrame(({ y }) => {
      if (measure()) paintedStep = -1;
      update(y);
    });
  }, [color, glowColor, veilId, spreadStartVh, spreadEndVh, fadeEndVh]);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 50,
        pointerEvents: "none",
        opacity: 0,
        // translateZ promotes this to its own GPU compositor layer, improving
        // stacking order reliability against WebGL canvases
        transform: "translateZ(0)",
        willChange: "opacity",
      }}
    />
  );
}
