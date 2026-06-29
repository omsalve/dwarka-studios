import { Reveal } from "@/components/Reveal";

export function WhyDwarka() {
  return (
    <section className="relative overflow-hidden bg-bg-warm px-6 py-28 sm:py-36">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-px"
        style={{
          background:
            "linear-gradient(90deg, transparent, var(--gold-light), transparent)",
        }}
      />

      <div className="mx-auto max-w-3xl text-center">
        <Reveal>
          <p className="font-display text-xs tracking-[0.3em] text-gold">
            WHY &ldquo;DWARKA&rdquo;
          </p>
        </Reveal>

        <Reveal delay={0.08}>
          <p className="mt-8 text-lg leading-relaxed text-ink-soft sm:text-xl">
            Our name comes from Dwarka, the golden city of Lord Sri Krishna —
            a place that legend describes as one of the most magnificent
            ever conceived. It was a city of master craftsmanship and
            visionary design, built to bridge worlds and stand ahead of its
            time. That is the spirit we carry into everything we make: where
            heritage meets genius, where artistry meets engineering.
          </p>
        </Reveal>

        <Reveal delay={0.16}>
          <p className="mt-10 font-display text-xl leading-relaxed text-gold-deep sm:text-2xl">
            We are the bridge between the ancient past, the intelligent
            present, and the immersive virtual future.
          </p>
        </Reveal>
      </div>
    </section>
  );
}
