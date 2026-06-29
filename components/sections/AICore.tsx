import { Reveal } from "@/components/Reveal";

export function AICore() {
  return (
    <section id="approach" className="bg-peacock-gradient px-6 py-28 text-center sm:py-36">
      <div className="mx-auto max-w-3xl">
        <Reveal>
          <p className="font-display text-xs tracking-[0.3em] text-gold-light">
            THE DWARKA ADVANTAGE
          </p>
        </Reveal>

        <Reveal delay={0.08}>
          <h2 className="mt-6 font-display text-3xl text-white sm:text-5xl">
            AI at the Core
          </h2>
        </Reveal>

        <Reveal delay={0.16}>
          <p className="mt-8 text-lg leading-relaxed text-white/85 sm:text-xl">
            At most studios, AI is a tool. At Dwarka Studios, it&apos;s a
            co-creator. We&apos;ve embedded AI into every stage of every
            service — concepting, production, iteration, and delivery — so
            our teams move faster, explore more, and ship smarter. The
            result for you: cinematic quality at a speed traditional
            pipelines can&apos;t match, without ever losing the human craft
            and cultural soul that make work memorable.
          </p>
        </Reveal>

        <Reveal delay={0.24}>
          <div className="mt-14 flex flex-col items-center">
            <span className="h-px w-16 bg-gold-light" />
            <p className="mt-8 font-display text-2xl text-white sm:text-3xl">
              Faster. Smarter. Without compromise.
            </p>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
