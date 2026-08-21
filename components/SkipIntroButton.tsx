"use client";

/* -----------------------------------------------------------------------
   SkipIntroButton — the way out of the opening beat
   ─────────────────────────────────────────────────────────────────────
   The intro is a hover-driven shot that only advances while the visitor
   plays along, so someone who has seen it once (or who just wants the site)
   has no natural end to wait for. This is that exit: one quiet control,
   bottom-right, plus Escape.

   It is there from the first frame — the shot is hover-driven, so someone
   who wants out has nothing to wait through, and a control that arrives late
   is a control they had already given up looking for. The fade-in is the only
   restraint left: it arrives rather than pops.

   Layered above the door (z-10) so it is always clickable, even on a narrow
   viewport where the door spans the full width.
   ----------------------------------------------------------------------- */

import { useEffect } from "react";
import { motion } from "motion/react";

/** Fade-in — slow enough that it arrives rather than pops. */
const REVEAL_FADE = 0.6; // seconds

interface Props {
  /** Leave the intro now. Should hand off exactly like a natural finish. */
  onSkip: () => void;
  /** Copy override, for an intro where "skip" isn't the right word. */
  label?: string;
  className?: string;
}

export function SkipIntroButton({ onSkip, label = "Skip intro", className = "" }: Props) {
  /* Escape is the keyboard's universal "let me out". */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onSkip();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onSkip]);

  return (
    <motion.button
      type="button"
      onClick={onSkip}
      // The door beneath tracks pointer enter/leave to advance the shot; this
      // sits above it, and reaching for it reads as a leave, which simply
      // freezes the frame. Nothing to guard against — we're about to leave.
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: REVEAL_FADE, ease: [0.4, 0, 0.2, 1] }}
      className={`absolute bottom-8 right-8 z-20 rounded-full border border-parchment/25 bg-black/20 px-5 py-2.5 font-sans text-[0.65rem] uppercase tracking-[0.35em] text-parchment/60 backdrop-blur-sm outline-none transition-colors duration-300 hover:border-parchment/50 hover:text-parchment focus-visible:ring-2 focus-visible:ring-[rgba(255,244,214,0.6)] ${className}`}
      style={{
        // Clears the iOS home indicator / Android gesture bar.
        marginBottom: "env(safe-area-inset-bottom, 0px)",
      }}
    >
      {label}
    </motion.button>
  );
}

export default SkipIntroButton;
