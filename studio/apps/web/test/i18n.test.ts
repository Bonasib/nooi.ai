// every string the studio shows exists in English and Arabic, and the two files have the same keys
import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import en from "../src/locales/en.json";
import ar from "../src/locales/ar.json";
import { parseSubs } from "../src/subs";

const flat = (o: Record<string, unknown>, p = ""): string[] => Object.entries(o).flatMap(([k, v]) => (v && typeof v === "object" ? flat(v as Record<string, unknown>, p + k + ".") : [p + k]));
const files = (d: string): string[] => readdirSync(d).flatMap((f) => { const x = join(d, f); return statSync(x).isDirectory() ? files(x) : /\.tsx?$/.test(f) ? [x] : []; });
describe("translations", () => {
  const E = new Set(flat(en)), A = new Set(flat(ar));
  it("English and Arabic have the same keys", () => { expect([...E].filter((k) => !A.has(k))).toEqual([]); expect([...A].filter((k) => !E.has(k))).toEqual([]); });
  it("every fixed key used in the code exists", () => {
    const used = new Set<string>();
    for (const f of files(join(__dirname, "../src"))) for (const m of readFileSync(f, "utf8").matchAll(/\b(?:t|i18n\.t|i18nText)\("([a-zA-Z0-9_.]+)"/g)) used.add(m[1]);
    expect([...used].filter((k) => (k.endsWith(".") ? ![...E].some((x) => x.startsWith(k)) : !E.has(k)))).toEqual([]);   // ("rail." + name: the prefix must exist)
  });
  it("Arabic strings are Arabic", () => { expect((ar as { rail: { media: string } }).rail.media).toMatch(/[؀-ۿ]/); });
});
describe("captions", () => {
  it("reads .srt and .vtt (Arabic too)", () => {
    expect(parseSubs("1\n00:00:01,000 --> 00:00:02,500\nمرحبا\n\n2\n00:00:03,000 --> 00:00:04,000\n<b>Hi</b>\n")).toEqual([{ a: 1, b: 2.5, text: "مرحبا" }, { a: 3, b: 4, text: "Hi" }]);
    expect(parseSubs("WEBVTT\n\n00:01.000 --> 00:02.000 align:middle\nOne\n").length).toBe(1);
  });
});
