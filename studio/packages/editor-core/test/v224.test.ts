// v224 (Step 2): the magnetic main track (anchors) and the .nooi project file.
import { describe, expect, it } from "vitest";
import { Editor, emptyProject, mediaClip, textClip, addClip, deleteClips, trim, split, moveClip, cutRange, addTransition, addMarker, findClip, migrate, toNooi, fromNooi, spineOf, anchorAll, setKeyframe, setSpeed } from "../src";
import type { Asset, MediaClip, Project } from "../src";

const asset = (id: string, kind: Asset["kind"], duration?: number): Asset => ({ id, kind, name: id, src: "/m/" + id, duration, createdAt: 0, hasAudio: kind === "video", w: 1920, h: 1080 });
function setup() {
  const e = new Editor(emptyProject()); const p = e.project;
  p.assets.va = asset("va", "video", 10); p.assets.vb = asset("vb", "video", 8); p.assets.br = asset("br", "video", 4); p.assets.mu = asset("mu", "audio", 30);
  const V1 = spineOf(p)!.id, V2 = p.tracks.find((t) => t.name === "V2")!.id, A1 = p.tracks.find((t) => t.kind === "audio")!.id;
  let a = "", b = "", br = "", mu = "", ti = "";
  e.run("build", (q) => {
    a = addClip(q, mediaClip(q.assets.va, 0), V1).id; b = addClip(q, mediaClip(q.assets.vb, 10), V1).id;
    br = addClip(q, mediaClip(q.assets.br, 12), V2).id;                    // B-roll over the second clip, 2 s in
    mu = addClip(q, mediaClip(q.assets.mu, 0), A1).id;                     // music from the start
    ti = addClip(q, textClip("Title", 13)).id;
  });
  return { e, V1, V2, A1, a, b, br, mu, ti };
}
const at = (p: Project, id: string) => findClip(p, id)!.clip;

describe("the magnetic main track", () => {
  it("attaches clips on other tracks to the V1 clip under them", () => {
    const { e, a, b, br, mu, ti } = setup();
    expect(at(e.project, br).anchor).toEqual({ clip: b, at: 2 });   // vb's source second 2
    expect(at(e.project, mu).anchor).toEqual({ clip: a, at: 0 });
    expect(at(e.project, ti).anchor?.clip).toBe(b);
    expect(at(e.project, a).anchor).toBeUndefined();               // V1 itself is never attached
  });
  it("a ripple delete on V1 moves what is attached downstream with it", () => {
    const { e, a, br, mu, ti } = setup();
    e.run("del", (q) => deleteClips(q, [a], true));
    expect(at(e.project, br).start).toBe(2); expect(at(e.project, ti).start).toBe(3);
    expect(at(e.project, mu).start).toBe(0);                          // its clip is gone: it stays, attached to what is under it now
  });
  it("trimming the front of a V1 clip keeps the B-roll on the same picture", () => {
    const { e, b, br } = setup();
    e.run("trim", (q) => trim(q, b, "start", 11, true));            // 1 s off vb's front, the rest ripples left by 1 s
    const c = at(e.project, b) as MediaClip; expect(c.start).toBe(10); expect(c.in).toBe(1);
    expect(at(e.project, br).start).toBe(11);                         // source second 2 of vb is now at 11
  });
  it("speed on the V1 clip moves the attached clip with the picture", () => {
    const { e, b, br } = setup();
    e.run("speed", (q) => setSpeed(q, b, 2));
    expect(at(e.project, br).start).toBe(11);                         // source second 2 at 2× is 1 s in
  });
  it("moving the V1 clip carries its B-roll; moving the B-roll itself attaches it anew", () => {
    const { e, b, br } = setup();
    e.run("move", (q) => moveClip(q, b, 20)); expect(at(e.project, br).start).toBe(22);
    e.run("move br", (q) => moveClip(q, br, 24)); expect(at(e.project, br).anchor).toEqual({ clip: b, at: 4 });
  });
  it("a split hands the attached clip to the half it sits on", () => {
    const { e, b, br } = setup(); let right = "";
    e.run("split", (q) => { right = split(q, b, 11)!.id; });
    expect(at(e.project, br).anchor?.clip).toBe(right); expect(at(e.project, br).start).toBe(12);
  });
  it("live drags follow too, and the magnetic switch off leaves clips where they are", () => {
    const { e, a, br } = setup();
    e.begin("drag"); e.live((q) => { deleteClips(q, [a], true); }); expect(at(e.project, br).start).toBe(2); e.cancel();
    expect(at(e.project, br).start).toBe(12);
    e.run("off", (q) => { q.magnetic = false; }); e.run("del", (q) => deleteClips(q, [a], true));
    expect(at(e.project, br).start).toBe(12);
  });
  it("a followed clip that would land on another one goes to a free track", () => {
    const { e, a, V2, br } = setup();
    e.run("other", (q) => { addClip(q, mediaClip(q.assets.br, 2), V2); });   // something already at 2–6 on V2
    e.run("del", (q) => deleteClips(q, [a], true));
    const f = findClip(e.project, br)!; expect(f.clip.start).toBe(2); expect(f.track.id).not.toBe(V2);
  });
  it("remove a part (cutRange) keeps B-roll in sync", () => {
    const { e, br } = setup(); e.run("cut", (q) => cutRange(q, 1, 3)); expect(at(e.project, br).start).toBe(10);
  });
  it("old projects become magnetic and get attached on the next change", () => {
    const p = emptyProject(); delete (p as Partial<Project>).magnetic; const m = migrate(p); expect(m.magnetic).toBe(true);
    m.assets.va = asset("va", "video", 10); const V1 = spineOf(m)!.id; addClip(m, mediaClip(m.assets.va, 0), V1); addClip(m, mediaClip(m.assets.va, 3), m.tracks[1].id);
    anchorAll(m); expect(m.tracks[1].clips[0].anchor?.at).toBe(3);
  });
});

describe(".nooi", () => {
  function rich() {
    const s = setup(); const { e, a, b } = s;
    e.run("more", (q) => {
      const c = at(q, a) as MediaClip; c.keyframes = setKeyframe(setKeyframe({}, "scale", 0, 1), "scale", 2, 1.3); c.keyframes.scale![0].ease = "easeOut"; c.keyframes.x = [{ t: 0.123, v: 0.1, ease: { bezier: [0.1, 0.2, 0.3, 0.9] } }];
      c.color.exposure = 0.2; c.color.hsl.blue = [0.1, -0.2, 0]; c.effects.push({ id: "e1", type: "rain", enabled: true, params: { amount: 0.6 } }); c.volume = 0.5; c.fadeIn = 0.37; c.denoise = true;
      c.transform.crop = [0.1, 0, 0.1, 0]; c.transform.flipH = true; c.opacity = 0.8; c.blend = "screen"; c.lut = { asset: "lut1", amount: 0.7 };
      q.assets.lut1 = { id: "lut1", kind: "lut", name: "Teal", src: "local:k1", createdAt: 5 };
      addTransition(q, a, "fade", 0.6); addMarker(q, 4.25, "Hook", "#00F0FF"); q.beats = [0.5, 1.01];
      const cb = at(q, b) as MediaClip; cb.dur = 3.18; cb.in = 0.033; cb.reverse = true;
    });
    return s;
  }
  it("has the spec's shape: frames, V1 as the primary spine, anchors", () => {
    const { e, br, b } = rich(); const d = toNooi(e.project) as Record<string, any>;
    expect(d.nooiVersion).toBe("1.0.0"); expect(d.settings.frameRate).toEqual({ num: 30, den: 1 }); expect(d.settings.magneticRippleEnabled).toBe(true);
    const v1 = d.timeline.tracks.find((t: any) => t.isPrimarySpine); expect(v1.name).toBe("V1"); expect(v1.index).toBe(1);
    const brc = d.timeline.tracks.flatMap((t: any) => t.clips).find((c: any) => c.clipId === br);
    expect(brc.parentAnchorClipId).toBe(b); expect(brc.anchorOffsetFrames).toBe(60); expect(brc.timelineStartFrame).toBe(360);
    expect(brc.transform.scaleX.default).toBe(100);
    const ac = v1.clips[0]; expect(ac.transform.scaleX.keyframes[1]).toMatchObject({ frame: 60, value: 130 }); expect(ac.transform.scaleX.keyframes[0].interp).toBe("bezier");
  });
  it("project → .nooi → project loses nothing", () => {
    const { e } = rich(); const p = e.project;
    const back = fromNooi(JSON.parse(JSON.stringify(toNooi(p))));
    expect(JSON.parse(JSON.stringify(back))).toEqual(JSON.parse(JSON.stringify(migrate(p))));
  });
  it("reads an anchor given only in frames (another app's file)", () => {
    const { e, br, b } = rich(); const d = JSON.parse(JSON.stringify(toNooi(e.project)));
    for (const t of d.timeline.tracks) for (const c of t.clips) delete c.anchorSource;
    const back = fromNooi(d); expect(at(back, br).anchor).toEqual({ clip: b, at: at(e.project, br).anchor!.at });
  });
});
