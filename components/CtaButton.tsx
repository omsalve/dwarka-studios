export function CtaButton({
  href,
  children,
  className,
}: {
  href: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <a
      href={href}
      className={`inline-block whitespace-nowrap rounded-full border border-gold px-8 py-3 text-sm tracking-wide text-gold transition-all duration-300 hover:border-transparent hover:bg-peacock-gradient hover:text-white active:bg-peacock-gradient active:text-white active:border-transparent ${
        className ?? ""
      }`}
    >
      {children}
    </a>
  );
}
