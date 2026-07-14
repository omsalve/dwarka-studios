"use client";

import { useRef } from "react";
import { CtaButton } from "@/components/CtaButton";
import { Reveal } from "@/components/Reveal";
import { ScrollTextReveal } from "@/components/ScrollTextReveal";

export function ClosingBridge() {
  const sectionRef = useRef<HTMLElement>(null);

  return (
    <section
      ref={sectionRef}
      className="bg-bg px-6 py-28 text-center sm:py-36"
      data-navbar-bg="var(--bg)"
      data-navbar-fg="var(--ink)"
    >
      <div className="mx-auto max-w-3xl">
        <ScrollTextReveal
          as="p"
          className="font-display text-2xl leading-relaxed text-ink sm:text-3xl"
          text="The past was built by master craftsmen. The future will be built by intelligent ones. Dwarka Studios is where they meet — ancient storytelling, modern intelligence, and immersive technology, engineered into experiences worth remembering."
          scrollTarget={sectionRef}
        />

        <Reveal delay={0.12} className="mt-10">
          <CtaButton href="/contact" pageCta>Let&apos;s build your world.</CtaButton>
        </Reveal>
      </div>
    </section>
  );
}
