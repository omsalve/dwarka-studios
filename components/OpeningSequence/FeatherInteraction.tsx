"use client";

/* -----------------------------------------------------------------------
   FeatherInteraction — the invisible hitbox + the reactive light overlay
   ─────────────────────────────────────────────────────────────────────
   Nothing here reads as UI. An invisible box sits over the feather; while the
   cursor is inside (and building charge), a soft-light overlay blooms on top
   of the video — never replacing it. Only opacity and transform animate, and
   all of it is driven off MotionValues so the component never re-renders per
   frame (the `state` string only gates the hold-only pulse layer).
   ----------------------------------------------------------------------- */

import { useEffect, useState } from "react";
import { motion, useTransform } from "motion/react";
import { prefersReducedMotion } from "@/lib/heroBridge";
import {
  CHARGE_STAGES,
  DEBUG_HITBOX,
  FEATHER_HITBOX,
  PARTICLES,
} from "./constants";
import type { FeatherController } from "./useFeatherState";

/** Ramp a MotionValue-derived charge across a stage window → 0…1. */
function stageRamp(c: number, from: number) {
  return Math.max(0, Math.min(1, (c - from) / (1 - from)));
}

export function FeatherInteraction({ controller }: { controller: FeatherController }) {
  const { state, crossfade, charge, bind } = controller;

  const [reduced, setReduced] = useState(false);
  useEffect(() => setReduced(prefersReducedMotion()), []);

  // `crossfade` doubles as the presence signal — the overlay breathes in on
  // exactly the same curve the video dissolves on.
  const hover = crossfade;

  // Scale: subtle 102% on hover, a touch more as the charge maxes out. Only the
  // overlay scales — never the video.
  const scale = useTransform([hover, charge], ([h, c]: number[]) => 1 + h * 0.02 + c * 0.015);

  const bloomOpacity = useTransform([hover, charge], ([h, c]: number[]) => h * (0.26 + c * 0.5));
  const radialOpacity = useTransform([hover, charge], ([h, c]: number[]) => h * (0.2 + c * 0.28));
  const particlesOpacity = useTransform([hover, charge], ([h, c]: number[]) => h * (0.45 + c * 0.55));
  const shimmerOpacity = useTransform(
    [hover, charge],
    ([h, c]: number[]) => h * stageRamp(c, CHARGE_STAGES.shimmer) * 0.45,
  );
  const shimmerShift = useTransform(charge, (c) => stageRamp(c, CHARGE_STAGES.shimmer) * 6);
  const shimmerShiftNeg = useTransform(shimmerShift, (v) => -v);
  const pulseOpacity = useTransform(
    [hover, charge],
    ([h, c]: number[]) => h * stageRamp(c, CHARGE_STAGES.pulse) * 0.4,
  );

  const holding = state === "holding";

  // Feather box, center-anchored to its normalized position on the stage.
  const wrapperStyle: React.CSSProperties = {
    left: `${FEATHER_HITBOX.cx * 100}%`,
    top: `${FEATHER_HITBOX.cy * 100}%`,
    width: `${FEATHER_HITBOX.w * 100}%`,
    height: `${FEATHER_HITBOX.h * 100}%`,
    transform: "translate(-50%, -50%)",
  };

  return (
    <div className="pointer-events-none absolute select-none" style={wrapperStyle}>
      {/* ---- Reactive light overlay (never captures the pointer) ---- */}
      <motion.div
        style={{ scale, willChange: "transform" }}
        className="absolute inset-0"
        aria-hidden="true"
      >
        {/* Soft radial light — the world quietly leaning toward the cursor. */}
        <motion.div
          style={{ opacity: radialOpacity, willChange: "opacity" }}
          className="absolute inset-0"
        >
          <div
            className="absolute left-1/2 top-1/2 h-[140%] w-[140%] -translate-x-1/2 -translate-y-1/2 mix-blend-screen"
            style={{
              background:
                "radial-gradient(closest-side, rgba(255,244,214,0.9), rgba(120,180,150,0.25) 55%, transparent 72%)",
              filter: "blur(10px)",
            }}
          />
        </motion.div>

        {/* Bloom — a brighter, tighter core that intensifies with the charge. */}
        <motion.div
          style={{ opacity: bloomOpacity, willChange: "opacity" }}
          className="absolute inset-0"
        >
          <div
            className="absolute left-1/2 top-1/2 h-[85%] w-[70%] -translate-x-1/2 -translate-y-1/2 mix-blend-screen"
            style={{
              background:
                "radial-gradient(closest-side, rgba(255,255,255,0.85), rgba(180,230,255,0.4) 45%, transparent 70%)",
              filter: "blur(14px)",
            }}
          />
        </motion.div>

        {/* Chromatic shimmer — offset cyan/magenta veils that surface past the
            0.6s mark of a hold. */}
        {!reduced && (
          <motion.div
            style={{ opacity: shimmerOpacity, willChange: "opacity" }}
            className="absolute inset-0 mix-blend-screen"
          >
            <motion.div
              style={{ x: shimmerShift }}
              className="absolute inset-0"
              initial={false}
              animate={{ opacity: [0.7, 1, 0.7] }}
              transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
            >
              <div
                className="absolute left-1/2 top-1/2 h-[80%] w-[60%] -translate-x-1/2 -translate-y-1/2"
                style={{ background: "radial-gradient(closest-side, rgba(120,255,240,0.5), transparent 70%)", filter: "blur(12px)" }}
              />
            </motion.div>
            <motion.div
              style={{ x: shimmerShiftNeg }}
              className="absolute inset-0"
              initial={false}
              animate={{ opacity: [0.7, 1, 0.7] }}
              transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut", delay: 0.4 }}
            >
              <div
                className="absolute left-1/2 top-1/2 h-[80%] w-[60%] -translate-x-1/2 -translate-y-1/2"
                style={{ background: "radial-gradient(closest-side, rgba(255,120,235,0.45), transparent 70%)", filter: "blur(12px)" }}
              />
            </motion.div>
          </motion.div>
        )}

        {/* Iridescent motes — always drifting, faded in with presence and made
            more active by the charge. */}
        {!reduced && (
          <motion.div
            style={{ opacity: particlesOpacity, willChange: "opacity" }}
            className="absolute inset-0 mix-blend-screen"
          >
            {PARTICLES.map((p, i) => (
              <motion.span
                key={i}
                className="absolute rounded-full"
                style={{
                  left: `${p.x * 100}%`,
                  top: `${p.y * 100}%`,
                  width: p.size,
                  height: p.size,
                  background:
                    "radial-gradient(circle, rgba(200,240,255,0.95), rgba(255,190,240,0.4) 60%, transparent)",
                  willChange: "transform, opacity",
                }}
                initial={false}
                animate={{
                  y: [0, -22, 0],
                  x: [0, p.drift, 0],
                  opacity: [0, 1, 0],
                  scale: [0.6, 1, 0.6],
                }}
                transition={{
                  duration: p.duration,
                  delay: p.delay,
                  repeat: Infinity,
                  ease: "easeInOut",
                }}
              />
            ))}
          </motion.div>
        )}

        {/* Gentle pulse — a slow breath that only exists in the final phase of a
            hold. Mounted only while holding so it costs nothing otherwise. */}
        {holding && !reduced && (
          <motion.div
            style={{ opacity: pulseOpacity, willChange: "transform, opacity" }}
            className="absolute inset-0 mix-blend-screen"
            initial={false}
            animate={{ scale: [1, 1.06, 1] }}
            transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
          >
            <div
              className="absolute left-1/2 top-1/2 h-[95%] w-[80%] -translate-x-1/2 -translate-y-1/2"
              style={{ background: "radial-gradient(closest-side, rgba(255,250,225,0.6), transparent 70%)", filter: "blur(16px)" }}
            />
          </motion.div>
        )}
      </motion.div>

      {/* ---- Invisible hitbox — the only pointer-reactive surface ---- */}
      <div
        {...bind}
        draggable={false}
        onDragStart={(e) => e.preventDefault()}
        className="absolute inset-0 cursor-pointer"
        style={{
          pointerEvents: "auto",
          touchAction: "none", // hold on touch shouldn't scroll/zoom
          WebkitUserSelect: "none",
          userSelect: "none",
          outline: DEBUG_HITBOX ? "1px solid rgba(0,255,200,0.8)" : undefined,
          background: DEBUG_HITBOX ? "rgba(0,255,200,0.08)" : undefined,
        }}
      />
    </div>
  );
}
