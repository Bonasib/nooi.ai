// Invoices: one per paid checkout, numbered NOOI-<year>-<000001>. Prices are VAT-inclusive (15% in Saudi Arabia),
// so each invoice shows the net amount and the VAT inside the total. Seller details come from the environment:
// COMPANY_NAME, COMPANY_VAT (VAT registration number), COMPANY_ADDRESS, COMPANY_CR (commercial registration).
// GET /v1/billing/invoices · GET /v1/billing/invoices/:no · POST /v1/billing/invoices/:no/email
import { col, save, user } from "./store.js";
import { requireUser } from "./auth.js";
import { isStaff } from "./admin.js";
import { sendEmail, emailConfigured } from "./email.js";
import { renderEmail } from "../public/email-templates.js";

export const VAT_RATE = +(process.env.VAT_RATE || 15);
const invoices = () => col("invoices", {});
const meta = () => col("meta", {});
const wrap = (fn) => (req, res) => Promise.resolve(fn(req, res)).catch((e) => res.status(e.code || 500).json({ error: e.message }));
const base = () => (process.env.PUBLIC_BASE_URL || "").replace(/\/$/, "") || "https://nooi.ai";
export const seller = () => ({ name: process.env.COMPANY_NAME || "nooi.ai", vat: process.env.COMPANY_VAT || "", cr: process.env.COMPANY_CR || "", address: process.env.COMPANY_ADDRESS || "", email: "contact@nooi.ai" });

export async function makeInvoice(uidv, p, c) {
  if (p.invoice && invoices()[p.invoice]) return p.invoice;
  const m = meta(), year = new Date().getFullYear(); m.invoiceSeq = (m.invoiceSeq || 0) + 1;
  const no = `NOOI-${year}-${String(m.invoiceSeq).padStart(6, "0")}`;
  const u = user(uidv), total = p.amount, net = Math.round(total / (1 + VAT_RATE / 100)), vat = total - net;
  const inv = { no, uid: uidv, date: p.paidAt || Date.now(), status: "paid", currency: p.currency, total, net, vat, vatRate: VAT_RATE,
    items: [{ desc: c.label, qty: 1, credits: c.credits || 0, unit: total }], coupon: p.coupon || null, provider: p.provider || null, ref: p.ref,
    gift: p.giftCode ? { code: p.giftCode, to: p.gift?.toName || p.gift?.toEmail || "" } : null,
    buyer: { name: u.profile?.name || "", email: u.profile?.email || p.email || "", cid: u.cid || "" }, seller: seller() };
  invoices()[no] = inv; u.invoices = [no, ...(u.invoices || [])].slice(0, 1000); save();
  if (inv.buyer.email && emailConfigured()) { try { await mailInvoice(inv, inv.buyer.email, u.profile?.lang); } catch (e) { console.warn("invoice email", e.message); } }
  return no;
}
export async function mailInvoice(inv, to, lang) {
  const m = renderEmail("receipt", { lang: lang === "ar" ? "ar" : "en", invoice: inv, name: inv.buyer.name, base: base(), url: base() + "/#wallet" });
  await sendEmail({ to, subject: m.subject, text: m.text, html: m.html });
}
const mine = (req, no) => { const inv = invoices()[no]; if (!inv || (inv.uid !== req.user.uid && !isStaff(req.user))) throw Object.assign(new Error("Not found"), { code: 404 }); return inv; };

export function registerInvoices(app) {
  app.get("/v1/billing/invoices", requireUser, (req, res) => { const u = user(req.user.uid);
    res.json({ items: (u.invoices || []).map((n) => invoices()[n]).filter(Boolean).map((i) => ({ no: i.no, date: i.date, total: i.total, currency: i.currency, desc: i.items[0]?.desc || "", status: i.status })) }); });
  app.get("/v1/billing/invoices/:no", requireUser, wrap(async (req, res) => res.json(mine(req, req.params.no))));
  app.post("/v1/billing/invoices/:no/email", requireUser, wrap(async (req, res) => {
    const inv = mine(req, req.params.no), to = inv.buyer.email || req.user.email;
    if (!to) throw Object.assign(new Error("Add an email to your account first"), { code: 400 });
    if (!emailConfigured()) throw Object.assign(new Error("Email isn't set up on this server yet — print or save the invoice instead"), { code: 501 });
    await mailInvoice(inv, to, req.body?.lang); res.json({ sent: true, to });
  }));
}
