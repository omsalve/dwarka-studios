"use client";

/* -----------------------------------------------------------------------
   useHeroStillReady — the AssetPreloader (image half)
   ─────────────────────────────────────────────────────────────────────
   The video handles its own buffering (`preload="auto"`); this makes sure
   the hero still is fully *decoded to a bitmap* before we ever dissolve to
   it, so the reveal can't stutter on a late decode. It fetches the exact
   same URL the hero <img> uses, so that element paints from cache the
   instant the video fades away.
   ----------------------------------------------------------------------- */

import { useEffect, useState } from "react";
import { preload } from "react-dom";
import { HERO_STILL } from "./constants";

export function useHeroStillReady(): boolean {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const done = () => {
      if (!cancelled) setReady(true);
    };

    // Earliest possible fetch — hoists <link rel="preload" as="image"> to <head>.
    preload(HERO_STILL, { as: "image", fetchPriority: "high" });

    const img = new Image();
    img.src = HERO_STILL;
    // decode() resolves after download *and* decode, which is exactly the
    // guarantee we want before revealing the image.
    img
      .decode()
      .then(done)
      .catch(() => {
        // Some browsers reject decode() for edge cases — fall back to load.
        if (img.complete) done();
        else {
          img.onload = done;
          img.onerror = done; // never block the intro on a missing asset
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return ready;
}
