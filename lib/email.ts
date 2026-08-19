import "server-only";

import { Resend } from "resend";

import type { ContactValues } from "@/lib/contact";

/**
 * Email transport for the site.
 *
 * Everything funnels through `sendMail`, so swapping Resend for SMTP later
 * means rewriting one function rather than hunting through the app.
 */

type MailMessage = {
  to: string;
  subject: string;
  html: string;
  text: string;
  /** Where a plain "Reply" should go, when that isn't the From address. */
  replyTo?: string;
};

export type MailResult =
  | { ok: true; id: string | null }
  | { ok: false; error: string };

/** Read at call time, not module load, so a missing key fails per-send. */
function config() {
  return {
    apiKey: process.env.RESEND_API_KEY,
    from: process.env.CONTACT_FROM_EMAIL,
    to: process.env.CONTACT_TO_EMAIL,
  };
}

let client: Resend | null = null;

function getClient(apiKey: string): Resend {
  // Reused across invocations on a warm serverless instance.
  if (!client) client = new Resend(apiKey);
  return client;
}

/** Where enquiry notifications land. */
export function notificationRecipient(): string | undefined {
  return config().to;
}

export function isEmailConfigured(): boolean {
  const { apiKey, from, to } = config();
  return Boolean(apiKey && from && to);
}

async function sendMail(message: MailMessage): Promise<MailResult> {
  const { apiKey, from } = config();

  if (!apiKey || !from) {
    return {
      ok: false,
      error: "Email is not configured (RESEND_API_KEY / CONTACT_FROM_EMAIL).",
    };
  }

  try {
    const { data, error } = await getClient(apiKey).emails.send({
      from,
      to: message.to,
      subject: message.subject,
      html: message.html,
      text: message.text,
      replyTo: message.replyTo,
    });

    if (error) {
      return { ok: false, error: `${error.name}: ${error.message}` };
    }

    return { ok: true, id: data?.id ?? null };
  } catch (cause) {
    // Network failure, DNS, timeout — anything the SDK throws rather than returns.
    return {
      ok: false,
      error: cause instanceof Error ? cause.message : "Unknown transport error",
    };
  }
}

/* -------------------------------------------------------------------------- */
/* Templates                                                                  */
/* -------------------------------------------------------------------------- */

const GOLD = "#c8a24a";
const INK = "#16140f";
const INK_SOFT = "#5c574c";
const PARCHMENT = "#f6f1e6";
const LINE = "#ece6da";

/**
 * Enquiry text is untrusted and goes straight into an HTML email — escape it.
 */
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Preserve the sender's paragraph breaks without letting markup through. */
function escapeMultiline(value: string): string {
  return escapeHtml(value).replace(/\r?\n/g, "<br />");
}

/** Shared shell: a centred card on a parchment ground, inline styles only. */
function layout(heading: string, body: string): string {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(heading)}</title>
  </head>
  <body style="margin:0;padding:0;background:${PARCHMENT};">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${PARCHMENT};padding:32px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;background:#ffffff;border:1px solid ${LINE};border-radius:16px;overflow:hidden;">
            <tr>
              <td style="background:${INK};padding:28px 32px;">
                <p style="margin:0;font-family:Georgia,serif;font-size:17px;letter-spacing:0.14em;text-transform:uppercase;color:${GOLD};">
                  Dwarka Studios
                </p>
              </td>
            </tr>
            <tr>
              <td style="padding:32px;font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Helvetica,Arial,sans-serif;">
                <h1 style="margin:0 0 20px;font-family:Georgia,serif;font-size:22px;line-height:1.3;font-weight:400;color:${INK};">
                  ${escapeHtml(heading)}
                </h1>
                ${body}
              </td>
            </tr>
          </table>
          <p style="max-width:560px;margin:16px auto 0;font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Helvetica,Arial,sans-serif;font-size:11px;color:${INK_SOFT};">
            Dwarka Studios — interactive worlds, intelligent visuals, cinematic effects.
          </p>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

function detailRow(label: string, value: string): string {
  return `<tr>
    <td style="padding:10px 0;border-bottom:1px solid ${LINE};font-size:11px;letter-spacing:0.14em;text-transform:uppercase;color:${INK_SOFT};width:34%;vertical-align:top;">
      ${escapeHtml(label)}
    </td>
    <td style="padding:10px 0;border-bottom:1px solid ${LINE};font-size:14px;color:${INK};vertical-align:top;">
      ${value}
    </td>
  </tr>`;
}

function notificationTemplate(values: ContactValues) {
  const rows = [
    detailRow("Name", escapeHtml(values.name)),
    detailRow(
      "Email",
      `<a href="mailto:${escapeHtml(values.email)}" style="color:${GOLD};text-decoration:none;">${escapeHtml(values.email)}</a>`,
    ),
    values.company ? detailRow("Company", escapeHtml(values.company)) : "",
    values.projectType
      ? detailRow("Project type", escapeHtml(values.projectType))
      : "",
  ].join("");

  const html = layout(
    "New enquiry from the website",
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:24px;">${rows}</table>
     <p style="margin:0 0 8px;font-size:11px;letter-spacing:0.14em;text-transform:uppercase;color:${INK_SOFT};">Message</p>
     <div style="padding:16px;background:${PARCHMENT};border-radius:12px;font-size:14px;line-height:1.7;color:${INK};">
       ${escapeMultiline(values.message)}
     </div>
     <p style="margin:24px 0 0;font-size:13px;color:${INK_SOFT};">
       Reply directly to this email to reach ${escapeHtml(values.name)}.
     </p>`,
  );

  const text = [
    "New enquiry from the website",
    "",
    `Name: ${values.name}`,
    `Email: ${values.email}`,
    values.company ? `Company: ${values.company}` : null,
    values.projectType ? `Project type: ${values.projectType}` : null,
    "",
    "Message:",
    values.message,
  ]
    .filter((line): line is string => line !== null)
    .join("\n");

  return { html, text };
}

function autoReplyTemplate(values: ContactValues) {
  // Only the first name — "Hi Om" reads warmer than "Hi Om Salve".
  const firstName = values.name.split(/\s+/)[0] || values.name;

  const html = layout(
    "We received your enquiry",
    `<p style="margin:0 0 16px;font-size:15px;line-height:1.7;color:${INK};">
       Hi ${escapeHtml(firstName)},
     </p>
     <p style="margin:0 0 16px;font-size:15px;line-height:1.7;color:${INK_SOFT};">
       Thank you for reaching out to Dwarka Studios. Your message has landed with
       our team, and we usually reply within two business days.
     </p>
     <p style="margin:0 0 8px;font-size:11px;letter-spacing:0.14em;text-transform:uppercase;color:${INK_SOFT};">What you sent us</p>
     <div style="padding:16px;background:${PARCHMENT};border-radius:12px;font-size:14px;line-height:1.7;color:${INK};">
       ${escapeMultiline(values.message)}
     </div>
     <p style="margin:24px 0 0;font-family:Georgia,serif;font-style:italic;font-size:15px;line-height:1.7;color:${INK_SOFT};">
       &ldquo;When we truly experience something, we never forget it.&rdquo;
     </p>`,
  );

  const text = [
    `Hi ${firstName},`,
    "",
    "Thank you for reaching out to Dwarka Studios. Your message has landed with",
    "our team, and we usually reply within two business days.",
    "",
    "What you sent us:",
    values.message,
    "",
    '"When we truly experience something, we never forget it."',
  ].join("\n");

  return { html, text };
}

/* -------------------------------------------------------------------------- */
/* Public senders                                                             */
/* -------------------------------------------------------------------------- */

/** The enquiry itself — this one has to land, or the submission failed. */
export async function sendEnquiryNotification(
  values: ContactValues,
): Promise<MailResult> {
  const to = notificationRecipient();

  if (!to) {
    return { ok: false, error: "CONTACT_TO_EMAIL is not set." };
  }

  const { html, text } = notificationTemplate(values);
  const suffix = values.projectType ? ` · ${values.projectType}` : "";

  return sendMail({
    to,
    subject: `New enquiry — ${values.name}${suffix}`,
    html,
    text,
    // So hitting Reply in the inbox writes back to the enquirer.
    replyTo: values.email,
  });
}

/** The courtesy confirmation — best effort, never blocks the submission. */
export async function sendEnquiryAutoReply(
  values: ContactValues,
): Promise<MailResult> {
  const { html, text } = autoReplyTemplate(values);

  return sendMail({
    to: values.email,
    subject: "We received your enquiry — Dwarka Studios",
    html,
    text,
    replyTo: notificationRecipient(),
  });
}
