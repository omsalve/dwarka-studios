"use client";

/* -----------------------------------------------------------------------
   SplashIntro — mounts SplashScreen as the landing page's entry overlay
   ─────────────────────────────────────────────────────────────────────
   SplashScreen itself knows nothing about the page it sits on: it plays the
   two videos and reports back. This wrapper is the seam — it fades the
   overlay away once video 2 ends, then flips `completeIntro()` so the hero
   underneath starts breathing, exactly where GateIntro used to.

   Reduced-motion visitors skip the overlay entirely (IntroProvider already
   treats the intro as complete for them).
   ----------------------------------------------------------------------- */

import { useState } from "react";
import { motion } from "motion/react";
import { useIntro } from "@/components/GateIntro/IntroContext";
import { SplashScreen } from "@/components/SplashScreen";

/** Matches GateIntro's handoff fade, so the reveal keeps the same feel. */
const HANDOFF_FADE_MS = 340;

export function SplashIntro() {
  const { completeIntro, reducedMotion } = useIntro();
  const [ended, setEnded] = useState(false); // video 2 finished → start fading
  const [gone, setGone] = useState(false); // fade done → unmount

  if (reducedMotion || gone) return null;

  return (
    <motion.div
      className="fixed inset-0 z-[100]"
      initial={false}
      animate={{ opacity: ended ? 0 : 1 }}
      transition={{ duration: HANDOFF_FADE_MS / 1000, ease: [0.4, 0, 0.2, 1] }}
      onAnimationComplete={() => {
        // Fires for every settle; only the fade-out ends the intro.
        if (ended) {
          completeIntro();
          setGone(true);
        }
      }}
    >
      <SplashScreen onComplete={() => setEnded(true)} />
    </motion.div>
  );
}

export default SplashIntro;
