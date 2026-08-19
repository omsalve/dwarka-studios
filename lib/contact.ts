/**
 * Shared contract for the contact enquiry form.
 *
 * Both the client form and the Server Action import from here so the field
 * names, the project-type list, and the length limits can never drift apart.
 */

export const PROJECT_TYPES = [
  "Interactive worlds & games",
  "Intelligent visuals & AI",
  "Cinematic effects",
  "Immersive / XR experiences",
  "Something else",
] as const;

export type ProjectType = (typeof PROJECT_TYPES)[number];

export const CONTACT_FIELDS = [
  "name",
  "email",
  "company",
  "projectType",
  "message",
] as const;

export type ContactField = (typeof CONTACT_FIELDS)[number];

/** Name of the hidden field bots fill in and humans never see. */
export const HONEYPOT_FIELD = "website";

/** Name of the hidden field carrying the form's render timestamp. */
export const RENDERED_AT_FIELD = "renderedAt";

/**
 * A real person needs a few seconds to fill this in. Anything faster is a bot
 * replaying the form, so we drop it silently rather than mailing it on.
 */
export const MIN_FILL_MS = 3_000;

const LIMITS = {
  name: 100,
  email: 254, // RFC 5321 maximum
  company: 120,
  message: 5_000,
} as const;

/** Deliberately permissive — real addresses fail strict regexes all the time. */
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export type ContactValues = Record<ContactField, string>;

export type ContactErrors = Partial<Record<ContactField, string>>;

export type ContactState = {
  status: "idle" | "success" | "error";
  /** Form-level message: the success note, or the reason we couldn't send. */
  message?: string;
  errors?: ContactErrors;
  /** Echoed back so the fields survive a failed submit. */
  values?: Partial<ContactValues>;
  /**
   * Whether the courtesy confirmation actually reached the sender. The success
   * card only promises an email when this is true — the enquiry itself can
   * land fine while the auto-reply bounces.
   */
  autoReplied?: boolean;
};

export const INITIAL_CONTACT_STATE: ContactState = { status: "idle" };

/** Collapse whitespace so " \n\n " doesn't pass an `isEmpty` check. */
function clean(value: FormDataEntryValue | null): string {
  return typeof value === "string" ? value.trim() : "";
}

export function readContactValues(formData: FormData): ContactValues {
  return {
    name: clean(formData.get("name")),
    email: clean(formData.get("email")),
    company: clean(formData.get("company")),
    projectType: clean(formData.get("projectType")),
    message: clean(formData.get("message")),
  };
}

export function validateContact(values: ContactValues): ContactErrors {
  const errors: ContactErrors = {};

  if (!values.name) {
    errors.name = "Please tell us your name.";
  } else if (values.name.length > LIMITS.name) {
    errors.name = `Please keep this under ${LIMITS.name} characters.`;
  }

  if (!values.email) {
    errors.email = "We need an email to reply to.";
  } else if (values.email.length > LIMITS.email) {
    errors.email = "That email address is too long.";
  } else if (!EMAIL_PATTERN.test(values.email)) {
    errors.email = "That doesn't look like a valid email address.";
  }

  if (values.company.length > LIMITS.company) {
    errors.company = `Please keep this under ${LIMITS.company} characters.`;
  }

  // Optional, but if it is set it has to be one we actually offer.
  if (
    values.projectType &&
    !PROJECT_TYPES.includes(values.projectType as ProjectType)
  ) {
    errors.projectType = "Please choose one of the listed project types.";
  }

  if (!values.message) {
    errors.message = "Tell us a little about the project.";
  } else if (values.message.length < 10) {
    errors.message = "A sentence or two would help us understand the scope.";
  } else if (values.message.length > LIMITS.message) {
    errors.message = `Please keep this under ${LIMITS.message} characters.`;
  }

  return errors;
}
