// v245: music made in code
import { describe, expect, it } from "vitest";
import { compose, hz, MOODS } from "../src";
describe("v245 music made in code", () => {
  it("every mood writes music at least as long as asked, in whole bars, with its tempo and an even beat", () => {
    for (const m of MOODS) { const s = compose(m.id, 15, 3); const bar = (60 / m.bpm) * 4;
      expect(s.dur).toBeGreaterThanOrEqual(15); expect(s.dur - 15).toBeLessThan(bar + 1e-6); expect(Math.abs(s.dur / bar - Math.round(s.dur / bar))).toBeLessThan(1e-3);
      expect(s.notes.length).toBeGreaterThan(10); expect(s.beats[1] - s.beats[0]).toBeCloseTo(60 / m.bpm, 3); expect(s.notes.every((n) => n.t >= 0 && n.t < s.dur && n.d > 0)).toBe(true); }
  });
  it("the same seed writes the same music; another seed another tune", () => {
    expect(JSON.stringify(compose("upbeat", 20, 5).notes)).toBe(JSON.stringify(compose("upbeat", 20, 5).notes));
    const lead = (s: number) => compose("upbeat", 20, s).notes.filter((n) => n.inst === "lead" || n.inst === "pluck").map((n) => n.midi).join(",");
    expect(lead(5)).not.toBe(lead(6));
  });
  it("example: Upbeat — four on the floor, snare on 2 and 4, the tune in the mood's key; the first bar is an intro (no drums)", () => {
    const s = compose("upbeat", 8, 1), beat = 60 / 120, kicks = s.notes.filter((n) => n.inst === "kick").map((n) => n.t);
    expect(kicks[0]).toBeCloseTo(4 * beat, 6); expect(kicks.slice(0, 4).map((t) => +(t - kicks[0]).toFixed(3))).toEqual([0, 0.5, 1, 1.5]);
    expect(s.notes.filter((n) => n.inst === "snare").map((n) => +((n.t / beat) % 4).toFixed(3)).slice(0, 2)).toEqual([1, 3]);
    const pcs = new Set([0, 2, 4, 5, 7, 9, 11].map((x) => (60 + x) % 12)); expect(s.notes.filter((n) => n.inst === "lead").every((n) => pcs.has(n.midi % 12))).toBe(true);
    expect(hz(69)).toBe(440);
  });
});
