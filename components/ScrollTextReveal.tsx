"use client";

import { useEffect, useMemo, useRef, type RefObject } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

if (typeof window !== "undefined") {
  gsap.registerPlugin(ScrollTrigger);
}

type ScrollTextRevealTag = "p" | "div" | "span" | "h1" | "h2" | "h3" | "h4";

export type ScrollTextRevealProps = {
  /** The exact copy to reveal. Content is never altered — only its opacity/brightness animates. */
  text: string;
  /** Wrapping element. Defaults to a paragraph. */
  as?: ScrollTextRevealTag;
  className?: string;
  /** Applied to every animated letter span. */
  charClassName?: string;
  /**
   * Element whose scroll transit drives the reveal (GSAP ScrollTrigger's
   * `trigger`). Defaults to this component's own wrapper. Pass a ref to an
   * ancestor (e.g. the whole section) to spread the reveal across a longer
   * scroll distance than the text block itself covers.
   */
  scrollTarget?: RefObject<HTMLElement | null>;
  /** ScrollTrigger `start` position, e.g. "top 90%". */
  start?: string;
  /** ScrollTrigger `end` position, e.g. "bottom 10%". */
  end?: string;
  /** Opacity of a letter before it's been reached by the reveal. */
  restOpacity?: number;
  /** Per-letter catch-up tween duration, in seconds. */
  duration?: number;
  /** Per-letter catch-up ease. A slight overshoot ease reads as a light bounce. */
  ease?: string;
};

const DEFAULT_START = "top 50%";
const DEFAULT_END = "bottom 100%";

export function ScrollTextReveal({
  text,
  as = "p",
  className,
  charClassName,
  scrollTarget,
  start = DEFAULT_START,
  end = DEFAULT_END,
  // Was 0.15 alongside a brightness(45%) filter. Dropping the filter (see
  // below) makes the resting letters read slightly lighter, so the resting
  // opacity comes down to match what the pair used to look like together.
  restOpacity = 0.12,
  duration = 0.3,
  ease = "back.out(1.7)",
}: ScrollTextRevealProps) {
  const containerRef = useRef<HTMLElement>(null);
  const Tag = as;

  const tokens = useMemo(() => text.split(/(\s+)/), [text]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || !text) return;

    const letters = Array.from(
      container.querySelectorAll<HTMLElement>(".stw-letter")
    );
    const totalLetters = letters.length;
    if (totalLetters === 0) return;

    const prefersReducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;

    if (prefersReducedMotion) {
      gsap.set(letters, { opacity: 1 });
      return;
    }

    /* Opacity only, deliberately.

       This reveal used to animate `filter: brightness()` on every character
       alongside the opacity. A CSS filter promotes its element to its own
       compositor layer for the duration of the animation — so a 240-character
       paragraph became 240 layers, each with its own texture, all being
       re-rasterised as the scrub moved through them. Opacity alone composites
       on the GPU with no promotion and no rasterisation, and on ink-coloured
       text over parchment the two look the same. */
    gsap.set(letters, { opacity: restOpacity });

    let revealedCount = 0;

    const trigger = ScrollTrigger.create({
      trigger: scrollTarget?.current ?? container,
      start,
      end,
      scrub: true,
      onUpdate: (self) => {
        const index = Math.floor(self.progress * totalLetters);
        const from = Math.min(revealedCount, index);
        const to = Math.max(revealedCount, index);

        for (let i = from; i < to; i++) {
          const revealed = i < index;
          gsap.to(letters[i], {
            opacity: revealed ? 1 : restOpacity,
            duration,
            ease,
            overwrite: "auto",
          });
        }

        revealedCount = index;
      },
    });

    return () => {
      trigger.kill();
      gsap.killTweensOf(letters);
    };
  }, [text, scrollTarget, start, end, restOpacity, duration, ease]);

  return (
    <Tag ref={containerRef as never} className={className} aria-label={text}>
      {tokens.map((token, tokenIndex) => {
        if (/^\s+$/.test(token)) {
          return <span key={tokenIndex}>{token}</span>;
        }

        return (
          <span key={tokenIndex} className="inline-block" aria-hidden="true">
            {Array.from(token).map((char, i) => (
              <span
                key={i}
                className={
                  charClassName
                    ? `stw-letter ${charClassName}`
                    : "stw-letter"
                }
              >
                {char}
              </span>
            ))}
          </span>
        );
      })}
    </Tag>
  );
}
