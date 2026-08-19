"use client";

/* -----------------------------------------------------------------------
   DeferredBook — the founder's note scene, built only when it is near
   ─────────────────────────────────────────────────────────────────────
   Same contract as DeferredForge, with one extra consideration: this scene
   owns a GSAP ScrollTrigger pin, and a pin adds its own spacer to the
   document the moment it initialises. Mounting it two viewports early means
   that growth always happens well below the fold, where nothing the visitor
   is looking at can shift.

   The placeholder holds the section's full 100vh so the server-rendered
   document is already the right height — `ssr: false` costs no layout shift.
   ----------------------------------------------------------------------- */

import dynamic from "next/dynamic";
import { useRef } from "react";
import { useNearViewport } from "@/lib/useVisibility";

const FoundersNoteBook = dynamic(
  () => import("@/components/FoundersNoteBook"),
  { ssr: false }
);

export function DeferredBook() {
  const ref = useRef<HTMLDivElement>(null);
  const near = useNearViewport(ref, "200% 0px");

  return (
    // The height is only asserted while this is empty: once the scene mounts
    // it renders its own 100vh wrapper, and holding a second one here would
    // double the section.
    <div
      ref={ref}
      style={{
        width: "100%",
        position: "relative",
        height: near ? undefined : "100vh",
      }}
    >
      {near && <FoundersNoteBook />}
    </div>
  );
}

export default DeferredBook;
