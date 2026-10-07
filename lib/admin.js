// Admin dashboard API: roles & permissions, clients, emails, support tickets, features, providers, payments, audit.
import crypto from "crypto";
import { user, allUsers, save, uid, col } from "./store.js";
import { S, saveCfg, publicProviders, publicPayments } from "./settings.js";
import { credit, charge, balance } from "./billing.js";
import { sendEmail, logEmail } from "./email.js";
import { testProvider, testAll, publicStatus } from "./health.js";
export const PERMS = ["analytics.view", "users.view", "users.edit", "credits.adjust", "emails.send", "support.reply", "features.manage", "providers.manage", "payments.manage", "admins.manage", "audit.view"];
export const ROLE_DEFAULT = { owner: PERMS, admin: PERMS.filter((p) => p !== "admins.manage"), support: ["users.view", "support.reply", "emails.send"], finance: ["analytics.view", "users.view", "credits.adjust", "payments.manage", "audit.view"], moderator: ["users.view", "users.edit", "support.reply", "audit.view"], viewer: ["analytics.view", "users.view"] };
const owners = () => (process.env.ADMIN_EMAILS || "").split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
export function roleOf(u) {
  const email = (u.email || user(u.uid).profile?.email || "").toLowerCase();
  if (u.uid === "local" || (email && owners().includes(email))) return "owner";
  const m = S().team.find((t) => t.email.toLowerCase() === email); return m ? m.role : null;
}
export const permsOf = (role) => role === "owner" ? PERMS : (S().roles[role] || ROLE_DEFAULT[role] || []);
export const requireAdmin = (perm) => (req, res, next) => { const role = roleOf(req.user); if (!role || (perm && !permsOf(role).includes(perm))) return res.status(403).json({ error: "Not allowed" }); req.role = role; next(); };
export function audit(req, what) { const a = col("audit", []); a.unshift({ t: Date.now(), who: req.user.email || req.user.uid, what }); a.length = Math.min(a.length, 1000); save(); }
const unsubSig = (id) => crypto.createHmac("sha256", process.env.SECRET_KEY || "nooi").update(id).digest("hex").slice(0, 16);
function clientRow(id, U) { const L = U.ledger || []; const pays = Object.values(U.payments || {}).filter((p) => p.status === "paid"); const sar = (p) => Math.round((p.currency === "USD" ? p.amount * 3.75 : p.amount) / 100); return { id, name: U.profile?.name || (U.profile?.email || "").split("@")[0] || id.slice(0, 6), email: U.profile?.email || "", plan: U.plan || "free", credits: U.credits ?? 0, status: U.status || "active", created: U.profile?.created || 0, lastSeen: U.profile?.lastSeen || 0, spent: L.filter((x) => x.delta < 0).reduce((a, x) => a - x.delta, 0), jobs: Object.keys(U.jobs || {}).length, country: U.profile?.country || "", city: U.profile?.city || "", payments: pays.map((p) => ({ t: p.paidAt, item: p.item, sar: sar(p), status: p.status, no: "INV-" + p.ref.slice(0, 8).toUpperCase() })) }; }
const wrap = (fn) => (req, res) => fn(req, res).catch((e) => res.status(e.code && e.code >= 400 && e.code < 600 ? e.code : 500).json({ error: e.message }));

export function registerAdmin(app, requireUser) {
  app.get("/v1/me", requireUser, (req, res) => { const role = roleOf(req.user); res.json({ uid: req.user.uid, email: req.user.email || user(req.user.uid).profile?.email || null, role, perms: role ? permsOf(role) : [] }); });
  app.get("/v1/admin/overview", requireUser, requireAdmin("analytics.view"), (req, res) => {
    const D = 864e5, now = Date.now(), days = Array.from({ length: 14 }, (_, i) => ({ d: now - (13 - i) * D, sar: 0, jobs: 0 }));
    const idx = (t) => 13 - Math.floor((now - t) / D);
    for (const [, U] of allUsers()) { Object.values(U.payments || {}).forEach((p) => { if (p.status === "paid") { const i = idx(p.paidAt); if (i >= 0 && i < 14) days[i].sar += Math.round((p.currency === "USD" ? p.amount * 3.75 : p.amount) / 100); } }); Object.values(U.jobs || {}).forEach((j) => { const i = idx(j.created); if (i >= 0 && i < 14) days[i].jobs++; }); }
    res.json({ rev: days });
  });
  app.get("/v1/admin/users", requireUser, requireAdmin("users.view"), (req, res) => { const q = String(req.query.q || "").toLowerCase(); res.json({ users: allUsers().map(([id, U]) => clientRow(id, U)).filter((u) => !q || (u.name + " " + u.email).toLowerCase().includes(q)).sort((a, b) => b.lastSeen - a.lastSeen).slice(0, 1000) }); });
  app.patch("/v1/admin/users/:id", requireUser, requireAdmin("users.view"), wrap(async (req, res) => {
    const U = user(req.params.id), perms = permsOf(req.role), b = req.body || {};
    if (b.creditsDelta) { if (!perms.includes("credits.adjust")) return res.status(403).json({ error: "Not allowed" }); const n = Math.round(+b.creditsDelta); if (n > 0) credit(req.params.id, n, "Admin credit"); else charge(req.params.id, Math.min(-n, balance(req.params.id)), "Admin debit"); audit(req, `${n > 0 ? "Added" : "Removed"} ${Math.abs(n)} credits · ${U.profile?.email || req.params.id}`); }
    if (b.plan) { if (!perms.includes("credits.adjust")) return res.status(403).json({ error: "Not allowed" }); U.plan = b.plan; audit(req, `Plan → ${b.plan} · ${U.profile?.email || req.params.id}`); }
    if (b.status) { if (!perms.includes("users.edit")) return res.status(403).json({ error: "Not allowed" }); U.status = b.status === "suspended" ? "suspended" : "active"; audit(req, `${U.status === "suspended" ? "Suspended" : "Reactivated"} ${U.profile?.email || req.params.id}`); }
    save(); res.json(clientRow(req.params.id, U));
  }));
  app.post("/v1/admin/email", requireUser, requireAdmin("emails.send"), wrap(async (req, res) => {
    const { segment = "all", ids, subject, body } = req.body || {}; if (!subject || !body) return res.status(400).json({ error: "Subject and message required" });
    const now = Date.now(); let list = allUsers().map(([id, U]) => [id, U]).filter(([, U]) => U.profile?.email && !U.unsub);
    if (segment === "paid") list = list.filter(([, U]) => (U.plan || "free") !== "free"); if (segment === "free") list = list.filter(([, U]) => (U.plan || "free") === "free");
    if (segment === "inactive") list = list.filter(([, U]) => now - (U.profile?.lastSeen || 0) > 14 * 864e5); if (segment === "selected") list = list.filter(([id]) => (ids || []).includes(id));
    list = list.slice(0, 2000); let sent = 0; const base = (process.env.PUBLIC_BASE_URL || "").replace(/\/$/, "");
    for (const [id, U] of list) { const name = U.profile?.name || U.profile?.email.split("@")[0]; try { await sendEmail({ to: U.profile.email, subject: subject.replaceAll("{name}", name), text: body.replaceAll("{name}", name), unsub: `${base}/v1/unsubscribe?u=${id}&s=${unsubSig(id)}` }); sent++; } catch (e) { console.warn("email", e.message); } await new Promise((r) => setTimeout(r, 60)); }
    logEmail(subject, sent, req.user.email); audit(req, `Emailed ${sent} clients: ${subject}`); res.json({ sent });
  }));
  app.get("/v1/unsubscribe", (req, res) => { const id = String(req.query.u || ""); if (unsubSig(id) !== req.query.s) return res.status(400).send("Invalid link"); user(id).unsub = true; save(); res.send("<p style='font-family:sans-serif'>You're unsubscribed from nooi.ai updates. · تم إلغاء اشتراكك.</p>"); });
  app.get("/v1/admin/tickets", requireUser, requireAdmin("support.reply"), (req, res) => res.json({ tickets: col("tickets", []).slice(0, 500) }));
  app.patch("/v1/admin/tickets/:id", requireUser, requireAdmin("support.reply"), (req, res) => { const t = col("tickets", []).find((x) => x.id === req.params.id); if (!t) return res.status(404).json({ error: "Not found" }); ["status", "priority", "assignee"].forEach((k) => { if (req.body[k]) t[k] = req.body[k]; }); t.updated = Date.now(); save(); audit(req, `Ticket #${t.id} → ${req.body.status || req.body.priority || ""}`); res.json(t); });
  app.post("/v1/admin/tickets/:id/reply", requireUser, requireAdmin("support.reply"), wrap(async (req, res) => {
    const t = col("tickets", []).find((x) => x.id === req.params.id); if (!t) return res.status(404).json({ error: "Not found" });
    const internal = !!req.body.internal, text = String(req.body.text || "").slice(0, 8000); t.messages.push({ from: "agent", name: req.user.email || "Support", text, t: Date.now(), internal }); if (!internal) t.status = "pending"; t.updated = Date.now(); save();
    if (!internal && t.email) await sendEmail({ to: t.email, subject: `Re: ${t.subject} [#${t.id}]`, text: `${text}\n\n— nooi.ai support` }).catch((e) => console.warn(e.message));
    audit(req, `${internal ? "Note on" : "Replied to"} #${t.id}`); res.json(t);
  }));
  app.get("/v1/admin/settings", requireUser, requireAdmin(), (req, res) => { const st = S(); res.json({ features: st.features, models: st.models, prices: st.prices, modelCat: st.modelCat || {}, providers: publicProviders(), payments: publicPayments(), emails: col("emails", []).slice(0, 50) }); });
  app.put("/v1/admin/settings", requireUser, requireAdmin(), (req, res) => {
    const st = S(), b = req.body || {}, P = permsOf(req.role);
    if (b.features) { if (!P.includes("features.manage")) return res.status(403).json({ error: "Not allowed" }); Object.assign(st.features, b.features); audit(req, "Features: " + JSON.stringify(b.features)); }
    if (b.models || b.prices) { if (!P.includes("providers.manage")) return res.status(403).json({ error: "Not allowed" }); Object.assign(st.models, b.models || {}); Object.assign(st.prices, b.prices || {}); audit(req, "Models/prices: " + JSON.stringify(b.models || b.prices)); }
    if (b.modelCat) { if (!P.includes("providers.manage")) return res.status(403).json({ error: "Not allowed" }); st.modelCat = st.modelCat || {}; for (const [k, v] of Object.entries(b.modelCat)) { const cur = st.modelCat[k] || {}; if (typeof v.apiModel === "string") cur.apiModel = v.apiModel.slice(0, 120).trim(); if (typeof v.kieModel === "string") { const km = v.kieModel.slice(0, 120).trim(); if (km) cur.kieModel = km; else delete cur.kieModel; } if (typeof v.cr === "number" && v.cr > 0) { cur.cr = Math.round(v.cr); st.prices[k] = cur.cr; } if (typeof v.verified === "boolean") cur.verified = v.verified; st.modelCat[k] = cur; } audit(req, "Model catalog: " + Object.keys(b.modelCat).join(", ")); }
    if (b.modelLogos) { if (!P.includes("providers.manage")) return res.status(403).json({ error: "Not allowed" }); st.modelLogos = st.modelLogos || {}; for (const [k, v] of Object.entries(b.modelLogos)) { if (typeof v === "string" && /^data:image\/(png|svg\+xml);base64,/.test(v) && v.length < 400000) st.modelLogos[k] = v; else if (v === null) delete st.modelLogos[k]; } audit(req, "Model logos updated: " + Object.keys(b.modelLogos).join(", ")); }
    if (b.payments) { if (!P.includes("payments.manage")) return res.status(403).json({ error: "Not allowed" }); for (const [k, v] of Object.entries(b.payments)) st.payments[k] = { ...(st.payments[k] || {}), enabled: !!v.enabled }; audit(req, "Payments: " + JSON.stringify(b.payments)); }
    save(); res.json({ ok: true });
  });
  app.put("/v1/admin/providers/:key", requireUser, requireAdmin("providers.manage"), wrap(async (req, res) => { saveCfg("providers", req.params.key, req.body); audit(req, "Updated provider keys: " + req.params.key); res.json({ ok: true }); }));
  app.put("/v1/admin/payments/:key", requireUser, requireAdmin("payments.manage"), wrap(async (req, res) => { saveCfg("payments", req.params.key, req.body); audit(req, "Updated payment keys: " + req.params.key); res.json({ ok: true }); }));
  app.get("/v1/admin/team", requireUser, requireAdmin("admins.manage"), (req, res) => res.json({ team: [...owners().map((e) => ({ email: e, role: "owner" })), ...S().team], roles: Object.fromEntries(Object.keys(ROLE_DEFAULT).map((r) => [r, permsOf(r)])) }));
  app.post("/v1/admin/team", requireUser, requireAdmin("admins.manage"), (req, res) => { const email = String(req.body.email || "").toLowerCase(), role = req.body.role; if (!/^\S+@\S+$/.test(email) || !ROLE_DEFAULT[role] || role === "owner") return res.status(400).json({ error: "Invalid" }); const st = S(); st.team = st.team.filter((t) => t.email !== email).concat({ email, role, added: Date.now() }); save(); audit(req, `Invited ${email} as ${role}`); res.json({ ok: true }); });
  app.delete("/v1/admin/team/:email", requireUser, requireAdmin("admins.manage"), (req, res) => { const st = S(); st.team = st.team.filter((t) => t.email !== req.params.email.toLowerCase()); save(); audit(req, "Removed admin " + req.params.email); res.json({ ok: true }); });
  app.put("/v1/admin/roles", requireUser, requireAdmin("admins.manage"), (req, res) => { const { role, perms } = req.body || {}; if (!ROLE_DEFAULT[role] || role === "owner") return res.status(400).json({ error: "Invalid" }); S().roles[role] = (perms || []).filter((p) => PERMS.includes(p)); save(); audit(req, `Role ${role} permissions updated`); res.json({ ok: true }); });
  app.get("/v1/admin/audit", requireUser, requireAdmin("audit.view"), (req, res) => res.json({ audit: col("audit", []).slice(0, 300) }));
  // ---- discounts: one code per campaign, emailed to the selected clients
  app.post("/v1/admin/coupons", requireUser, requireAdmin("emails.send"), wrap(async (req, res) => {
    const pct = Math.min(90, Math.max(1, +req.body.pct || 20)), days = Math.min(365, Math.max(1, +req.body.days || 7)), scope = ["all", "plans", "credits"].includes(req.body.scope) ? req.body.scope : "all";
    const code = "NOOI-" + crypto.randomBytes(3).toString("hex").toUpperCase(); const ids = (req.body.ids || []).slice(0, 5000);
    col("coupons", {})[code] = { code, pct, scope, expires: Date.now() + days * 864e5, allow: ids, used: [] }; save();
    let sent = 0; for (const id of ids) { const U = user(id); if (!U.profile?.email) continue; try { await sendEmail({ to: U.profile.email, subject: `${pct}% off nooi.ai — your code ${code}`, text: `Use code ${code} at checkout for ${pct}% off (${scope === "plans" ? "plans" : scope === "credits" ? "credit top-ups" : "plans and credits"}). Valid for ${days} days.\n\nاستخدم الكود ${code} عند الدفع لخصم ${pct}%. صالح لمدة ${days} يوماً.` }); sent++; } catch (e) { console.warn(e.message); } }
    logEmail(`${pct}% discount · ${code}`, sent, req.user.email); audit(req, `Discount ${pct}% (${code}) to ${ids.length} clients`); res.json({ code, sent });
  }));
  // ---- invoices: email each selected client a summary of their paid invoices (VAT-inclusive)
  app.post("/v1/admin/invoices", requireUser, requireAdmin("emails.send"), wrap(async (req, res) => {
    let sent = 0; for (const id of (req.body.ids || []).slice(0, 5000)) { const U = user(id); const pays = Object.values(U.payments || {}).filter((p) => p.status === "paid"); if (!U.profile?.email || !pays.length) continue;
      const lines = pays.map((p) => { const total = p.amount / 100, vat = p.currency === "SAR" ? total - total / 1.15 : 0; return `INV-${p.ref.slice(0, 8).toUpperCase()} · ${new Date(p.paidAt).toISOString().slice(0, 10)} · ${p.item} · ${total.toFixed(2)} ${p.currency}${vat ? ` (VAT 15%: ${vat.toFixed(2)})` : ""}`; });
      try { await sendEmail({ to: U.profile.email, subject: "Your nooi.ai invoices · فواتيرك", text: `Here are your invoices:\n\n${lines.join("\n")}\n\n${process.env.COMPANY_NAME || ""} ${process.env.VAT_NUMBER ? "· VAT " + process.env.VAT_NUMBER : ""}` }); sent++; } catch (e) { console.warn(e.message); } }
    audit(req, `Sent invoices to ${sent} clients`); res.json({ sent });
  }));
  // ---- provider health: test one / all, maintenance flag, public status
  app.post("/v1/admin/providers/:key/test", requireUser, requireAdmin("providers.manage"), wrap(async (req, res) => { const r = await testProvider(req.params.key); audit(req, "Tested provider " + req.params.key + " → " + r.state); res.json(r); }));
  app.post("/v1/admin/providers-test", requireUser, requireAdmin("providers.manage"), wrap(async (req, res) => res.json(await testAll())));
  app.put("/v1/admin/providers/:key/maintenance", requireUser, requireAdmin("providers.manage"), (req, res) => { const st = S(); st.maintenance = st.maintenance || {}; st.maintenance[req.params.key] = !!req.body.on; save(); audit(req, `Maintenance ${req.body.on ? "on" : "off"} · ${req.params.key}`); res.json({ ok: true }); });
  app.get("/v1/status", (req, res) => res.json({ providers: publicStatus(), t: Date.now() }));
  // ---- CRM & ERP data (small JSON documents, permission-checked)
  const DATA_PERM = { crm: ["users.view", "users.edit"], erp: ["analytics.view", "payments.manage"] };
  app.get("/v1/admin/data/:name", requireUser, (req, res, next) => { const p = DATA_PERM[req.params.name]; if (!p) return res.status(404).json({ error: "Unknown" }); return requireAdmin(p[0])(req, res, () => res.json({ value: col("admdata", {})[req.params.name] || null })); });
  app.put("/v1/admin/data/:name", requireUser, (req, res) => { const p = DATA_PERM[req.params.name]; if (!p) return res.status(404).json({ error: "Unknown" }); return requireAdmin(p[1])(req, res, () => { const v = req.body && req.body.value; if (!v || typeof v !== "object" || JSON.stringify(v).length > 2e6) return res.status(400).json({ error: "Invalid" }); col("admdata", {})[req.params.name] = v; save(); audit(req, "Updated " + req.params.name.toUpperCase()); res.json({ ok: true }); }); });
  // ---- client support
  app.get("/v1/support/tickets", requireUser, (req, res) => res.json({ tickets: col("tickets", []).filter((t) => t.uid === req.user.uid).map((t) => ({ ...t, messages: t.messages.filter((m) => !m.internal) })) }));
  app.post("/v1/support/tickets", requireUser, wrap(async (req, res) => {
    const U = user(req.user.uid), b = req.body || {}; if (!b.subject || !b.message) return res.status(400).json({ error: "Subject and message required" });
    const t = { id: uid().slice(0, 6), uid: req.user.uid, name: U.profile?.name || "", email: req.user.email || U.profile?.email || "", subject: String(b.subject).slice(0, 160), category: b.category || "other", status: "open", priority: b.category === "billing" ? "high" : "normal", created: Date.now(), messages: [{ from: "user", text: String(b.message).slice(0, 8000), t: Date.now() }] };
    col("tickets", []).unshift(t); save();
    if (t.email) sendEmail({ to: t.email, subject: `We got your request [#${t.id}]`, text: `Thanks — we received your ticket "${t.subject}" and will reply within 1 business day.\n\nشكراً لك — وصلتنا تذكرتك وسنرد خلال يوم عمل واحد.` }).catch(() => {});
    sendEmail({ to: process.env.SUPPORT_INBOX || "contact@nooi.ai", subject: `[Ticket #${t.id}] ${t.subject}`, text: `${t.email}\n\n${b.message}` }).catch(() => {});
    res.json(t);
  }));
  app.post("/v1/support/tickets/:id/messages", requireUser, (req, res) => { const t = col("tickets", []).find((x) => x.id === req.params.id && x.uid === req.user.uid); if (!t) return res.status(404).json({ error: "Not found" }); t.messages.push({ from: "user", text: String(req.body.text || "").slice(0, 8000), t: Date.now() }); t.status = "open"; t.updated = Date.now(); save(); res.json(t); });
}
