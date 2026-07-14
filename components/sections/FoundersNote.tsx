import { CtaButton } from "@/components/CtaButton";
import { FoundersNoteBook } from "@/components/FoundersNoteBook";
import { Reveal } from "@/components/Reveal";

export function FoundersNote() {
  return (
    <section
      className="bg-bg-warm py-20 sm:py-28 max-w-7xl mx-auto relative z-10"
      data-navbar-bg="var(--bg-warm)"
      data-navbar-fg="var(--ink)"
    >
      <FoundersNoteBook />

      {/* The letter is painted onto the book's 3D pages for the visual
          experience; this mirrors it as real text for screen readers and
          crawlers, which can't read a WebGL canvas. */}
      <div className="sr-only">
        <h2>Founder&apos;s Note</h2>
        <p>
          Since childhood, I&apos;ve been deeply passionate about gaming and
          animation. I&apos;ve always believed that when we simply see
          something, we may remember it for a while — but when we truly
          experience something, we never forget it. That&apos;s where this
          journey began: I wanted to give everyone that kind of unforgettable
          experience, and to weave into it the history, culture, and
          heritage of our country. Dwarka Studios was born from that belief
          — that the stories and craftsmanship of our heritage deserve to
          live in the most advanced experiences of the future, and that
          intelligent technology, used with care, can make that possible
          faster and better than ever before. This is just the beginning,
          and I&apos;m glad you&apos;re here for it.
        </p>
        <p>— Srikaran Adapa, Founder, Dwarka Studios</p>
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
