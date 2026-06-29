"use client";

import { useMemo, useRef } from "react";
import {
  motion,
  useScroll,
  useTransform,
  type MotionValue,
} from "motion/react";

const PARAGRAPHS = [
  "Dwarka Studios is a next-generation gaming and immersive technology studio where creativity, culture, and cutting-edge AI come together. We design and build interactive worlds, intelligent visuals, cinematic effects, and immersive realities for studios, brands, and innovators who refuse to settle for ordinary.",
  "We don't see ourselves as a vendor. We see ourselves as world-builders — partners who take an idea and engineer it into an experience people remember.",
] as const;

// Decelerating curve so each letter settles in calmly instead of snapping.
const easeOutSoft = (t: number) => 1 - Math.pow(1 - t, 4);

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);

// The reveal occupies this slice of the section's total scroll range (which
// itself spans from the moment the section first enters the viewport to the
// moment it fully exits). Starting near 0 means letters begin appearing
// almost as soon as the section comes into view — never a blank pause.
// Ending well before 1 leaves a long, calm, fully-revealed reading window
// while the section is still pinned, before it unpins naturally.
const REVEAL_START = 0.03;
const REVEAL_END = 0.5;

// Fraction of total scroll progress a single character's own transition
// spans. Kept well above the per-character stagger step so neighbouring
// letters overlap heavily — the reveal reads as one slow, continuous wave
// rather than a typewriter, and is spread across a long scroll distance so
// reading speed can keep pace with it instead of chasing it.
const LETTER_WINDOW = 0.1;

function countLetters(text: string) {
  return text.replace(/\s/g, "").length;
}

// Prefix-sum of word/paragraph lengths, offset by `base`, used to assign each
// character a stable global index without mutating render-scoped state.
function prefixIndices(lengths: number[], base: number): number[] {
  const starts: number[] = [];
  let pos = base;
  for (const len of lengths) {
    starts.push(pos);
    pos += len;
  }
  return starts;
}

function RevealChar({
  char,
  index,
  total,
  progress,
}: {
  char: string;
  index: number;
  total: number;
  progress: MotionValue<number>;
}) {
  const span = REVEAL_END - REVEAL_START - LETTER_WINDOW;
  const step = span / Math.max(total - 1, 1);
  const start = REVEAL_START + index * step;
  const end = Math.min(start + LETTER_WINDOW, REVEAL_END);

  // A single eased, clamped 0→1 value per letter — reading it directly as
  // opacity and deriving blur/offset from it keeps every property in lock
  // step and avoids ever animating back out once a letter has settled in.
  const t = useTransform(progress, (p) => {
    const local = end > start ? (p - start) / (end - start) : 1;
    return easeOutSoft(clamp01(local));
  });
  const y = useTransform(t, (v) => (1 - v) * 12);
  const filter = useTransform(t, (v) => `blur(${(1 - v) * 8}px)`);

  return (
    <motion.span
      style={{
        display: "inline-block",
        opacity: t,
        y,
        filter,
        willChange: "transform, opacity, filter",
      }}
    >
      {char}
    </motion.span>
  );
}

function RevealParagraph({
  text,
  progress,
  startIndex,
  total,
  className,
}: {
  text: string;
  progress: MotionValue<number>;
  startIndex: number;
  total: number;
  className?: string;
}) {
  const words = text.split(" ");
  const wordStarts = prefixIndices(
    words.map((word) => word.length),
    startIndex
  );

  return (
    <p className={className} aria-hidden="true">
      {words.map((word, wi) => {
        const wordStart = wordStarts[wi];
        return (
          <span key={wi}>
            <span className="inline-block whitespace-nowrap">
              {[...word].map((char, ci) => (
                <RevealChar
                  key={ci}
                  char={char}
                  index={wordStart + ci}
                  total={total}
                  progress={progress}
                />
              ))}
            </span>
            {wi < words.length - 1 ? " " : ""}
          </span>
        );
      })}
    </p>
  );
}

export function WhoWeAreReveal() {
  const trackRef = useRef<HTMLDivElement>(null);

  // Spans from the section's first appearance at the bottom of the
  // viewport to it fully leaving the top — covers the entry scroll, the
  // pinned hold, and the exit scroll in one continuous progress value.
  const { scrollYProgress } = useScroll({
    target: trackRef,
    offset: ["start end", "end start"],
  });

  const totalChars = useMemo(
    () => PARAGRAPHS.reduce((sum, p) => sum + countLetters(p), 0),
    []
  );

  const paragraphStarts = useMemo(
    () => prefixIndices(PARAGRAPHS.map(countLetters), 0),
    []
  );

  return (
    // Tall scroll track gives the reveal — and the calm, fully-revealed
    // reading pause after it — room to play out; the visible section itself
    // stays pinned at one viewport height (below).
    <section ref={trackRef} className="relative h-[300vh]">
      <div className="sticky top-0 flex h-screen items-center justify-center overflow-hidden bg-bg">
        <div
          aria-hidden="true"
          className="reveal-ambient-light pointer-events-none absolute inset-0"
        />
        <div
          aria-hidden="true"
          className="reveal-ambient-grain pointer-events-none absolute inset-0"
        />

        <div className="relative z-10 mx-auto max-w-[920px] px-6 py-20 sm:px-10 sm:py-24">
          <div className="sr-only">
            {PARAGRAPHS.map((text, i) => (
              <p key={i}>{text}</p>
            ))}
          </div>

          {PARAGRAPHS.map((text, i) => (
            <RevealParagraph
              key={i}
              text={text}
              progress={scrollYProgress}
              startIndex={paragraphStarts[i]}
              total={totalChars}
              className={
                i === 0
                  ? "font-serif text-[clamp(1.4rem,2.7vw,2.1rem)] leading-[1.85] tracking-[-0.005em] text-ink-soft"
                  : "mt-14 font-display text-[clamp(1.6rem,3.1vw,2.5rem)] leading-[1.65] text-ink sm:mt-16"
              }
            />
          ))}
        </div>
      </div>
    </section>
  );
}
