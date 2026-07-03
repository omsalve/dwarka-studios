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
  /** Brightness (0–100) of a letter before it's been reached by the reveal. */
  restBrightness?: number;
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
  restOpacity = 0.15,
  restBrightness = 45,
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
      gsap.set(letters, { opacity: 1, filter: "brightness(100%)" });
      return;
    }

    gsap.set(letters, {
      opacity: restOpacity,
      filter: `brightness(${restBrightness}%)`,
    });

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
            filter: `brightness(${revealed ? 100 : restBrightness}%)`,
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
  }, [text, scrollTarget, start, end, restOpacity, restBrightness, duration, ease]);

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
