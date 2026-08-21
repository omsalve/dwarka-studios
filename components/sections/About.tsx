"use client";

import { useEffect, useMemo, useRef } from "react";
import { CtaButton } from "@/components/CtaButton";
import { onScrollFrame } from "@/lib/scrollScheduler";
import { ABOUT, BRIDGE, clamp01, prefersReducedMotion, smoothstep } from "@/lib/heroBridge";

/* -----------------------------------------------------------------------
   About — the gilded threshold the hero's descent lands in
   ─────────────────────────────────────────────────────────────────────

   This is the second half of the Hero → light bridge. HeroLightBridge fades
   a single champagne→gold→antique-gold wash over the whole viewport during
   the dive, holds it solid across the section seam, then fades it away. The
   panel below carries *that exact gradient* as its own background (see
   BRIDGE_GRADIENT, which is the same three stops the bridge canvas paints),
   so when the canvas clears there is nothing to see change: the light simply
   turns out to have been a room the whole time.

   Everything that then happens inside the room is driven off the same shared
   scroll frame as the bridge, in absolute page depth (viewport-heights from
   the top), so the beats can never drift out of sync with the light:

     clearEnd (2.30)            the wash has fully cleared
     scrim    (2.28 → 2.50)     the chamber deepens around the words
     words    (2.30 → 2.80)     the manifesto lights word by word
     cta      (2.62 → 2.85)     the invitation arrives last

   The descent's rest point (BRIDGE.restDepth, 2.5) lands mid-reveal on
   purpose — the visitor comes to a stop with the sentence half-lit, which is
   what asks them to keep scrolling.

   No GSAP here, deliberately. ScrollTextReveal is ~114KB behind a dynamic
   import that only pays for itself far down the page; this section sits two
   viewports from the top, so it would land squarely on the critical path.
   Per-word opacity written straight from the scroll frame costs nothing,
   never re-renders React, and — unlike a ScrollTrigger start/end string — is
   exact against a `position: sticky` panel.
   ----------------------------------------------------------------------- */

const ABOUT_TEXT =
  "The past was built by master craftsmen. The future will be built by intelligent ones. Dwarka Studios is where they meet — ancient storytelling, modern intelligence, and immersive technology, engineered into experiences worth remembering.";

/** Opacity of a word the reveal has not reached yet. Matches ScrollTextReveal's
 *  resting value so the two reveals on the page read as the same effect. */
const WORD_REST = 0.14;
/** How many words the lighting edge is spread across. Below ~3 it reads as a
 *  hard wipe; much above it and the sentence lights all at once. */
const WORD_RAMP = 5;

/** Depth quantisation — a frame that has not moved the reveal by 1/400th of
 *  its range cannot change a single word's rendered opacity, so it is skipped
 *  outright rather than writing ~40 styles for nothing. */
const STEPS = 400;

export function About() {
  const scrimRef = useRef<HTMLDivElement>(null);
  const wordsRef = useRef<HTMLParagraphElement>(null);
  const ctaRef = useRef<HTMLDivElement>(null);

  const words = useMemo(() => ABOUT_TEXT.split(" "), []);

  useEffect(() => {
    const scrim = scrimRef.current;
    const block = wordsRef.current;
    const cta = ctaRef.current;
    if (!scrim || !block || !cta) return;

    const spans = Array.from(block.querySelectorAll<HTMLElement>("[data-word]"));

    // Reduced motion gets the room already lit: no wash to wait for, no
    // reveal to scrub, and the copy is the point.
    if (prefersReducedMotion()) {
      scrim.style.opacity = "1";
      cta.style.opacity = "1";
      for (const span of spans) span.style.opacity = "1";
      return;
    }

    const total = spans.length;
    let paintedStep = -1;
    let ctaLive = false;

    return onScrollFrame(({ depth }) => {
      scrim.style.opacity = String(
        smoothstep(ABOUT.scrimStart, ABOUT.scrimEnd, depth)
      );

      const ctaP = smoothstep(ABOUT.ctaStart, ABOUT.ctaEnd, depth);
      cta.style.opacity = String(ctaP);
      cta.style.transform = `translate3d(0,${(1 - ctaP) * 14}px,0)`;
      // A CTA at 8% opacity is still a click target sitting over the copy.
      const shouldBeLive = ctaP > 0.5;
      if (shouldBeLive !== ctaLive) {
        ctaLive = shouldBeLive;
        cta.style.pointerEvents = shouldBeLive ? "auto" : "none";
      }

      const p = smoothstep(ABOUT.wordsStart, ABOUT.wordsEnd, depth);
      const step = Math.round(p * STEPS);
      if (step === paintedStep) return;
      paintedStep = step;

      // The lighting edge sweeps from before the first word to past the last,
      // so both ends of the sentence get the full ramp rather than snapping.
      const edge = p * (total + WORD_RAMP);
      for (let i = 0; i < total; i++) {
        const t = clamp01((edge - i) / WORD_RAMP);
        spans[i].style.opacity = String(WORD_REST + (1 - WORD_REST) * t);
      }
    });
  }, []);

  return (
    <section
      // The #about nav anchor is a positioned element in page.tsx, not this
      // panel: this one is sticky, so its document position changes depending
      // on whether its container has been scrolled past, and a jump to it
      // from further down the page would land at the *end* of the pin. The
      // anchor there is pinned to ABOUT.wordsStart instead — the first frame
      // of the reveal below.
      className="relative flex h-full w-full items-center justify-center overflow-hidden px-6"
      style={{ background: BRIDGE.gradient }}
      // The panel's mid band is what sits behind the nav for this whole beat.
      data-navbar-bg="#8d6d38"
      data-navbar-fg="var(--parchment)"
    >
      {/* The chamber: a soft warm shadow that deepens around the words once
          the wash has cleared. It starts at zero so the dissolve out of the
          bridge is against a *flat* gradient — an identical one — and only
          then does the room acquire depth. */}
      <div
        ref={scrimRef}
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
        style={{
          opacity: 0,
          background:
            "radial-gradient(ellipse 74% 62% at 50% 50%, rgba(18,12,3,0.72) 0%, rgba(18,12,3,0.46) 46%, rgba(18,12,3,0) 78%)",
          willChange: "opacity",
        }}
      />

      <div className="relative z-10 mx-auto max-w-3xl text-center">
        <p
          ref={wordsRef}
          className="font-display text-2xl leading-relaxed text-parchment sm:text-3xl"
        >
          {/* Rendered as real, complete copy — the reveal only ever animates
              opacity, so this paragraph is fully legible with JS off and is
              read verbatim by assistive tech. */}
          {words.map((word, i) => (
            <span key={`${word}-${i}`}>
              <span data-word style={{ opacity: WORD_REST }}>
                {word}
              </span>
              {i < words.length - 1 ? " " : null}
            </span>
          ))}
        </p>

        <div
          ref={ctaRef}
          className="mt-10 inline-block"
          style={{ opacity: 0, pointerEvents: "none", willChange: "opacity, transform" }}
        >
          <CtaButton href="/contact" pageCta>
            Let&apos;s build your world.
          </CtaButton>
        </div>
      </div>
    </section>
  );
}
