// v245: a long video → shorts
import { describe, expect, it } from "vitest";
import { captionLines, findMoments, type Word } from "../src";
const W = (txt: string, t0: number, step = 0.35): Word[] => txt.split(" ").map((w, i) => ({ s: +(t0 + i * step).toFixed(3), e: +(t0 + i * step + 0.28).toFixed(3), w }));
// a 3-minute talk: slow small talk, then a hook ("Why do most videos fail?") with a steady answer, then slow talk again
function talk(): Word[] {
  const out: Word[] = []; let t = 0;
  for (let i = 0; i < 12; i++) { out.push(...W("um so yeah we were just um talking about stuff", t, 0.6)); t += 9; }
  out.push(...W("Why do most videos fail?", t)); t += 2.2;
  for (let i = 0; i < 8; i++) { out.push(...W("They lose people in the first three seconds because nothing happens.", t)); t += 4.2; }
  for (let i = 0; i < 8; i++) { out.push(...W("uh and then um we went home", t, 0.7)); t += 8; }
  return out;
}
describe("v245 long video → shorts", () => {
  it("example: the hook and its steady answer is the best moment; it starts on the question and ends on a full stop", () => {
    const m = findMoments(talk(), { n: 2 }); expect(m.length).toBeGreaterThan(0);
    expect(m[0].title.startsWith("Why do most videos fail?")).toBe(true); expect(m[0].why).toContain("hook"); expect(m[0].why).toContain("ends");
    expect(m[0].b - m[0].a).toBeGreaterThanOrEqual(20); expect(m[0].b - m[0].a).toBeLessThanOrEqual(60);
    if (m[1]) expect(m[1].a >= m[0].b || m[1].b <= m[0].a).toBe(true);
  });
  it("Arabic hooks count too", () => { const ws = [...W("لماذا تفشل معظم الفيديوهات؟", 0), ...Array.from({ length: 10 }, (_, i) => W("لأنها تخسر المشاهد في أول ثلاث ثوان.", 2 + i * 2.6)).flat()]; expect(findMoments(ws)[0].why).toContain("hook"); });
  it("captions: a few words a line, broken at pauses and sentence ends", () => {
    const l = captionLines([...W("one two three four five six seven", 0), ...W("eight.", 5), ...W("nine ten", 6)]);
    expect(l.map((x) => x.text)).toEqual(["one two three four five six seven", "eight.", "nine ten"]);   // "six seven" would be left alone: kept with the line
    expect(captionLines(W("They lose people in the first three seconds because nothing happens.", 0)).map((x) => x.text)).toEqual(["They lose people in the", "first three seconds because nothing happens."]);
  });
});
