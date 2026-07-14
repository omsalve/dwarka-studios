// Shared pill styling for every CTA on the site. `NavCta` reuses this exact
// shell so the navbar button stays identical in identity to the in-page ones —
// the only difference is the navbar copy layers a dissolve on top. The color
// hover/active states live here; motion-driven transforms (opacity, blur,
// scale) are intentionally left off so a wrapping motion component can own them
// without fighting a CSS `transition-all`.
export const CTA_SHELL =
  "inline-block whitespace-nowrap rounded-full border border-gold px-8 py-3 text-sm tracking-wide text-gold hover:border-transparent hover:bg-peacock-gradient hover:text-white active:bg-peacock-gradient active:text-white active:border-transparent";

export function CtaButton({
  href,
  children,
  className,
  pageCta = false,
}: {
  href: string;
  children: React.ReactNode;
  className?: string;
  /** Marks this as an in-page primary CTA so the navbar CTA can step aside
   *  while it's on screen. See lib/usePageCtaVisible.ts. */
  pageCta?: boolean;
}) {
  return (
    <a
      href={href}
      data-page-cta={pageCta ? "" : undefined}
      className={`${CTA_SHELL} transition-all duration-300 ${className ?? ""}`}
    >
      {children}
    </a>
  );
}
