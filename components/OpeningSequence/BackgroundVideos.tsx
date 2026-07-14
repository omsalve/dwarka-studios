"use client";

/* -----------------------------------------------------------------------
   BackgroundVideos — two frame-locked loops, always decoding
   ─────────────────────────────────────────────────────────────────────
   Both videos play from the first frame and never pause or restart. The
   charged loop sits *underneath* at full opacity; the calm loop rides on top
   and fades out (opacity 1 → 0) to reveal it. A single top-layer dissolve
   over frame-identical footage means there is no brightness dip and nothing
   to perceive as a cut.

   A rAF loop nudges the hidden video back into alignment if it ever drifts —
   but only while that video is fully transparent, so the seek is invisible.
   ----------------------------------------------------------------------- */

import { useEffect, useRef } from "react";
import { motion, useTransform } from "motion/react";
import type { MotionValue } from "motion/react";
import { SYNC_THRESHOLD, VIDEO_SOURCES } from "./constants";

interface Props {
  /** 0 → calm (Video 1) visible, 1 → charged (Video 2) visible. */
  crossfade: MotionValue<number>;
}

export function BackgroundVideos({ crossfade }: Props) {
  const calmRef = useRef<HTMLVideoElement>(null); // top layer, fades out
  const chargedRef = useRef<HTMLVideoElement>(null); // bottom layer, always opaque

  // Calm loop opacity: 1 at rest, 0 when fully crossfaded to the charged loop.
  const calmOpacity = useTransform(crossfade, (c) => 1 - c);

  useEffect(() => {
    const calm = calmRef.current;
    const charged = chargedRef.current;
    if (!calm || !charged) return;

    let raf = 0;

    // Align both to the same frame, then play them together.
    const start = () => {
      charged.currentTime = calm.currentTime;
      void calm.play().catch(() => {});
      void charged.play().catch(() => {});
    };

    if (calm.readyState >= 2 && charged.readyState >= 2) {
      start();
    } else {
      const onReady = () => {
        if (calm.readyState >= 2 && charged.readyState >= 2) start();
      };
      calm.addEventListener("loadeddata", onReady);
      charged.addEventListener("loadeddata", onReady);
    }

    // Invisible drift correction — only touch a video while it's transparent.
    const tick = () => {
      const c = crossfade.get();
      if (c < 0.02 && Math.abs(charged.currentTime - calm.currentTime) > SYNC_THRESHOLD) {
        charged.currentTime = calm.currentTime; // charged is hidden → safe to seek
      } else if (c > 0.98 && Math.abs(calm.currentTime - charged.currentTime) > SYNC_THRESHOLD) {
        calm.currentTime = charged.currentTime; // calm is hidden → safe to seek
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    return () => cancelAnimationFrame(raf);
  }, [crossfade]);

  const videoClass = "absolute inset-0 h-full w-full object-cover";

  return (
    <div className="absolute inset-0 overflow-hidden">
      {/* Charged loop — underneath, always fully decoding and opaque. */}
      <video
        ref={chargedRef}
        className={videoClass}
        src={VIDEO_SOURCES.charged}
        muted
        loop
        playsInline
        autoPlay
        preload="auto"
        aria-hidden="true"
      />
      {/* Calm loop — on top, fades away to reveal the charged one. */}
      <motion.video
        ref={calmRef}
        style={{ opacity: calmOpacity, willChange: "opacity" }}
        className={videoClass}
        src={VIDEO_SOURCES.base}
        muted
        loop
        playsInline
        autoPlay
        preload="auto"
        aria-hidden="true"
      />
    </div>
  );
}
