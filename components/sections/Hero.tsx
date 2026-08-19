"use client";

import Image from "next/image";
import { motion, useMotionValue, useSpring, useTransform } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { CtaButton } from "@/components/CtaButton";
import { onScrollFrame } from "@/lib/scrollScheduler";
import { useDeviceBudget } from "@/lib/deviceTier";
import { useSceneActive } from "@/lib/useVisibility";
import { useIntro } from "@/components/GateIntro/IntroContext";
import { HERO_STILL, STILL_CLASS } from "@/components/GateIntro/constants";
import {
  BRIDGE,
  easeInOut,
  prefersReducedMotion,
  smoothstep,
} from "@/lib/heroBridge";

const BLOOM_EASE = [0.16, 1, 0.3, 1] as const;
const TEXT_EASE = [0.22, 1, 0.36, 1] as const;

const HERO_ZOOM_DURATION = 1.8;
const HERO_MAX_PARALLAX = 32;
const HERO_PARALLAX_SPRING = { stiffness: 40, damping: 22, mass: 1.2 };

// How far the dive pushes into the temple, layered on top of the intro zoom.
const HERO_DIVE_SCALE = 0.94;
// Transform origin = the temple's screen anchor, so the world expands *past*
// the temple as we fall toward it (a real push-in, not a centred zoom).
const HERO_DIVE_ORIGIN = `${BRIDGE.templeX * 100}% ${BRIDGE.templeY * 100}%`;

const LINES = [
  "Built on legend.",
  "Powered by intelligence.",
  "Made for what's next.",
];

// Stable (SSR-safe) drifting motes — a faint dusk shimmer that keeps the
// temple feeling inhabited without ever reading as a moving shape.
const MOTES = [
  { x: 14, y: 68, size: 3, drift: 10, delay: 0.0, duration: 9 },
  { x: 32, y: 82, size: 2, drift: -8, delay: 1.6, duration: 11 },
  { x: 58, y: 74, size: 3, drift: 7, delay: 0.8, duration: 10 },
  { x: 72, y: 86, size: 2, drift: -6, delay: 2.4, duration: 12 },
  { x: 86, y: 70, size: 3, drift: 9, delay: 1.1, duration: 9.5 },
  { x: 46, y: 90, size: 2, drift: 5, delay: 3.0, duration: 12.5 },
] as const;

export function Hero() {
  const { introComplete, reducedMotion } = useIntro();
  const budget = useDeviceBudget();
  const [parallaxEnabled, setParallaxEnabled] = useState(false);

  const sectionRef = useRef<HTMLElement>(null);
  const rawX = useMotionValue(0);
  const rawY = useMotionValue(0);
  const x = useSpring(rawX, HERO_PARALLAX_SPRING);
  const y = useSpring(rawY, HERO_PARALLAX_SPRING);

  // Scroll-driven "descent into the temple". These motion values are written
  // from a passive scroll listener (never triggering a React render) and read
  // straight into `style`, so the whole dive stays on the compositor at 60fps.
  const diveScale = useMotionValue(1);
  const warm = useMotionValue(0); // cool valley → warm gold grade
  const textExit = useMotionValue(0); // parchment text lifts + blurs away

  useEffect(() => {
    if (prefersReducedMotion()) return;

    // Shares the page's single rAF-coalesced scroll frame with the light
    // bridge and the forge arrival (lib/scrollScheduler), so all three read
    // the identical scrollY within a frame and the descent can never tear.
    return onScrollFrame(({ depth: p }) => {
      // Gentle creep before the dive, then an eased push into the temple.
      const creep = smoothstep(0, BRIDGE.igniteStart, p) * 0.05;
      const dive = easeInOut(smoothstep(BRIDGE.igniteStart, BRIDGE.bloomFull, p));
      diveScale.set(1 + creep + dive * HERO_DIVE_SCALE);

      warm.set(smoothstep(BRIDGE.igniteStart - 0.05, BRIDGE.bloomFull, p));
      textExit.set(smoothstep(0.06, 0.42, p));
    });
  }, [diveScale, warm, textExit]);

  // Derived styles (pure reads off the motion values — still no re-render).
  const tintOpacity = useTransform(warm, (v) => v * 0.85);
  const textOpacity = useTransform(textExit, (v) => 1 - v);
  const textY = useTransform(textExit, (v) => v * -54);
  const textBlur = useTransform(textExit, (v) => `blur(${v * 9}px)`);

  /* The parchment blot is three animated blurs stacked on one subtree: the
     46px bloom it enters on, this scroll-driven defocus over the whole block,
     and a 10px blur on each headline line. Blur is the one filter that cannot
     be composited — every frame is a fresh rasterisation of the element plus
     its blur skirt — and this element is near-viewport-sized, masked by seven
     radial gradients, and carries an overlay-blended noise texture.

     On a phone or a low-tier laptop that is the single worst moment on the
     page, so those devices get the same parchment and the same copy without
     the defocus: a plain opacity/transform entrance, which composites for
     free. The blot itself stays — it is what makes dark parchment-ink type
     legible over a photographed temple, not decoration. */
  const heavyFilters = budget.allowHeavyFilters;

  // Only bind the filter at all where it is affordable. Even `blur(0px)`
  // promotes a layer and forces a filter pass on every scroll frame.
  const textBlockStyle = heavyFilters
    ? { opacity: textOpacity, y: textY, filter: textBlur }
    : { opacity: textOpacity, y: textY };

  const bloomFrom = heavyFilters
    ? { opacity: 0, scale: 0.4, filter: "blur(46px)" }
    : { opacity: 0, scale: 0.82 };
  const bloomTo = heavyFilters
    ? { opacity: 1, scale: 1, filter: "blur(0px)" }
    : { opacity: 1, scale: 1 };
  const bloomTransition = {
    duration: heavyFilters ? 1.4 : 0.9,
    ease: BLOOM_EASE,
    delay: 0.15,
  };

  const lineFrom = heavyFilters
    ? { opacity: 0, y: 18, filter: "blur(10px)" }
    : { opacity: 0, y: 18 };
  const lineTo = heavyFilters
    ? { opacity: 1, y: 0, filter: "blur(0px)" }
    : { opacity: 1, y: 0 };

  useEffect(() => {
    // A touch device has no hovering pointer to track, and a low-tier device
    // has better uses for a full-viewport transform than a 32px drift.
    if (!parallaxEnabled || !budget.allowPointerFx) return;

    let frame = 0;
    let pendingX = 0;
    let pendingY = 0;

    // pointermove fires far faster than the display refreshes; coalescing to
    // one write per frame keeps a fast mouse from queueing a dozen spring
    // updates per painted frame.
    function flush() {
      frame = 0;
      rawX.set(pendingX);
      rawY.set(pendingY);
    }

    function handlePointerMove(event: PointerEvent) {
      const nx = event.clientX / window.innerWidth - 0.5;
      const ny = event.clientY / window.innerHeight - 0.5;
      pendingX = -nx * 2 * HERO_MAX_PARALLAX;
      pendingY = -ny * 2 * HERO_MAX_PARALLAX;
      if (frame) return;
      frame = requestAnimationFrame(flush);
    }

    function handleLeave() {
      pendingX = 0;
      pendingY = 0;
      rawX.set(0);
      rawY.set(0);
    }

    window.addEventListener("pointermove", handlePointerMove, { passive: true });
    document.addEventListener("mouseleave", handleLeave);

    return () => {
      if (frame) cancelAnimationFrame(frame);
      window.removeEventListener("pointermove", handlePointerMove);
      document.removeEventListener("mouseleave", handleLeave);
    };
  }, [parallaxEnabled, rawX, rawY, budget.allowPointerFx]);

  // The ambient life is a full-viewport screen-blended conic gradient plus six
  // blended motes, all on infinite loops. Left running they keep the
  // compositor blending a full-screen layer forever — including the whole
  // time the visitor is three sections further down the page. It is switched
  // off the moment the hero leaves the viewport and back on when it returns.
  const heroOnScreen = useSceneActive(sectionRef);
  const alive = introComplete && !reducedMotion && heroOnScreen;

  return (
    <section
      ref={sectionRef}
      id="top"
      className="relative flex min-h-[100vh] flex-col overflow-hidden bg-ink"
      data-navbar-bg="var(--ink)"
      data-navbar-fg="var(--parchment)"
    >
      {/* Dive layer: scale about the temple's screen anchor so the valley
          expands *past* the temple as the camera falls toward it. */}
      <motion.div
        style={{ scale: diveScale, transformOrigin: HERO_DIVE_ORIGIN, willChange: "transform" }}
        className="absolute inset-0"
      >
        {/* Intro zoom + parallax. Held dead-still at scale 1 until the gate
            flight has handed off — at that instant this frame is pixel-identical
            to the video's last frame, so the reveal is invisible; only then does
            it begin its slow push-in. */}
        <motion.div
          initial={{ scale: 1 }}
          animate={{ scale: introComplete ? 1.08 : 1 }}
          transition={{ duration: HERO_ZOOM_DURATION, ease: BLOOM_EASE }}
          onAnimationComplete={() => {
            if (introComplete) setParallaxEnabled(true);
          }}
          style={{ x, y, willChange: "transform" }}
          className="absolute inset-0"
        >
          {/* The hero base — the *same file and URL* the intro overlay decoded
              and the video ends on. `unoptimized` keeps the bytes (and color)
              identical to that decode so the dissolve shows no gamma step. */}
          <Image
            src={HERO_STILL}
            alt="A grand temple crowning a misty, forested valley at golden hour, lit lamps lining the stone plaza"
            fill
            unoptimized
            preload
            sizes="100vw"
            className={STILL_CLASS}
          />
        </motion.div>

        {/* Warm grade: the cool valley evolves toward the forge's gold as the
            dive deepens — a single flat soft-light champagne wash, no
            localized light, so nothing reads as a shape moving across it. */}
        <motion.div
          aria-hidden="true"
          style={{
            opacity: tintOpacity,
            mixBlendMode: "soft-light",
            background:
              "linear-gradient(180deg, rgba(231,206,140,0.9) 0%, rgba(150,116,60,0.75) 55%, rgba(88,68,40,0.85) 100%)",
          }}
          className="pointer-events-none absolute inset-0 z-[2]"
        />
      </motion.div>

      {/* ---- Subtle life: the temple breathing, revealed only after the intro
          so it can never disturb the seamless handoff. ---- */}
      {alive && (
        <>
          {/* God rays drifting down from the upper-left, matching the sun in
              the plate. Barely-there, very slow.

              These two are plain CSS keyframe animations rather than motion
              components: they are ambient, infinite, and never interact with
              React state or scroll, so there is nothing for a JS animation
              loop to buy. As CSS they run entirely on the compositor, cost no
              main-thread work per frame, and are paused automatically by the
              browser when the tab is backgrounded. */}
          <div
            aria-hidden="true"
            className="hero-godrays pointer-events-none absolute inset-0 z-[3] mix-blend-screen"
          />
          {/* Drifting embers/motes. */}
          <div aria-hidden="true" className="pointer-events-none absolute inset-0 z-[3] mix-blend-screen">
            {MOTES.map((m, i) => (
              <span
                key={i}
                className="hero-mote absolute rounded-full"
                style={{
                  left: `${m.x}%`,
                  top: `${m.y}%`,
                  width: m.size,
                  height: m.size,
                  // Custom properties feed the shared keyframes, so six motes
                  // share one animation definition instead of six timelines.
                  ["--mote-drift" as string]: `${m.drift}px`,
                  animationDuration: `${m.duration}s`,
                  animationDelay: `${m.delay}s`,
                }}
              />
            ))}
          </div>
        </>
      )}

      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 z-[1] bg-gradient-to-t from-black/35 via-transparent to-black/10"
      />

      {/* Parchment headline + CTA — mounted only once the flight is over, so
          they bloom in as the temple settles. */}
      {introComplete && (
        <>
          <motion.div
            style={textBlockStyle}
            className="absolute left-0 top-0 z-10 h-[92%] w-[98%] md:h-[68%] md:w-[78%] lg:h-[86%] lg:w-[84%]"
          >
            <motion.div
              initial={bloomFrom}
              animate={bloomTo}
              transition={bloomTransition}
              style={{ transformOrigin: "2% 2%" }}
              className="absolute inset-0"
            >
              <div className="hero-parchment-mask hero-parchment-fill absolute inset-0" />
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 1, ease: "easeOut", delay: 0.55 }}
                className="hero-parchment-mask hero-parchment-grain absolute inset-0"
              />
            </motion.div>

            <div className="relative z-10 flex h-full max-w-[700px] flex-col justify-start px-8 pt-20 sm:px-12 sm:pt-24 lg:px-16 lg:pt-24">
              {LINES.map((line, i) => (
                <motion.span
                  key={line}
                  initial={lineFrom}
                  animate={lineTo}
                  transition={{
                    duration: 0.8,
                    ease: TEXT_EASE,
                    delay: 1.05 + i * 0.16,
                  }}
                  className="whitespace-nowrap font-serif text-[clamp(1.5rem,3.4vw,2.75rem)] font-medium leading-[1.35] tracking-[-0.01em] text-parchment-ink"
                >
                  {line}
                </motion.span>
              ))}
            </div>
          </motion.div>

          <motion.div
            style={{ opacity: textOpacity, y: textY }}
            className="relative z-10 mt-auto flex justify-center pb-16"
          >
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, ease: TEXT_EASE, delay: 2 }}
            >
              <CtaButton href="/contact" pageCta>Start a Project</CtaButton>
            </motion.div>
          </motion.div>
        </>
      )}
    </section>
  );
}
