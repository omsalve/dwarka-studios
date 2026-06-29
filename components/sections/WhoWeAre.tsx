import { Reveal } from "@/components/Reveal";

export function WhoWeAre() {
  return (
    <section id="about" className="bg-bg px-6 py-28 sm:py-36">
      <div className="mx-auto max-w-3xl">
        <Reveal>
          <p className="font-display text-xs tracking-[0.3em] text-gold">
            WHO WE ARE
          </p>
        </Reveal>

        <Reveal delay={0.08}>
          <p className="mt-8 text-lg leading-relaxed text-ink-soft sm:text-xl">
            Dwarka Studios is a next-generation gaming and immersive
            technology studio where creativity, culture, and cutting-edge AI
            come together. We design and build interactive worlds,
            intelligent visuals, cinematic effects, and immersive realities
            for studios, brands, and innovators who refuse to settle for
            ordinary.
          </p>
        </Reveal>

        <Reveal delay={0.16}>
          <p className="mt-10 font-display text-2xl leading-snug text-ink sm:text-3xl">
            We don&apos;t see ourselves as a vendor. We see ourselves as
            world-builders — partners who take an idea and engineer it into
            an experience people remember.
          </p>
        </Reveal>
      </div>
    </section>
  );
}
