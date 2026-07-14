"use client";

/* -----------------------------------------------------------------------
   useFeatherState — the interaction's state machine
   ─────────────────────────────────────────────────────────────────────
     idle ──enter──▶ hover ──press──▶ holding ──charge full──▶ unlocked
       ▲              │  ▲               │
       └────leave─────┘  └──release/cancel┘

   `unlocked` is terminal: the charge completed while still held, so the world
   awakens and the caller (onComplete) reveals the landing page. Releasing
   before the charge fills cancels back to hover/idle.

   Presence and charge are exposed as MotionValues so the video crossfade and
   the overlay can render entirely on the compositor — the React `state` string
   only exists so we can mount/unmount heavier hold-only layers.
   ----------------------------------------------------------------------- */

import { useCallback, useEffect, useRef, useState } from "react";
import { animate, useMotionValue } from "motion/react";
import type { AnimationPlaybackControls, MotionValue } from "motion/react";
import { prefersReducedMotion } from "@/lib/heroBridge";
import {
  CHARGE_DURATION,
  CHARGE_RESET_DURATION,
  CHARGE_RESET_EASE,
  CROSSFADE_DURATION,
  CROSSFADE_EASE,
} from "./constants";

export type FeatherState = "idle" | "hover" | "holding" | "unlocked";

export interface FeatherOptions {
  /** Fires once when the hold completes (charge reaches 1) — the unlock. */
  onComplete?: () => void;
}

export interface FeatherController {
  state: FeatherState;
  /** 0 → Video 1, 1 → Video 2. Drives the crossfade. */
  crossfade: MotionValue<number>;
  /** 0 → 1 hold progress. Drives the charging feedback. */
  charge: MotionValue<number>;
  /** Spread onto the invisible hitbox. */
  bind: {
    onPointerEnter: () => void;
    onPointerLeave: () => void;
    onPointerDown: (e: React.PointerEvent) => void;
  };
}

export function useFeatherState(options: FeatherOptions = {}): FeatherController {
  const [state, setState] = useState<FeatherState>("idle");
  const crossfade = useMotionValue(0);
  const charge = useMotionValue(0);

  // Latest presence, read by global (release) listeners without re-subscribing.
  const insideRef = useRef(false);
  const pressedRef = useRef(false);
  const unlockedRef = useRef(false);
  const crossfadeAnim = useRef<AnimationPlaybackControls | null>(null);
  const chargeAnim = useRef<AnimationPlaybackControls | null>(null);
  const reduced = useRef(false);

  // Keep the callback fresh without re-binding the charge animation.
  const onCompleteRef = useRef(options.onComplete);
  onCompleteRef.current = options.onComplete;

  useEffect(() => {
    reduced.current = prefersReducedMotion();
  }, []);

  const applyCrossfade = useCallback(
    (target: number) => {
      crossfadeAnim.current?.stop();
      crossfadeAnim.current = animate(crossfade, target, {
        duration: reduced.current ? 0 : CROSSFADE_DURATION,
        ease: CROSSFADE_EASE,
      });
    },
    [crossfade],
  );

  const startCharge = useCallback(() => {
    chargeAnim.current?.stop();
    // The hold is an intentional gesture, so its 1.2s length is kept even under
    // reduced motion — only the decorative visuals are suppressed elsewhere.
    chargeAnim.current = animate(charge, 1, {
      duration: CHARGE_DURATION,
      ease: "linear", // steady ramp so the beat-sheet stages land on time
      // Fires only on natural completion — a stop() (release) never calls this.
      onComplete: () => {
        if (!pressedRef.current) return;
        unlockedRef.current = true;
        setState("unlocked");
        onCompleteRef.current?.();
      },
    });
  }, [charge]);

  const resetCharge = useCallback(() => {
    chargeAnim.current?.stop();
    chargeAnim.current = animate(charge, 0, {
      duration: CHARGE_RESET_DURATION,
      ease: CHARGE_RESET_EASE,
    });
  }, [charge]);

  // Reconcile the machine to the current presence/press flags.
  const sync = useCallback(() => {
    const pressed = pressedRef.current;
    const inside = insideRef.current;
    setState(pressed ? "holding" : inside ? "hover" : "idle");
    applyCrossfade(pressed || inside ? 1 : 0);
  }, [applyCrossfade]);

  const release = useCallback(() => {
    // Once unlocked the machine is frozen — a trailing pointerup must not reset.
    if (unlockedRef.current || !pressedRef.current) return;
    pressedRef.current = false;
    resetCharge();
    sync();
  }, [resetCharge, sync]);

  // While holding, catch the release anywhere — including outside the hitbox or
  // when the window loses focus — so a charge never gets stranded.
  useEffect(() => {
    if (state !== "holding") return;
    const onRelease = () => release();
    window.addEventListener("pointerup", onRelease);
    window.addEventListener("pointercancel", onRelease);
    window.addEventListener("blur", onRelease);
    return () => {
      window.removeEventListener("pointerup", onRelease);
      window.removeEventListener("pointercancel", onRelease);
      window.removeEventListener("blur", onRelease);
    };
  }, [state, release]);

  const onPointerEnter = useCallback(() => {
    if (unlockedRef.current) return;
    insideRef.current = true;
    if (!pressedRef.current) sync();
  }, [sync]);

  const onPointerLeave = useCallback(() => {
    if (unlockedRef.current) return;
    insideRef.current = false;
    // During a hold, pointer capture keeps us engaged — ignore stray boundary
    // crossings so a micro-movement can't cancel the charge.
    if (!pressedRef.current) sync();
  }, [sync]);

  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (unlockedRef.current) return;
      e.preventDefault(); // block text selection, image drag, focus side-effects
      (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
      pressedRef.current = true;
      insideRef.current = true;
      startCharge();
      sync();
    },
    [startCharge, sync],
  );

  return {
    state,
    crossfade,
    charge,
    bind: { onPointerEnter, onPointerLeave, onPointerDown },
  };
}
