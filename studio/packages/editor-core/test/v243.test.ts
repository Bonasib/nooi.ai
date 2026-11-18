// v243: editing by the words said, the music's grid, loudness, and checking before posting
import { describe, expect, it } from "vitest";
import { addAssetClip, addTrack, applyCuts, beatGrid, checkProject, clipEnd, emptyProject, findCuts, lufs, loudGain, norm, phrases, PLATFORMS, retakes, safeBeat, textClip, addClip, wordsAfter } from "../src";
import type { Asset, MediaClip, Word } from "../src";

const W = (txt: string, t0 = 0, step = 0.4, len = 0.3): Word[] => txt.split(" ").map((w, i) => ({ s: +(t0 + i * step).toFixed(3), e: +(t0 + i * step + len).toFixed(3), w }));
const vid = (id: string, d = 20): Asset => ({ id, kind: "video", name: id, src: id, w: 1920, h: 1080, duration: d, hasAudio: true, createdAt: 0 });
const aud = (id: string, d = 60): Asset => ({ id, kind: "audio", name: id, src: id, duration: d, createdAt: 0 });

describe("v243 smart cut by the words", () => {
  it("Arabic letters are folded so fillers and retakes match however they are written", () => {
    expect(norm("أصلاً")).toBe(norm("اصلا")); expect(norm("إمممم")).toBe(norm("امم")); expect(norm("Um,")).toBe("um");
  });
  it("phrases split at a pause and at a sentence's end", () => {
    const ws = [...W("hello there friend."), ...W("how are you", 1.5), ...W("today", 3.2)];
    expect(phrases(ws).map((p) => p.text)).toEqual(["hello there friend.", "how are you", "today"]);
  });
  it("a retake: the same opening said again — the earlier take is the one that goes", () => {
    const ph = [{ text: "so today we will look at" }, { text: "so today we will be looking at the editor" }, { text: "and then the export" }];
    expect(retakes(ph)).toEqual([0]);
    expect(retakes([{ text: "اليوم سنشرح المحرر" }, { text: "اليوم سنشرح المحرر الجديد بالكامل" }])).toEqual([0]);
    expect(retakes([{ text: "one two three" }, { text: "four five six" }])).toEqual([]);
  });
  it("example: a pause, an 'um', an Arabic 'يعني' (only when asked) and a retake — cut word-safe, music kept", () => {
    // "welcome um to the show" … 2 s quiet … "today we look at" (retake) "today we look at the new editor" … "يعني it is fast"
    const ws: Word[] = [...W("welcome um to the show"), ...W("today we look at", 4), ...W("today we look at the new editor", 6), ...W("يعني it is fast", 9.2)];
    const hard = findCuts(ws, { soft: false }); const kinds = hard.map((c) => c.kind);
    expect(kinds).toContain("pause"); expect(kinds).toContain("filler"); expect(kinds).toContain("retake");
    expect(hard.find((c) => c.kind === "filler")!.text).toBe("um");
    expect(hard.some((c) => c.text.includes("يعني"))).toBe(false);
    const soft = findCuts(ws, { soft: true }); expect(soft.some((c) => c.text.includes("يعني"))).toBe(true);
    // never inside a word that stays
    const left = wordsAfter(ws, hard);
    for (const c of hard) for (const w of ws) { const inside = w.s >= c.a - 1e-3 && w.e <= c.b + 1e-3; const cross = w.s < c.b - 1e-3 && w.e > c.a + 1e-3; if (cross) expect(inside).toBe(true); }
    expect(left.map((w) => w.w).join(" ")).toBe("welcome to the show today we look at the new editor يعني it is fast");
    // on a project: the video shortens, the music under it keeps playing (not split), the later beds move up
    const p = emptyProject(); p.assets.v = vid("v", 12); p.assets.m = aud("m");
    const v1 = p.tracks.find((t) => t.kind === "video")!; const c = addAssetClip(p, p.assets.v, 0, v1.id) as MediaClip; c.dur = 12;
    const at = addTrack(p, "audio"); const m = addAssetClip(p, p.assets.m, 0, at.id) as MediaClip; m.dur = 12;
    const s = applyCuts(p, hard);
    expect(s).toBeGreaterThan(2); const vids = p.tracks.find((t) => t.id === v1.id)!.clips; expect(vids.length).toBe(hard.length + 1 - (hard[0].a === 0 ? 1 : 0));
    const end = Math.max(...vids.map(clipEnd)); expect(end).toBeCloseTo(12 - s, 2);
    const beds = p.tracks.find((t) => t.id === at.id)!.clips; expect(beds.length).toBe(1); expect(beds[0].start).toBe(0); expect(clipEnd(beds[0])).toBeCloseTo(end, 2);
  });
  it("without keeping the music the bed is cut with the pictures", () => {
    const p = emptyProject(); p.assets.v = vid("v", 10); p.assets.m = aud("m");
    const v1 = p.tracks.find((t) => t.kind === "video")!; addAssetClip(p, p.assets.v, 0, v1.id).dur = 10; const at = addTrack(p, "audio"); addAssetClip(p, p.assets.m, 0, at.id).dur = 10;
    applyCuts(p, [{ a: 2, b: 4 }], { keepMusic: false }); expect(p.tracks.find((t) => t.id === at.id)!.clips.length).toBe(2);
  });
});

describe("v243 cuts on the music's grid", () => {
  const b = [0, 0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4];
  it("beats, bars (from the strongest of the first four) and 8ths", () => {
    expect(beatGrid(b, "beats")).toEqual(b); expect(beatGrid(b, "bars")).toEqual([0, 2, 4]);
    expect(beatGrid(b, "bars", [0, 1, 0, 0, 0, 1, 0, 0, 0])).toEqual([0.5, 2.5]); expect(beatGrid([0, 1], "8ths")).toEqual([0, 0.5, 1]);
  });
  it("a cut never lands inside a word: the beat before it is taken", () => {
    const ws: Word[] = [{ s: 2.8, e: 3.3, w: "editor" }];
    expect(safeBeat(b, 0.5, 3.2)).toBe(3); expect(safeBeat(b, 0.5, 3.2, ws)).toBe(2.5); expect(safeBeat(b, 3.9, 3.95, ws)).toBeNull();
  });
});

describe("v243 loudness and checking before posting", () => {
  const sine = (f: number, amp: number, secs: number, rate = 48000) => { const x = new Float32Array(secs * rate); for (let i = 0; i < x.length; i++) x[i] = amp * Math.sin((2 * Math.PI * f * i) / rate); return x; };
  it("a full-scale 997 Hz tone on one channel measures −3 LUFS (BS.1770); half as loud is 6 dB less; silence is −70", () => {
    expect(lufs([sine(997, 1, 3)], 48000)).toBeCloseTo(-3.0, 0); expect(lufs([sine(997, 0.5, 3)], 48000)).toBeCloseTo(-9.0, 0);
    expect(lufs([sine(997, 1, 3, 44100)], 44100)).toBeCloseTo(-3.0, 0); expect(lufs([new Float32Array(48000)], 48000)).toBe(-70);
  });
  it("the gain to −14 LUFS never pushes the peak over −1 dB", () => {
    expect(loudGain(-20, -10)).toBeCloseTo(2, 1); expect(loudGain(-20, -3)).toBeCloseTo(Math.pow(10, 2 / 20), 2); expect(loudGain(-80, -90)).toBe(1);
  });
  it("example: a wide 3-minute edit for TikTok — the wrong shape, words under the buttons, too quiet", () => {
    const p = emptyProject(); p.assets.v = vid("v", 200); const v1 = p.tracks.find((t) => t.kind === "video")!; addAssetClip(p, p.assets.v, 0, v1.id).dur = 200;
    const tt = addTrack(p, "text", 0); const low = textClip("Follow for more", 1); low.transform = { ...low.transform, y: 0.42 }; addClip(p, low, tt.id);
    const tk = PLATFORMS.find((x) => x.id === "tiktok")!; const codes = checkProject(p, tk, { lufs: -24, peak: -6 }).map((i) => i.code);
    expect(codes).toEqual(expect.arrayContaining(["aspect", "unsafe", "loud"])); expect(codes).not.toContain("long");
    const reels = PLATFORMS.find((x) => x.id === "reels")!; expect(checkProject(p, reels).map((i) => i.code)).toContain("long");
    p.width = 1080; p.height = 1920; low.transform.y = 0; p.tracks.find((t) => t.kind === "video")!.clips[0].dur = 30;
    expect(checkProject(p, tk, { lufs: -14.2, peak: -2 })).toEqual([{ level: "ok", code: "ok" }]);
  });
});
