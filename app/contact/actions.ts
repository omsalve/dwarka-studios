"use server";

import { headers } from "next/headers";

import {
  HONEYPOT_FIELD,
  MIN_FILL_MS,
  RENDERED_AT_FIELD,
  readContactValues,
  validateContact,
  type ContactState,
} from "@/lib/contact";
import {
  isEmailConfigured,
  notificationRecipient,
  sendEnquiryAutoReply,
  sendEnquiryNotification,
} from "@/lib/email";

const SUCCESS_MESSAGE =
  "Thank you — your enquiry is with us. We usually reply within two business days.";

/** Derived from config so the fallback address can't drift from the real inbox. */
function genericFailure(): string {
  const inbox = notificationRecipient() ?? "info@dwarkastudio.in";
  return (
    "Something went wrong sending your enquiry. Please email us directly at " +
    `${inbox} and we'll pick it up from there.`
  );
}

/* -------------------------------------------------------------------------- */
/* Rate limiting                                                              */
/* -------------------------------------------------------------------------- */

const RATE_LIMIT_MAX = 3;
const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000; // 10 minutes

/**
 * Per-instance memory only: on serverless this resets on cold start and isn't
 * shared between instances. It is a speed bump for casual abuse, not a real
 * quota. Move to a shared store (Upstash, Redis) if the form gets hammered.
 */
const recentSubmissions = new Map<string, number[]>();

function isRateLimited(key: string): boolean {
  const now = Date.now();
  const cutoff = now - RATE_LIMIT_WINDOW_MS;
  const hits = (recentSubmissions.get(key) ?? []).filter((at) => at > cutoff);

  if (hits.length >= RATE_LIMIT_MAX) {
    recentSubmissions.set(key, hits);
    return true;
  }

  hits.push(now);
  recentSubmissions.set(key, hits);

  // Keep the map from growing without bound on a long-lived instance.
  if (recentSubmissions.size > 5_000) {
    for (const [entry, times] of recentSubmissions) {
      if (times.every((at) => at <= cutoff)) recentSubmissions.delete(entry);
    }
  }

  return false;
}

async function clientKey(): Promise<string> {
  const headerList = await headers();

  // `x-forwarded-for` is a comma-separated chain; the first entry is the client.
  const forwarded = headerList.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]!.trim();

  return headerList.get("x-real-ip") ?? "unknown";
}

/* -------------------------------------------------------------------------- */
/* Action                                                                     */
/* -------------------------------------------------------------------------- */

export async function submitEnquiry(
  _prevState: ContactState,
  formData: FormData,
): Promise<ContactState> {
  const values = readContactValues(formData);

  // --- Spam gates -----------------------------------------------------------
  // Both report success: a bot that knows it was caught just tries again.

  if (String(formData.get(HONEYPOT_FIELD) ?? "").trim() !== "") {
    return { status: "success", message: SUCCESS_MESSAGE, autoReplied: false };
  }

  const renderedAt = Number(formData.get(RENDERED_AT_FIELD));
  if (Number.isFinite(renderedAt) && Date.now() - renderedAt < MIN_FILL_MS) {
    return { status: "success", message: SUCCESS_MESSAGE, autoReplied: false };
  }

  // --- Validation -----------------------------------------------------------

  const errors = validateContact(values);
  if (Object.keys(errors).length > 0) {
    return {
      status: "error",
      message: "Please check the highlighted fields.",
      errors,
      values,
    };
  }

  // --- Rate limit -----------------------------------------------------------

  if (isRateLimited(await clientKey())) {
    return {
      status: "error",
      message:
        "You've sent a few enquiries already. Please give us a little time to reply before sending another.",
      values,
    };
  }

  // --- Send -----------------------------------------------------------------

  if (!isEmailConfigured()) {
    console.error(
      "[contact] Email is not configured. Set RESEND_API_KEY, CONTACT_FROM_EMAIL and CONTACT_TO_EMAIL.",
    );
    return { status: "error", message: genericFailure(), values };
  }

  const notification = await sendEnquiryNotification(values);

  if (!notification.ok) {
    // Server-side only — never surface provider errors to the visitor.
    console.error("[contact] Enquiry notification failed:", notification.error);
    return { status: "error", message: genericFailure(), values };
  }

  // Best effort. The enquiry is already safely in our inbox, so a failed
  // courtesy note must not tell the visitor their message didn't get through.
  const autoReply = await sendEnquiryAutoReply(values);

  if (!autoReply.ok) {
    console.error("[contact] Auto-reply failed:", autoReply.error);
  }

  return {
    status: "success",
    message: SUCCESS_MESSAGE,
    autoReplied: autoReply.ok,
  };
}
