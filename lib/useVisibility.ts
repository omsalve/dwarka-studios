"use client";

/* -----------------------------------------------------------------------
   Visibility hooks — the difference between "mounted" and "costing money"
   ─────────────────────────────────────────────────────────────────────
   Both WebGL scenes on this page used to render continuously from the moment
   they mounted: r3f's default `frameloop="always"` does not care whether its
   canvas is on screen, in a background tab, or buried under a full-screen
   video overlay. Scrolling through the services deck was therefore paying
   for a full-screen fbm shader pass *and* a 2048² shadow map pass every
   frame, for two scenes nobody could see.

   `useNearViewport` decides when a scene is worth *downloading and building*
   (generous margin — it must be ready before it is looked at).
   `useSceneActive` decides when it is worth *rendering* (tight margin, plus
   the Page Visibility API, so a backgrounded tab costs zero GPU).
   ----------------------------------------------------------------------- */

import { useEffect, useRef, useState, type RefObject } from "react";

/** True once `ref` has come within `rootMargin` of the viewport. Never flips back. */
export function useNearViewport(
  ref: RefObject<Element | null>,
  rootMargin = "150% 0px"
): boolean {
  const [near, setNear] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el || near) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setNear(true);
          observer.disconnect();
        }
      },
      { rootMargin }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [ref, rootMargin, near]);

  return near;
}

/**
 * True while `ref` is on (or just off) screen AND the tab is foregrounded.
 * Feed this straight into r3f's `frameloop` to make a scene cost nothing the
 * moment it stops being looked at.
 *
 * `extraGate` lets a caller add its own condition (the forge, for instance,
 * stays frozen behind the intro splash even though it is technically on
 * screen) without a second observer.
 *
 * `rootMargin` defaults to slack on the *bottom* edge only — see the note on
 * DEFAULT_SCENE_MARGIN.
 */
/**
 * Slack on the bottom edge of the root, and none on the top.
 *
 * The slack exists so a scene is already rendering by the time its first pixel
 * is visible — a canvas that starts on the exact intersection boundary shows
 * one black frame. That is a property of *approaching* a scene, and on this
 * page every scene is approached by scrolling down, so it is only ever wanted
 * below the viewport.
 *
 * It used to be symmetric ("25% 0px"), and the top half of that was pure
 * waste: it kept a scene rendering for a quarter of a viewport *after* it had
 * left. For the forge that is not a rounding error — its shell sits directly
 * above the services deck, so 25% of a viewport bought it 426px of the deck's
 * scroll range, and it was still drawing ~7,600 times through the whole first
 * card transition. Below, the slack stays exactly as it was.
 */
const DEFAULT_SCENE_MARGIN = "0px 0px 25% 0px";

export function useSceneActive(
  ref: RefObject<Element | null>,
  extraGate = true,
  rootMargin = DEFAULT_SCENE_MARGIN
): boolean {
  const [onScreen, setOnScreen] = useState(false);
  const [tabVisible, setTabVisible] = useState(true);
  // Avoids a re-render storm if the observer re-reports the same state.
  const onScreenRef = useRef(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const next = entries.some((e) => e.isIntersecting);
        if (next === onScreenRef.current) return;
        onScreenRef.current = next;
        setOnScreen(next);
      },
      { rootMargin }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [ref, rootMargin]);

  useEffect(() => {
    const onChange = () => setTabVisible(document.visibilityState === "visible");
    onChange();
    document.addEventListener("visibilitychange", onChange);
    return () => document.removeEventListener("visibilitychange", onChange);
  }, []);

  return onScreen && tabVisible && extraGate;
}
