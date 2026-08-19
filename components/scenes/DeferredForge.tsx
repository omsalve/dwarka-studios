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
import { useNearViewport } from "@/lib/useVisibility";

/** The forge's own backdrop colour — the placeholder *is* the scene's ground. */
const FORGE_GROUND = "#6a5330";

const BeforeAfterDwarka = dynamic(
  () => import("@/components/BeforeAfterDwarka"),
  { ssr: false }
);

export function DeferredForge() {
  const ref = useRef<HTMLDivElement>(null);
  // The descent auto-plays to this scene ~3s after the splash ends, so the
  // margin is deliberately generous: the chunk must already be parsed and the
  // context already warm by the time the light parts.
  const near = useNearViewport(ref, "250% 0px");

  return (
    <div
      ref={ref}
      style={{ position: "absolute", inset: 0, background: FORGE_GROUND }}
      data-navbar-bg="#d9be86"
      data-navbar-fg="#2a1e0d"
    >
      {near && <BeforeAfterDwarka />}
    </div>
  );
}

export default DeferredForge;
