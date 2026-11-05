// Motion code's host: one sealed frame (sandbox="allow-scripts", no same-origin) that starts the drawing worker and watches it.
// The preview shows the newest picture of each code clip (and asks for the next one); the export waits for every frame.
import type { Project, TextClip } from "@nooi/editor-core";
import { layersAt } from "@nooi/editor-core";
import runtimeUrl from "./sandbox.ts?worker&url";

export const CODE_EXAMPLE = `// m: frame, fps, t (seconds), dur, W, H, u (shorter side), p (props), audio(), bars(n), ctx (the canvas)
// M: nooi Motion — spring, interpolate, Easing, interpolateColors, noise2, random, shapes, toPath, evolve, loop, stagger
const x = m.ctx, s = M.spring({ frame: m.frame, fps: m.fps, config: { damping: 12 } });
const hue = M.interpolate(m.t, [0, m.dur], [170, 320]);
x.translate(m.W / 2, m.H / 2);
for (let i = 0; i < 12; i++) {
  const a = (i / 12) * Math.PI * 2 + m.t * 0.8, r = m.u * 0.28 * s;
  x.fillStyle = \`hsl(\${hue + i * 8} 90% 60%)\`;
  x.beginPath(); x.arc(Math.cos(a) * r, Math.sin(a) * r, m.u * (0.02 + 0.03 * m.audio()), 0, 7); x.fill();
}
x.fillStyle = "#fff"; x.font = \`800 \${m.u * 0.09}px Inter, Cairo, sans-serif\`; x.textAlign = "center"; x.textBaseline = "middle";
x.globalAlpha = M.interpolate(m.frame, [10, 25], [0, 1]); x.fillText("nooi", 0, 0);`;

const BOOT = `<!doctype html><meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline' 'unsafe-eval' blob:; worker-src blob:"><script>
let w = null, src = "", timers = new Map();
function mk() { w = new Worker(URL.createObjectURL(new Blob([src], { type: "text/javascript" })));
  w.onmessage = (e) => { const d = e.data; clearTimeout(timers.get(d.req)); timers.delete(d.req); parent.postMessage(d, "*", d.bmp ? [d.bmp] : []); };
  w.onerror = (e) => { e.preventDefault(); }; }
function stop(why) { try { w.terminate(); } catch (x) {} for (const [r, tm] of timers) { clearTimeout(tm); parent.postMessage({ req: r, err: why }, "*"); } timers.clear(); mk(); }
addEventListener("message", (e) => { if (e.source !== parent) return; const d = e.data;
  if (d.type === "boot") { src = d.src; mk(); parent.postMessage({ type: "ready" }, "*"); return; }
  if (d.type === "frame") { timers.set(d.req, setTimeout(() => stop("too slow (over 2 seconds for one frame)"), 2000)); w.postMessage(d); } });
<\/script>`;

type Res = { bmp?: ImageBitmap; err?: string };
let host: HTMLIFrameElement | null = null, booting: Promise<void> | null = null, seq = 0;
const pending = new Map<number, (r: Res) => void>();
const latest = new Map<string, { key: string; bmp: ImageBitmap }>();   // clip id → its newest picture
const asked = new Map<string, string>();                                // clip id → the frame being drawn
export const codeErrors = new Map<string, string>();
const ls = new Set<() => void>();
export const onCode = (f: () => void) => { ls.add(f); return () => void ls.delete(f); };
const tell = () => ls.forEach((f) => f());

function boot(): Promise<void> {
  if (booting) return booting;
  booting = (async () => {
    const src = await fetch(new URL(runtimeUrl, location.href).href).then((r) => r.text());
    host = Object.assign(document.createElement("iframe"), { title: "motion", srcdoc: BOOT }); host.setAttribute("sandbox", "allow-scripts"); host.setAttribute("aria-hidden", "true");
    host.style.cssText = "position:fixed;width:1px;height:1px;left:-9px;top:-9px;opacity:0;pointer-events:none;border:0";
    const ready = new Promise<void>((ok) => {
      addEventListener("message", (e) => {
        if (!host || e.source !== host.contentWindow) return; const d = e.data as Res & { req?: number; type?: string };
        if (d.type === "ready") { ok(); return; }
        const f = d.req != null ? pending.get(d.req) : undefined; if (f) { pending.delete(d.req!); f(d); }
      });
    });
    await new Promise<void>((ok) => { host!.onload = () => ok(); document.body.appendChild(host!); });
    host.contentWindow!.postMessage({ type: "boot", src }, "*"); await ready;
  })().catch((e) => { booting = null; throw e; });
  return booting;
}
async function ask(d: Record<string, unknown>): Promise<Res> {
  try { await boot(); } catch (e) { return { err: "the sandbox did not start: " + String((e as Error).message || e) }; }
  const req = ++seq; return new Promise<Res>((ok) => { pending.set(req, ok); host!.contentWindow!.postMessage({ type: "frame", req, ...d }, "*"); });
}
const keyOf = (code: string, props: Record<string, unknown>, frame: number, W: number, H: number, audio: number) => [code.length, hash(code), hash(JSON.stringify(props)), frame, W, H, Math.round(audio * 200)].join(":");
function hash(s: string) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return (h >>> 0).toString(36); }
function store(id: string, key: string, r: Res) {
  if (r.bmp) { const old = latest.get(id); latest.set(id, { key, bmp: r.bmp }); if (old && old.bmp !== r.bmp) old.bmp.close(); if (codeErrors.delete(id)) tell(); }
  else if (r.err && codeErrors.get(id) !== r.err) { codeErrors.set(id, r.err); tell(); }
}

/** the newest picture of a code clip for this frame (asks for it when it is not drawn yet; `onCode` listeners hear when it is) */
export function codeFrame(c: TextClip, props: Record<string, unknown>, frame: number, fps: number, dur: number, W: number, H: number, audio: number, bars: number[]) {
  const code = String(props.code || ""), key = keyOf(code, props, frame, W, H, audio), have = latest.get(c.id);
  if (have?.key === key) return have;
  if (asked.get(c.id) !== key) {
    asked.set(c.id, key);
    void ask({ code, p: props, W, H, frame, fps, dur, audio, bars }).then((r) => { if (asked.get(c.id) === key) asked.delete(c.id); store(c.id, key, r); tell(); });
  }
  return have || null;
}
/** the export: every code clip showing at `t` drawn for that exact frame before the moment is put together */
export async function prepareCode(p: Project, t: number, W: number, H: number, sound: (t: number) => [number, number[]]) {
  for (const L of layersAt(p, t)) {
    const c = L.clip; if (c.type !== "text" || c.motion?.tpl !== "code") continue;
    const props = { code: "", ...(c.motion.props as Record<string, unknown>) }, frame = Math.floor(Math.max(0, Math.min(c.dur, L.local)) * p.fps + 1e-6);
    const [audio, bars] = sound(c.start + frame / p.fps), code = String(props.code || ""), key = keyOf(code, props, frame, W, H, audio);
    if (latest.get(c.id)?.key === key) continue;
    store(c.id, key, await ask({ code, p: props, W, H, frame, fps: p.fps, dur: c.dur, audio, bars }));
  }
}
/** run code once (the inspector's Run): resolves to an error message or "" */
export async function tryCode(code: string, props: Record<string, unknown> = {}): Promise<string> {
  const r = await ask({ code, p: { ...props, code }, W: 320, H: 180, frame: 15, fps: 30, dur: 5, audio: 0.4, bars: Array(64).fill(0.4) });
  r.bmp?.close(); return r.err || "";
}
/** a still of some code (the gallery's example) */
export async function codePicture(code: string, W: number, H: number, frame = 30): Promise<ImageBitmap | null> {
  const r = await ask({ code, p: { code }, W, H, frame, fps: 30, dur: 5, audio: 0.45, bars: Array.from({ length: 64 }, (_, i) => 0.7 - i / 120) }); return r.bmp || null;
}
