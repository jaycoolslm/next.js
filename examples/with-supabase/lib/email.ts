import "server-only";
import nodemailer from "nodemailer";

// Application email (invitations, witness requests, dispute notices, contract
// pack links). Email is the only notification channel in v1.
//
// Local dev: `supabase start` bundles a Mailpit test inbox; its SMTP port is
// exposed as 54325 (supabase/config.toml [local_smtp]) and the web UI is at
// http://127.0.0.1:54324. Self-hosting: point SMTP_URL at any SMTP server.

const DEFAULT_LOCAL_SMTP = "smtp://127.0.0.1:54325";

export interface AppMail {
  to: string;
  subject: string;
  text: string;
}

export async function sendMail(mail: AppMail): Promise<void> {
  const smtpUrl = process.env.SMTP_URL ?? DEFAULT_LOCAL_SMTP;
  const from = process.env.EMAIL_FROM ?? "282 <no-reply@282.local>";
  const transport = nodemailer.createTransport(smtpUrl);
  try {
    await transport.sendMail({ from, ...mail });
  } catch (error) {
    // Email is best-effort in v1: a failed notification must never abort the
    // underlying ledger write (the event log is the source of truth).
    console.error(`[282] failed to send email to ${mail.to}:`, error);
  }
}
