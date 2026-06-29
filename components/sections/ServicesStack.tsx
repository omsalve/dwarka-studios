"use client";

import { useRef } from "react";
import { motion, useScroll, useTransform } from "motion/react";

type Accent = "gold" | "peacock";

type Service = {
  n: string;
  name: string;
  tagline: string;
  body: string;
  chips: string[];
  usp: string;
  accent: Accent;
};

const SERVICES: Service[] = [
  {
    n: "01",
    name: "Gaming & Simulations",
    tagline: "Worlds you don't just play — you believe.",
    body: "We design games and simulations where every mechanic, frame, and decision is engineered for immersion. From mythic open worlds and stylized indie titles to high-fidelity training and enterprise simulators, we treat play as architecture — balancing narrative, systems, art, and performance so your world holds up under a million hours of curiosity.",
    chips: [
      "Game design & development",
      "Interactive simulations",
      "Training & enterprise sims",
      "Gameplay systems",
      "Level & world design",
      "Cross-platform builds",
    ],
    usp: "Playable worlds in weeks, not quarters. Our AI-accelerated pipeline handles procedural world-building, intelligent NPC behavior, and automated playtesting — so we prototype and iterate at a speed conventional studios can't match.",
    accent: "gold",
  },
  {
    n: "02",
    name: "AI Visualization",
    tagline: "Turn ideas and data into images that think.",
    body: "We transform abstract concepts, raw datasets, and rough ideas into stunning, intelligent visuals — products on the whiteboard, architectural visions, scientific datasets, brand campaigns. Not a single static render, but an explorable space of options, variations, and refinements — each one production-grade.",
    chips: [
      "Concept & product visualization",
      "Architectural & spatial viz",
      "Data-driven imagery",
      "Brand & campaign visuals",
      "Rapid concept exploration",
      "Style development",
    ],
    usp: "From prompt to polished frame, in a fraction of the time. Our AI-driven visualization engine explores hundreds of creative directions before a traditional studio finishes its first draft — more ideas, faster decisions, final visuals that hit the brief on the first round.",
    accent: "peacock",
  },
  {
    n: "03",
    name: "VFX & Animation",
    tagline: "Maya, mastered.",
    body: "Visual effects and animation that blur the line between the real and the rendered. From cinematic VFX and dynamic simulations to character animation, motion design, and stylized storytelling, we craft the illusions that move audiences — grounded in solid technique and elevated by cultural storytelling. Every frame is intentional. Every effect serves the story.",
    chips: [
      "Cinematic VFX",
      "Character & creature animation",
      "Motion graphics",
      "Compositing & simulation",
      "Stylized & cultural storytelling",
      "Post-production",
    ],
    usp: "Cinematic craft at production speed. AI supercharges the heavy lifting — rotoscoping, denoising, in-betweening, clean-up, style transfer — so our artists spend their time on creativity and craft, not grunt work.",
    accent: "gold",
  },
];

function ServiceCard({
  service,
  index,
  total,
}: {
  service: Service;
  index: number;
  total: number;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start start", "end start"],
  });

  const isLast = index === total - 1;
  const scale = useTransform(scrollYProgress, [0, 1], [1, isLast ? 1 : 0.94]);
  const opacity = useTransform(
    scrollYProgress,
    [0, 1],
    [1, isLast ? 1 : 0.75]
  );
  const boxShadow = useTransform(
    scrollYProgress,
    [0, 1],
    [
      "0 10px 30px -12px rgba(22,20,15,0.08)",
      isLast
        ? "0 10px 30px -12px rgba(22,20,15,0.08)"
        : "0 30px 60px -15px rgba(22,20,15,0.28)",
    ]
  );

  const isPeacock = service.accent === "peacock";

  return (
    <div
      ref={containerRef}
      className="relative py-6 md:h-[145vh] md:py-0"
      style={{ zIndex: index }}
    >
      <div className="md:sticky md:top-[10vh] md:flex md:h-[78vh] md:items-center md:justify-center md:px-6">
        <motion.div
          style={{ scale, opacity, boxShadow }}
          className="mx-6 flex w-full max-w-[1100px] flex-col overflow-hidden rounded-3xl border border-gold/30 bg-bg md:mx-0 md:h-full md:flex-row"
        >
          <div className="flex flex-1 flex-col justify-between p-8 sm:p-12 md:overflow-y-auto">
            <div>
              <div className="flex items-baseline gap-4">
                <span className="font-display text-3xl text-gold sm:text-4xl">
                  {service.n}
                </span>
                <span className="font-display text-lg text-ink sm:text-xl">
                  {service.name}
                </span>
              </div>

              <p className="mt-5 font-display text-2xl leading-snug text-ink sm:text-3xl">
                {service.tagline}
              </p>

              <p className="mt-5 max-w-xl text-sm leading-relaxed text-ink-soft sm:text-base">
                {service.body}
              </p>

              <div className="mt-6 flex flex-wrap gap-2">
                {service.chips.map((chip) => (
                  <span
                    key={chip}
                    className="rounded-full border border-gold/40 px-3 py-1 text-xs text-ink-soft"
                  >
                    {chip}
                  </span>
                ))}
              </div>
            </div>

            <div
              className={`mt-8 rounded-2xl border p-5 ${
                isPeacock
                  ? "border-peacock-blue/20 bg-[linear-gradient(135deg,rgba(14,140,140,0.10),rgba(33,79,176,0.10))]"
                  : "border-gold/30 bg-[linear-gradient(135deg,rgba(230,205,134,0.18),rgba(200,162,74,0.10))]"
              }`}
            >
              <span
                className={isPeacock ? "text-peacock-blue" : "text-gold-deep"}
              >
                ✦
              </span>
              <p className="mt-2 text-sm leading-relaxed text-ink">
                {service.usp}
              </p>
            </div>
          </div>

          <div
            className={`flex min-h-[180px] flex-1 items-center justify-center md:max-w-[34%] ${
              isPeacock
                ? "bg-peacock-gradient"
                : "bg-[linear-gradient(135deg,var(--gold-light),var(--gold))]"
            }`}
          >
            <span className="font-display text-lg tracking-wide text-white sm:text-xl">
              {service.name}
            </span>
          </div>
        </motion.div>
      </div>
    </div>
  );
}

export function ServicesStack() {
  return (
    <section id="services" className="bg-bg pt-24">
      <div className="mx-auto max-w-5xl px-6 text-center">
        <p className="font-display text-xs tracking-[0.3em] text-gold">
          SERVICES
        </p>
        <h2 className="mt-6 font-display text-3xl text-ink sm:text-4xl">
          Three disciplines. One studio.
        </h2>
      </div>

      <div className="mt-16">
        {SERVICES.map((service, index) => (
          <ServiceCard
            key={service.n}
            service={service}
            index={index}
            total={SERVICES.length}
          />
        ))}
      </div>
    </section>
  );
}
