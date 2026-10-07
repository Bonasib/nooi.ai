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
    hello: "Hi {name},", foot: "You're receiving this because you have a nooi.ai account.", unsub: "Unsubscribe", contact: "Contact us",
  },
  ar: {
    signin: { subject: "رابط الدخول إلى nooi.ai", kicker: "تسجيل الدخول", title: "رابط الدخول جاهز", body: "اضغط الزر لتسجيل الدخول إلى nooi.ai. الرابط يعمل مرة واحدة وتنتهي صلاحيته خلال ساعة.", cta: "ادخل إلى nooi.ai", alt: "أو انسخ هذا الرابط في المتصفح:", safe: "لم تطلب ذلك؟ تجاهل الرسالة — لا يمكن لأحد الدخول بدون الرابط.", codeSubject: "{code} رمز الدخول إلى nooi.ai", codeTitle: "رمز الدخول", codeBody: "أدخل هذا الرمز في nooi.ai لتسجيل الدخول. صالح لمدة 10 دقائق ولمرة واحدة.", codeSafe: "لم تطلب ذلك؟ تجاهل الرسالة — ولا تشارك الرمز مع أي أحد." },
    marketing: { subject: "اصنع فيلمك القادم مع nooi.ai", kicker: "NOOI.AI", title: "كل وصف يصبح فيلماً", body: "اكتب لقطة واحصل على مقطع — ثم أضف الترجمة والدبلجة وانشره في كل مكان. طاقمك الذكي جاهز.", cta: "ابدأ الإنشاء", chips: ["فيديو", "صور", "صوت ودبلجة"] },
    discount: { subject: "خصم {percent}% — هذا الأسبوع فقط", kicker: "عرض محدود", title: "خصم {percent}% على باقتك", body: "رقِّ باقتك الآن واحتفظ بالخصم على أول دفعة.", cta: "احصل على العرض", codeLabel: "رمز الخصم", until: "صالح حتى {date}", off: "خصم" },
    feature: { subject: "جديد في nooi.ai: {title}", kicker: "ميزة جديدة", title: "شيء جديد لتجربه", body: "أطلقنا أداة جديدة في nooi.ai. افتح الاستوديو وجرّبها.", cta: "جرّبها الآن" },
    holiday: { subject: "تهنئة من nooi.ai", kicker: "تهنئة", title: "كل عام وأنتم بخير", body: "شكراً لأنك تصنع معنا. نتمنى لك ولعائلتك أوقاتاً سعيدة.", cta: "افتح nooi.ai", gift: "هدية لك" },
    plain: { subject: "رسالة من nooi.ai", kicker: "", title: "", body: "", cta: "" },
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
export const KINDS = ["signin", "marketing", "discount", "feature", "holiday", "plain"];

const fill = (s, d) => String(s || "").replace(/\{(\w+)\}/g, (_, k) => (d[k] != null && d[k] !== "" ? d[k] : ""));

export function renderEmail(kind, data = {}) {
  if (!KINDS.includes(kind)) kind = "plain";
  const lang = data.lang === "ar" ? "ar" : "en", rtl = lang === "ar", t = T[lang], k = t[kind];
  const d = { ...data, name: data.name || (rtl ? "صديقنا" : "there"), percent: data.percent || 20, date: data.date || "", title: data.title || "" };
  const base = safeUrl(data.base) ? data.base.replace(/\/$/, "") : "https://nooi.ai";
  const hol = HOLIDAYS[data.holiday] || HOLIDAYS.generic;
  const otp = kind === "signin" && /^\d{6}$/.test(String(data.code || ""));
  const title = data.title || (kind === "holiday" ? hol[lang][0] : otp ? k.codeTitle : fill(k.title, d));
  const body = data.body || (kind === "holiday" ? hol[lang][1] : otp ? k.codeBody : fill(k.body, d));
  const cta = otp ? "" : data.cta || k.cta, url = safeUrl(data.url) || safeUrl(data.link) || base;
  const subject = data.subject || (otp ? fill(k.codeSubject, { code: data.code }) : fill(k.subject, { ...d, title })) || title;
  const dir = rtl ? "rtl" : "ltr", align = rtl ? "right" : "left";
  const font = rtl ? "'IBM Plex Sans Arabic',Tahoma,Arial,sans-serif" : "'Geist','Segoe UI',Helvetica,Arial,sans-serif";
  const [c1, c2] = kind === "holiday" ? hol.colors : kind === "discount" ? ["#2b0f3a", "#6d2a8f"] : kind === "feature" ? ["#08262a", "#0f5c5a"] : ["#0b1407", "#26470f"];
  const btn = (label, href) => `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:26px 0 6px"><tr><td style="border-radius:999px;background:#9CD245"><a href="${esc(href)}" style="display:inline-block;padding:14px 30px;font:700 16px ${font};color:#0a1200;text-decoration:none;border-radius:999px">${esc(label)}</a></td></tr></table>`;

  // hero band (logo + kicker + title + badge per poster)
  let badge = "";
  if (kind === "discount") badge = `<div style="display:inline-block;margin-top:18px;padding:14px 24px;border-radius:18px;background:#9CD245;color:#0a1200;font:800 44px/1 ${font}">${esc(d.percent)}%<span style="font-size:16px;font-weight:700;margin-${rtl ? "right" : "left"}:6px">${esc(k.off)}</span></div>`;
  if (kind === "holiday") badge = `<div style="font-size:54px;line-height:1;margin-top:14px">${hol.emoji}</div>`;
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
  else if (kind === "holiday") extra = (data.code ? `<p style="margin:20px 0 0;font:600 14px ${font};color:#141713">🎁 ${esc(k.gift)}: <span style="font-family:monospace;padding:4px 10px;border-radius:8px;background:#f3f4f0;direction:ltr;display:inline-block">${esc(data.code)}</span></p>` : "") + btn(cta, url);
  else if (cta) extra = btn(cta, url);

  const greet = kind === "signin" ? "" : `<p style="margin:0 0 12px;font:600 16px ${font};color:#141713">${esc(fill(t.hello, d))}</p>`;
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
