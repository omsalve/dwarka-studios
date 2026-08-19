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
   ----------------------------------------------------------------------- */

import dynamic from "next/dynamic";
import { useRef } from "react";
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

  // On a phone this stays false forever, so the chunk is never even requested.
  const showBook = near && !budget.isPhone;

  return (
    <div ref={ref} style={{ width: "100%", position: "relative" }}>
      {showBook ? (
        <>
          <FoundersNoteBook />
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
