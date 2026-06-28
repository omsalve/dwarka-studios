"use client";

import { useState } from "react";
import { motion, useMotionValueEvent, useScroll } from "motion/react";
import { CtaButton } from "@/components/CtaButton";
import { FeatherMark } from "@/components/FeatherMark";
import { NAV_LINKS } from "@/lib/nav-links";

export function Nav() {
  const [scrolled, setScrolled] = useState(false);
  const { scrollY } = useScroll();

  useMotionValueEvent(scrollY, "change", (latest) => {
    setScrolled(latest > 40);
  });

  return (
    <motion.header
      className={`fixed top-0 left-0 right-0 z-40 border-b transition-colors duration-500 ${
        scrolled
          ? "border-line bg-bg/85 backdrop-blur-md"
          : "border-transparent bg-transparent"
      }`}
    >
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4 sm:px-6 sm:py-5">
        <a
          href="#top"
          className="flex items-center gap-2 whitespace-nowrap font-display text-xs tracking-[0.15em] text-ink sm:text-sm sm:tracking-[0.25em]"
        >
          <FeatherMark className="h-4 w-4 shrink-0 text-gold" />
          DWARKA STUDIOS
        </a>

        <nav className="hidden items-center gap-9 md:flex">
          {NAV_LINKS.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="text-sm text-ink-soft transition-colors hover:text-ink"
            >
              {link.label}
            </a>
          ))}
        </nav>

        <CtaButton href="#contact" className="px-4 py-2 text-xs sm:px-5 sm:text-sm">
          Start a Project
        </CtaButton>
      </div>
    </motion.header>
  );
}
