"use client";

import { useEffect } from "react";
import { BRIDGE } from "@/lib/heroBridge";

/* -----------------------------------------------------------------------
   IntroAutoScroll
   ─────────────────────────────────────────────────────────────────────

   Turns the Hero → forge descent into a self-playing cinematic beat instead
   of a scrubbed one. While the page is at the top, the first downward scroll
   gesture (wheel / touch / key) is captured — not consumed as scroll — and
   instead starts a fixed ~5.5s eased playback that drives window.scrollY
   from the Hero all the way to the settled forge. Manual scroll input is
   locked for the whole beat plus a short cooldown, so a single flick can no
   longer overshoot the Before/After Dwarka section: the descent always plays
   in full and comes to rest exactly there.

   Everything visual is still driven off scrollY (Hero dive, the light bridge,
   the forge arrival), so this component owns *timing* only — it never touches
   the scenes directly. The eased time→depth curve spends most of the run on
   the slow dive into the temple, then eases through the light into the forge.

   Disabled under prefers-reduced-motion (normal scrolling is left intact),
   and it never fires unless the page is genuinely at the top, so a reload
   mid-page or a scroll-up-then-down behaves normally.
   ----------------------------------------------------------------------- */

const DIVE_FRACTION = 0.6; // share of the runtime spent on the slow dive
const DIVE_DEPTH = 1.0; //    scroll-depth reached by the end of the dive
const COOLDOWN_MS = 700; //   held-still beat on the forge after landing

type Phase = "armed" | "playing" | "cooldown" | "done";

function easeInOutSine(x: number): number {
  return -(Math.cos(Math.PI * x) - 1) / 2;
}

/** Time (0..1) → scroll depth (viewport-heights). Front-loaded so the dive
 *  into the temple is slow and the pass through the light is brisk. */
function depthAt(tau: number): number {
  if (tau <= 0) return 0;
  if (tau >= 1) return BRIDGE.restDepth;
  if (tau < DIVE_FRACTION) {
    return easeInOutSine(tau / DIVE_FRACTION) * DIVE_DEPTH;
  }
  const u = (tau - DIVE_FRACTION) / (1 - DIVE_FRACTION);
  return DIVE_DEPTH + easeInOutSine(u) * (BRIDGE.restDepth - DIVE_DEPTH);
}

export function IntroAutoScroll() {
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const html = document.documentElement;
    let phase: Phase = "armed";
    let raf = 0;
    let startT = 0;
    let cooldownTimer = 0;
    let savedScrollBehavior = "";
    let touchStartY = 0;

    const atTop = () => window.scrollY <= 2;
    const locked = () => phase === "playing" || phase === "cooldown";

    function step(now: number) {
      if (!startT) startT = now;
      const tau = Math.min(1, (now - startT) / BRIDGE.playMs);
      window.scrollTo(0, depthAt(tau) * window.innerHeight);
      if (tau < 1) {
        raf = requestAnimationFrame(step);
      } else {
        phase = "cooldown";
        cooldownTimer = window.setTimeout(() => {
          phase = "done";
          html.style.scrollBehavior = savedScrollBehavior;
        }, COOLDOWN_MS);
      }
    }

    function start() {
      if (phase !== "armed" || !atTop()) return;
      phase = "playing";
      // Bypass the global `scroll-behavior: smooth` so our per-frame
      // scrollTo calls jump precisely instead of double-animating.
      savedScrollBehavior = html.style.scrollBehavior;
      html.style.scrollBehavior = "auto";
      startT = 0;
      raf = requestAnimationFrame(step);
    }

    function onWheel(e: WheelEvent) {
      if (locked()) {
        e.preventDefault();
        return;
      }
      if (phase === "armed" && atTop() && e.deltaY > 0) {
        e.preventDefault();
        start();
      }
    }

    function onTouchStart(e: TouchEvent) {
      touchStartY = e.touches[0]?.clientY ?? 0;
    }

    function onTouchMove(e: TouchEvent) {
      if (locked()) {
        e.preventDefault();
        return;
      }
      if (phase === "armed" && atTop()) {
        const dy = touchStartY - (e.touches[0]?.clientY ?? touchStartY);
        if (dy > 4) {
          e.preventDefault();
          start();
        }
      }
    }

    const DOWN_KEYS = ["ArrowDown", "PageDown", "End", " ", "Spacebar"];
    const SCROLL_KEYS = [...DOWN_KEYS, "ArrowUp", "PageUp", "Home"];

    function onKey(e: KeyboardEvent) {
      if (locked()) {
        if (SCROLL_KEYS.includes(e.key)) e.preventDefault();
        return;
      }
      if (phase === "armed" && atTop() && DOWN_KEYS.includes(e.key)) {
        e.preventDefault();
        start();
      }
    }

    function onScroll() {
      // Re-arm the descent if the user returns fully to the top.
      if (phase === "done" && atTop()) phase = "armed";
    }

    window.addEventListener("wheel", onWheel, { passive: false });
    window.addEventListener("touchstart", onTouchStart, { passive: true });
    window.addEventListener("touchmove", onTouchMove, { passive: false });
    window.addEventListener("keydown", onKey, { passive: false });
    window.addEventListener("scroll", onScroll, { passive: true });

    return () => {
      cancelAnimationFrame(raf);
      window.clearTimeout(cooldownTimer);
      if (savedScrollBehavior !== undefined) html.style.scrollBehavior = savedScrollBehavior;
      window.removeEventListener("wheel", onWheel);
      window.removeEventListener("touchstart", onTouchStart);
      window.removeEventListener("touchmove", onTouchMove);
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("scroll", onScroll);
    };
  }, []);

  return null;
}
