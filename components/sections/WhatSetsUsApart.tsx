"use client";

import { motion } from "motion/react";
import { fadeUpItem, staggerContainer } from "@/lib/motion";

const ITEMS = [
  {
    n: "01",
    title: "AI as a co-creator, not just a tool.",
    body: "We've embedded artificial intelligence into every stage of our process — concepting, production, iteration, and delivery. It lets our teams explore more ideas, move faster, and deliver cinematic quality on timelines traditional studios can't match. Technology accelerates us; it never replaces the craft.",
  },
  {
    n: "02",
    title: "Culture as our compass.",
    body: "Anyone can render a frame. We bring meaning, narrative, and identity to ours. Cultural storytelling is woven into our DNA — and it's what makes our work resonate, not just impress.",
  },
  {
    n: "03",
    title: "Precision in every pixel.",
    body: "From the smallest interaction to the largest world, we care about design at every scale. Detail isn't an afterthought — it's the difference between something that looks good and something that feels alive.",
  },
  {
    n: "04",
    title: "Built to scale.",
    body: "Our work is engineered to grow — across platforms, audiences, and ambitions. We build experiences that hold up under real-world demand and evolve with you.",
  },
];

export function WhatSetsUsApart() {
  return (
    <section className="bg-bg-warm px-6 py-28 sm:py-36">
      <div className="mx-auto max-w-5xl">
        <motion.p
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-10%" }}
          variants={fadeUpItem}
          className="font-display text-xs tracking-[0.3em] text-gold"
        >
          WHAT SETS US APART
        </motion.p>

        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-10%" }}
          variants={staggerContainer(0.1)}
          className="mt-12 grid gap-x-12 gap-y-14 sm:grid-cols-2"
        >
          {ITEMS.map((item) => (
            <motion.div key={item.n} variants={fadeUpItem}>
              <span className="font-display text-2xl text-gold">
                {item.n}
              </span>
              <h3 className="mt-3 font-display text-xl text-ink sm:text-2xl">
                {item.title}
              </h3>
              <p className="mt-4 text-base leading-relaxed text-ink-soft">
                {item.body}
              </p>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
