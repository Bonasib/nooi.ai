// Top-ups, gift cards and invoices end to end, with the test-only payment provider (PAYMENT_TEST=1).
// Checkout → provider return → credits / gift code → invoice (VAT inside the total) → redeem → plan or credits.
// Run: node tests/gifts_e2e.mjs
import { spawn } from "child_process"; import path from "path"; import url from "url"; import fs from "fs"; import os from "os";
const ROOT = path.resolve(path.dirname(url.fileURLToPath(import.meta.url)), "..");
const PORT = 8094, B = `http://localhost:${PORT}`;
// a throw-away working copy of the data so the real data/ is never touched
const work = fs.mkdtempSync(path.join(os.tmpdir(), "nooi-gifts-"));
for (const d of ["public", "lib", "providers", "node_modules", "server.js", "package.json", "i18n"]) if (fs.existsSync(path.join(ROOT, d))) fs.symlinkSync(path.join(ROOT, d), path.join(work, d));
const srv = spawn("node", ["server.js"], { cwd: work, env: { ...process.env, PORT: String(PORT), SECRET_KEY: "g".repeat(40), FIREBASE_PROJECT_ID: "", PAYMENT_TEST: "1", PAYMENT_PROVIDER: "test", PUBLIC_BASE_URL: B, COMPANY_VAT: "300000000000003" }, stdio: "ignore" });
let pass = 0, fail = 0; const ok = (c, m) => { c ? pass++ : fail++; console.log((c ? "✓ " : "✗ ") + m); };
const api = async (p, o = {}) => { const r = await fetch(B + p, { method: o.method || (o.json ? "POST" : "GET"), headers: { "content-type": "application/json" }, body: o.json ? JSON.stringify(o.json) : undefined, redirect: "manual" }); const t = await r.text(); let d; try { d = JSON.parse(t); } catch { d = { text: t }; } return { status: r.status, d, loc: r.headers.get("location") }; };
const buy = async (json) => { const c = await api("/v1/billing/checkout", { json: { currency: "SAR", ...json } }); if (!c.d.url) return { c }; const u = new URL(c.d.url); const r = await api(u.pathname + u.search); return { c, r }; };
try {
  for (let i = 0; i < 80; i++) { try { await api("/v1/config"); break; } catch { await new Promise((r) => setTimeout(r, 250)); } }
  const cat = (await api("/v1/gifts/catalog")).d;
  ok(cat.topups?.map((x) => x.credits).join() === "200,500,800,1200" && cat.topups.every((x) => x.SAR > 0 && x.USD > 0), "catalog: top-ups 200 · 500 · 800 · 1200 with SAR and USD prices");
  ok(cat.giftPlans?.length === 3 && cat.giftPlans.every((p) => p.months.map((m) => m.months).join() === "1,3,6,12") && cat.giftPlans[0].months[3].SAR < cat.giftPlans[0].months[0].SAR * 12, "catalog: gift plans for 1, 3, 6, 12 months; a year costs less than 12 months");
  const b0 = (await api("/v1/billing")).d.credits;
  let { c, r } = await buy({ item: "cr800" });
  ok(c.status === 200 && r && /paid=1/.test(r.loc) && /inv=NOOI-/.test(r.loc), "top-up 800: checkout → paid → redirected with the invoice number (" + (c.d.error || r?.loc) + ")");
  ok((await api("/v1/billing")).d.credits === b0 + 800, "top-up 800: credits added");
  ({ c, r } = await buy({ item: "cr:750" }));
  ok((await api("/v1/billing")).d.credits === b0 + 1550, "custom amount (750 credits) bought and added");
  ok((await api("/v1/billing/checkout", { json: { item: "cr:5", currency: "SAR" } })).status === 400, "custom amount below the minimum is refused");
  const invs = (await api("/v1/billing/invoices")).d.items || [];
  ok(invs.length === 2 && invs.every((i) => /^NOOI-\d{4}-\d{6}$/.test(i.no)), "two invoices, numbered NOOI-<year>-<000001>");
  const inv = (await api("/v1/billing/invoices/" + invs[0].no)).d;
  ok(inv.net + inv.vat === inv.total && Math.abs(inv.vat - inv.total * 15 / 115) <= 1 && inv.seller.vat === "300000000000003", "invoice: VAT 15% inside the total, seller VAT number shown");
  ok((await api("/v1/billing/invoices/NOOI-1999-000001")).status === 404, "invoice: unknown number → 404");
  // gift card: credits, with a message
  ({ c, r } = await buy({ item: "gift:cr:1200", gift: { toName: "Lina", fromName: "Omar", message: "Happy birthday!", design: "sunset" } }));
  const code = r && new URL(r.loc, B).searchParams.get("gift");
  ok(/^NOOI-[A-Z2-9]{4}-[A-Z2-9]{4}-[A-Z2-9]{4}$/.test(code || ""), "gift card bought → code " + code);
  ok((await api("/v1/billing")).d.credits === b0 + 1550, "buying a gift does not add credits to the buyer");
  const mine = (await api("/v1/gifts/mine")).d.bought || [];
  ok(mine.length === 1 && mine[0].code === code && mine[0].toName === "Lina" && mine[0].design === "sunset" && !mine[0].redeemed, "my gift cards: code, recipient, design, not yet used");
  ok((await api("/v1/gifts/redeem", { json: { code: "NOOI-AAAA-BBBB-CCCC" } })).status === 404, "redeem: a wrong code is refused");
  const red = await api("/v1/gifts/redeem", { json: { code: code.toLowerCase().replace(/-/g, " ") } });
  ok(red.status === 200 && red.d.credits === 1200 && (await api("/v1/billing")).d.credits === b0 + 2750, "redeem: code typed in lower case with spaces works → +1,200 credits");
  ok((await api("/v1/gifts/redeem", { json: { code } })).status === 409, "redeem: the same code can't be used twice");
  // gift card: a plan for 3 months
  ({ c, r } = await buy({ item: "gift:plan:pro:3", gift: { toEmail: "friend@example.com", fromName: "Omar" } }));
  const code2 = r && new URL(r.loc, B).searchParams.get("gift"); const red2 = await api("/v1/gifts/redeem", { json: { code: code2 } });
  const bill = (await api("/v1/billing")).d;
  ok(red2.status === 200 && bill.plan === "pro" || bill.staff, "redeem plan gift: Pro plan for 3 months (" + JSON.stringify(red2.d).slice(0, 120) + ")");
  ok(Math.abs((bill.planUntil || red2.d.planUntil) - Date.now() - 90 * 864e5) < 864e5, "redeem plan gift: plan runs ~90 days");
  ok(((await api("/v1/billing/invoices")).d.items || []).length === 4, "every purchase has an invoice (2 top-ups + 2 gift cards)");
  ok((await api("/v1/billing/checkout", { json: { item: "gift:cr:500", currency: "SAR", gift: { toEmail: "not-an-email" } } })).status === 400, "gift with a bad recipient email is refused");
  // staff promo codes
  const promo = await api("/v1/admin/gifts", { json: { kind: "credits", credits: 300, count: 3, note: "Instagram giveaway" } });
  ok(promo.status === 200 && promo.d.codes?.length === 3, "admin: 3 promo gift codes made");
  const list = (await api("/v1/admin/gifts")).d.items || [];
  ok(list.filter((g) => g.promo).length === 3 && list.some((g) => g.redeemedBy), "admin: list shows promo codes and who redeemed");
} catch (e) { ok(false, "crashed: " + e.message); }
finally { srv.kill(); setTimeout(() => fs.rmSync(work, { recursive: true, force: true }), 300); }
console.log(`\n${pass} passed, ${fail} failed`); setTimeout(() => process.exit(fail ? 1 : 0), 400);
