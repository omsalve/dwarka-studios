import { CtaButton } from "@/components/CtaButton";
import { DeferredBook } from "@/components/scenes/DeferredBook";
import { Reveal } from "@/components/Reveal";

export function FoundersNote() {
  return (
    <section
      className="bg-bg-warm py-20 sm:py-28 max-w-7xl mx-auto relative z-10"
      data-navbar-bg="var(--bg-warm)"
      data-navbar-fg="var(--ink)"
    >
      {/* Renders the letter as type on phones and as the 3D book everywhere
          else — and carries the accessible copy in both cases, so the
          hand-maintained sr-only duplicate that used to sit here is gone. */}
      <DeferredBook />

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
