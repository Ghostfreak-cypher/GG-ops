import nodemailer from "nodemailer";
import type { Transporter } from "nodemailer";
import { env } from "@/lib/env";
import { logger } from "@/lib/logger";

export type Email = { to: string; subject: string; text: string; html?: string };

let _transporter: Transporter | undefined;
let _etherealFrom: string | undefined;

function getTransporter(): Transporter {
  if (!_transporter) {
    const port = env.SMTP_PORT ?? 587;
    _transporter = nodemailer.createTransport({
      host: env.SMTP_HOST,
      port,
      secure: port === 465,
      auth: { user: env.SMTP_USER, pass: env.SMTP_PASS },
    });
  }
  return _transporter;
}

function hasSmtpConfig(): boolean {
  return !!(env.SMTP_HOST && env.SMTP_USER && env.SMTP_PASS && env.EMAIL_FROM);
}

async function getEtherealTransporter(): Promise<{ transporter: Transporter; from: string }> {
  if (!_transporter || !_etherealFrom) {
    const account = await nodemailer.createTestAccount();
    _etherealFrom = `"GGOps Dev" <${account.user}>`;
    _transporter = nodemailer.createTransport({
      host: "smtp.ethereal.email",
      port: 587,
      auth: { user: account.user, pass: account.pass },
    });
  }
  return { transporter: _transporter, from: _etherealFrom };
}

async function sendWithResend(email: Email): Promise<void> {
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: env.EMAIL_FROM,
      to: [email.to],
      subject: email.subject,
      text: email.text,
      ...(email.html ? { html: email.html } : {}),
    }),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(`Resend email failed: ${response.status} ${body}`.trim());
  }
}

export async function sendEmail(email: Email): Promise<void> {
  if (env.RESEND_API_KEY && env.EMAIL_FROM) {
    await sendWithResend(email);
    logger.info("email.sent", { provider: "resend", to: email.to, subject: email.subject });
    return;
  }

  if (hasSmtpConfig()) {
    await getTransporter().sendMail({
      from: env.EMAIL_FROM,
      to: email.to,
      subject: email.subject,
      text: email.text,
      ...(email.html ? { html: email.html } : {}),
    });

    logger.info("email.sent", { provider: "smtp", to: email.to, subject: email.subject });
    return;
  }

  if (env.NODE_ENV !== "production") {
    const { transporter, from } = await getEtherealTransporter();
    const info = await transporter.sendMail({
      from,
      to: email.to,
      subject: email.subject,
      text: email.text,
      ...(email.html ? { html: email.html } : {}),
    });
    const previewUrl = nodemailer.getTestMessageUrl(info);
    logger.info("email.sent (ethereal)", {
      to: email.to,
      subject: email.subject,
      preview: previewUrl || undefined,
    });
    return;
  }

  throw new Error("No production email provider configured");
}
