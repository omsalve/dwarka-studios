"use client";

import { useEffect, useRef } from "react";
import { BRIDGE, clamp01, smoothstep } from "@/lib/heroBridge";

/* -----------------------------------------------------------------------
   HeroForgeTransition
   ─────────────────────────────────────────────────────────────────────

   The luminous bridge between the Hero valley and the Dwarka forge. A
   single fixed, full-viewport 2D canvas that is *the light itself* passing
   between the two scenes — the Hero dives beneath it and the forge condenses
   out of it above it, so this layer is only ever the shared warm-light state
   the two scenes have in common.

   Deliberately shape-free: it is one full-frame champagne wash (a soft
   vertical grade matching the forge backdrop — bright up top, deep antique
   gold at the floor) that simply fades IN over the dive, HOLDS solid across
   the section seam, then fades OUT to uncover the forge. No radial cores, no
   glows, no reveal-hole — nothing that could read as a blob or edge moving
   across the frame. The colour is sampled from the forge's own backdrop, so
   fading it away reveals an identically-coloured scene: a seamless dissolve.

   Depth is normally advanced by IntroAutoScroll on a ~5.5s eased clock, but
   this component only ever renders the current scroll depth, so it behaves
   the same whether the descent is played or scrubbed.
   ----------------------------------------------------------------------- */

// Sampled from the forge backdrop: champagne highlight → gold field → deep
// antique-gold edge — the exact wash the Dwarka scene resolves to.
const CHAMPAGNE = "231,206,140"; // #e7ce8c
const GOLD_FIELD = "150,116,60"; // #96743c
const DEEP_GOLD = "88,68,40"; //   #584428

export function HeroForgeTransition() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvasEl = canvasRef.current;
    if (!canvasEl) return;
    const context = canvasEl.getContext("2d");
    if (!context) return;

    // Explicitly-typed non-null aliases so the nested closures keep the
    // narrowed types under `strict`.
    const cv: HTMLCanvasElement = canvasEl;
    const g: CanvasRenderingContext2D = context;

    let W = 0;
    let H = 0;

    function measure() {
      W = window.innerWidth;
      H = window.innerHeight;
      cv.width = W;
      cv.height = H;
    }

    function draw() {
      const depth = window.scrollY / H;

      if (depth <= BRIDGE.igniteStart || depth >= BRIDGE.clearEnd) {
        if (cv.style.opacity !== "0") cv.style.opacity = "0";
        return;
      }

      // Fade in across the dive, hold solid over the seam, fade out to the
      // forge — a single global alpha, no localized light anywhere.
      const ignite = smoothstep(BRIDGE.igniteStart, BRIDGE.bloomFull, depth);
      const part = smoothstep(BRIDGE.holdEnd, BRIDGE.clearEnd, depth);
      const alpha = clamp01(ignite * (1 - part));

      cv.style.opacity = "1";
      g.clearRect(0, 0, W, H);

      const grad = g.createLinearGradient(0, 0, 0, H);
      grad.addColorStop(0, `rgba(${CHAMPAGNE},${alpha})`);
      grad.addColorStop(0.5, `rgba(${GOLD_FIELD},${alpha})`);
      grad.addColorStop(1, `rgba(${DEEP_GOLD},${alpha})`);
      g.fillStyle = grad;
      g.fillRect(0, 0, W, H);
    }

    function onScroll() {
      draw();
    }
    function onResize() {
      measure();
      draw();
    }

    measure();
    draw();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onResize, { passive: true });

    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onResize);
    };
  }, []);

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
        transform: "translateZ(0)",
        willChange: "opacity",
      }}
    />
  );
}
