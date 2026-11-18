// v234: separating a person from the background in an FFmpeg export — a colour key (green screen) and a cut-out (the picture
// with its mask below it) are see-through over what is under them; a picture keeps its own transparency through the colour filters
import { describe, expect, it } from "vitest";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { addAssetClip, addTrack, compile, emptyProject, isStudioScreen, keyAlpha, keyOf, screenColor, setKey, KEY0 } from "../src";
import type { Asset, MediaClip } from "../src";

const vid = (id: string, o: Partial<Asset> = {}): Asset => ({ id, kind: "video", name: id, src: id, w: 320, h: 180, duration: 2, hasAudio: false, createdAt: 0, ...o });
const img = (id: string): Asset => ({ id, kind: "image", name: id, src: id, w: 320, h: 180, createdAt: 0 });
function scene(person: Asset, key: boolean) {
  const p = emptyProject(); p.width = 320; p.height = 180; p.assets.bg = img("bg"); p.assets[person.id] = person;
  const v1 = p.tracks.find((t) => t.kind === "video")!; addAssetClip(p, p.assets.bg, 0, v1.id).dur = 2;
  const v2 = addTrack(p, "video", p.tracks.indexOf(v1)); const c = addAssetClip(p, person, 0, v2.id) as MediaClip; c.dur = 2;
  if (key) setKey(c, { color: "#00ff00", sim: 0.1, soft: 0.1, spill: 0.8 });
  return { p, c };
}
const graph = (r: { args: string[] }) => r.args[r.args.indexOf("-filter_complex") + 1];
const ff = spawnSync("ffmpeg", ["-version"]).status === 0;
function run(args: string[]) { const r = spawnSync("ffmpeg", args, { encoding: "utf8" }); if (r.status !== 0) throw new Error(r.stderr); }
function pixel(file: string, x: number, y: number): number[] { const r = spawnSync("ffmpeg", ["-v", "error", "-ss", "1", "-i", file, "-frames:v", "1", "-vf", `format=rgb24,crop=2:2:${x}:${y}`, "-f", "rawvideo", "-pix_fmt", "rgb24", "-"]); return [...r.stdout]; }

describe("v234 keys and cut-outs in compile()", () => {
  it("a key: chromakey on a copy of the picture, the green taken out of the edges, joined back with alphamerge", () => {
    const { p } = scene(vid("gs"), true);
    const g = graph(compile({ project: p, media: { bg: "/b.png", gs: "/g.mp4" }, out: "/o.mp4", format: "mp4", width: 320, height: 180, fps: 25 }));
    expect(g).toMatch(/split\[k\d+a\]\[k\d+b\]/); expect(g).toContain("chromakey=0x00FF00:0.1:0.1,alphaextract");
    expect(g).toContain("despill=type=green:mix=0.5:green=-0.8"); expect(g).toMatch(/alphamerge\[k\d+\]/);
  });
  it("a cut-out: the top half is the picture, the bottom half its mask", () => {
    const { p } = scene(vid("cut", { alpha: "stacked" }), false);
    const g = graph(compile({ project: p, media: { bg: "/b.png", cut: "/c.webm" }, out: "/o.mp4", format: "mp4", width: 320, height: 180, fps: 25 }));
    expect(g).toContain("crop=iw:ih/2:0:0"); expect(g).toContain("crop=iw:ih/2:0:ih/2"); expect(g).toContain("format=gray"); expect(g).toContain("alphamerge");
  });
  it("a plain video is drawn as before (no copy)", () => {
    const { p } = scene(vid("plain"), false);
    expect(graph(compile({ project: p, media: { bg: "/b.png", plain: "/p.mp4" }, out: "/o.mp4", format: "mp4", width: 320, height: 180, fps: 25 }))).not.toContain("split");
  });
  it("the key's distance is FFmpeg's: the screen goes, a red subject stays", () => {
    expect(keyAlpha(KEY0, 0, 1, 0)).toBe(0); expect(keyAlpha(KEY0, 1, 0.13, 0.13)).toBe(1);
    expect(keyOf({ effects: [{ id: "a", type: "key", enabled: false, params: {} }] })).toBeNull();
  });
  it("finds the screen's colour around the picture's edges", () => {
    const w = 40, h = 30, px = new Uint8Array(w * h * 4);
    for (let i = 0; i < w * h; i++) { const x = i % w, y = Math.floor(i / w), mid = x > 12 && x < 28 && y > 8 && y < 22; px.set(mid ? [200, 150, 120, 255] : [20, 60, 230, 255], i * 4); }
    expect(screenColor(px, w, h)?.color).toBe("#143ce6");
    expect(isStudioScreen(screenColor(px, w, h))).toBe(true);   // a strong chroma blue
    const paint = (c: number[]) => { for (let i = 0; i < w * h; i++) { const x = i % w, y = Math.floor(i / w); if (!(x > 12 && x < 28 && y > 8 && y < 22)) px.set([...c, 255], i * 4); } return screenColor(px, w, h); };
    expect(isStudioScreen(paint([0, 177, 64]))).toBe(true);       // studio green
    expect(isStudioScreen(paint([125, 180, 240]))).toBe(false);   // a blue sky is not a screen (the person gets cut out instead)
    px.fill(128); expect(screenColor(px, w, h)).toBeNull();
  });
  it.skipIf(!ff)("FFmpeg draws them: the blue picture shows where the screen was, the red subject stays", () => {
    const d = mkdtempSync(join(tmpdir(), "nooi-v234-"));
    run(["-y", "-v", "error", "-f", "lavfi", "-i", "color=c=0x0000ff:s=320x180:d=1", "-frames:v", "1", join(d, "b.png")]);
    run(["-y", "-v", "error", "-f", "lavfi", "-i", "color=c=0x00ff00:s=320x180:d=2:r=25,drawbox=x=120:y=50:w=80:h=80:c=0xff2020:t=fill", "-c:v", "libx264", "-pix_fmt", "yuv444p", "-crf", "8", join(d, "g.mp4")]);
    // a cut-out: the red box on grey, with a mask that keeps only the box
    run(["-y", "-v", "error", "-f", "lavfi", "-i", "color=c=0x808080:s=320x360:d=2:r=25,drawbox=x=120:y=50:w=80:h=80:c=0xff2020:t=fill,drawbox=x=0:y=180:w=320:h=180:c=black:t=fill,drawbox=x=120:y=230:w=80:h=80:c=white:t=fill", "-c:v", "libx264", "-pix_fmt", "yuv444p", "-crf", "8", join(d, "c.mp4")]);
    for (const [id, a, file] of [["gs", vid("gs"), "g.mp4"], ["cut", vid("cut", { alpha: "stacked" }), "c.mp4"]] as const) {
      const { p, c } = scene(a, id === "gs"); c.color.exposure = 0.1;   // (a colour filter on the way: the transparency is kept)
      const out = join(d, id + "-o.mp4"), r = compile({ project: p, media: { bg: join(d, "b.png"), [id]: join(d, file) }, out, format: "mp4", width: 320, height: 180, fps: 25 });
      run(r.args); const corner = pixel(out, 10, 10), mid = pixel(out, 160, 90);
      expect(corner[2]).toBeGreaterThan(200); expect(corner[1]).toBeLessThan(60);   // the blue background
      expect(mid[0]).toBeGreaterThan(200); expect(mid[2]).toBeLessThan(90);         // the red subject
    }
    expect(readFileSync(join(d, "gs-o.mp4")).length).toBeGreaterThan(1000);
  }, 60000);
});

import { backdropsOf, putUnder, removeBackdrop, spineOf, textClip, addTransition } from "../src";
describe("v234 a new background under a clip", () => {
  const mk = () => { const p = emptyProject(); p.assets.a = vid("a"); p.assets.b = vid("b"); const v1 = spineOf(p)!; for (const t of p.tracks.filter((x) => x.kind === "video" && x !== v1)) p.tracks.splice(p.tracks.indexOf(t), 1);
    const c1 = addAssetClip(p, p.assets.a, 0, v1.id) as MediaClip; c1.dur = 2; const c2 = addAssetClip(p, p.assets.b, 2, v1.id) as MediaClip; c2.dur = 2; return { p, v1, c1, c2 }; };
  const bg = (tpl: string) => (s: number, d: number) => [textClip("bg", s, { dur: d, motion: { tpl, props: {} } })];
  it("on V1: the background takes the clip's place, the clip moves up onto a layer attached to it, the cut's transition follows", () => {
    const { p, v1, c1, c2 } = mk(); addTransition(p, c1.id, "fade", 0.5);
    const [b] = putUnder(p, c1.id, bg("mb-aurora"));
    expect(spineOf(p)).toBe(v1); expect(v1.clips.map((c) => c.id)).toEqual([b.id, c2.id]); expect(b.start).toBe(0); expect(b.dur).toBe(2);
    const up = p.tracks[p.tracks.indexOf(v1) - 1]; expect(up.clips[0].id).toBe(c1.id); expect(c1.anchor?.clip).toBe(b.id);
    expect(p.transitions[0].a).toBe(b.id); expect(p.transitions[0].b).toBe(c2.id);
    // another pick replaces it in the same place; taking it away puts the clip back on V1
    const [b2] = putUnder(p, c1.id, bg("mb-space")); expect(backdropsOf(p, c1.id).map((x) => x.c.id)).toEqual([b2.id]); expect(v1.clips[0].id).toBe(b2.id); expect(p.transitions[0].a).toBe(b2.id);
    expect(removeBackdrop(p, c1.id)).toBe(true); expect(v1.clips.map((c) => c.id)).toEqual([c1.id, c2.id]); expect(p.transitions[0].a).toBe(c1.id); expect(c1.anchor).toBeUndefined();
    expect(p.tracks.filter((t) => t.kind === "video").length).toBe(1);
  });
  it("on a layer: a new track just below it", () => {
    const { p, v1 } = mk(); const v2 = addTrack(p, "video", p.tracks.indexOf(v1)); const c = addAssetClip(p, p.assets.a, 1, v2.id) as MediaClip; c.dur = 1.5;
    const [b] = putUnder(p, c.id, bg("mb-snow")); const i = p.tracks.findIndex((t) => t.clips.includes(b));
    expect(i).toBe(p.tracks.indexOf(v2) + 1); expect(spineOf(p)).toBe(v1); expect(b.start).toBe(1); expect(b.dur).toBe(1.5);
  });
});
