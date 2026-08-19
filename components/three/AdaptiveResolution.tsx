"use client";

/* -----------------------------------------------------------------------
   AdaptiveResolution — the GPU's own opinion, applied every second
   ─────────────────────────────────────────────────────────────────────
   Device tiering (lib/deviceTier) is a *guess* made before a single frame
   has been drawn. It is a good guess, but it cannot know that this
   particular laptop is on battery, thermally throttled, driving a 5K
   external display, or sharing the GPU with a video call.

   So the tier sets the *ceiling* and this component finds the real number
   underneath it: it samples frame times over ~1s windows and moves the
   renderer's pixel ratio one step at a time.

     · sustained frame time above the drop threshold → step DOWN immediately
     · sustained comfortable headroom → step UP, but only after several
       consecutive good windows, and never back above the tier ceiling

   Stepping down is eager and stepping up is reluctant on purpose: a
   momentary dip in quality is invisible on soft gradient shaders, whereas
   oscillating between two resolutions every second is very visible indeed.

   Resolution is the right dial because these scenes are fragment-bound —
   full-screen fbm noise, fresnel, iridescence. Halving the pixel ratio
   quarters the shader work, and on content with no fine geometry or text it
   is close to imperceptible.
   ----------------------------------------------------------------------- */

import { useEffect, useRef } from "react";
import { useThree, useFrame } from "@react-three/fiber";

const LADDER = [0.6, 0.75, 1, 1.25, 1.5, 1.75, 2];

/** ~50fps. Below this we are visibly dropping frames and must act. */
const DROP_MS = 20;
/** ~72fps. Above this there is real headroom to spend. */
const RAISE_MS = 13.5;
/** Samples per decision window — roughly one second at 60fps. */
const WINDOW = 60;
/** Consecutive good windows required before spending headroom. */
const RAISE_PATIENCE = 3;

export function AdaptiveResolution({
  maxDpr,
  minDpr = 0.6,
}: {
  /** Tier ceiling. The governor never exceeds this. */
  maxDpr: number;
  minDpr?: number;
}) {
  // r3f's own setter, not gl.setPixelRatio directly: it resizes the drawing
  // buffer *and* keeps state.viewport in sync, so anything reading the
  // viewport (and r3f's own resize handling) stays correct. It commits a store
  // update, which is exactly why the governor only ever calls it on a window
  // boundary — at most once a second — never per frame.
  const setDpr = useThree((state) => state.setDpr);

  const samples = useRef(0);
  const accumulated = useRef(0);
  const goodWindows = useRef(0);
  const index = useRef(0);

  // Start at the tier ceiling (clamped to the device's own ratio — asking for
  // 2x on a 1x monitor is pure waste) and let the governor walk it down.
  useEffect(() => {
    const ceiling = Math.min(maxDpr, window.devicePixelRatio || 1);
    let start = LADDER.findIndex((v) => v >= ceiling);
    if (start === -1) start = LADDER.length - 1;
    index.current = start;
    setDpr(LADDER[start]);
  }, [setDpr, maxDpr]);

  useFrame((_, delta) => {
    // Guard against the enormous delta a tab returning from the background
    // produces — it would trigger a spurious downgrade on the first frame.
    const ms = delta * 1000;
    if (ms > 100) return;

    accumulated.current += ms;
    samples.current += 1;
    if (samples.current < WINDOW) return;

    const average = accumulated.current / samples.current;
    samples.current = 0;
    accumulated.current = 0;

    const ceiling = Math.min(maxDpr, window.devicePixelRatio || 1);
    const floor = minDpr;

    if (average > DROP_MS && LADDER[index.current] > floor) {
      goodWindows.current = 0;
      index.current -= 1;
      setDpr(LADDER[index.current]);
      return;
    }

    if (average < RAISE_MS && LADDER[index.current + 1] <= ceiling) {
      goodWindows.current += 1;
      if (goodWindows.current >= RAISE_PATIENCE) {
        goodWindows.current = 0;
        index.current += 1;
        setDpr(LADDER[index.current]);
      }
      return;
    }

    goodWindows.current = 0;
  });

  return null;
}

export default AdaptiveResolution;
