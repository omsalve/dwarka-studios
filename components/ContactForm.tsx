"use client";

const fieldBase =
  "w-full rounded-xl border border-line bg-white/60 px-4 py-3 text-sm text-ink placeholder:text-ink-soft/50 outline-none transition-all duration-300 focus:border-gold focus:bg-white focus:ring-2 focus:ring-gold/20";
const labelBase =
  "mb-2 block text-xs font-medium uppercase tracking-[0.14em] text-ink-soft";

const PROJECT_TYPES = [
  "Interactive worlds & games",
  "Intelligent visuals & AI",
  "Cinematic effects",
  "Immersive / XR experiences",
  "Something else",
];

export function ContactForm() {
  return (
    <form
      // Non-functional for now — wiring comes later.
      onSubmit={(event) => event.preventDefault()}
      className="rounded-3xl border border-line bg-white/40 p-6 backdrop-blur-sm sm:p-10"
    >
      <div className="grid gap-6 sm:grid-cols-2">
        <div>
          <label htmlFor="name" className={labelBase}>
            Name
          </label>
          <input
            id="name"
            name="name"
            type="text"
            placeholder="Your name"
            className={fieldBase}
          />
        </div>

        <div>
          <label htmlFor="email" className={labelBase}>
            Email
          </label>
          <input
            id="email"
            name="email"
            type="email"
            placeholder="you@studio.com"
            className={fieldBase}
          />
        </div>
      </div>

      <div className="mt-6">
        <label htmlFor="company" className={labelBase}>
          Company / Studio{" "}
          <span className="text-ink-soft/50">(optional)</span>
        </label>
        <input
          id="company"
          name="company"
          type="text"
          placeholder="Where you're building from"
          className={fieldBase}
        />
      </div>

      <div className="mt-6">
        <label htmlFor="projectType" className={labelBase}>
          What can we build?
        </label>
        <select
          id="projectType"
          name="projectType"
          defaultValue=""
          className={`${fieldBase} appearance-none`}
        >
          <option value="" disabled>
            Select a project type
          </option>
          {PROJECT_TYPES.map((type) => (
            <option key={type} value={type}>
              {type}
            </option>
          ))}
        </select>
      </div>

      <div className="mt-6">
        <label htmlFor="message" className={labelBase}>
          Tell us about it
        </label>
        <textarea
          id="message"
          name="message"
          rows={5}
          placeholder="The world you want to build…"
          className={`${fieldBase} resize-none`}
        />
      </div>

      <button
        type="submit"
        className="mt-8 inline-block w-full whitespace-nowrap rounded-full border border-gold px-8 py-3.5 text-sm tracking-wide text-gold transition-all duration-300 hover:border-transparent hover:bg-peacock-gradient hover:text-white active:border-transparent active:bg-peacock-gradient active:text-white sm:w-auto"
      >
        Send enquiry
      </button>

      <p className="mt-4 text-xs text-ink-soft/70">
        We usually reply within two business days.
      </p>
    </form>
  );
}
