// Icon stickers and banners — the classic editor's (v131), drawn with Google's Material Symbols (Apache-2.0, see
// MATERIAL-ICONS-LICENSE.txt). Each one is drawn on a canvas into a PNG, so it is a picture like any other: on the timeline, in the
// library and in every export. A banner's lines and colour are yours to change before it is added.
import ICONS from "./material-icons.json";

const D = ICONS as Record<string, string | string[]>;
const path = (n: string) => { const d = D[n]; return d ? new Path2D(Array.isArray(d) ? d.join(" ") : d) : null; };
const FONT = '"Inter","IBM Plex Sans Arabic","Cairo",system-ui,Arial,sans-serif';
const rtl = (s: string) => /[֐-ࣿ]/.test(s);
const ink = (c: string) => { const h = c.replace("#", ""); if (h.length < 6) return "#111"; const r = parseInt(h.slice(0, 2), 16), g = parseInt(h.slice(2, 4), 16), b = parseInt(h.slice(4, 6), 16); return (r * 299 + g * 587 + b * 114) / 1000 > 150 ? "#111111" : "#ffffff"; };
function icon(x: CanvasRenderingContext2D, n: string, cx: number, cy: number, size: number, fill: string, stroke?: { w: number; col: string }) {
  const p = path(n); if (!p) return; x.save(); x.translate(cx - size / 2, cy + size / 2); x.scale(size / 960, size / 960);
  if (stroke) { x.lineJoin = "round"; x.lineWidth = (stroke.w * 960) / size; x.strokeStyle = stroke.col; x.stroke(p); } x.fillStyle = fill; x.fill(p); x.restore();
}

// ---- icon stickers: [icon, colour]
export const ICON_STICKERS: [string, string][] = [["favorite", "#ff5a5f"], ["thumb_up", "#4dc3ff"], ["star", "#ffd36a"], ["bolt", "#ffd36a"], ["local_fire_department", "#ff7a1a"], ["celebration", "#c38bff"], ["check_circle", "#2dd4a8"], ["verified", "#4dc3ff"],
  ["arrow_forward", "#00F0FF"], ["arrow_downward", "#00F0FF"], ["touch_app", "#ffffff"], ["rocket_launch", "#c38bff"], ["lightbulb", "#ffd36a"], ["trending_up", "#2dd4a8"], ["music_note", "#ff5a5f"], ["mic", "#ffffff"],
  ["chat_bubble", "#ffffff"], ["share", "#ffffff"], ["bookmark", "#ffd36a"], ["notifications", "#ff3b30"], ["person_add", "#00F0FF"], ["location_on", "#ff5a5f"], ["shopping_bag", "#00F0FF"], ["sell", "#ffd36a"],
  ["schedule", "#ffffff"], ["flag", "#ff5a5f"], ["mail", "#4dc3ff"], ["call", "#2dd4a8"], ["link", "#4dc3ff"], ["campaign", "#ff3b30"], ["play_circle", "#ffffff"], ["alternate_email", "#00F0FF"], ["pets", "#ffd36a"], ["flight", "#4dc3ff"], ["restaurant", "#ff7a1a"], ["home", "#ffffff"]];
export const iconName = (n: string) => n.replace(/_/g, " ");
/** an icon sticker: the icon in its colour with a white outline and a soft shadow (512 px) */
export function drawIconSticker(n: string, col: string, size = 512): HTMLCanvasElement {
  const cv = Object.assign(document.createElement("canvas"), { width: size, height: size }); const x = cv.getContext("2d")!; const S = size * 0.78;
  x.shadowColor = "rgba(0,0,0,.35)"; x.shadowBlur = size * 0.03; icon(x, n, size / 2, size / 2, S, "#ffffff", { w: S * 0.1, col: "#ffffff" }); x.shadowBlur = 0; icon(x, n, size / 2, size / 2, S, col);
  return cv;
}

// ---- banners: [id, name, style, icon, colour, first line, second line]
export type BannerStyle = "pill" | "button" | "tag" | "news" | "quote" | "badge" | "pin" | "social";
export interface Banner { id: string; en: string; ar: string; style: BannerStyle; icon: string; color: string; l1: [string, string]; l2: [string, string] }
const B = (id: string, en: string, ar: string, style: BannerStyle, icon: string, color: string, l1: [string, string], l2: [string, string]): Banner => ({ id, en, ar, style, icon, color, l1, l2 });
export const BANNERS: Banner[] = [
  B("sub", "Subscribe", "اشترك", "pill", "notifications", "#ff3b30", ["Subscribe", "اشترك"], ["New videos every week", "فيديوهات جديدة كل أسبوع"]),
  B("follow", "Follow", "تابع", "pill", "person_add", "#00F0FF", ["@nooi.ai", "@nooi.ai"], ["Follow for more", "تابعنا للمزيد"]),
  B("place", "Location", "الموقع", "pin", "location_on", "#ff5a5f", ["Riyadh", "الرياض"], ["Saudi Arabia", "المملكة العربية السعودية"]),
  B("sale", "Sale tag", "وسم تخفيض", "tag", "sell", "#ffd36a", ["50% OFF", "خصم 50%"], ["This week only", "هذا الأسبوع فقط"]),
  B("shop", "Shop now", "تسوّق الآن", "button", "shopping_bag", "#00F0FF", ["Shop now", "تسوّق الآن"], ["", ""]),
  B("news", "Breaking news", "خبر عاجل", "news", "campaign", "#ff3b30", ["BREAKING", "عاجل"], ["Your headline here", "عنوانك هنا"]),
  B("quote", "Quote", "اقتباس", "quote", "format_quote", "#00F0FF", ["Make every second count.", "اجعل كل ثانية تستحق."], ["nooi", "nooi"]),
  B("call", "Call us", "اتصل بنا", "pill", "call", "#2dd4a8", ["Call us", "اتصل بنا"], ["+966 50 000 0000", "+966 50 000 0000"]),
  B("verified", "Verified", "موثّق", "badge", "verified", "#4dc3ff", ["Verified", "موثّق"], ["Official account", "حساب رسمي"]),
  B("social", "Like & share", "أعجبني وشارك", "social", "favorite", "#ff5a5f", ["Like · Comment · Share", "أعجبني · علّق · شارك"], ["", ""]),
];
function rr(x: CanvasRenderingContext2D, X: number, Y: number, w: number, h: number, r: number) { x.beginPath(); if (x.roundRect) x.roundRect(X, Y, w, h, r); else x.rect(X, Y, w, h); }
/** a banner as a picture: its width follows its words (height ≈ 260 px for one or two lines) */
export function drawBanner(b: Pick<Banner, "style" | "icon" | "color">, l1: string, l2: string): HTMLCanvasElement {
  const U = 260, R = rtl(l1 + l2), m = document.createElement("canvas").getContext("2d")!;
  const w = (s: string, wt: number, px: number) => { m.font = `${wt} ${px}px ${FONT}`; return s ? m.measureText(s).width : 0; };
  const ac = b.color, fg = ink(ac), st = b.style, two = !!l2.trim(), pad = U * 0.16;
  let W = 0, H = 0; const ops: ((x: CanvasRenderingContext2D) => void)[] = [];
  const text = (x: CanvasRenderingContext2D, s: string, wt: number, px: number, col: string, X: number, Y: number, align: CanvasTextAlign = R ? "right" : "left") => { x.shadowBlur = 0; x.shadowOffsetY = 0; x.font = `${wt} ${px}px ${FONT}`; x.fillStyle = col; x.textAlign = align; x.textBaseline = "middle"; x.direction = R ? "rtl" : "ltr"; x.fillText(s, X, Y); };
  const F1 = U * 0.24, F2 = U * 0.15;
  if (st === "pill" || st === "badge" || st === "social") {
    const ch = U * 0.7, tw = Math.max(w(l1, 800, F1), w(l2, 500, F2)); W = pad + ch + pad * 0.8 + tw + pad * 1.4; H = U;
    ops.push((x) => {
      rr(x, 0, 0, W, H, st === "badge" ? U * 0.22 : H / 2); x.fillStyle = st === "badge" ? ac : "rgba(10,12,14,.88)"; x.fill();
      const cx = R ? W - pad - ch / 2 : pad + ch / 2; x.beginPath(); x.arc(cx, H / 2, ch / 2, 0, 7); x.fillStyle = st === "badge" ? fg : ac; x.fill(); icon(x, b.icon, cx, H / 2, ch * 0.6, st === "badge" ? ac : fg);
      const tx = R ? cx - ch / 2 - pad * 0.8 : cx + ch / 2 + pad * 0.8, col = st === "badge" ? fg : "#ffffff";
      text(x, l1, 800, F1, col, tx, two ? H * 0.38 : H / 2); if (two) text(x, l2, 500, F2, st === "badge" ? fg : "rgba(255,255,255,.75)", tx, H * 0.68);
      if (st === "social") { const n = ["favorite", "chat_bubble", "share"]; n.forEach((k, i) => icon(x, k, (R ? pad + U * 0.2 : W - pad - U * 0.2) + (R ? 1 : -1) * i * U * 0.36, H / 2, U * 0.26, "#ffffff")); }
    });
    if (st === "social") W += U * 1.1;
  } else if (st === "button") {
    const ic = U * 0.4; W = pad + ic + pad * 0.6 + w(l1, 800, F1) + pad * 0.6 + ic + pad; H = U * 0.78;
    ops.push((x) => { rr(x, 0, 0, W, H, H / 2); x.fillStyle = ac; x.fill(); icon(x, b.icon, R ? W - pad - ic / 2 : pad + ic / 2, H / 2, ic, fg); text(x, l1, 800, F1, fg, W / 2, H / 2, "center");
      x.save(); x.translate(R ? pad + ic / 2 : W - pad - ic / 2, H / 2); if (R) x.scale(-1, 1); icon(x, "arrow_forward", 0, 0, ic, fg); x.restore(); });
  } else if (st === "tag") {
    const G1 = U * 0.36, ic = G1, tw = Math.max(w(l1, 900, G1), w(l2, 600, F2)); W = pad + ic + pad * 0.6 + tw + pad * 1.2; H = G1 * 1.4 + (two ? F2 * 1.6 : 0) + pad;
    ops.push((x) => { rr(x, 0, 0, W, H, U * 0.08); x.fillStyle = ac; x.fill(); x.setLineDash([U * 0.05, U * 0.04]); x.lineWidth = U * 0.02; x.strokeStyle = fg === "#111111" ? "rgba(0,0,0,.35)" : "rgba(255,255,255,.55)"; rr(x, U * 0.05, U * 0.05, W - U * 0.1, H - U * 0.1, U * 0.05); x.stroke(); x.setLineDash([]);
      const ix = R ? W - pad - ic / 2 : pad + ic / 2; icon(x, b.icon, ix, H / 2, ic, fg); const tx = R ? ix - ic / 2 - pad * 0.6 : ix + ic / 2 + pad * 0.6;
      text(x, l1, 900, G1, fg, tx, two ? pad / 2 + G1 * 0.75 : H / 2); if (two) text(x, l2, 600, F2, fg, tx, H - pad / 2 - F2 * 0.8); });
  } else if (st === "news") {
    const ic = U * 0.36, a = pad + ic + pad * 0.5 + w(l1, 900, F1) + pad, bb = two ? pad + w(l2, 700, F1) + pad : 0; W = a + bb; H = U * 0.62;
    ops.push((x) => { const ax = R ? W - a : 0; x.fillStyle = ac; x.fillRect(ax, 0, a, H); icon(x, b.icon, R ? W - pad - ic / 2 : pad + ic / 2, H / 2, ic, fg); text(x, l1, 900, F1, fg, R ? W - pad - ic - pad * 0.5 : pad + ic + pad * 0.5, H / 2);
      if (two) { x.fillStyle = "#ffffff"; x.fillRect(R ? 0 : a, 0, bb, H); text(x, l2, 700, F1, "#111111", R ? bb - pad : a + pad, H / 2); } });
  } else if (st === "quote") {
    const G1 = U * 0.22, tw = Math.max(w(l1, 700, G1), w(l2, 600, F2)); W = Math.max(U * 2.4, tw + pad * 2); H = U * 0.55 + G1 * 1.5 + (two ? F2 * 1.8 : 0) + pad;
    ops.push((x) => { rr(x, 0, 0, W, H, U * 0.12); x.fillStyle = "rgba(10,12,14,.9)"; x.fill(); icon(x, b.icon, R ? W - pad - U * 0.2 : pad + U * 0.2, pad + U * 0.18, U * 0.42, ac);
      const tx = R ? W - pad : pad; text(x, l1, 700, G1, "#ffffff", tx, U * 0.55 + pad * 0.5 + G1 * 0.5); if (two) text(x, "— " + l2, 600, F2, ac, tx, H - pad * 0.9); });
  } else {   // pin
    const ic = U * 0.62, tw = Math.max(w(l1, 800, F1), w(l2, 500, F2)); W = Math.max(ic, tw + pad * 2); H = ic + U * 0.12 + F1 * 1.5 + (two ? F2 * 1.6 : 0) + pad * 0.8;
    ops.push((x) => { x.shadowColor = "rgba(0,0,0,.35)"; x.shadowBlur = U * 0.05; icon(x, b.icon, W / 2, ic / 2, ic, ac, { w: U * 0.04, col: "#ffffff" }); x.shadowBlur = 0;
      const y0 = ic + U * 0.12; rr(x, 0, y0, W, H - y0, U * 0.1); x.fillStyle = "#ffffff"; x.fill(); text(x, l1, 800, F1, "#111111", W / 2, y0 + pad * 0.4 + F1 * 0.6, "center"); if (two) text(x, l2, 500, F2, "#444444", W / 2, H - pad * 0.4 - F2 * 0.7, "center"); });
  }
  const M = Math.round(U * 0.06), cv = Object.assign(document.createElement("canvas"), { width: Math.ceil(W + M * 2), height: Math.ceil(H + M * 2) }); const x = cv.getContext("2d")!;
  x.translate(M, M); x.shadowColor = "rgba(0,0,0,.3)"; x.shadowBlur = M * 0.8; x.shadowOffsetY = M * 0.25;
  for (const f of ops) { x.save(); f(x); x.restore(); }
  return cv;
}
export const canvasFile = (cv: HTMLCanvasElement, name: string) => new Promise<File | null>((ok) => cv.toBlob((b) => ok(b ? new File([b], name, { type: "image/png" }) : null), "image/png"));
const cache = new Map<string, string>();
export const tileOf = (key: string, draw: () => HTMLCanvasElement) => { let u = cache.get(key); if (!u) { u = draw().toDataURL("image/png"); cache.set(key, u); } return u; };
