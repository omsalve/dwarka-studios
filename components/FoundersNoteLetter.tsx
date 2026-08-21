import { Reveal } from "@/components/Reveal";
import {
  FOUNDER_PARAGRAPHS,
  FOUNDER_ROLE,
  LETTER_KICKER,
  LETTER_TITLE_LEAD,
  LETTER_TITLE_TAIL,
  SIGNATURE,
} from "@/components/foundersNote/letter";

/* -----------------------------------------------------------------------
   FoundersNoteLetter — the letter as type, not as geometry
   ─────────────────────────────────────────────────────────────────────
   The 3D book is a second WebGL context, five procedurally-baked canvas
   textures (the longest single main-thread task on the page), a GSAP scroll
   pin and a per-frame shadow pass. On a phone that is too much, and the
   obvious lever — dropping the texture density — attacks the one thing the
   section exists for: the letter has to be *readable*.

   So phones get this instead. It is not a stripped-down book; it is the same
   letter set properly, and it borrows the book's own lockup so it reads as
   the same object rendered a different way — the kicker, the Cinzel/Playfair
   title pair, the rule, the signature.

   Everything here is deliberately cheap: flat gradients, a static border and
   one static shadow. No filters, no blend modes, no transforms beyond the
   entrance fade — the same properties this pass spent its time removing from
   the hero. It is also the *server-rendered* default (see DeferredBook), so
   the letter is real text in the HTML on every device, which the 3D version
   could only ever approximate with an sr-only mirror.
   ----------------------------------------------------------------------- */

export function FoundersNoteLetter({ plain = false }: { plain?: boolean } = {}) {
  const card = (
    <article
          className="relative mx-auto max-w-[46rem] overflow-hidden rounded-[20px] border border-gold/25 bg-[linear-gradient(168deg,#fffdf8_0%,var(--parchment)_58%,#f1e9d8_100%)] px-6 py-10 shadow-[0_1px_0_rgba(255,255,255,0.8),0_26px_50px_-30px_rgba(22,20,15,0.35)] sm:px-12 sm:py-14"
          aria-labelledby="founders-note-title"
        >
          {/* Hairline inner highlight — the same "machined edge" the service
              cards use, so the card belongs to the same family. */}
          <span
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 rounded-[20px] shadow-[inset_0_1px_0_rgba(255,255,255,0.9),inset_0_0_0_1px_rgba(255,255,255,0.35)]"
          />

          <header className="relative text-center">
            <p className="font-display text-[0.625rem] uppercase tracking-[0.32em] text-gold-deep sm:text-xs">
              {LETTER_KICKER}
            </p>
            {/* The visible lockup splits the title across two typefaces, which
                reads correctly by eye but not aloud — the label puts it back
                together for assistive tech. */}
            <h2 id="founders-note-title" aria-label="Founder's Note" className="mt-3">
              <span className="block font-display text-[clamp(1.75rem,7vw,2.5rem)] uppercase leading-none tracking-[0.06em] text-parchment-ink">
                {LETTER_TITLE_LEAD}
              </span>
              <span className="mt-1 block font-serif text-[clamp(1.25rem,5vw,1.75rem)] italic leading-none text-gold-deep">
                {LETTER_TITLE_TAIL}
              </span>
            </h2>

            {/* Rule with a centred lozenge — mirrors the foil divider under
                the title on the book's right page. */}
            <div aria-hidden="true" className="mt-6 flex items-center justify-center gap-3">
              <span className="h-px w-14 bg-[linear-gradient(90deg,transparent,var(--gold))]" />
              <span className="h-1.5 w-1.5 rotate-45 bg-gold" />
              <span className="h-px w-14 bg-[linear-gradient(90deg,var(--gold),transparent)]" />
            </div>
          </header>

          <div className="relative mt-8 space-y-5 sm:mt-10 sm:space-y-6">
            {FOUNDER_PARAGRAPHS.map((paragraph) => (
              <p
                key={paragraph.slice(0, 32)}
                className="font-serif text-[clamp(1rem,4.1vw,1.125rem)] leading-[1.85] text-parchment-ink/90"
              >
                {paragraph}
              </p>
            ))}
          </div>

          <footer className="relative mt-10 text-center sm:mt-12">
            <span
              aria-hidden="true"
              className="mx-auto mb-5 block h-px w-24 bg-[linear-gradient(90deg,transparent,rgba(160,124,44,0.55),transparent)]"
            />
            {/* A scrawl over a typeset caption reads as a signature over a
                credit only when the scrawl is genuinely handwritten. There is
                no hand in this font stack, so set in real type both times it
                just reads as the name printed twice — in both versions the
                signature IS the attribution, and carries the accessible name
                rather than being hidden from it. */}
            <p className="font-serif text-[clamp(1.6rem,6.5vw,2.125rem)] italic leading-none text-gold-deep">
              {SIGNATURE}
            </p>
            <p className="mt-3 font-display text-[0.625rem] uppercase tracking-[0.2em] text-ink-soft sm:text-xs">
              {FOUNDER_ROLE}
            </p>
          </footer>
    </article>
  );

  // `plain` is the accessibility mirror the 3D book needs: identical markup
  // and identical words, but no entrance animation and no card chrome, since
  // it is rendered inside an sr-only wrapper where an IntersectionObserver and
  // a motion component would be doing work nobody can see.
  if (plain) return card;

  return (
    <div className="px-6 py-10 sm:py-14">
      <Reveal>{card}</Reveal>
    </div>
  );
}

export default FoundersNoteLetter;
