// v228: a nooi Motion graphic in an FFmpeg export — the editor's two-part video (colour on top, transparency below) becomes one
// see-through layer, placed like a title at the clip's time
import { describe, expect, it } from "vitest";
import { addClip, compile, emptyProject, textClip } from "../src";

describe("v228 motion graphics in compile()", () => {
  const p = emptyProject();
  const c = addClip(p, textClip("Accent bar", 1, { dur: 3, animIn: { type: "none", dur: 0 }, animOut: { type: "none", dur: 0 }, motion: { tpl: "lt-bar", props: { name: "A" } } }));
  it("joins the halves back into one layer with its transparency, from the clip's start, for the clip's time", () => {
    const r = compile({ project: p, media: {}, motions: { [c.id]: "/tmp/m.webm" }, out: "/tmp/o.mp4", format: "mp4", width: 1280, height: 720, fps: 30 });
    const g = r.args[r.args.indexOf("-filter_complex") + 1];
    expect(r.inputs).toEqual(["/tmp/m.webm"]);
    expect(r.args.join(" ")).toContain("-ss 0 -t 3.05 -i /tmp/m.webm");
    const m = /\[0:v\]split\[(m\d+)a\]\[\1b\]/.exec(g); expect(m).not.toBeNull(); const L = m![1];
    expect(g).toContain(`[${L}a]crop=iw:ih/2:0:0,format=gbrp[${L}c]`); expect(g).toContain(`[${L}b]crop=iw:ih/2:0:ih/2,format=gray[${L}m]`);
    expect(g).toContain(`[${L}c][${L}m]alphamerge,unpremultiply=inplace=1[${L}]`); expect(g).toContain(`[${L}]setpts=PTS-STARTPTS,fps=30,scale=1280:720,format=rgba`);
    expect(g).toContain("enable='between(t,1,4)'");
  });
  it("starts inside the graphic when the range begins after its start; a motion clip without its video is left out (not drawn as a still)", () => {
    const r = compile({ project: p, media: {}, motions: { [c.id]: "/tmp/m.webm" }, out: "/tmp/o.mp4", format: "mp4", width: 1280, height: 720, fps: 30, range: [2, 4] });
    expect(r.args.join(" ")).toContain("-ss 1 -t 2.05 -i /tmp/m.webm");
    const r2 = compile({ project: p, media: {}, texts: { [c.id]: "/tmp/t.png" }, out: "/tmp/o.mp4", format: "mp4", width: 1280, height: 720, fps: 30 });
    expect(r2.inputs).toEqual([]);
  });
});
