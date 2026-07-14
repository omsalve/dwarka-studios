"use client";

/* -----------------------------------------------------------------------
   OpeningSequence — the AAA-style opening beat / splash
   ─────────────────────────────────────────────────────────────────────
   A full-viewport stage: two frame-locked temple-gate loops crossfading as the
   user discovers a glowing peacock feather. Holding the feather to completion
   floods the frame with champagne light and fires `onUnlock`, at which point
   the caller lifts the splash to reveal the landing page beneath.

   Composition only — the video sync lives in BackgroundVideos, the interaction
   in FeatherInteraction, and the state machine in useFeatherState.
   ----------------------------------------------------------------------- */

import { motion } from "motion/react";
import { BackgroundVideos } from "./BackgroundVideos";
import { FeatherInteraction } from "./FeatherInteraction";
import { useFeatherState } from "./useFeatherState";
import {
  FEATHER_HITBOX,
  UNLOCK_FLOOD_DURATION,
  UNLOCK_HOLD,
} from "./constants";

interface Props {
  className?: string;
  /** Fired after the unlock flood completes — reveal the real page here. */
  onUnlock?: () => void;
}

export function OpeningSequence({ className = "", onUnlock }: Props) {
  const controller = useFeatherState();
  const unlocked = controller.state === "unlocked";

  const floodOrigin = `${FEATHER_HITBOX.cx * 100}% ${FEATHER_HITBOX.cy * 100}%`;

  return (
    <section
      className={`relative h-[100svh] w-full select-none overflow-hidden bg-black ${className}`}
      aria-label="Ancient temple gate"
    >
      <BackgroundVideos crossfade={controller.crossfade} />
      <FeatherInteraction controller={controller} />

      {/* Unlock flood — champagne light expands from the feather to engulf the
          frame, then hands off to the caller to lift the splash. */}
      {unlocked && (
        <motion.div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 z-30"
          style={{
            transformOrigin: floodOrigin,
            background:
              "radial-gradient(circle at var(--flood-origin), rgba(255,251,240,1) 0%, rgba(255,244,214,0.96) 42%, rgba(240,222,180,0.9) 100%)",
            ["--flood-origin" as string]: floodOrigin,
          }}
          initial={{ opacity: 0, scale: 0.35 }}
          animate={{ opacity: 1, scale: 1.8 }}
          transition={{ duration: UNLOCK_FLOOD_DURATION, ease: [0.4, 0, 0.2, 1] }}
          onAnimationComplete={() => {
            window.setTimeout(() => onUnlock?.(), UNLOCK_HOLD * 1000);
          }}
        />
      )}
    </section>
  );
}

export default OpeningSequence;
