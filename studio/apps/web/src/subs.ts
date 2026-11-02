// .srt / .vtt → [{a, b, text}] (seconds) — tags removed, Arabic kept as written
export function parseSubs(text: string): { a: number; b: number; text: string }[] {
  const tm = (s: string) => { const m = s.trim().replace(",", ".").match(/(?:(\d+):)?(\d+):(\d+(?:\.\d+)?)/); return m ? (+(m[1] || 0)) * 3600 + +m[2] * 60 + +m[3] : NaN; };
  const out: { a: number; b: number; text: string }[] = [];
  for (const block of text.replace(/\r/g, "").replace(/^WEBVTT[^\n]*\n/, "").split(/\n\s*\n/)) {
    const lines = block.split("\n").filter((l) => l.trim()); const i = lines.findIndex((l) => l.includes("-->")); if (i < 0) continue;
    const [x, y] = lines[i].split("-->"); const a = tm(x), b = tm(y.split(" ").filter(Boolean)[0] || ""); const txt = lines.slice(i + 1).join("\n").replace(/<[^>]+>/g, "").trim();
    if (isFinite(a) && isFinite(b) && b > a && txt) out.push({ a, b, text: txt });
  }
  return out;
}
