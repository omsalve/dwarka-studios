"use client";

import { useEffect, useRef, useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import { CTA_SHELL } from "@/components/CtaButton";

/* Cinematic motion pair — decelerate on arrival, accelerate on departure. The
   decel curve is the site's existing text easing (Hero's TEXT_EASE); the accel
   curve is its mirror, so the CTA leaves the way it returns. */
const EASE_OUT = [0.22, 1, 0.36, 1] as const; // entrance — graceful settle
const EASE_IN = [0.64, 0, 0.78, 0] as const; // exit — gathers speed as it goes

/* Deterministic dispersion field (no Math.random → no hydration drift). The
   spread is biased upward and outward, as if the CTA's light is lifting off
   the bar and giving the page below the focus. Coordinates are px offsets from
   the button's centre. */
const PARTICLES = [
  { x: -34, y: -18, size: 3, delay: 0.02 },
  { x: -22, y: -30, size: 4, delay: 0.06 },
  { x: -6, y: -35, size: 3, delay: 0.0 },
  { x: 12, y: -31, size: 4, delay: 0.05 },
  { x: 28, y: -20, size: 3, delay: 0.08 },
  { x: 41, y: -6, size: 2, delay: 0.1 },
  { x: -41, y: -3, size: 2, delay: 0.09 },
  { x: 20, y: 9, size: 3, delay: 0.12 },
  { x: -18, y: 11, size: 2, delay: 0.11 },
] as const;

type Burst = { dir: "out" | "in"; id: number };

/**
 * The navbar's "Start a Project" CTA. Identical in identity to every other
 * CtaButton (same shell), but when an in-page CTA is on screen it dissolves —
 * a soft blur-and-lift on the pill, a gold particle dispersion, and a brief
 * light bloom — then reassembles when the page CTA leaves.
 *
 * Only transform / opacity / filter animate, so the whole thing composites on
 * the GPU and never reflows: the button's box keeps its size the entire time,
 * which is what keeps the navbar layout perfectly stable while it's hidden.
 */
export function NavCta({
  href,
  children,
  hidden,
  className,
}: {
  href: string;
  children: React.ReactNode;
  hidden: boolean;
  className?: string;
}) {
  const reduce = useReducedMotion();

  // One-shot particle/bloom burst, replayed (fresh key) on every toggle so a
  // reversal mid-flight simply starts a new, current burst. Never fires on
  // first mount.
  const [burst, setBurst] = useState<Burst | null>(null);
  const firstRun = useRef(true);

  useEffect(() => {
    if (firstRun.current) {
      firstRun.current = false;
      return;
    }
    if (reduce) return;
    setBurst((prev) => ({ dir: hidden ? "out" : "in", id: (prev?.id ?? 0) + 1 }));
  }, [hidden, reduce]);

  return (
    <span className="relative inline-flex">
      {/* Light bloom — a brief champagne flare as the pill gathers or sheds
          its light. Keyed to the burst so it only ever pulses on a transition. */}
      {burst && (
        <motion.span
          key={`bloom-${burst.id}`}
          aria-hidden
          className="pointer-events-none absolute -inset-4 -z-10 rounded-full"
          style={{
            background:
              "radial-gradient(closest-side, rgba(200,162,74,0.42), transparent 72%)",
          }}
          initial={{ opacity: 0, scale: burst.dir === "out" ? 0.85 : 1.45 }}
          animate={{
            opacity: [0, 0.55, 0],
            scale: burst.dir === "out" ? [0.85, 1.5] : [1.45, 1],
          }}
          transition={{
            duration: burst.dir === "out" ? 0.62 : 0.72,
            ease: burst.dir === "out" ? EASE_IN : EASE_OUT,
          }}
        />
      )}

      {/* Dispersion particles. */}
      {burst &&
        PARTICLES.map((p, i) => (
          <motion.span
            key={`${burst.id}-${i}`}
            aria-hidden
            className="pointer-events-none absolute left-1/2 top-1/2 rounded-full bg-gold"
            style={{
              width: p.size,
              height: p.size,
              marginLeft: -p.size / 2,
              marginTop: -p.size / 2,
            }}
            initial={{
              x: burst.dir === "out" ? 0 : p.x,
              y: burst.dir === "out" ? 0 : p.y,
              opacity: 0,
              scale: 0.4,
            }}
            animate={{
              x: burst.dir === "out" ? p.x : 0,
              y: burst.dir === "out" ? p.y : 0,
              opacity: [0, 0.9, 0],
              scale: burst.dir === "out" ? [0.4, 1, 0.5] : [0.5, 1, 0.4],
            }}
            transition={{
              duration: burst.dir === "out" ? 0.62 : 0.72,
              ease: burst.dir === "out" ? EASE_IN : EASE_OUT,
              delay: p.delay,
            }}
          />
        ))}

      {/* The pill itself. Reduced motion collapses everything to a plain
          opacity crossfade — still no layout shift, still reversible. */}
      <motion.a
        href={href}
        className={`${CTA_SHELL} transition-colors duration-300 ${className ?? ""}`}
        style={{
          pointerEvents: hidden ? "none" : "auto",
          willChange: "transform, opacity, filter",
        }}
        tabIndex={hidden ? -1 : undefined}
        aria-hidden={hidden || undefined}
        initial={false}
        animate={
          reduce
            ? { opacity: hidden ? 0 : 1 }
            : {
                opacity: hidden ? 0 : 1,
                scale: hidden ? 0.94 : 1,
                y: hidden ? -6 : 0,
                filter: hidden ? "blur(9px)" : "blur(0px)",
              }
        }
        transition={
          reduce
            ? { duration: 0.4, ease: EASE_OUT }
            : {
                duration: hidden ? 0.55 : 0.8,
                ease: hidden ? EASE_IN : EASE_OUT,
              }
        }
      >
        {children}
      </motion.a>
    </span>
  );
}
