"use client";

import { useActionState, useEffect, useRef } from "react";

import { submitEnquiry } from "@/app/contact/actions";
import {
  HONEYPOT_FIELD,
  INITIAL_CONTACT_STATE,
  PROJECT_TYPES,
  RENDERED_AT_FIELD,
  type ContactField,
} from "@/lib/contact";

const fieldBase =
  "w-full rounded-xl border bg-white/60 px-4 py-3 text-sm text-ink placeholder:text-ink-soft/50 outline-none transition-all duration-300 focus:bg-white";
const fieldIdle =
  "border-line focus:border-gold focus:ring-2 focus:ring-gold/20";
const fieldInvalid =
  "border-[#b3402d]/60 focus:border-[#b3402d] focus:ring-2 focus:ring-[#b3402d]/20";
const labelBase =
  "mb-2 block text-xs font-medium uppercase tracking-[0.14em] text-ink-soft";

function fieldClass(hasError: boolean, extra = "") {
  return `${fieldBase} ${hasError ? fieldInvalid : fieldIdle} ${extra}`.trim();
}

/** Ties an input to its error node for screen readers. */
function describedBy(field: ContactField, hasError: boolean) {
  return hasError ? `${field}-error` : undefined;
}

function FieldError({ id, message }: { id: string; message?: string }) {
  if (!message) return null;

  return (
    <p id={id} className="mt-2 text-xs text-[#b3402d]">
      {message}
    </p>
  );
}

export function ContactForm() {
  const [state, formAction, pending] = useActionState(
    submitEnquiry,
    INITIAL_CONTACT_STATE,
  );

  const renderedAtRef = useRef<HTMLInputElement>(null);

  // Stamped on the client after mount, so server and client HTML match. Left
  // empty the timing gate simply passes, which keeps no-JS submissions working.
  useEffect(() => {
    if (renderedAtRef.current) {
      renderedAtRef.current.value = String(Date.now());
    }
  }, [state]);

  const errors = state.errors ?? {};
  const values = state.values ?? {};

  if (state.status === "success") {
    return (
      <div
        className="rounded-3xl border border-line bg-white/40 p-6 backdrop-blur-sm sm:p-10"
        role="status"
        aria-live="polite"
      >
        <div className="flex h-12 w-12 items-center justify-center rounded-full border border-gold/40 bg-gold/10">
          <svg
            aria-hidden="true"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="h-5 w-5 text-gold"
          >
            <path d="m4 12.5 5 5L20 6.5" />
          </svg>
        </div>

        <h3 className="mt-6 font-display text-2xl text-ink">
          Your message is on its way.
        </h3>
        <p className="mt-3 max-w-md text-sm leading-relaxed text-ink-soft">
          {state.message}
        </p>
        {state.autoReplied ? (
          <p className="mt-2 max-w-md text-sm leading-relaxed text-ink-soft">
            We&apos;ve sent a confirmation to your inbox in the meantime.
          </p>
        ) : null}
      </div>
    );
  }

  return (
    <form
      action={formAction}
      noValidate
      className="rounded-3xl border border-line bg-white/40 p-6 backdrop-blur-sm sm:p-10"
    >
      {/* Bot bait — hidden from people, irresistible to form-fillers. */}
      <div aria-hidden="true" className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
        <label htmlFor={HONEYPOT_FIELD}>Website</label>
        <input
          id={HONEYPOT_FIELD}
          name={HONEYPOT_FIELD}
          type="text"
          tabIndex={-1}
          autoComplete="off"
        />
      </div>

      <input ref={renderedAtRef} type="hidden" name={RENDERED_AT_FIELD} />

      <div className="grid gap-6 sm:grid-cols-2">
        <div>
          <label htmlFor="name" className={labelBase}>
            Name
          </label>
          <input
            id="name"
            name="name"
            type="text"
            required
            defaultValue={values.name ?? ""}
            placeholder="Your name"
            aria-invalid={Boolean(errors.name)}
            aria-describedby={describedBy("name", Boolean(errors.name))}
            className={fieldClass(Boolean(errors.name))}
          />
          <FieldError id="name-error" message={errors.name} />
        </div>

        <div>
          <label htmlFor="email" className={labelBase}>
            Email
          </label>
          <input
            id="email"
            name="email"
            type="email"
            required
            defaultValue={values.email ?? ""}
            placeholder="you@studio.com"
            aria-invalid={Boolean(errors.email)}
            aria-describedby={describedBy("email", Boolean(errors.email))}
            className={fieldClass(Boolean(errors.email))}
          />
          <FieldError id="email-error" message={errors.email} />
        </div>
      </div>

      <div className="mt-6">
        <label htmlFor="company" className={labelBase}>
          Company / Studio <span className="text-ink-soft/50">(optional)</span>
        </label>
        <input
          id="company"
          name="company"
          type="text"
          defaultValue={values.company ?? ""}
          placeholder="Where you're building from"
          aria-invalid={Boolean(errors.company)}
          aria-describedby={describedBy("company", Boolean(errors.company))}
          className={fieldClass(Boolean(errors.company))}
        />
        <FieldError id="company-error" message={errors.company} />
      </div>

      <div className="mt-6">
        <label htmlFor="projectType" className={labelBase}>
          What can we build?
        </label>
        <select
          id="projectType"
          name="projectType"
          defaultValue={values.projectType ?? ""}
          aria-invalid={Boolean(errors.projectType)}
          aria-describedby={describedBy(
            "projectType",
            Boolean(errors.projectType),
          )}
          className={fieldClass(Boolean(errors.projectType), "appearance-none")}
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
        <FieldError id="projectType-error" message={errors.projectType} />
      </div>

      <div className="mt-6">
        <label htmlFor="message" className={labelBase}>
          Tell us about it
        </label>
        <textarea
          id="message"
          name="message"
          rows={5}
          required
          defaultValue={values.message ?? ""}
          placeholder="The world you want to build…"
          aria-invalid={Boolean(errors.message)}
          aria-describedby={describedBy("message", Boolean(errors.message))}
          className={fieldClass(Boolean(errors.message), "resize-none")}
        />
        <FieldError id="message-error" message={errors.message} />
      </div>

      <button
        type="submit"
        disabled={pending}
        className="mt-8 inline-flex w-full items-center justify-center gap-2 whitespace-nowrap rounded-full border border-gold px-8 py-3.5 text-sm tracking-wide text-gold transition-all duration-300 hover:border-transparent hover:bg-peacock-gradient hover:text-white active:border-transparent active:bg-peacock-gradient active:text-white disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:border-gold disabled:hover:bg-transparent disabled:hover:text-gold sm:w-auto"
      >
        {pending ? (
          <>
            <svg
              aria-hidden="true"
              viewBox="0 0 24 24"
              fill="none"
              className="h-4 w-4 animate-spin"
            >
              <circle
                cx="12"
                cy="12"
                r="9"
                stroke="currentColor"
                strokeWidth="2.5"
                opacity="0.25"
              />
              <path
                d="M21 12a9 9 0 0 0-9-9"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
              />
            </svg>
            Sending…
          </>
        ) : (
          "Send enquiry"
        )}
      </button>

      {/* Form-level failures: validation summary, rate limit, transport errors. */}
      <p aria-live="polite" className="mt-4 text-xs text-ink-soft/70">
        {state.status === "error" && state.message ? (
          <span className="text-[#b3402d]">{state.message}</span>
        ) : (
          "We usually reply within two business days."
        )}
      </p>
    </form>
  );
}
