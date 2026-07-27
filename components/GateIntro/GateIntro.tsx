"use client";

/* -----------------------------------------------------------------------
   GateIntro — the whole cinematic entry, start to seamless finish
   ─────────────────────────────────────────────────────────────────────
   A full-viewport overlay above the already-mounted page. It orchestrates
   the three gate videos (see GateVideos) and the one thing that has to be
   perfect — the finish.

   Idle shows Video 1 (the feather forming, looped seamlessly). Hovering the
   door triggers the sequence at once: Video 2 dissolves in (the peacock
   awakens) and, right after, Video 3 plays (the doors open, the camera flies
   to the temple). Video 3's last frame and the hero image are the same
   picture, so we don't cut or crossfade *scenes* — we let the flight freeze
   on that frame, make sure the hero still is decoded, then fade this entire
   overlay out over ~340ms. The hero underneath is already sitting on the
   identical frame at its resting transform, so nothing appears to change:
   the video simply becomes the page. Only once the overlay is gone does
   `completeIntro()` let the hero start breathing.

   Phases:  idle ──hover──▶ awaken ──(AWAKEN_HOLD_MS)──▶ playing
            ──flight ends + still decoded──▶ handoff (fade overlay)
            ──▶ gone (unmount, hero comes alive)
   ----------------------------------------------------------------------- */

import { useCallback, useEffect, useRef, useState } from "react";
import { motion } from "motion/react";
import { useIntro } from "./IntroContext";
import { useHeroStillReady } from "./useIntroAssets";
import { GateVideos } from "./GateVideos";
import { GateInvitation } from "./GateInvitation";
import { AWAKEN_HOLD_MS, GATE_HITBOX, HANDOFF_FADE_MS } from "./constants";

type Phase = "idle" | "awaken" | "playing" | "handoff" | "gone";

export function GateIntro() {
  const { completeIntro, reducedMotion } = useIntro();
  const heroReady = useHeroStillReady();

  const [phase, setPhase] = useState<Phase>("idle");
  const startedRef = useRef(false);
  const awakenTimer = useRef(0);
  const endedRef = useRef(false);

  // Hovering the door commits to the whole sequence at once — no dwell, no
  // cancel. Video 2 shows for AWAKEN_HOLD_MS, then Video 3 opens the doors.
  const startSequence = useCallback(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    setPhase("awaken");
    awakenTimer.current = window.setTimeout(() => setPhase("playing"), AWAKEN_HOLD_MS);
  }, []);

  useEffect(() => () => window.clearTimeout(awakenTimer.current), []);

  // Freeze → dissolve. Only begin once BOTH the flight has ended and the hero
  // still is fully decoded, so the reveal can't hitch. (In practice the still
  // decodes long before the flight ends.)
  const beginHandoff = useCallback(() => {
    setPhase((p) => (p === "playing" ? "handoff" : p));
  }, []);

  const handleFlightEnd = useCallback(() => {
    endedRef.current = true;
    if (heroReady) beginHandoff();
  }, [heroReady, beginHandoff]);

  useEffect(() => {
    if (endedRef.current && heroReady) beginHandoff();
  }, [heroReady, beginHandoff]);

  // Lock body scroll while the overlay is up; restore it the moment it's gone.
  useEffect(() => {
    if (reducedMotion || phase === "gone") return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [reducedMotion, phase]);

  if (reducedMotion || phase === "gone") return null;

  const idle = phase === "idle";
  const showInvitation = phase === "idle" || phase === "awaken";

  return (
    <motion.div
      className="fixed inset-0 z-[100] overflow-hidden bg-black"
      initial={false}
      animate={{ opacity: phase === "handoff" ? 0 : 1 }}
      transition={{ duration: HANDOFF_FADE_MS / 1000, ease: [0.4, 0, 0.2, 1] }}
      onAnimationComplete={() => {
        // Fires for every settle; only the fade-out ends the intro.
        if (phase === "handoff") {
          completeIntro();
          setPhase("gone");
        }
      }}
      aria-label="Ancient temple gate"
    >
      <GateVideos
        charged={phase === "awaken" || phase === "playing" || phase === "handoff"}
        flightStarted={phase === "playing" || phase === "handoff"}
        onFlightEnd={handleFlightEnd}
      />

      {/* Invitation — fades out the instant the gate is triggered. */}
      {showInvitation && <GateInvitation triggered={!idle} />}

      {/* The only pointer-reactive surface: a centred region over the doors, so
          the sequence can only be triggered on purpose. Doubles as a keyboard
          control (Enter/Space opens the gate). Removed once triggered. */}
      {idle && (
        <div
          role="button"
          tabIndex={0}
          aria-label="Hover or press to enter the temple"
          className="absolute z-30 cursor-pointer rounded-full outline-none focus-visible:ring-2 focus-visible:ring-[rgba(255,244,214,0.6)]"
          style={{
            left: `${GATE_HITBOX.cx * 100}%`,
            top: `${GATE_HITBOX.cy * 100}%`,
            width: `${GATE_HITBOX.w * 100}%`,
            height: `${GATE_HITBOX.h * 100}%`,
            transform: "translate(-50%, -50%)",
            touchAction: "none",
          }}
          onPointerEnter={(e) => {
            if (e.pointerType !== "touch") startSequence();
          }}
          onPointerDown={(e) => {
            if (e.pointerType === "touch") startSequence();
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              startSequence();
            }
          }}
        />
      )}
    </motion.div>
  );
}

export default GateIntro;
