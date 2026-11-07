// v244: speed ramps
import { describe, expect, it } from "vitest";
import { addAssetClip, clipEnd, emptyProject, RAMPS, rampAt, rampedDur, speedRamp } from "../src";
import type { Asset, MediaClip } from "../src";
const vid = (id: string, d = 20): Asset => ({ id, kind: "video", name: id, src: id, w: 1920, h: 1080, duration: d, hasAudio: true, createdAt: 0 });
describe("v244 speed ramps", () => {
  it("example: Bullet time on a 5 s clip — fast, slow-motion in the middle, fast; the same source, the clip after moves along", () => {
    const p = emptyProject(); p.assets.v = vid("v"); const v1 = p.tracks.find((t) => t.kind === "video")!;
    const c = addAssetClip(p, p.assets.v, 0, v1.id) as MediaClip; c.dur = 5; c.in = 2; c.fadeOut = 0.5; const d = addAssetClip(p, p.assets.v, 5, v1.id) as MediaClip; d.dur = 2;
    const curve = RAMPS.find((r) => r.id === "bullet")!.curve; const want = rampedDur(c, curve);
    const ids = speedRamp(p, c.id, curve)!; expect(ids.length).toBe(10);
    const parts = v1.clips.filter((x) => ids.includes(x.id)) as MediaClip[];
    expect(parts.map((x) => x.speed)).toEqual(curve); expect(parts[0].in).toBe(2); expect(parts[9].in + parts[9].dur * parts[9].speed).toBeCloseTo(7, 5);
    for (let i = 1; i < 10; i++) expect(parts[i].start).toBeCloseTo(clipEnd(parts[i - 1]), 5);
    expect(clipEnd(parts[9])).toBeCloseTo(want, 5); expect(d.start).toBeCloseTo(want, 5); expect(parts[9].fadeOut).toBe(0.5); expect(parts[0].fadeOut).toBe(0);
    expect(want).toBeGreaterThan(5);   // the slow middle makes it longer
  });
  it("a clip running backwards or frozen is left alone", () => {
    const p = emptyProject(); p.assets.v = vid("v"); const c = addAssetClip(p, p.assets.v, 0) as MediaClip; c.reverse = true; expect(speedRamp(p, c.id, [1, 2])).toBeNull();
  });
  it("the example curve: half the time is spent where the speed is low", () => {
    const hero = RAMPS.find((r) => r.id === "hero")!.curve; expect(rampAt(hero, 0)).toBe(0); expect(rampAt(hero, 1)).toBeCloseTo(1, 6); expect(rampAt(hero, 0.5)).toBeGreaterThan(0.4); expect(rampAt(hero, 0.5)).toBeLessThan(0.6);
    expect(rampAt([1, 1], 0.25)).toBeCloseTo(0.25, 6);
  });
});
