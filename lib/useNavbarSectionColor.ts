"use client";

import { useEffect } from "react";

/**
 * Fine-grained thresholds so the observer callback fires often enough to
 * track which section occupies the most of the viewport as the user
 * scrolls, without ever attaching a scroll listener.
 */
const THRESHOLD_STEPS = 24;
const THRESHOLDS = Array.from({ length: THRESHOLD_STEPS + 1 }, (_, i) => i / THRESHOLD_STEPS);

const MIN_VIEWPORT_OCCUPANCY = 0.05;

/**
 * Watches every element carrying `data-navbar-bg` / `data-navbar-fg` and
 * writes the winner's colors onto `--navbar-bg` / `--navbar-fg` on
 * <html>. The Nav component reads those variables in styles that already
 * have a `transition`, so the color change animates for free — this hook
 * only ever decides *which* section won, never how the color interpolates.
 *
 * "Winner" = whichever observed section currently covers the largest
 * portion of the viewport (entry.intersectionRect.height / innerHeight),
 * not the largest share of its own bounding box — that's what keeps a
 * short section from outranking a tall one it barely overlaps.
 */
export function useNavbarSectionColor() {
  useEffect(() => {
    const sections = Array.from(
      document.querySelectorAll<HTMLElement>("[data-navbar-bg]")
    );
    if (sections.length === 0) return;

    const root = document.documentElement;
    const occupancy = new Map<Element, number>();
    let activeEl: Element | null = null;

    function applyColors(el: HTMLElement) {
      const { navbarBg, navbarFg } = el.dataset;
      if (navbarBg) root.style.setProperty("--navbar-bg", navbarBg);
      if (navbarFg) root.style.setProperty("--navbar-fg", navbarFg);
    }

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const portion = entry.isIntersecting
            ? entry.intersectionRect.height / window.innerHeight
            : 0;
          occupancy.set(entry.target, portion);
        }

        let winner: Element | null = null;
        let winnerPortion = 0;
        for (const [el, portion] of occupancy) {
          if (portion > winnerPortion) {
            winnerPortion = portion;
            winner = el;
          }
        }

        if (winner && winner !== activeEl && winnerPortion > MIN_VIEWPORT_OCCUPANCY) {
          activeEl = winner;
          applyColors(winner as HTMLElement);
        }
      },
      { threshold: THRESHOLDS }
    );

    for (const section of sections) observer.observe(section);

    return () => observer.disconnect();
  }, []);
}
