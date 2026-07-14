"use client";

/* -----------------------------------------------------------------------
   SplashScreen — gates the site behind the opening sequence
   ─────────────────────────────────────────────────────────────────────
   The landing page is rendered (and warmed up) underneath from the first
   frame, so when the feather is unlocked the splash simply fades away to
   reveal it — a seamless hand-off with no navigation and no loading flash.

   Body scroll is locked while the splash is up so nothing moves behind it.
   ----------------------------------------------------------------------- */

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { OpeningSequence } from "./OpeningSequence";
import { UNLOCK_FADE_DURATION } from "./constants";

export function SplashScreen({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(true);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  return (
    <>
      {children}
      <AnimatePresence>
        {open && (
          <motion.div
            key="opening-splash"
            className="fixed inset-0 z-[100]"
            initial={{ opacity: 1 }}
            exit={{
              opacity: 0,
              transition: { duration: UNLOCK_FADE_DURATION, ease: "easeInOut" },
            }}
          >
            <OpeningSequence onUnlock={() => setOpen(false)} />
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
