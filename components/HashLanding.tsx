"use client";

import { useEffect } from "react";

/* -----------------------------------------------------------------------
   HashLanding — makes a fragment landing survive this page's late layout
   ─────────────────────────────────────────────────────────────────────

   Arriving at /#approach (or #about, #services) from another route is a full
   document load, and the browser resolves the fragment against whatever has
   been laid out at that moment. On this page that is not the finished page:
   measured live, the document is ~10.6 viewport-heights tall half a second
   in and ~12.6 once the services deck and the founder's note have settled,
   and #approach moves 2vh down the document in between. Chromium re-anchors
   as the content streams but stops a little over half a viewport short —
   which on the forge is the difference between the scene and the sheet of
   gold ink still covering it.

   So: re-align to the fragment whenever the document's height changes, until
   it stops changing or the visitor takes over. Any *genuine* input ends it
   immediately — a scroll event would not do, because our own scrollTo emits
   one, so this listens for the gestures themselves.

   Same-document fragment clicks (the nav, while already on this page) do not
   need any of this and are not touched: the layout is long settled by then,
   and this only ever runs once, on mount.
   ----------------------------------------------------------------------- */

/** Hard stop, in ms. The height settles inside ~1s locally; this is the
 *  ceiling for a slow connection, not the expected wait. */
const SETTLE_WINDOW_MS = 6000;

export function HashLanding() {
  useEffect(() => {
    const id = decodeURIComponent(window.location.hash.slice(1));
    if (!id) return;

    let done = false;
    const html = document.documentElement;

    function align() {
      if (done) return;
      const el = document.getElementById(id);
      if (!el) return;
      const target = el.getBoundingClientRect().top + window.scrollY;
      if (Math.abs(target - window.scrollY) < 2) return;
      // Bypass the global `scroll-behavior: smooth` — this is a correction to
      // a position the visitor is already meant to be at, not a journey.
      const saved = html.style.scrollBehavior;
      html.style.scrollBehavior = "auto";
      window.scrollTo(0, target);
      html.style.scrollBehavior = saved;
    }

    function stop() {
      if (done) return;
      done = true;
      observer.disconnect();
      window.clearTimeout(deadline);
      for (const type of INPUT) window.removeEventListener(type, stop);
    }

    // The document growing under us is the whole problem, so it is also the
    // signal: every height change gets one correction.
    const observer = new ResizeObserver(align);
    observer.observe(html);

    const INPUT = ["wheel", "touchstart", "keydown", "pointerdown"] as const;
    for (const type of INPUT) {
      window.addEventListener(type, stop, { passive: true });
    }

    const deadline = window.setTimeout(stop, SETTLE_WINDOW_MS);
    void document.fonts?.ready.then(align);

    return stop;
  }, []);

  return null;
}
