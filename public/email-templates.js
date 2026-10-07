// nooi.ai email "posters": branded, email-safe HTML (tables + inline styles) shared by the server (sending)
// and the admin dashboard (live preview). Kinds: signin · marketing · discount · feature · holiday · plain.
// renderEmail(kind, data) → { subject, html, text }. Every user-supplied value is escaped; links must be http(s).

const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const safeUrl = (u) => (/^https?:\/\/[^\s"<>]+$/i.test(String(u || "")) ? String(u) : "");
const br = (s) => esc(s).replace(/\r?\n/g, "<br>");

const T = {
  en: {
    signin: { subject: "Your nooi.ai sign-in link", kicker: "SIGN IN", title: "Your sign-in link is here", body: "Tap the button to sign in to nooi.ai. The link works once and expires in 1 hour.", cta: "Sign in to nooi.ai", alt: "Or paste this link into your browser:", safe: "Didn't ask for this? You can ignore this email — nobody can sign in without the link.", codeSubject: "{code} is your nooi.ai code", codeTitle: "Your sign-in code", codeBody: "Enter this code on nooi.ai to sign in. It expires in 10 minutes and works once.", codeSafe: "Didn't ask for this? Ignore this email — never share the code with anyone." },
    marketing: { subject: "Make your next film with nooi.ai", kicker: "NOOI.AI", title: "Every prompt is a film", body: "Write a shot, get a clip — then subtitle it, dub it and publish it everywhere. Your AI film crew is ready.", cta: "Start creating", chips: ["Video", "Images", "Voice & dubbing"] },
    discount: { subject: "{percent}% off — this week only", kicker: "LIMITED OFFER", title: "{percent}% off your plan", body: "Upgrade now and keep the discount on your first payment.", cta: "Claim the offer", codeLabel: "Your code", until: "Valid until {date}", off: "OFF" },
    feature: { subject: "New in nooi.ai: {title}", kicker: "NEW FEATURE", title: "Something new to try", body: "We just shipped a new tool in nooi.ai. Open the studio to try it.", cta: "Try it now" },
    holiday: { subject: "Greetings from nooi.ai", kicker: "SEASON'S GREETINGS", title: "Happy holidays", body: "Thank you for creating with us. Wishing you and your family a wonderful season.", cta: "Open nooi.ai", gift: "A gift for you" },
    plain: { subject: "A message from nooi.ai", kicker: "", title: "", body: "", cta: "" },
    gift: { subject: "{fromName} sent you a nooi.ai gift card 🎁", subjectAnon: "You received a nooi.ai gift card 🎁", kicker: "GIFT CARD", title: "A gift to create with", body: "{fromName} sent you a nooi.ai gift card. Use it to make videos, images, voice and more with AI.", bodyAnon: "You received a nooi.ai gift card. Use it to make videos, images, voice and more with AI.", cta: "Redeem your gift", codeLabel: "Your gift code", how: "Open nooi.ai → Credits → Redeem a code, or tap the button.", valid: "Valid for 12 months." },
    receipt: { subject: "Your nooi.ai receipt · {no}", kicker: "RECEIPT", title: "Payment received — thank you", body: "Here is your invoice. You can view, print or download every invoice any time from Credits & transactions.", cta: "View my invoices", inv: "Invoice", date: "Date", item: "Item", net: "Amount before VAT", vat: "VAT", total: "Total paid", method: "Paid with", giftLine: "Gift code" },
    giftpromo: { subject: "Give the gift of creativity 🎁", kicker: "NEW · GIFT CARDS", title: "Give someone an AI film studio", body: "nooi.ai gift cards are here. Send credits or a Basic, Pro or Studio plan for 1, 3, 6 or 12 months — with your own message and a card they'll love.", cta: "Send a gift card" },
    topup: { subject: "Top up anytime — credits from 200", kicker: "CREDITS", title: "Never run out mid-project", body: "Add credits whenever you need them: 200, 500, 800 or 1,200 — or type any amount. They never expire while your account is active.", cta: "Top up credits", chips: ["200", "500", "800", "1,200", "Any amount"] },
    hello: "Hi {name},", foot: "You're receiving this because you have a nooi.ai account.", unsub: "Unsubscribe", contact: "Contact us",
  },
  ar: {
    signin: { subject: "رابط الدخول إلى nooi.ai", kicker: "تسجيل الدخول", title: "رابط الدخول جاهز", body: "اضغط الزر لتسجيل الدخول إلى nooi.ai. الرابط يعمل مرة واحدة وتنتهي صلاحيته خلال ساعة.", cta: "ادخل إلى nooi.ai", alt: "أو انسخ هذا الرابط في المتصفح:", safe: "لم تطلب ذلك؟ تجاهل الرسالة — لا يمكن لأحد الدخول بدون الرابط.", codeSubject: "{code} رمز الدخول إلى nooi.ai", codeTitle: "رمز الدخول", codeBody: "أدخل هذا الرمز في nooi.ai لتسجيل الدخول. صالح لمدة 10 دقائق ولمرة واحدة.", codeSafe: "لم تطلب ذلك؟ تجاهل الرسالة — ولا تشارك الرمز مع أي أحد." },
    marketing: { subject: "اصنع فيلمك القادم مع nooi.ai", kicker: "NOOI.AI", title: "كل وصف يصبح فيلماً", body: "اكتب لقطة واحصل على مقطع — ثم أضف الترجمة والدبلجة وانشره في كل مكان. طاقمك الذكي جاهز.", cta: "ابدأ الإنشاء", chips: ["فيديو", "صور", "صوت ودبلجة"] },
    discount: { subject: "خصم {percent}% — هذا الأسبوع فقط", kicker: "عرض محدود", title: "خصم {percent}% على باقتك", body: "رقِّ باقتك الآن واحتفظ بالخصم على أول دفعة.", cta: "احصل على العرض", codeLabel: "رمز الخصم", until: "صالح حتى {date}", off: "خصم" },
    feature: { subject: "جديد في nooi.ai: {title}", kicker: "ميزة جديدة", title: "شيء جديد لتجربه", body: "أطلقنا أداة جديدة في nooi.ai. افتح الاستوديو وجرّبها.", cta: "جرّبها الآن" },
    holiday: { subject: "تهنئة من nooi.ai", kicker: "تهنئة", title: "كل عام وأنتم بخير", body: "شكراً لأنك تصنع معنا. نتمنى لك ولعائلتك أوقاتاً سعيدة.", cta: "افتح nooi.ai", gift: "هدية لك" },
    plain: { subject: "رسالة من nooi.ai", kicker: "", title: "", body: "", cta: "" },
    gift: { subject: "أرسل لك {fromName} بطاقة هدية من nooi.ai 🎁", subjectAnon: "وصلتك بطاقة هدية من nooi.ai 🎁", kicker: "بطاقة هدية", title: "هدية لتصنع بها", body: "أرسل لك {fromName} بطاقة هدية من nooi.ai. استخدمها لصنع الفيديو والصور والأصوات وغيرها بالذكاء الاصطناعي.", bodyAnon: "وصلتك بطاقة هدية من nooi.ai. استخدمها لصنع الفيديو والصور والأصوات وغيرها بالذكاء الاصطناعي.", cta: "استخدم هديتك", codeLabel: "رمز الهدية", how: "افتح nooi.ai ← الرصيد ← استخدام رمز، أو اضغط الزر.", valid: "صالحة لمدة 12 شهراً." },
    receipt: { subject: "إيصالك من nooi.ai · {no}", kicker: "إيصال", title: "تم استلام الدفعة — شكراً لك", body: "هذه فاتورتك. يمكنك عرض كل فواتيرك وطباعتها وتنزيلها في أي وقت من صفحة الرصيد والمعاملات.", cta: "عرض فواتيري", inv: "رقم الفاتورة", date: "التاريخ", item: "البند", net: "المبلغ قبل الضريبة", vat: "ضريبة القيمة المضافة", total: "الإجمالي المدفوع", method: "طريقة الدفع", giftLine: "رمز الهدية" },
    giftpromo: { subject: "أهدِ الإبداع 🎁", kicker: "جديد · بطاقات الهدايا", title: "أهدِ شخصاً استوديو أفلام بالذكاء الاصطناعي", body: "وصلت بطاقات الهدايا من nooi.ai. أرسل رصيداً أو باقة أساسية أو احترافية أو استوديو لمدة 1 أو 3 أو 6 أو 12 شهراً — مع رسالتك الخاصة وبطاقة ستُعجبهم.", cta: "أرسل بطاقة هدية" },
    topup: { subject: "اشحن رصيدك في أي وقت — من 200 رصيد", kicker: "الرصيد", title: "لا ينفد رصيدك في منتصف المشروع", body: "أضف الرصيد متى احتجت: 200 أو 500 أو 800 أو 1,200 — أو اكتب أي كمية. لا ينتهي ما دام حسابك نشطاً.", cta: "اشحن الرصيد", chips: ["200", "500", "800", "1,200", "أي كمية"] },
    hello: "مرحباً {name}،", foot: "وصلتك هذه الرسالة لأن لديك حساباً في nooi.ai.", unsub: "إلغاء الاشتراك", contact: "تواصل معنا",
  },
};
// Ready-made greetings for the holiday poster (admin picks one; text stays editable)
export const HOLIDAYS = {
  ramadan: { emoji: "🌙", colors: ["#1b1446", "#3b2a8f"], en: ["Ramadan Kareem", "Wishing you a blessed Ramadan full of peace, family and inspiration."], ar: ["رمضان كريم", "نتمنى لك شهراً مباركاً مليئاً بالسكينة واللمة والإلهام."] },
  eid: { emoji: "🎉", colors: ["#0f3d2e", "#1f7a55"], en: ["Eid Mubarak", "Happy Eid to you and your loved ones — may every day bring joy."], ar: ["عيد مبارك", "كل عام وأنتم بخير — عساكم من عواده."] },
  national: { emoji: "🇸🇦", colors: ["#0b3d1f", "#167a3a"], en: ["Happy Saudi National Day", "Celebrating the Kingdom with you — proud to create together."], ar: ["اليوم الوطني السعودي", "نحتفل بالوطن معكم — فخورون بأن نصنع معاً."] },
  founding: { emoji: "🏛️", colors: ["#3d2a12", "#7a5a24"], en: ["Happy Founding Day", "Honouring three centuries of history and heritage."], ar: ["يوم التأسيس", "نحتفي بثلاثة قرون من التاريخ والأصالة."] },
  newyear: { emoji: "✨", colors: ["#141414", "#3a3a3a"], en: ["Happy New Year", "New year, new stories — we can't wait to see what you make."], ar: ["سنة سعيدة", "سنة جديدة وقصص جديدة — متحمسون لما ستصنعه."] },
  generic: { emoji: "🎊", colors: ["#1d2a0c", "#3f6a17"], en: ["Happy holidays", "Thank you for creating with us. Wishing you a wonderful season."], ar: ["كل عام وأنتم بخير", "شكراً لأنك تصنع معنا. نتمنى لك أوقاتاً سعيدة."] },
};
export const KINDS = ["signin", "marketing", "discount", "feature", "holiday", "plain", "gift", "receipt", "giftpromo", "topup"];
// designs of the gift card (email hero + the picture made in the browser)
export const GIFT_COLORS = { aurora: ["#0b1407", "#2f5a12", "#9CD245"], midnight: ["#0b1020", "#2a3478", "#8EA8FF"], sunset: ["#3a1208", "#b4521c", "#FFC27A"], eid: ["#0f3d2e", "#1f7a55", "#E9D27A"] };
export const money = (v, cur) => (v / 100).toLocaleString("en", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " " + (cur || "SAR");
export function giftValue(g, lang) { const ar = lang === "ar";
  if (g.kind === "plan" || g.plan) { const P = { basic: ar ? "الأساسية" : "Basic", pro: ar ? "الاحترافية" : "Pro", studio: ar ? "الاستوديو" : "Studio" }[g.plan] || g.plan, m = +g.months;
    return ar ? `باقة ${P} · ${m === 12 ? "سنة كاملة" : m + (m === 1 ? " شهر" : " أشهر")}` : `${P} plan · ${m === 12 ? "1 year" : m + (m === 1 ? " month" : " months")}`; }
  return (+g.credits || 0).toLocaleString("en") + (ar ? " رصيد" : " credits"); }
// printable invoice (the site shows it in a sheet with Print / Save as PDF; the receipt email embeds the table)
export function invoiceTable(inv, lang) { const ar = lang === "ar", t = T[ar ? "ar" : "en"].receipt, font = ar ? "'IBM Plex Sans Arabic',Tahoma,Arial,sans-serif" : "'Geist','Segoe UI',Helvetica,Arial,sans-serif", al = ar ? "right" : "left", ar2 = ar ? "left" : "right";
  const row = (k, v, b) => `<tr><td style="padding:8px 0;border-bottom:1px solid #eceee8;font:${b ? 700 : 400} 14px ${font};color:#4b5563;text-align:${al}">${esc(k)}</td><td style="padding:8px 0;border-bottom:1px solid #eceee8;font:${b ? 800 : 600} ${b ? 16 : 14}px ${font};color:#141713;text-align:${ar2};direction:ltr">${esc(v)}</td></tr>`;
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:22px 0 0">${row(t.inv, inv.no)}${row(t.date, new Date(inv.date).toISOString().slice(0, 10))}${row(t.item, (inv.items[0] || {}).desc || "")}${inv.gift ? row(t.giftLine, inv.gift.code) : ""}${row(t.net, money(inv.net, inv.currency))}${row(t.vat + " " + inv.vatRate + "%", money(inv.vat, inv.currency))}${row(t.total, money(inv.total, inv.currency), true)}${inv.provider ? row(t.method, inv.provider) : ""}</table>`; }
export function renderInvoice(inv, lang) { const ar = lang === "ar", dir = ar ? "rtl" : "ltr", font = ar ? "'IBM Plex Sans Arabic',Tahoma,Arial,sans-serif" : "'Geist','Segoe UI',Helvetica,Arial,sans-serif", S = inv.seller || {}, B = inv.buyer || {};
  const L = (en, a) => (ar ? a : en);
  return `<!doctype html><html lang="${ar ? "ar" : "en"}" dir="${dir}"><head><meta charset="utf-8"><title>${esc(inv.no)}</title><style>body{margin:0;background:#fff;color:#141713;font:14px/1.6 ${font}}.w{max-width:720px;margin:0 auto;padding:36px 28px}h1{font-size:26px;margin:0}.top{display:flex;justify-content:space-between;align-items:flex-start;gap:20px;flex-wrap:wrap}.muted{color:#6b7280}.box{border:1px solid #e5e7df;border-radius:14px;padding:14px 16px;flex:1;min-width:220px}.paid{display:inline-block;padding:4px 12px;border-radius:999px;background:#eef6e2;color:#2c5a12;font-weight:700;font-size:12px}@media print{.w{padding:0}}</style></head><body><div class="w">
<div class="top"><div><div style="font:800 22px ${font};color:#3E7B22">nooi<span style="color:#9CD245">.ai</span></div><h1>${L("Tax invoice", "فاتورة ضريبية")}</h1><div class="muted" style="direction:ltr;text-align:${ar ? "right" : "left"}">${esc(inv.no)}</div></div><div style="text-align:${ar ? "left" : "right"}"><span class="paid">${L("PAID", "مدفوعة")}</span><div class="muted" style="margin-top:6px">${new Date(inv.date).toISOString().slice(0, 10)}</div></div></div>
<div class="top" style="margin-top:22px"><div class="box"><b>${L("From", "من")}</b><br>${esc(S.name || "nooi.ai")}${S.address ? "<br>" + esc(S.address) : ""}${S.vat ? `<br>${L("VAT no.", "الرقم الضريبي")}: <span style="direction:ltr">${esc(S.vat)}</span>` : ""}${S.cr ? `<br>${L("CR", "السجل التجاري")}: ${esc(S.cr)}` : ""}<br>${esc(S.email || "contact@nooi.ai")}</div><div class="box"><b>${L("Billed to", "إلى")}</b><br>${esc(B.name || "—")}<br><span style="direction:ltr">${esc(B.email || "")}</span>${B.cid ? `<br>${L("Client ID", "رقم العميل")}: <span style="direction:ltr">${esc(B.cid)}</span>` : ""}</div></div>
${invoiceTable(inv, lang)}
<p class="muted" style="margin-top:18px;font-size:12px">${L(`Prices include ${inv.vatRate}% VAT. Payment reference: `, `الأسعار شاملة ضريبة القيمة المضافة ${inv.vatRate}%. مرجع الدفع: `)}<span style="direction:ltr">${esc(inv.ref || "")}</span>${inv.coupon ? " · " + L("Discount code", "رمز الخصم") + ": " + esc(inv.coupon) : ""}</p></div></body></html>`; }

const fill = (s, d) => String(s || "").replace(/\{(\w+)\}/g, (_, k) => (d[k] != null && d[k] !== "" ? d[k] : ""));

export function renderEmail(kind, data = {}) {
  if (!KINDS.includes(kind)) kind = "plain";
  const lang = data.lang === "ar" ? "ar" : "en", rtl = lang === "ar", t = T[lang], k = t[kind];
  const d = { ...data, name: data.name || (rtl ? "صديقنا" : "there"), percent: data.percent || 20, date: data.date || "", title: data.title || "" };
  const base = safeUrl(data.base) ? data.base.replace(/\/$/, "") : "https://nooi.ai";
  const hol = HOLIDAYS[data.holiday] || HOLIDAYS.generic;
  const anon = kind === "gift" && !data.fromName;
  const otp = kind === "signin" && /^\d{6}$/.test(String(data.code || ""));
  const title = data.title || (kind === "holiday" ? hol[lang][0] : otp ? k.codeTitle : fill(k.title, d));
  const body = data.body || (kind === "holiday" ? hol[lang][1] : otp ? k.codeBody : anon ? k.bodyAnon : fill(k.body, d));
  const cta = otp ? "" : data.cta || k.cta, url = safeUrl(data.url) || safeUrl(data.link) || base;
  const subject = data.subject || (otp ? fill(k.codeSubject, { code: data.code }) : anon ? k.subjectAnon : fill(k.subject, { ...d, title, no: data.invoice?.no || "" })) || title;
  const dir = rtl ? "rtl" : "ltr", align = rtl ? "right" : "left";
  const font = rtl ? "'IBM Plex Sans Arabic',Tahoma,Arial,sans-serif" : "'Geist','Segoe UI',Helvetica,Arial,sans-serif";
  const gc = GIFT_COLORS[data.design] || GIFT_COLORS.aurora;
  const [c1, c2] = kind === "gift" || kind === "giftpromo" ? gc : kind === "holiday" ? hol.colors : kind === "discount" ? ["#2b0f3a", "#6d2a8f"] : kind === "feature" ? ["#08262a", "#0f5c5a"] : ["#0b1407", "#26470f"];
  const btn = (label, href) => `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:26px 0 6px"><tr><td style="border-radius:999px;background:#9CD245"><a href="${esc(href)}" style="display:inline-block;padding:14px 30px;font:700 16px ${font};color:#0a1200;text-decoration:none;border-radius:999px">${esc(label)}</a></td></tr></table>`;

  // hero band (logo + kicker + title + badge per poster)
  let badge = "";
  if (kind === "discount") badge = `<div style="display:inline-block;margin-top:18px;padding:14px 24px;border-radius:18px;background:#9CD245;color:#0a1200;font:800 44px/1 ${font}">${esc(d.percent)}%<span style="font-size:16px;font-weight:700;margin-${rtl ? "right" : "left"}:6px">${esc(k.off)}</span></div>`;
  if (kind === "holiday") badge = `<div style="font-size:54px;line-height:1;margin-top:14px">${hol.emoji}</div>`;
  if (kind === "gift") badge = `<div style="display:inline-block;margin-top:18px;padding:16px 22px;border-radius:18px;background:rgba(255,255,255,.1);border:1px solid rgba(255,255,255,.25);color:#fff;font:800 30px/1.2 ${font}">✦ ${esc(giftValue(data, lang))}</div>`;
  if (kind === "giftpromo") badge = `<div style="font-size:54px;line-height:1;margin-top:14px">🎁</div>`;
  if (kind === "feature") badge = `<div style="display:inline-block;margin-top:16px;padding:6px 14px;border-radius:999px;background:#2DD4A8;color:#04211a;font:800 13px ${font};letter-spacing:${rtl ? 0 : ".08em"}">${rtl ? "جديد" : "NEW"}</div>`;
  const hero = `<tr><td style="background-color:${c1};background-image:linear-gradient(135deg,${c1},${c2});padding:30px 32px 34px;border-radius:22px 22px 0 0;text-align:${align}">
    <img src="${base}/brand/nooi-logo-180.png" width="52" height="52" alt="nooi.ai" style="display:block;border:0;${rtl ? "margin-left:auto" : ""}">
    ${k.kicker ? `<div style="margin-top:22px;font:700 12px ${font};letter-spacing:${rtl ? 0 : ".14em"};color:#CFE13E">${esc(k.kicker)}</div>` : ""}
    ${title ? `<div style="margin-top:8px;font:700 30px/1.3 ${font};color:#ffffff">${esc(title)}</div>` : ""}
    ${badge}</td></tr>`;

  // body per poster
  let extra = "";
  if (otp) extra = `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:26px 0 0"><tr><td style="background:#f3f4f0;border:1px solid #dfe3d8;border-radius:16px;padding:16px 26px;font:800 38px/1 monospace;letter-spacing:.32em;color:#141713;direction:ltr">${esc(data.code)}</td></tr></table><p style="margin:22px 0 0;padding:12px 14px;border-radius:12px;background:#f3f4f0;font:13px/1.6 ${font};color:#4b5563">🔒 ${esc(k.codeSafe)}</p>`;
  else if (kind === "signin") extra = btn(cta, url) + `<p style="margin:18px 0 6px;font:13px/1.6 ${font};color:#6b7280">${esc(k.alt)}</p><p style="margin:0;font:12px/1.5 monospace;color:#3E7B22;word-break:break-all;direction:ltr;text-align:left">${esc(url)}</p><p style="margin:22px 0 0;padding:12px 14px;border-radius:12px;background:#f3f4f0;font:13px/1.6 ${font};color:#4b5563">🔒 ${esc(k.safe)}</p>`;
  else if (kind === "discount") extra = (data.code ? `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:24px 0 0"><tr><td style="border:2px dashed #9CD245;border-radius:14px;padding:14px 22px;text-align:center"><div style="font:600 12px ${font};color:#6b7280">${esc(k.codeLabel)}</div><div style="font:800 26px/1.3 monospace;color:#141713;letter-spacing:.12em;direction:ltr">${esc(data.code)}</div></td></tr></table>` : "") + (d.date ? `<p style="margin:12px 0 0;font:13px ${font};color:#6b7280">${esc(fill(k.until, d))}</p>` : "") + btn(cta, url);
  else if (kind === "marketing") extra = `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:20px 0 0"><tr>${(k.chips || []).map((c) => `<td style="padding:${rtl ? "0 0 0 8px" : "0 8px 0 0"}"><span style="display:inline-block;padding:8px 14px;border-radius:999px;background:#eef6e2;color:#2c5a12;font:600 13px ${font}">${esc(c)}</span></td>`).join("")}</tr></table>` + btn(cta, url);
  else if (kind === "gift") extra = (data.message ? `<p style="margin:18px 0 0;padding:14px 16px;border-${rtl ? "right" : "left"}:4px solid ${gc[2]};background:#f6f7f3;border-radius:10px;font:italic 15px/1.7 ${font};color:#2b2f2a">“${br(data.message)}”${data.fromName ? `<br><span style="font-style:normal;font-weight:700">— ${esc(data.fromName)}</span>` : ""}</p>` : "") + `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:24px 0 0"><tr><td style="border:2px dashed #9CD245;border-radius:14px;padding:14px 22px;text-align:center"><div style="font:600 12px ${font};color:#6b7280">${esc(k.codeLabel)}</div><div style="font:800 24px/1.3 monospace;color:#141713;letter-spacing:.1em;direction:ltr">${esc(data.code || "")}</div></td></tr></table><p style="margin:12px 0 0;font:13px ${font};color:#6b7280">${esc(k.how)} ${esc(k.valid)}</p>` + btn(cta, url);
  else if (kind === "receipt") extra = (data.invoice ? invoiceTable(data.invoice, lang) : "") + btn(cta, url);
  else if (kind === "topup") extra = `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:20px 0 0"><tr>${(k.chips || []).map((c) => `<td style="padding:${rtl ? "0 0 0 8px" : "0 8px 0 0"}"><span style="display:inline-block;padding:8px 14px;border-radius:999px;background:#eef6e2;color:#2c5a12;font:700 13px ${font}">✦ ${esc(c)}</span></td>`).join("")}</tr></table>` + btn(cta, url);
  else if (kind === "holiday") extra = (data.code ? `<p style="margin:20px 0 0;font:600 14px ${font};color:#141713">🎁 ${esc(k.gift)}: <span style="font-family:monospace;padding:4px 10px;border-radius:8px;background:#f3f4f0;direction:ltr;display:inline-block">${esc(data.code)}</span></p>` : "") + btn(cta, url);
  else if (cta) extra = btn(cta, url);

  const greet = kind === "signin" || (kind === "gift" && !data.name) ? "" : `<p style="margin:0 0 12px;font:600 16px ${font};color:#141713">${esc(fill(t.hello, d))}</p>`;
  const unsub = safeUrl(data.unsub);
  const html = `<!doctype html><html lang="${lang}" dir="${dir}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"><title>${esc(subject)}</title></head>
<body style="margin:0;padding:0;background:#eef0ea"><div style="display:none;max-height:0;overflow:hidden">${esc(body).slice(0, 120)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#eef0ea"><tr><td align="center" style="padding:28px 12px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" dir="${dir}" style="max-width:600px;background:#ffffff;border-radius:22px;box-shadow:0 18px 40px -24px rgba(0,0,0,.35)">
${hero}
<tr><td style="padding:30px 32px 34px;text-align:${align};font:16px/1.75 ${font};color:#2b2f2a">${greet}<div>${br(body)}</div>${extra}</td></tr>
</table>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px"><tr><td style="padding:18px 12px;text-align:center;font:12px/1.7 ${font};color:#8a8f86" dir="${dir}">nooi.ai · ${esc(t.foot)}<br><a href="mailto:contact@nooi.ai" style="color:#3E7B22">${esc(t.contact)}</a>${unsub ? ` · <a href="${esc(unsub)}" style="color:#8a8f86">${esc(t.unsub)}</a>` : ""}</td></tr></table>
</td></tr></table></body></html>`;
  const text = [kind === "signin" ? "" : fill(t.hello, d), title, body, otp ? data.code : data.code ? `${kind === "discount" ? k.codeLabel : "Code"}: ${data.code}` : "", cta ? `${cta}: ${url}` : "", unsub ? `${t.unsub}: ${unsub}` : ""].filter(Boolean).join("\n\n");
  return { subject, html, text };
}
