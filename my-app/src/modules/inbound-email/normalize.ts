import type { gmail_v1 } from "googleapis";
import { getPlainText } from "@/lib/get-plain-text";

/** A Gmail message flattened into just the fields the pipeline reasons about. */
export type NormalizedEmail = {
  messageId: string;
  from: string;
  fromEmail: string;
  to: string[];
  subject: string;
  body: string;
  /** Raw `Authentication-Results` header — the input to SPF/DKIM/DMARC verification. */
  authResults: string;
};

/** Body text is truncated well before it can dominate an LLM prompt or a task description. */
const MAX_BODY_CHARS = 8_000;

function header(message: gmail_v1.Schema$Message, name: string): string {
  const found = message.payload?.headers?.find(
    (h) => h.name?.toLowerCase() === name.toLowerCase(),
  );
  return found?.value ?? "";
}

/** `"Ada Lovelace" <ada@example.com>` → `ada@example.com`. */
export function extractEmailAddress(value: string): string {
  const angled = value.match(/<([^>]+)>/);
  const raw = angled ? angled[1]! : value;
  return raw.trim().toLowerCase();
}

function decodeBase64Url(data: string): string {
  return Buffer.from(data.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8");
}

/**
 * Depth-first walk for the best body part: prefer `text/plain`, fall back to `text/html`.
 * Attachments are ignored entirely — we never download or forward them.
 */
function extractBody(payload: gmail_v1.Schema$MessagePart | undefined): string {
  if (!payload) return "";

  const collect = (
    part: gmail_v1.Schema$MessagePart,
    mime: string,
  ): string | null => {
    if (part.mimeType === mime && part.body?.data) return decodeBase64Url(part.body.data);
    for (const child of part.parts ?? []) {
      const found = collect(child, mime);
      if (found) return found;
    }
    return null;
  };

  const plain = collect(payload, "text/plain");
  if (plain) return plain;

  const html = collect(payload, "text/html");
  if (html) return getPlainText(html);

  return payload.body?.data ? decodeBase64Url(payload.body.data) : "";
}

/**
 * Strip quoted reply chains and signatures.
 *
 * Without this, a reply to an existing thread hands the model the entire history and it
 * summarises the wrong message.
 */
function stripQuotedText(body: string): string {
  const markers = [
    /^On .+ wrote:$/m, // Gmail
    /^-{2,}\s*Original Message\s*-{2,}$/im,
    /^_{5,}$/m, // Outlook
    /^From:\s.+$/m,
    /^--\s*$/m, // signature delimiter
  ];
  let cut = body.length;
  for (const marker of markers) {
    const match = body.match(marker);
    if (match?.index !== undefined && match.index < cut) cut = match.index;
  }
  return body.slice(0, cut);
}

export function parseGmailMessage(message: gmail_v1.Schema$Message): NormalizedEmail {
  const from = header(message, "From");
  const rawBody = extractBody(message.payload);

  const body = stripQuotedText(rawBody)
    .replace(/\r\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
    .slice(0, MAX_BODY_CHARS);

  return {
    messageId: message.id ?? "",
    from,
    fromEmail: extractEmailAddress(from),
    to: header(message, "To")
      .split(",")
      .map((t) => extractEmailAddress(t))
      .filter(Boolean),
    subject: header(message, "Subject").trim(),
    body,
    authResults: header(message, "Authentication-Results"),
  };
}
