"use client";

import { useEffect, useState } from "react";

/**
 * True while any in-page primary CTA ([data-page-cta]) is at (or near) the
 * viewport. The navbar CTA reads this to gracefully step aside so it never
 * competes with a CTA the user can already see and reach.
 *
 * A single IntersectionObserver — never a scroll listener. The rootMargin
 * does two things:
 *
 *   • top −72px  — trims the strip sitting *behind* the fixed navbar, so a
 *                  CTA scrolled up under the bar (no longer really visible)
 *                  stops counting.
 *   • bottom 14% — extends the trigger a little below the fold, so the navbar
 *                  CTA begins bowing out *just before* the page CTA rises into
 *                  full view rather than the instant they'd overlap.
 */
export function usePageCtaVisible(): boolean {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const targets = Array.from(
      document.querySelectorAll<HTMLElement>("[data-page-cta]")
    );
    if (targets.length === 0) return;

    const onScreen = new Set<Element>();

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) onScreen.add(entry.target);
          else onScreen.delete(entry.target);
        }
        setVisible(onScreen.size > 0);
      },
      { rootMargin: "-72px 0px 14% 0px", threshold: 0 }
    );

    for (const target of targets) observer.observe(target);
    return () => observer.disconnect();
  }, []);

  return visible;
}
