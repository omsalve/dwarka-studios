"use client";

import { motion } from "motion/react";
import { fadeUpItem, staggerContainer } from "@/lib/motion";

const ROWS = [
  {
    dim: "Speed",
    before: "Months of revisions, missed launches",
    after: "Quarters become weeks, AI-accelerated",
  },
  {
    dim: "Impact",
    before: "Visuals people forget",
    after: "Experiences they never forget",
  },
  {
    dim: "Identity",
    before: "Generic, templated, soulless",
    after: "Culturally rich, unmistakably yours",
  },
  {
    dim: "Simplicity",
    before: "Juggling separate vendors",
    after: "One integrated studio, end to end",
  },
];

const afterVariant = {
  hidden: { opacity: 0, y: 20, x: 8 },
  visible: { opacity: 1, y: 0, x: 0, transition: { duration: 0.6 } },
};

export function BeforeAfter() {
  return (
    <section className="bg-bg-warm px-6 py-28 sm:py-36">
      <div className="mx-auto max-w-4xl">
        <p className="text-center font-display text-xs tracking-[0.3em] text-gold">
          THE DWARKA DIFFERENCE
        </p>
        <h2 className="mt-6 text-center font-display text-3xl text-ink sm:text-4xl">
          Before Dwarka. After Dwarka.
        </h2>

        <div className="mt-16 flex flex-col gap-6">
          <div className="hidden grid-cols-[1fr_2fr_2fr] gap-6 px-2 text-xs tracking-[0.2em] text-ink-soft sm:grid">
            <span />
            <span>BEFORE DWARKA</span>
            <span>AFTER DWARKA</span>
          </div>

          {ROWS.map((row) => (
            <motion.div
              key={row.dim}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: "-10%" }}
              variants={staggerContainer(0.15)}
              className="grid grid-cols-1 items-stretch gap-3 sm:grid-cols-[1fr_2fr_2fr] sm:gap-6"
            >
              <motion.span
                variants={fadeUpItem}
                className="font-display text-sm text-ink sm:self-center"
              >
                {row.dim}
              </motion.span>

              <motion.div
                variants={fadeUpItem}
                className="rounded-xl border border-line bg-bg px-5 py-4 text-sm text-ink-soft"
              >
                {row.before}
              </motion.div>

              <motion.div
                variants={afterVariant}
                className="rounded-xl border border-gold/40 bg-[linear-gradient(135deg,rgba(230,205,134,0.18),rgba(200,162,74,0.08))] px-5 py-4 text-sm text-ink"
              >
                {row.after}
              </motion.div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
