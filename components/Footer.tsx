import Image from "next/image";
import { NAV_LINKS } from "@/lib/nav-links";
import wordmark from "@/public/images/Wordmark_Realistic_trimmed.png";

export function Footer() {
  return (
    <footer
      id="contact"
      className="border-t border-line bg-bg-warm"
      data-navbar-bg="var(--bg-warm)"
      data-navbar-fg="var(--ink)"
    >
      <div className="mx-auto max-w-6xl px-6 py-16">
        <div className="flex flex-col gap-12 md:flex-row md:items-start md:justify-between">
          <div>
            <Image src={wordmark} alt="Dwarka Studios" className="h-8 w-auto" />
            <p className="mt-4 max-w-xs text-sm leading-relaxed text-ink-soft">
              Ancient soul. Intelligent core. Immersive future.
            </p>
          </div>

          <nav className="flex flex-wrap gap-6 text-sm">
            {NAV_LINKS.map((link) => (
              <a
                key={link.href}
                href={link.href}
                className="text-ink-soft transition-colors hover:text-ink"
              >
                {link.label}
              </a>
            ))}
          </nav>

          <div className="text-sm">
            <p className="text-ink-soft">Let&apos;s build your world.</p>
            <a
              href="mailto:hello@dwarkastudios.com"
              className="mt-2 inline-block text-gold transition-colors hover:text-gold-deep"
            >
              hello@dwarkastudios.com
            </a>
            <div className="mt-6 flex gap-4 text-ink-soft">
              <span>Instagram</span>
              <span>LinkedIn</span>
              <span>X</span>
            </div>
          </div>
        </div>

        <div className="mt-14 border-t border-line pt-6 text-xs text-ink-soft/70">
          © {new Date().getFullYear()} Dwarka Studios. All rights reserved.
        </div>
      </div>
    </footer>
  );
}
