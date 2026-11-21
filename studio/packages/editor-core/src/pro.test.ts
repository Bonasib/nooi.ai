import { describe, expect, it } from "vitest";
import { trackFrames, trackAt, panoAt, hueOf, srcToFrame } from "./pro";
import { emptyProject } from "./defaults";

function frame(w: number, h: number, bx: number, by: number) {   // a bright 16×16 square with a dot pattern on a dark noisy ground
  const d = new Float32Array(w * h); let s = 7; for (let i = 0; i < d.length; i++) { s = (s * 9301 + 49297) % 233280; d[i] = 20 + (s / 233280) * 20; }
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) d[(by + y) * w + bx + x] = 200 + ((x * 7 + y * 3) % 5) * 10;
  return { data: d, w, h };
}
describe("v277 pro tools", () => {
  it("follows a moving square", () => {
    const w = 240, h = 136, fr = [] as ReturnType<typeof frame>[];
    for (let i = 0; i < 20; i++) fr.push(frame(w, h, 20 + i * 6, 30 + i * 3));
    const out = trackFrames(fr, [20 / w, 30 / h, 16 / w, 16 / h]);
    const last = out[out.length - 1]; expect(Math.abs(last[0] * w - (20 + 19 * 6 + 8))).toBeLessThan(2); expect(Math.abs(last[1] * h - (30 + 19 * 3 + 8))).toBeLessThan(2);
  });
  it("interpolates the tracked path", () => {
    const tr = { box: [0, 0, 0.1, 0.1] as [number, number, number, number], pts: [[0, 0.2, 0.2], [1, 0.4, 0.6]] as [number, number, number][], lock: 0 };
    expect(trackAt(tr, 0.5)).toEqual([0.30000000000000004, 0.4]);
  });
  it("moves the 360 camera across the clip", () => {
    const c = { dur: 4, pano: { on: true, yaw: 0, pitch: 0, roll: 0, fov: 90, move: true, yaw2: 90, pitch2: 0, fov2: 60 } } as never;
    expect(panoAt(c, 0)!.yaw).toBe(0); expect(panoAt(c, 4)!.yaw).toBe(90); expect(panoAt(c, 2)!.fov).toBeCloseTo(75, 5);
  });
  it("reads hues and maps a source point into the frame", () => {
    expect(hueOf("#ff0000")).toBe(0); expect(hueOf("#00ff00")).toBeCloseTo(1 / 3, 5);
    const p = emptyProject(); const c = { dur: 2, keyframes: {}, transform: { x: 0, y: 0, scale: 1, rotation: 0, flipH: false, flipV: false, crop: [0, 0, 0, 0] } } as never;
    const a = { w: p.width, h: p.height } as never;
    expect(srcToFrame(c, a, p.width, p.height, 0.75, 0.5, 0)[0]).toBeCloseTo(0.25, 5);
  });
});

import { lockOffset as lk277 } from "./pro";
describe("lock", () => {
  it("keeps a subject near the edge where it was in the first frame", () => {
    const c = { type: "media", id: "c", asset: "a", start: 0, dur: 2, in: 0, speed: 1, keyframes: {}, transform: { x: 0, y: 0, scale: 1, rotation: 0, crop: [0, 0, 0, 0], flipH: false, flipV: false },
      track: { box: [0, 0, 0.1, 0.1], pts: [[0, 0.1, 0.5], [2, 0.5, 0.5]], lock: 1 } } as never;
    const a = { w: 640, h: 360 } as never; const r = lk277(c, a, 2, 640, 360);
    // the subject at 2 s (frame x 0.5 − 0.5 = 0) must land at its first place (0.1 − 0.5 = −0.4)
    expect(0 * r.zoom + r.dx).toBeCloseTo(-0.4, 5); expect(r.zoom).toBeGreaterThan(1);
  });
});
