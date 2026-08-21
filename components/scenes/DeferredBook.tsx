"use client";

/* -----------------------------------------------------------------------
   DeferredBook — which founder's note this device gets
   ─────────────────────────────────────────────────────────────────────
   Phones get the letter as type (FoundersNoteLetter). Laptops and desktops
   get the 3D diary, exactly as it was — nothing about the scene itself is
   tuned or degraded any more.

   It branches on `isPhone`, not on `tier`. Tier is a scored guess and we know
   it can be wrong: Safari masks the GPU, so an iPhone and a budget Android can
   score alike. Screen size and input type are directly observed and cannot be
   masked, and they are the honest question here anyway — this is a layout
   decision, not a quality dial.

   The letter is also what the server renders, on every device, with capable
   devices upgrading to the book once it is near. That ordering is what makes
   `ssr: false` safe (server and hydrating client both render the letter, so
   the markup matches), and it means the letter is real text in the HTML for
   crawlers and assistive tech on every request — which the WebGL version can
   only ever approximate with an sr-only mirror.

   The near-viewport gate stays because it is a *delivery* mechanism, not a
   rendering one: it keeps three.js out of the landing page's initial bundle
   and stops phones requesting a scene they will never show. It does not change
   how the diary looks or behaves once it is on screen. The margin is wide so
   the swap always lands off-screen — it changes the section's height, and the
   book's scroll pin adds its own spacer the moment it initialises.

   That wide margin has a second consequence, though, and it is the reason for
   the idle gate below. Two viewports before this section is the *middle of the
   services deck*, and mounting the book is not cheap: it bakes five procedural
   canvas textures, which measured out at ~3,600 `measureText` and ~430
   `fillText` calls in a single synchronous burst. Landing that burst inside a
   scroll gesture is a visible hitch in the deck, three sections above.

   So "near" now only *arms* the swap. The mount itself waits for the browser
   to be idle, which during an active scroll it is not — so the bake reliably
   slides into the first pause instead of interrupting the gesture. The wide
   margin is what makes this safe: there is a lot of runway for an idle moment
   to turn up. If one never does, the timeout fires and we are exactly where we
   were before, which is the correct floor for this.
   ----------------------------------------------------------------------- */

import dynamic from "next/dynamic";
import { useCallback, useEffect, useRef, useState } from "react";
import { FoundersNoteLetter } from "@/components/FoundersNoteLetter";
import { useDeviceBudget } from "@/lib/deviceTier";
import { useNearViewport } from "@/lib/useVisibility";

const FoundersNoteBook = dynamic(
  () => import("@/components/FoundersNoteBook"),
  { ssr: false }
);

export function DeferredBook() {
  const ref = useRef<HTMLDivElement>(null);
  const budget = useDeviceBudget();
  const near = useNearViewport(ref, "200% 0px");
  // Set if the book's WebGL context dies and cannot be rebuilt. It is a
  // one-way door: a device that has just proved it cannot hold a context is
  // not worth handing another one to, and the letter says everything the book
  // says anyway. Stable callback so it is not a moving dependency inside the
  // scene's listener effect.
  const [glUnavailable, setGlUnavailable] = useState(false);
  const handleGlUnavailable = useCallback(() => setGlUnavailable(true), []);

  // `near` arms the swap; this lets it through on the first idle moment. See
  // the note above — the point is to keep the texture bake out of an active
  // scroll gesture, not to delay it indefinitely.
  const armed = near && !budget.isPhone && !glUnavailable;
  const [idle, setIdle] = useState(false);
  useEffect(() => {
    if (!armed || idle) return;
    const ric = window.requestIdleCallback;
    if (!ric) {
      // Safari has no requestIdleCallback. A timeout is a poor substitute for
      // "the main thread is free", but it is no worse than the unconditional
      // mount this replaced.
      const t = window.setTimeout(() => setIdle(true), 400);
      return () => window.clearTimeout(t);
    }
    const handle = ric(() => setIdle(true), { timeout: 2500 });
    return () => window.cancelIdleCallback(handle);
  }, [armed, idle]);

  // On a phone this stays false forever, so the chunk is never even requested.
  const showBook = armed && idle;

  return (
    <div ref={ref} style={{ width: "100%", position: "relative" }}>
      {showBook ? (
        <>
          <FoundersNoteBook onGlUnavailable={handleGlUnavailable} />
          {/* The book paints the letter into a WebGL canvas, which no screen
              reader or crawler can read. Same component, visually hidden —
              one source of markup, so the two can never drift apart. */}
          <div className="sr-only">
            <FoundersNoteLetter plain />
          </div>
        </>
      ) : (
        <FoundersNoteLetter />
      )}
    </div>
  );
}

export default DeferredBook;
