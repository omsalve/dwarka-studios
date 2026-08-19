"use client";

/* -----------------------------------------------------------------------
   SplashIntro — mounts SplashScreen as the landing page's entry overlay
   ─────────────────────────────────────────────────────────────────────
   SplashScreen itself knows nothing about the page it sits on: it plays the
   two videos and reports back. This wrapper is the seam — it fades the
   overlay away once video 2 ends, then flips `completeIntro()` so the hero
   underneath starts breathing, exactly where GateIntro used to.

   It is also the page's single most expensive decision. The splash is two
   full-frame clips totalling ~30MB, and while it is on screen it *is* the
   LCP element — so on a connection that cannot absorb those bytes quickly
   the cinematic opening stops being an opening and becomes a stall on a
   black rectangle, with the real page hidden behind it the whole time.

   So the overlay is opt-in on capability, not unconditional:

     · reduced motion            → skipped (as before)
     · Save-Data / 2G-3G-class   → skipped; the page opens on the hero
     · low device tier           → skipped; no video decode competing with
                                   two WebGL scenes on a weak GPU
     · everything else           → the full two-video sequence, at the
                                   resolution rung that matches the panel

   Skipping is a *degradation of the intro*, never of the site: the hero it
   would have dissolved into is the same hero, already rendered underneath,
   and completeIntro() fires immediately so it comes alive at once.
   ----------------------------------------------------------------------- */

import { useEffect, useState } from "react";
import { motion } from "motion/react";
import { useIntro } from "@/components/GateIntro/IntroContext";
import { SplashScreen } from "@/components/SplashScreen";
import { useDeviceBudget } from "@/lib/deviceTier";

/** Matches GateIntro's handoff fade, so the reveal keeps the same feel. */
const HANDOFF_FADE_MS = 340;

export function SplashIntro() {
  const { completeIntro, reducedMotion } = useIntro();
  const budget = useDeviceBudget();
  const [ended, setEnded] = useState(false); // video 2 finished → start fading
  const [gone, setGone] = useState(false); // fade done → unmount

  // The budget is only known after the first client commit (it is measured,
  // and the server cannot measure). If it comes back saying "not this device",
  // hand off immediately rather than mounting a <video> we are about to drop.
  // `measured` matters: on the server and during hydration the budget is a
  // placeholder, and acting on it would render the splash on the server and
  // then tear it out on the client. The decision waits one commit.
  const skip = reducedMotion || (budget.measured && !budget.allowHeavyVideo);

  useEffect(() => {
    if (skip) completeIntro();
  }, [skip, completeIntro]);

  if (skip || gone) return null;

  return (
    <motion.div
      // Paired with a CSS rule in globals.css. The server cannot know the
      // visitor's motion preference, so it always renders this overlay and the
      // client tears it out one commit later — which reads as the splash
      // flashing up and vanishing. prefers-reduced-motion is the one skip
      // signal CSS *can* evaluate before the first paint, so it does, and this
      // cohort simply never sees the overlay.
      data-splash-overlay
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
