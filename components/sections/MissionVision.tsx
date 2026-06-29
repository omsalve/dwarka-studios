import { Reveal } from "@/components/Reveal";

export function MissionVision() {
  return (
    <section className="bg-bg px-6 py-28 sm:py-36">
      <div className="mx-auto grid max-w-5xl gap-12 md:grid-cols-2 md:gap-16">
        <Reveal>
          <div>
            <p className="font-display text-xs tracking-[0.3em] text-gold">
              MISSION
            </p>
            <p className="mt-6 text-lg leading-relaxed text-ink-soft">
              To craft interactive and immersive experiences that are as
              meaningful as they are stunning — fusing cultural soul with
              intelligent technology, and making world-class creative work
              faster, smarter, and more accessible than ever before.
            </p>
          </div>
        </Reveal>

        <Reveal delay={0.1}>
          <div>
            <p className="font-display text-xs tracking-[0.3em] text-gold">
              VISION
            </p>
            <p className="mt-6 text-lg leading-relaxed text-ink-soft">
              A future where the richest stories of our heritage live on in
              the most advanced experiences of tomorrow — in games people
              lose themselves in, worlds they step inside, and visuals that
              move them. We&apos;re building toward a digital frontier that
              feels both deeply human and remarkably intelligent.
            </p>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
