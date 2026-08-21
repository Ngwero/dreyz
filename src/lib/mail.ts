import fs from "fs";
import path from "path";
import nodemailer from "nodemailer";
import type { Attachment } from "nodemailer/lib/mailer";

const LOGO_CID = "dreyz-logo@dreyz";

export function getMailer() {
  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT || 465);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASSWORD;
  if (!host || !user || !pass) {
    throw new Error("SMTP is not configured. Set SMTP_HOST, SMTP_USER, SMTP_PASSWORD in .env.local");
  }
  return nodemailer.createTransport({
    host,
    port,
    secure: process.env.SMTP_SECURE !== "false",
    auth: { user, pass },
  });
}

function getLogoAttachment(): Attachment | null {
  const logoPath = path.join(process.cwd(), "public", "logo.png");
  if (!fs.existsSync(logoPath)) return null;
  return {
    filename: "logo.png",
    path: logoPath,
    cid: LOGO_CID,
    contentDisposition: "inline",
  };
}

/** Shared branded HTML shell for auth emails (OTP / reset). */
export function authEmailHtml(opts: {
  name: string;
  intro: string;
  code: string;
  note?: string;
}) {
  const note =
    opts.note ??
    "This code expires in a few minutes. If you didn't request it, you can ignore this email.";

  return `
    <div style="font-family:system-ui,-apple-system,sans-serif;max-width:420px;margin:0 auto;padding:28px 24px;color:#082878;background:#ffffff">
      <div style="text-align:left;margin-bottom:24px">
        <img
          src="cid:${LOGO_CID}"
          alt="Dreyz Interior Design School"
          width="96"
          height="92"
          style="display:block;width:96px;height:auto;border:0;outline:none;margin:0"
        />
      </div>
      <p style="margin:0 0 12px;font-size:16px">Hi ${opts.name},</p>
      <p style="margin:0 0 8px;font-size:15px;line-height:1.5">${opts.intro}</p>
      <p style="font-size:28px;font-weight:700;letter-spacing:0.22em;margin:20px 0;text-align:center;color:#082878">${opts.code}</p>
      <p style="color:#5b6f94;font-size:14px;line-height:1.5;margin:0">${note}</p>
      <p style="margin-top:28px;font-size:13px;color:#5b6f94">— Dreyz Interior Design School</p>
    </div>
  `;
}

export async function sendMail(opts: {
  to: string;
  subject: string;
  text: string;
  html?: string;
  attachments?: Attachment[];
}) {
  const transporter = getMailer();
  const from = process.env.SMTP_FROM || process.env.SMTP_USER!;
  const logo = getLogoAttachment();
  const attachments = [
    ...(logo ? [logo] : []),
    ...(opts.attachments ?? []),
  ];

  await transporter.sendMail({
    from,
    to: opts.to,
    subject: opts.subject,
    text: opts.text,
    html: opts.html ?? opts.text.replace(/\n/g, "<br/>"),
    attachments: attachments.length ? attachments : undefined,
  });
}
