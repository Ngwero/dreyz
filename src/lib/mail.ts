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

/** Student welcome after public signup / student account create. */
export function welcomeStudentHtml(opts: {
  name: string;
  portalUrl: string;
  email: string;
  password: string;
  extras?: string[];
}) {
  const extrasHtml = (opts.extras ?? [])
    .map((line) => `<p style="margin:0 0 4px;font-size:14px;color:#5b6f94">${line}</p>`)
    .join("");

  return `
    <div style="font-family:system-ui,-apple-system,sans-serif;max-width:480px;margin:0 auto;padding:28px 24px;color:#082878;background:#ffffff">
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
      <p style="margin:0 0 12px;font-size:15px;line-height:1.55">
        <strong>Welcome to Dreyz Interior Design School.</strong>
      </p>
      <p style="margin:0 0 16px;font-size:15px;line-height:1.55">
        Your <strong>student</strong> portal is ready. Use it to follow classes, fees, projects, and attendance. Sign in with the details below, then change your password from My Account.
      </p>
      ${extrasHtml}
      <div style="margin:20px 0;padding:16px 18px;border-radius:12px;background:#f0f4ff;border:1px solid #d6e0ff">
        <p style="margin:0 0 8px;font-size:12px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#5b6f94">Student login</p>
        <p style="margin:0 0 6px;font-size:14px"><strong>Portal:</strong> <a href="${opts.portalUrl}" style="color:#1b7eef">${opts.portalUrl}</a></p>
        <p style="margin:0 0 6px;font-size:14px"><strong>Email:</strong> ${opts.email}</p>
        <p style="margin:0;font-size:14px"><strong>Temporary password:</strong> ${opts.password}</p>
      </div>
      <p style="margin-top:24px;font-size:13px;color:#5b6f94">— Dreyz Interior Design School · Learn | Design | Inspire</p>
    </div>
  `;
}

/** Staff / Super Admin / Tutor / Accountant welcome — not the student letter. */
export function welcomeStaffHtml(opts: {
  name: string;
  roleLabel: string;
  portalUrl: string;
  email: string;
  password: string;
  extras?: string[];
}) {
  const extrasHtml = (opts.extras ?? [])
    .map((line) => `<p style="margin:0 0 4px;font-size:14px;color:#5b6f94">${line}</p>`)
    .join("");

  return `
    <div style="font-family:system-ui,-apple-system,sans-serif;max-width:480px;margin:0 auto;padding:28px 24px;color:#082878;background:#ffffff">
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
      <p style="margin:0 0 12px;font-size:15px;line-height:1.55">
        <strong>You have been added to the Dreyz Interior staff portal.</strong>
      </p>
      <p style="margin:0 0 16px;font-size:15px;line-height:1.55">
        Your role is <strong>${opts.roleLabel}</strong>. This is an administration login — not a student account. Use it to manage the school portal. Sign in below, then change your password from My Account.
      </p>
      ${extrasHtml}
      <div style="margin:20px 0;padding:16px 18px;border-radius:12px;background:#082878;color:#ffffff">
        <p style="margin:0 0 8px;font-size:12px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#d8ff59">Staff login</p>
        <p style="margin:0 0 6px;font-size:14px"><strong>Portal:</strong> <a href="${opts.portalUrl}" style="color:#d8ff59">${opts.portalUrl}</a></p>
        <p style="margin:0 0 6px;font-size:14px"><strong>Email:</strong> ${opts.email}</p>
        <p style="margin:0;font-size:14px"><strong>Temporary password:</strong> ${opts.password}</p>
      </div>
      <p style="margin-top:24px;font-size:13px;color:#5b6f94">Keep these details private. — Dreyz Interior Design School</p>
    </div>
  `;
}

/** @deprecated prefer welcomeStudentHtml / welcomeStaffHtml */
export function welcomeAccountHtml(opts: {
  name: string;
  roleLabel: string;
  portalUrl: string;
  email: string;
  password: string;
  extras?: string[];
}) {
  if (opts.roleLabel === "Student") {
    return welcomeStudentHtml(opts);
  }
  return welcomeStaffHtml(opts);
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
