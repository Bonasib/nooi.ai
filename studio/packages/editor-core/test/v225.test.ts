// v225: the classic editor's 20 motions as keyframes for any clip, and their CSS examples
import { describe, expect, it } from "vitest";
import { ANIMATE, animateKeyframes, animateCss, emptyProject, mediaClip, valueAt, motionKeyframes } from "../src";
import type { Asset } from "../src";

const a: Asset = { id: "im", kind: "image", name: "im", src: "/x", createdAt: 0 };
const clip = () => { const c = mediaClip(a, 0); c.dur = 4; c.transform.scale = 0.5; c.transform.x = 0.2; return c; };
describe("motions (Animate.css)", () => {
  it("has the 20 motions, each with its own CSS example", () => {
    expect(ANIMATE.length).toBe(60); for (const m of ANIMATE) expect(animateCss(m, "ac-" + m.id)).toMatch(new RegExp("^@keyframes ac-" + m.id + "\\{0%\\{"));
  });
  it("an entrance starts away and comes to rest where the clip is", () => {
    const c = clip(), k = animateKeyframes("backInUp", c, { w: 0.3, h: 0.3 });
    expect(k.y![0].v).toBeCloseTo(1.2); expect(k.scale![0].v).toBeCloseTo(0.35); expect(k.opacity![0].v).toBeCloseTo(0.7);
    expect(valueAt(k.y, 3, 0)).toBe(0); expect(valueAt(k.scale, 3, 0)).toBe(0.5); expect(valueAt(k.opacity, 3, 0)).toBe(1);
    expect(k.x).toBeUndefined();                                           // it does not move sideways: no x keyframes, the clip keeps x = 0.2
    expect(typeof k.scale![0].ease === "object").toBe(true);               // the motion's own timing curve
  });
  it("moves measured in the clip's size use its size on the picture", () => {
    const k = animateKeyframes("rollIn", clip(), { w: 0.4, h: 0.2 }); expect(k.x![0].v).toBeCloseTo(0.2 - 0.4); expect(k.rotation![0].v).toBe(-120);
  });
  it("a repeating motion repeats through the clip", () => {
    const k = animateKeyframes("heartBeat", clip()); const peaks = k.scale!.filter((x) => x.v > 0.6).length;
    expect(peaks).toBeGreaterThanOrEqual(4);   // 1.3 s + 0.5 s pause → 2 beats of two pulses in 4 s
    expect(k.opacity).toBeUndefined();
  });
  it("the older motion presets are unchanged", () => { expect(Object.keys(motionKeyframes("zoomIn", clip()))).toEqual(["scale"]); });
});
describe("v226: 60 motions", () => {
  it("entrances, exits at the clip's end, and loops", async () => {
    const { animateGroup } = await import("../src");
    const g = { in: 0, out: 0, loop: 0 } as Record<string, number>; for (const m of ANIMATE) g[animateGroup(m)]++;
    expect(g).toEqual({ in: 34, out: 12, loop: 14 });
    const c = clip(), k = animateKeyframes("fadeOut", c); expect(k.opacity![0].t).toBeCloseTo(3.2); expect(valueAt(k.opacity, 1, 9)).toBe(1); expect(valueAt(k.opacity, 4, 9)).toBe(0);
    const s = animateKeyframes("slideInLeft", c); expect(s.x![0].v).toBeCloseTo(0.2 - 1.2);
  });
});
