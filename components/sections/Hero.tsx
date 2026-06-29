"use client";

import Image from "next/image";
import { motion, useMotionValue, useSpring } from "motion/react";
import { useEffect, useState } from "react";
import { CtaButton } from "@/components/CtaButton";
import heroImage from "@/public/images/heroimage.png";

const BLOOM_EASE = [0.16, 1, 0.3, 1] as const;
const TEXT_EASE = [0.22, 1, 0.36, 1] as const;

const HERO_ZOOM_DURATION = 1.8;
const HERO_MAX_PARALLAX = 32;
const HERO_PARALLAX_SPRING = { stiffness: 40, damping: 22, mass: 1.2 };

const LINES = [
  "Built on legend.",
  "Powered by intelligence.",
  "Made for what's next.",
];

export function Hero() {
  const [parallaxEnabled, setParallaxEnabled] = useState(false);

  const rawX = useMotionValue(0);
  const rawY = useMotionValue(0);
  const x = useSpring(rawX, HERO_PARALLAX_SPRING);
  const y = useSpring(rawY, HERO_PARALLAX_SPRING);

  useEffect(() => {
    if (!parallaxEnabled) return;

    function handlePointerMove(event: PointerEvent) {
      const nx = event.clientX / window.innerWidth - 0.5;
      const ny = event.clientY / window.innerHeight - 0.5;
      rawX.set(-nx * 2 * HERO_MAX_PARALLAX);
      rawY.set(-ny * 2 * HERO_MAX_PARALLAX);
    }

    function handleLeave() {
      rawX.set(0);
      rawY.set(0);
    }

    window.addEventListener("pointermove", handlePointerMove, { passive: true });
    document.addEventListener("mouseleave", handleLeave);

    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      document.removeEventListener("mouseleave", handleLeave);
    };
  }, [parallaxEnabled, rawX, rawY]);

  return (
    <section
      id="top"
      className="relative flex min-h-[100vh] flex-col overflow-hidden bg-ink"
    >
      <motion.div
        initial={{ scale: 1 }}
        animate={{ scale: 1.08}}
        transition={{ duration: HERO_ZOOM_DURATION, ease: BLOOM_EASE }}
        onAnimationComplete={() => setParallaxEnabled(true)}
        style={{ x, y, willChange: "transform" }}
        className="absolute inset-0 top-[-10px]"
      >
        <Image
          src={heroImage}
          alt="A grand temple crowning a misty, forested valley where a turquoise river winds through ancient mountains"
          fill
          preload
          placeholder="blur"
          quality={90}
          sizes="100vw"
          className="object-cover"
        />
      </motion.div>

      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 z-[1] bg-gradient-to-t from-black/35 via-transparent to-black/10"
      />

      <div className="absolute left-0 top-0 z-10 h-[92%] w-[98%] md:h-[68%] md:w-[78%] lg:h-[86%] lg:w-[84%]">
        <motion.div
          initial={{ opacity: 0, scale: 0.4, filter: "blur(46px)" }}
          animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
          transition={{ duration: 1.4, ease: BLOOM_EASE, delay: 0.15 }}
          style={{ transformOrigin: "2% 2%" }}
          className="absolute inset-0 -rotate-1"
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
              initial={{ opacity: 0, y: 18, filter: "blur(10px)" }}
              animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
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
      </div>

      <div className="relative z-10 mt-auto flex justify-center pb-16">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: TEXT_EASE, delay: 2 }}
        >
          <CtaButton href="#contact">Start a Project</CtaButton>
        </motion.div>
      </div>
    </section>
  );
}
