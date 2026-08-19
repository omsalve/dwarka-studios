import type { Metadata } from "next";
import { ContactForm } from "@/components/ContactForm";
import { Footer } from "@/components/Footer";
import { Nav } from "@/components/Nav";
import { Reveal } from "@/components/Reveal";

export const metadata: Metadata = {
  title: "Contact — Dwarka Studios",
  description:
    "Tell us about your world. Start a project with Dwarka Studios — interactive worlds, intelligent visuals, cinematic effects, and immersive realities.",
};

const labelBase =
  "mb-2 block text-xs font-medium uppercase tracking-[0.14em] text-ink-soft";

export default function ContactPage() {
  return (
    <>
      <Nav />

      <main className="flex-1">
        {/* Header — dark, cinematic, mirrors the hero's mood. */}
        <section
          className="relative overflow-hidden bg-ink pb-24 pt-40 sm:pb-28 sm:pt-48"
          data-navbar-bg="var(--ink)"
          data-navbar-fg="var(--parchment)"
        >
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 opacity-70"
            style={{
              background:
                "radial-gradient(60% 55% at 20% 0%, rgba(200,162,74,0.16) 0%, transparent 70%), radial-gradient(50% 50% at 90% 20%, rgba(31,182,201,0.10) 0%, transparent 72%)",
            }}
          />

          <div className="relative mx-auto max-w-6xl px-6">
            <Reveal>
              <p className="text-xs font-medium uppercase tracking-[0.3em] text-gold-light/80">
                Contact
              </p>
              <h1 className="mt-5 max-w-3xl font-display text-4xl leading-[1.1] text-parchment sm:text-5xl lg:text-6xl">
                Let&apos;s build your world.
              </h1>
              <p className="mt-6 max-w-xl text-base leading-relaxed text-parchment/70 sm:text-lg">
                Tell us what you&apos;re dreaming up — a game, a visual, a world
                worth remembering. We&apos;ll bring the ancient soul and the
                intelligent core.
              </p>
            </Reveal>
          </div>
        </section>

        {/* Body — warm parchment, split between details and the form. */}
        <section
          className="bg-bg-warm py-20 sm:py-28"
          data-navbar-bg="var(--bg-warm)"
          data-navbar-fg="var(--ink)"
        >
          <div className="mx-auto grid max-w-6xl gap-16 px-6 lg:grid-cols-[0.8fr_1.2fr] lg:gap-24">
            {/* Left — ways to reach us. */}
            <Reveal>
              <div className="flex flex-col gap-10">
                <div>
                  <h2 className="font-display text-2xl text-ink">
                    Start a conversation
                  </h2>
                  <p className="mt-3 max-w-sm text-sm leading-relaxed text-ink-soft">
                    Every immersive experience begins with a single idea. Share
                    yours and we&apos;ll take it from there.
                  </p>
                </div>

                <div>
                  <p className={labelBase}>Email</p>
                  <a
                    href="mailto:hello@dwarkastudios.com"
                    className="text-lg text-gold transition-colors hover:text-gold-deep"
                  >
                    hello@dwarkastudios.com
                  </a>
                </div>

                <div>
                  <p className={labelBase}>Follow</p>
                  <div className="flex gap-6 text-sm text-ink-soft">
                    <a className="transition-colors hover:text-ink" href="#">
                      Instagram
                    </a>
                    <a className="transition-colors hover:text-ink" href="#">
                      LinkedIn
                    </a>
                    <a className="transition-colors hover:text-ink" href="#">
                      X
                    </a>
                  </div>
                </div>

                <div className="mt-2 border-t border-line pt-8">
                  <p className="font-serif text-lg italic leading-relaxed text-ink-soft">
                    &ldquo;When we truly experience something, we never forget
                    it.&rdquo;
                  </p>
                </div>
              </div>
            </Reveal>

            {/* Right — the enquiry form, wired to the submitEnquiry action. */}
            <Reveal delay={0.1}>
              <ContactForm />
            </Reveal>
          </div>
        </section>
      </main>

      <Footer />
    </>
  );
}
