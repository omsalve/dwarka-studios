"use client";

/* -----------------------------------------------------------------------
   LoopVideo — a seamless loop for a clip that doesn't loop cleanly
   ─────────────────────────────────────────────────────────────────────
   Video 1 is a one-way "the feather forms" clip (bare quill → full peacock),
   so the native `loop` attribute would hard-cut the peacock back to the
   quill every ~10s. Instead we keep two copies stacked and cross-dissolve
   one over the other across the seam: as the playing copy nears its end, the
   idle copy starts from 0 and we fade between them, then swap roles. The
   reset becomes a soft ~0.8s dissolve rather than a jump.

   Only one copy is actually decoding at a time (the other is paused at 0)
   except during the brief crossfade, so this stays cheap.
   ----------------------------------------------------------------------- */

import { useEffect, useRef } from "react";
import { animate, motion, useMotionValue } from "motion/react";

interface Props {
  src: string;
  poster?: string;
  className?: string;
  style?: React.CSSProperties;
  /** Crossfade length at the loop seam, in ms. */
  fadeMs?: number;
}

export function LoopVideo({ src, poster, className, style, fadeMs = 800 }: Props) {
  const aRef = useRef<HTMLVideoElement>(null);
  const bRef = useRef<HTMLVideoElement>(null);
  const opA = useMotionValue(1);
  const opB = useMotionValue(0);

  useEffect(() => {
    const a = aRef.current;
    const b = bRef.current;
    if (!a || !b) return;

    const fade = fadeMs / 1000;
    let activeIsA = true;
    let transitioning = false;
    let swapTimer = 0;
    let raf = 0;

    a.currentTime = 0;
    void a.play().catch(() => {});

    const tick = () => {
      const active = activeIsA ? a : b;
      const other = activeIsA ? b : a;
      const opActive = activeIsA ? opA : opB;
      const opOther = activeIsA ? opB : opA;

      if (
        !transitioning &&
        Number.isFinite(active.duration) &&
        active.duration - active.currentTime <= fade
      ) {
        transitioning = true;
        other.currentTime = 0;
        void other.play().catch(() => {});
        animate(opActive, 0, { duration: fade, ease: "linear" });
        animate(opOther, 1, { duration: fade, ease: "linear" });
        swapTimer = window.setTimeout(() => {
          active.pause();
          active.currentTime = 0;
          activeIsA = !activeIsA;
          transitioning = false;
        }, fadeMs);
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(raf);
      window.clearTimeout(swapTimer);
    };
  }, [fadeMs, opA, opB]);

  const shared = {
    muted: true,
    playsInline: true,
    preload: "auto" as const,
    tabIndex: -1,
    disablePictureInPicture: true,
    "aria-hidden": true as const,
  };

  return (
    <>
      <motion.video
        {...shared}
        ref={aRef}
        src={src}
        poster={poster}
        className={className}
        style={{ ...style, opacity: opA, willChange: "opacity" }}
      />
      <motion.video
        {...shared}
        ref={bRef}
        src={src}
        className={className}
        style={{ ...style, opacity: opB, willChange: "opacity" }}
      />
    </>
  );
}
