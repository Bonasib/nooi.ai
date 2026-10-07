// Transactional & bulk email via Resend, SendGrid (HTTP APIs) or SMTP (e.g. your Hostinger mailbox). From: contact@nooi.ai
import { cfg } from "./settings.js";
import { col, save } from "./store.js";
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
export function wrapHtml(body, unsub) { return `<div style="font-family:Arial,sans-serif;max-width:560px;margin:auto;padding:24px;color:#111"><div style="font-size:20px;font-weight:700;margin-bottom:18px">● nooi<span style="color:#888">.ai</span></div><div style="font-size:15px;line-height:1.7;white-space:pre-wrap" dir="auto">${esc(body)}</div><hr style="border:0;border-top:1px solid #eee;margin:24px 0"><div style="font-size:12px;color:#888">nooi.ai · <a href="mailto:contact@nooi.ai">contact@nooi.ai</a>${unsub ? ` · <a href="${unsub}">Unsubscribe</a>` : ""}</div></div>`; }
// SMTP needs a mailbox password (EMAIL_API_KEY or SMTP_PASS); Resend / SendGrid need an API key.
export const emailConfigured = () => { const c = cfg("email"); return c.provider === "smtp" ? !!(c.pass || process.env.SMTP_PASS || c.apiKey) : !!c.apiKey; };
export async function sendEmail({ to, subject, text, unsub, html: posterHtml }) {
  const c = cfg("email"); const from = c.from || "nooi.ai <contact@nooi.ai>"; const html = posterHtml || wrapHtml(text, unsub);
  if (!emailConfigured()) { console.log("[email not configured]", to, subject); return { skipped: true }; }
  if (c.provider === "smtp") { // e.g. Hostinger mailbox: smtp.hostinger.com, port 465, SSL
    const nm = (await import("nodemailer")).default;
    const tx = nm.createTransport({ host: c.host || process.env.SMTP_HOST || "smtp.hostinger.com", port: +(c.port || process.env.SMTP_PORT || 465), secure: String(c.port || process.env.SMTP_PORT || 465) === "465", auth: { user: c.user || process.env.SMTP_USER || from.replace(/.*</, "").replace(">", ""), pass: c.pass || process.env.SMTP_PASS || c.apiKey } });
    await tx.sendMail({ from, to, subject, html, text }); return { ok: true };
  }
  if ((c.provider || "resend") === "sendgrid") {
    const r = await fetch("https://api.sendgrid.com/v3/mail/send", { method: "POST", headers: { Authorization: "Bearer " + c.apiKey, "Content-Type": "application/json" }, body: JSON.stringify({ personalizations: [{ to: [{ email: to }] }], from: { email: from.replace(/.*</, "").replace(">", ""), name: "nooi.ai" }, subject, content: [{ type: "text/plain", value: text }, { type: "text/html", value: html }] }) });
    if (!r.ok) throw new Error("SendGrid " + r.status); return { ok: true };
  }
  const r = await fetch("https://api.resend.com/emails", { method: "POST", headers: { Authorization: "Bearer " + c.apiKey, "Content-Type": "application/json" }, body: JSON.stringify({ from, to: [to], subject, html, text }) });
  if (!r.ok) throw new Error("Resend " + r.status + " " + (await r.text()).slice(0, 120)); return { ok: true };
}
export function logEmail(subject, count, by) { const l = col("emails", []); l.unshift({ t: Date.now(), subject, count, by }); l.length = Math.min(l.length, 300); save(); }
