"use client";

import { useState } from "react";
import Image from "next/image";
import { motion, useMotionValueEvent, useScroll } from "motion/react";
import { NavCta } from "@/components/NavCta";
import { NAV_LINKS } from "@/lib/nav-links";
import { useNavbarSectionColor } from "@/lib/useNavbarSectionColor";
import { usePageCtaVisible } from "@/lib/usePageCtaVisible";
import primaryLogo from "@/public/images/PrimaryLogo_Sandalwood.png";

const NAVBAR_EASE = "cubic-bezier(0.4, 0, 0.2, 1)";
// Everything the bar's chrome transitions on. Colors/blur/shadow all glide on
// the same curve so a section change reads as one continuous shift, never a
// stack of separate fades.
const CHROME_TRANSITION = [
  `background-color 600ms ${NAVBAR_EASE}`,
  `border-color 500ms ${NAVBAR_EASE}`,
  `box-shadow 500ms ${NAVBAR_EASE}`,
  `opacity 500ms ${NAVBAR_EASE}`,
].join(", ");

const mix = (token: string, pct: number) =>
  `color-mix(in srgb, var(${token}) ${pct}%, transparent)`;

export function Nav() {
  const [scrolled, setScrolled] = useState(false);
  const { scrollY } = useScroll();

  useMotionValueEvent(scrollY, "change", (latest) => {
    setScrolled(latest > 40);
  });

  // Keeps --navbar-bg / --navbar-fg in sync with whichever section is
  // currently underneath the nav — the actual color animation happens via
  // the CSS transitions below, not in JS.
  useNavbarSectionColor();

  // Whenever an in-page "Start a Project" is on screen, the navbar CTA
  // dissolves to give it the focus.
  const pageCtaVisible = usePageCtaVisible();

  return (
    <motion.header
      className="fixed inset-x-0 top-0 z-40"
      style={{
        color: "var(--navbar-fg)",
        transition: `color 500ms ${NAVBAR_EASE}`,
      }}
    >
      {/* Adaptive glass — separated from the content so the blur only ever
          samples the scene *behind* the bar, never its own text. This is the
          separation layer once you've scrolled past the hero: a faint tint + a
          real backdrop blur + a hairline edge, not a solid panel. */}
      {/* The blur is declared once and never animated. Transitioning
          `backdrop-filter` forces the compositor to re-sample and re-blur
          everything behind the bar on every frame of the transition — and the
          bar spans the full viewport width over whatever is scrolling beneath
          it. Fading the layer's *opacity* instead gives the identical read at
          a fraction of the cost, and `saturate` is dropped because it doubles
          the backdrop pass for an effect nothing on this palette shows.

          `willChange: opacity` keeps the blurred backdrop on its own layer so
          the fade never triggers a re-blur at all. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundColor: mix("--navbar-bg", 76),
          backdropFilter: "blur(16px)",
          WebkitBackdropFilter: "blur(16px)",
          borderBottom: `1px solid ${mix("--navbar-fg", 12)}`,
          boxShadow: `0 18px 40px -28px rgba(0,0,0,0.55), inset 0 1px 0 0 ${mix("--navbar-fg", 9)}`,
          opacity: scrolled ? 1 : 0,
          willChange: "opacity",
          transition: CHROME_TRANSITION,
        }}
      />

      {/* Soft top-anchored scrim — the elegant alternative to a solid bar. A
          gentle gradient falloff lifts the logo and links off a busy scene at
          the top of the page without ever reading as a UI panel. It yields to
          the glass once you scroll. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-[165%]"
        style={{
          background: `linear-gradient(to bottom, ${mix("--navbar-bg", 46)}, transparent)`,
          opacity: scrolled ? 0 : 1,
          transition: `opacity 600ms ${NAVBAR_EASE}, background 500ms ${NAVBAR_EASE}`,
        }}
      />

      <div className="relative mx-auto flex max-w-6xl items-center justify-between px-4 py-4 sm:px-6 sm:py-5">
        <a href="#top" className="flex shrink-0 items-center">
          <Image
            src={primaryLogo}
            alt="Dwarka Studios"
            className="h-8 w-auto sm:h-9"
            style={{ filter: "drop-shadow(0 1px 6px rgba(0,0,0,0.18))" }}
            preload
          />
        </a>

        <nav className="hidden items-center gap-9 md:flex">
          {NAV_LINKS.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="group relative text-[0.8125rem] font-medium tracking-wide opacity-70 transition-opacity duration-300 hover:opacity-100"
              style={{
                color: "var(--navbar-fg)",
                transition: `color 500ms ${NAVBAR_EASE}, opacity 300ms ${NAVBAR_EASE}`,
              }}
            >
              {link.label}
              {/* Hairline underline that wipes out from the centre on hover —
                  inherits the adaptive foreground color, so it stays legible on
                  every section. */}
              <span
                aria-hidden
                className="pointer-events-none absolute -bottom-1.5 left-0 h-px w-full origin-center scale-x-0 bg-current opacity-60 transition-transform duration-300 ease-out group-hover:scale-x-100"
              />
            </a>
          ))}
        </nav>

        <NavCta
          href="/contact"
          hidden={pageCtaVisible}
          className="px-4 py-2 text-xs sm:px-5 sm:text-sm"
        >
          Start a Project
        </NavCta>
      </div>
    </motion.header>
  );
}
