"use client";

/* -----------------------------------------------------------------------
   DeferredForge — three.js off the critical path
   ─────────────────────────────────────────────────────────────────────
   The forge and the founder's book pull in three.js, @react-three/fiber and
   @react-three/drei: a single 1.17MB parse-and-evaluate that used to sit in
   the landing route's *initial* script set, blocking hydration and competing
   with the hero image for bandwidth on a page whose first three seconds are
   a video splash that needs neither.

   Dynamic-importing it moves that megabyte to a second, asynchronous request
   that starts after the shell is interactive. Two separate gates then decide
   *when*:

     · `useNearViewport` gates the mount — building a WebGL context, compiling
       a dozen shaders and uploading buffers is a real chunk of main-thread
       work, and there is no reason to spend it until the scene is close.
     · the placeholder below reserves the exact final geometry and the scene's
       own resting background colour, so the swap is invisible and costs no
       layout shift — which is also what makes `ssr: false` safe here.
   ----------------------------------------------------------------------- */

import dynamic from "next/dynamic";
import { useRef } from "react";
import { FORGE_FLOOR_RAMP, FORGE_GROUND } from "@/lib/forge";
import { useNearViewport } from "@/lib/useVisibility";

/* The scene's colours live in lib/forge.ts, not here: app/page.tsx is a
   server component and needs the same two values, and a server component
   cannot import a value out of a "use client" module. */

const BeforeAfterDwarka = dynamic(
  () => import("@/components/BeforeAfterDwarka"),
  { ssr: false }
);

export function DeferredForge() {
  const ref = useRef<HTMLDivElement>(null);
  // The margin is deliberately generous: this scene closes the page behind an
  // ink wash that takes barely one viewport-height of scroll to clear, so the
  // chunk must already be parsed and the WebGL context already warm by the
  // time the gold thins away — there is no second chance to hide the build.
  const near = useNearViewport(ref, "250% 0px");

  return (
    <div
      ref={ref}
      style={{ position: "absolute", inset: 0, background: FORGE_GROUND }}
      data-navbar-bg="#d9be86"
      data-navbar-fg="#2a1e0d"
    >
      {near && <BeforeAfterDwarka />}
      {/* The floor ramp. Sits over the canvas but under page.tsx's reveal
          veil, so it is only ever visible once the ink has already cleared. */}
      <div
        aria-hidden="true"
        style={{
          position: "absolute",
          insetInline: 0,
          bottom: 0,
          height: "15%",
          background: FORGE_FLOOR_RAMP,
          pointerEvents: "none",
        }}
      />
    </div>
  );
}

export default DeferredForge;
