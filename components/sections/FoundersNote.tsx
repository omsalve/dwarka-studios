import { CtaButton } from "@/components/CtaButton";
import { Reveal } from "@/components/Reveal";

export function FoundersNote() {
  return (
    <section className="bg-bg-warm px-6 py-28 sm:py-36">
      <div className="mx-auto max-w-3xl">
        <Reveal>
          <p className="font-display text-xs tracking-[0.3em] text-gold">
            FOUNDER&apos;S NOTE
          </p>
        </Reveal>

        <Reveal delay={0.08}>
          <p className="mt-8 text-lg leading-relaxed text-ink-soft sm:text-xl">
            Since childhood, I&apos;ve been deeply passionate about gaming
            and animation. I&apos;ve always believed that when we simply see
            something, we may remember it for a while — but when we truly
            experience something, we never forget it. That&apos;s where this
            journey began: I wanted to give everyone that kind of
            unforgettable experience, and to weave into it the history,
            culture, and heritage of our country. Dwarka Studios was born
            from that belief — that the stories and craftsmanship of our
            heritage deserve to live in the most advanced experiences of the
            future, and that intelligent technology, used with care, can
            make that possible faster and better than ever before. This is
            just the beginning, and I&apos;m glad you&apos;re here for it.
          </p>
        </Reveal>

        <Reveal delay={0.16}>
          <p className="mt-8 font-display text-base text-ink">
            — Srikaran Adapa, Founder, Dwarka Studios
          </p>
        </Reveal>

        <Reveal delay={0.24} className="mt-14 text-center">
          <p className="font-display text-xl text-ink sm:text-2xl">
            Let&apos;s build something worth remembering.
          </p>
          <div className="mt-8 inline-block">
            <CtaButton href="#contact">Start a Project</CtaButton>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
