"use client";

/* -----------------------------------------------------------------------
   GateVideos — the three frame-matched layers, dissolving into each other
   ─────────────────────────────────────────────────────────────────────
   Bottom → top:

     idle   (V1)  seamless loop (see LoopVideo) — the resting gate
     charged(V2)  opacity 0→1 the moment the door is hovered — the feather awakens
     open   (V3)  opacity 0→1 right after — the doors open and the camera flies

   V1 and V2 both loop; V2 hands off to V3 once the hover sequence fires.
   Because each layer shares a frame with the one beneath it, every crossfade
   is a dissolve between (near-)identical pixels — nothing reads as a cut.

   Only opacity animates, all off MotionValues, so the whole stack stays on
   the compositor and never re-renders per frame.
   ----------------------------------------------------------------------- */

import { useEffect, useRef } from "react";
import { animate, motion, useMotionValue } from "motion/react";
import { LoopVideo } from "./LoopVideo";
import {
  CHARGE_FADE_MS,
  FADE_EASE,
  FLIGHT_FADE_MS,
  IDLE_LOOP_FADE_MS,
  IDLE_POSTER,
  OPEN_POSTER,
  STILL_CLASS,
  VIDEO_CHARGED,
  VIDEO_GRADE,
  VIDEO_IDLE,
  VIDEO_OPEN,
} from "./constants";

interface Props {
  /** Door hovered → dissolve the awakened feather (V2) in over the idle one. */
  charged: boolean;
  /** …and right after → play the flight (V3) and dissolve it in over V2. */
  flightStarted: boolean;
  /** Fired when the flight reaches its final (frozen) frame. */
  onFlightEnd: () => void;
}

export function GateVideos({ charged, flightStarted, onFlightEnd }: Props) {
  const chargedRef = useRef<HTMLVideoElement>(null);
  const openRef = useRef<HTMLVideoElement>(null);

  const charge = useMotionValue(0); // idle → charged
  const flight = useMotionValue(0); // charged → open

  // Keep the awakened loop rolling from mount (muted autoplay is always
  // allowed), so revealing it on hover is instant and mid-motion.
  useEffect(() => {
    void chargedRef.current?.play().catch(() => {});
  }, []);

  useEffect(() => {
    const controls = animate(charge, charged ? 1 : 0, {
      duration: CHARGE_FADE_MS / 1000,
      ease: FADE_EASE,
    });
    return () => controls.stop();
  }, [charged, charge]);

  useEffect(() => {
    if (!flightStarted) return;
    const v = openRef.current;
    if (v) {
      v.currentTime = 0;
      void v.play().catch(() => {});
    }
    const controls = animate(flight, 1, {
      duration: FLIGHT_FADE_MS / 1000,
      ease: FADE_EASE,
    });
    return () => controls.stop();
  }, [flightStarted, flight]);

  const shared = {
    muted: true,
    playsInline: true,
    preload: "auto" as const,
    tabIndex: -1,
    disablePictureInPicture: true,
    "aria-hidden": true as const,
  };

  return (
    <div className="absolute inset-0 overflow-hidden">
      {/* Idle — the feather forming, looped seamlessly at the bottom. */}
      <LoopVideo
        src={VIDEO_IDLE}
        poster={IDLE_POSTER}
        className={STILL_CLASS}
        style={{ filter: VIDEO_GRADE }}
        fadeMs={IDLE_LOOP_FADE_MS}
      />
      {/* Awakened loop — the full peacock. Fades in on hover. */}
      <motion.video
        {...shared}
        ref={chargedRef}
        className={STILL_CLASS}
        src={VIDEO_CHARGED}
        loop
        autoPlay
        style={{ filter: VIDEO_GRADE, opacity: charge, willChange: "opacity" }}
      />
      {/* The flight — doors open, camera flies to the temple. Plays once. */}
      <motion.video
        {...shared}
        ref={openRef}
        className={STILL_CLASS}
        src={VIDEO_OPEN}
        poster={OPEN_POSTER}
        onEnded={onFlightEnd}
        style={{ filter: VIDEO_GRADE, opacity: flight, willChange: "opacity" }}
      />
    </div>
  );
}
