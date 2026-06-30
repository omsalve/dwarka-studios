import { CtaButton } from "@/components/CtaButton";
import { Reveal } from "@/components/Reveal";

export function ClosingBridge() {
  return (
    <section className="bg-bg px-6 py-28 text-center sm:py-36">
      <div className="mx-auto max-w-3xl">
        <Reveal>
          <p className="font-display text-2xl leading-relaxed text-ink sm:text-3xl">
            The past was built by master craftsmen. The future will be built
            by intelligent ones. Dwarka Studios is where they meet — ancient
            storytelling, modern intelligence, and immersive technology,
            engineered into experiences worth remembering.
          </p>
        </Reveal>

        <Reveal delay={0.12} className="mt-10">
          <CtaButton href="#contact">Let&apos;s build your world.</CtaButton>
        </Reveal>
      </div>
    </section>
  );
}
