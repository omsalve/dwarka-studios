import { CtaButton } from "@/components/CtaButton";
import { DeferredBook } from "@/components/scenes/DeferredBook";
import { Reveal } from "@/components/Reveal";

export function FoundersNote() {
  return (
    /* Full-bleed warm ground, with the width limit moved to an inner
       wrapper. It used to be `bg-bg-warm … max-w-7xl mx-auto`, which painted
       the warm colour only across the centred column and left white body
       gutters either side. That was invisible while this section sat at the
       very bottom of the page; it is not now that the About → note ink wash
       floods #faf7f1 and clears onto it, because the gutters would clear to
       white instead. Full-bleed also makes the seam into Services — which is
       the same warm colour — disappear entirely. */
    <section
      className="relative z-10 bg-bg-warm py-20 sm:py-28"
      data-navbar-bg="var(--bg-warm)"
      data-navbar-fg="var(--ink)"
    >
      <div className="mx-auto max-w-7xl">
        {/* Renders the letter as type on phones and as the 3D book everywhere
            else — and carries the accessible copy in both cases, so the
            hand-maintained sr-only duplicate that used to sit here is gone. */}
        <DeferredBook />
      </div>

      <div className="mx-auto max-w-3xl px-6">
        <Reveal className="mt-4 text-center sm:mt-8">
          <p className="font-display text-xl text-ink sm:text-2xl">
            Let&apos;s build something worth remembering.
          </p>
          <div className="mt-8 inline-block">
            <CtaButton href="/contact" pageCta>Start a Project</CtaButton>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
