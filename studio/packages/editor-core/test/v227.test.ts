// v227: nooi Motion — the math under the motion graphics
import { describe, expect, it } from "vitest";
import { Motion as M } from "../src";

describe("nooi Motion math", () => {
  it("interpolate: through points, eased, clamped or extended", () => {
    expect(M.interpolate(15, [0, 30], [0, 1])).toBe(0.5);
    expect(M.interpolate(-5, [0, 30], [0, 1])).toBe(0);
    expect(M.interpolate(45, [0, 30], [0, 1], { extrapolate: "extend" })).toBe(1.5);
    expect(M.interpolate(20, [0, 10, 30], [0, 100, 0])).toBe(50);
    expect(M.interpolate(15, [0, 30], [0, 1], { easing: M.Easing.easeInOut })).toBeCloseTo(0.5, 5);
    expect(M.interpolate(7.5, [0, 30], [0, 1], { easing: M.Easing.quad })).toBeCloseTo(0.0625);
    expect(() => M.interpolate(0, [10, 0], [0, 1])).toThrow();
  });
  it("spring: starts at 0, overshoots when lightly damped, settles at 1; a fixed length when asked", () => {
    expect(M.spring({ frame: 0, fps: 30 })).toBe(0);
    const vals = Array.from({ length: 60 }, (_, f) => M.spring({ frame: f, fps: 30, config: { damping: 8 } }));
    expect(Math.max(...vals)).toBeGreaterThan(1.05); expect(M.spring({ frame: 120, fps: 30 })).toBeCloseTo(1, 2);
    expect(M.spring({ frame: 60, fps: 30, config: { damping: 200 } })).toBeLessThanOrEqual(1.0001);
    const L = M.springLength({ fps: 30 }); expect(L).toBeGreaterThan(10); expect(L).toBeLessThan(120);
    expect(M.spring({ frame: 15, fps: 30, durationInFrames: 15 })).toBeCloseTo(1, 1);
    expect(M.spring({ frame: 10, fps: 30, from: 100, to: 200, delay: 10 })).toBe(100);
  });
  it("colours mix; random and noise are the same for the same seed", () => {
    expect(M.interpolateColors(5, [0, 10], ["#000000", "#ffffff"])).toBe("rgba(128,128,128,1)");
    expect(M.interpolateColors(0, [0, 10], ["#f00", "rgba(0,0,255,0.5)"])).toBe("rgba(255,0,0,1)");
    expect(M.random("a")).toBe(M.random("a")); expect(M.random("a")).not.toBe(M.random("b")); expect(M.random(1)).toBeGreaterThanOrEqual(0);
    const n = M.noise3("s", 1.3, 2.7, 0.4); expect(n).toBe(M.noise3("s", 1.3, 2.7, 0.4)); expect(Math.abs(n)).toBeLessThan(1.2);
    expect(Math.abs(M.noise2("s", 3, 4))).toBeLessThan(1e-9 + 1);   // whole-number points are 0 in gradient noise along x,y
  });
  it("shapes draw themselves: length, evolve, points along", () => {
    const sq = M.shapes.rect(10, 10); expect(M.pathLength(sq)).toBeCloseTo(40);
    expect(M.evolve(sq, 0.25)).toEqual({ dash: [40, 40], offset: 30 });
    expect(M.pointAt(sq, 0.125)).toEqual([0, -5]);
    expect(M.pathLength(M.shapes.circle(10, 360))).toBeCloseTo(2 * Math.PI * 10, 0);
    expect(M.toPath(M.shapes.triangle(10))).toMatch(/^M0\.00 -10\.00L.*Z$/);
  });
  it("timing helpers", () => { expect(M.seq(35, 30, 10)).toBe(5); expect(M.seq(45, 30, 10)).toBeNull(); expect(M.loop(-1, 30)).toBe(29); expect(M.stagger(20, 2, 5, 3)).toBe(7); });
});
