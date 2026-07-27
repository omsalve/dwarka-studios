"use client";

/* -----------------------------------------------------------------------
   GateInvitation — a quiet "this is interactive" cue
   ─────────────────────────────────────────────────────────────────────
   No progress ring, no loading — just a soft champagne glow over the feather
   and a breathing "Hover to enter" line. Both fade away the instant the gate
   is triggered, so nothing lingers into the flight. Purely decorative; never
   captures the pointer.
   ----------------------------------------------------------------------- */

import { motion } from "motion/react";
import { GATE_FOCUS } from "./constants";

export function GateInvitation({ triggered }: { triggered: boolean }) {
  return (
    <motion.div
      className="pointer-events-none absolute inset-0 z-20"
      aria-hidden="true"
      animate={{ opacity: triggered ? 0 : 1 }}
      transition={{ duration: 0.5, ease: "easeOut" }}
    >
      {/* Soft champagne bloom over the feather — a gentle, slow breath. */}
      <motion.div
        className="absolute h-[40vmin] w-[40vmin] mix-blend-screen"
        style={{
          left: `${GATE_FOCUS.x * 100}%`,
          top: `${GATE_FOCUS.y * 100}%`,
          transform: "translate(-50%, -50%)",
          background:
            "radial-gradient(closest-side, rgba(255,246,222,0.5), rgba(226,190,120,0.2) 45%, transparent 72%)",
          filter: "blur(8px)",
          willChange: "opacity, transform",
        }}
        initial={{ opacity: 0.28, scale: 0.94 }}
        animate={{ opacity: [0.28, 0.55, 0.28], scale: [0.94, 1.02, 0.94] }}
        transition={{ duration: 4.2, repeat: Infinity, ease: "easeInOut" }}
      />

      {/* Invitation copy. */}
      <motion.p
        className="absolute left-1/2 w-full -translate-x-1/2 text-center font-serif text-sm tracking-[0.32em] text-[rgba(255,244,214,0.82)] uppercase"
        style={{ bottom: "11%", textShadow: "0 1px 18px rgba(0,0,0,0.55)" }}
        initial={{ opacity: 0.35 }}
        animate={{ opacity: [0.35, 0.72, 0.35] }}
        transition={{ duration: 3.4, repeat: Infinity, ease: "easeInOut", delay: 0.6 }}
      >
        Hover to enter
      </motion.p>
    </motion.div>
  );
}
