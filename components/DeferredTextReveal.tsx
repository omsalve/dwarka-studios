"use client";

/* -----------------------------------------------------------------------
   DeferredTextReveal — the copy first, the choreography second
   ─────────────────────────────────────────────────────────────────────
   ScrollTextReveal pulls in GSAP and ScrollTrigger: ~114KB of JavaScript for
   one paragraph that sits several viewports below the fold. That was in the
   landing route's initial script set, delaying hydration of everything above
   it for an effect nobody can see yet.

   The obvious fix — `next/dynamic` with `ssr: false` — would also remove the
   paragraph itself from the server-rendered HTML, which is unacceptable: it
   is real copy, and it is the only thing in that section. So this renders the
   text plainly and immediately (server-rendered, styled identically, fully
   legible), and swaps in the animated version only once the section is
   getting close.

   The margin is deliberately wide. The upgrade must land well before the
   paragraph is visible, because the animated version starts at 12% opacity —
   swapping while it is on screen would read as the text suddenly dimming.
   If the chunk never arrives, the static paragraph simply stays, which is the
   correct failure mode for body copy.
   ----------------------------------------------------------------------- */

import dynamic from "next/dynamic";
import { useRef } from "react";
import { useNearViewport } from "@/lib/useVisibility";
import type { ScrollTextRevealProps } from "@/components/ScrollTextReveal";

const ScrollTextReveal = dynamic(
  () => import("@/components/ScrollTextReveal").then((m) => m.ScrollTextReveal),
  { ssr: false }
);

export function DeferredTextReveal(props: ScrollTextRevealProps) {
  const ref = useRef<HTMLDivElement>(null);
  const near = useNearViewport(ref, "200% 0px");

  return (
    <div ref={ref}>
      {near ? (
        <ScrollTextReveal {...props} />
      ) : (
        <p className={props.className}>{props.text}</p>
      )}
    </div>
  );
}

export default DeferredTextReveal;
