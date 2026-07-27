"use client";

/* -----------------------------------------------------------------------
   IntroContext — the one bit of state that crosses the intro↔page seam
   ─────────────────────────────────────────────────────────────────────
   The gate overlay and the hero section live in different parts of the
   tree, but they share exactly one fact: *has the flight finished?* Until
   it has, the hero holds dead-still at its resting frame (pixel-identical
   to the video's last frame) so the dissolve is invisible; the instant it
   has, the hero starts breathing — zoom, parchment text, parallax.

   `introComplete` defaults to **true** so a `<Hero>` rendered anywhere
   without the intro (another page, a test) simply animates like a normal
   hero. The landing page wraps everything in <IntroProvider>, which starts
   it at `false` and hands the switch to the overlay.
   ----------------------------------------------------------------------- */

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from "react";
import { useReducedMotion } from "@/lib/useReducedMotion";

interface IntroValue {
  /** True once the gate flight has fully handed off to the page. */
  introComplete: boolean;
  /** Called by the overlay when the handoff dissolve has finished. */
  completeIntro: () => void;
  /** Honour the OS "reduce motion" setting — the overlay skips the flight. */
  reducedMotion: boolean;
}

const IntroContext = createContext<IntroValue>({
  introComplete: true,
  completeIntro: () => {},
  reducedMotion: false,
});

export function IntroProvider({ children }: { children: React.ReactNode }) {
  const [completed, setCompleted] = useState(false);
  const reducedMotion = useReducedMotion();

  // Reduced-motion visitors get no camera flight — the page is "complete" for
  // them from the start. Deriving this (rather than setting state in an effect)
  // keeps it in sync with a live preference toggle for free.
  const introComplete = completed || reducedMotion;

  const completeIntro = useCallback(() => setCompleted(true), []);

  const value = useMemo(
    () => ({ introComplete, completeIntro, reducedMotion }),
    [introComplete, completeIntro, reducedMotion],
  );

  return <IntroContext.Provider value={value}>{children}</IntroContext.Provider>;
}

export function useIntro(): IntroValue {
  return useContext(IntroContext);
}
