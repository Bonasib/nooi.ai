import { describe, expect, it } from "vitest";
import {
  Editor, emptyProject, mediaClip, textClip, addClip, split, splitAt, trim, deleteClips, closeGap, slip, roll, slide, setSpeed, freezeFrame,
  detachAudio, moveClip, addTransition, layersAt, sourceTime, duration, snap, snapPoints, valueAt, setKeyframe, bezier, migrate, runSteps,
  cutRange, frameSize, PRESETS, TRANSITIONS, peaks, beats, loudSpans, duckGain, gainAt, findClip, clipEnd, addMarker, aspectOf,
} from "../src";
import type { Asset, MediaClip, Project } from "../src";

const asset = (id: string, kind: Asset["kind"], duration?: number): Asset => ({ id, kind, name: id, src: "/m/" + id, duration, createdAt: 0, hasAudio: kind === "video" });
function setup(): { p: Project; v: string; a: string } {
  const p = emptyProject(); p.assets.va = asset("va", "video", 10); p.assets.vb = asset("vb", "video", 8); p.assets.im = asset("im", "image"); p.assets.mu = asset("mu", "audio", 30);
  const v = p.tracks.find((t) => t.kind === "video" && t.name === "V1")!.id, a = p.tracks.find((t) => t.kind === "audio")!.id;
  return { p, v, a };
}
const clip = (p: Project, id: string) => findClip(p, id)!.clip as MediaClip;

describe("adding and moving", () => {
  it("places media on the right kind of track, never overlapping", () => {
    const { p, v } = setup();
    const c1 = addClip(p, mediaClip(p.assets.va, 0), v); const c2 = addClip(p, mediaClip(p.assets.vb, 3), v);
    expect(c1.dur).toBe(10); expect(c2.start).toBe(10);                      // pushed to the free spot after c1
    const m = addClip(p, mediaClip(p.assets.mu, 0), v);                        // music never lands on a video track
    expect(findClip(p, m.id)!.track.kind).toBe("audio");
    const t = addClip(p, textClip("مرحبا", 1)); expect(findClip(p, t.id)!.track.kind).toBe("text");
    expect(duration(p)).toBe(30);
  });
  it("insert mode splits the clip under it and pushes the rest", () => {
    const { p, v } = setup(); const c1 = addClip(p, mediaClip(p.assets.va, 0), v);
    addClip(p, mediaClip(p.assets.im, 4), v, "insert");
    const tr = findClip(p, c1.id)!.track; expect(tr.clips.map((c) => [c.start, c.dur])).toEqual([[0, 4], [4, 4], [8, 6]]);
  });
  it("moving onto a taken spot finds the nearest free one", () => {
    const { p, v } = setup(); const a = addClip(p, mediaClip(p.assets.va, 0), v); const b = addClip(p, mediaClip(p.assets.im, 20), v);
    moveClip(p, b.id, 5); expect(clip(p, b.id).start).toBe(10); expect(clipEnd(a)).toBe(10);
  });
});

describe("trim, split, delete, ripple", () => {
  it("trims within the source and the neighbours", () => {
    const { p, v } = setup(); const a = addClip(p, mediaClip(p.assets.va, 0), v); const b = addClip(p, mediaClip(p.assets.vb, 12), v);
    trim(p, a.id, "end", 30); expect(clip(p, a.id).dur).toBe(10);           // the source has 10 s
    trim(p, a.id, "start", 2); expect([clip(p, a.id).start, clip(p, a.id).in, clip(p, a.id).dur]).toEqual([2, 2, 8]);
    trim(p, a.id, "start", -5); expect([clip(p, a.id).start, clip(p, a.id).in]).toEqual([0, 0]);
    trim(p, b.id, "start", 5); expect(clip(p, b.id).start).toBe(12);        // b's source starts at 0: can't grow earlier
    trim(p, a.id, "end", 6, true); expect([clip(p, a.id).dur, clip(p, b.id).start]).toEqual([6, 8]);   // ripple pulls b
  });
  it("splits keep the source continuous and the keyframes", () => {
    const { p, v } = setup(); const a = addClip(p, mediaClip(p.assets.va, 0, { speed: 2, dur: 5 }), v) as MediaClip;
    a.keyframes.opacity = [{ t: 0, v: 0 }, { t: 4, v: 1 }];
    const b = split(p, a.id, 2) as MediaClip;
    expect([clip(p, a.id).dur, b.start, b.dur, b.in]).toEqual([2, 2, 3, 4]);
    expect(valueAt(clip(p, a.id).keyframes.opacity, 2, 1)).toBeCloseTo(0.5, 5);
    expect(valueAt(b.keyframes.opacity, 0, 1)).toBeCloseTo(0.5, 5);
    expect(sourceTime(b, 0)).toBe(4);
  });
  it("split at the playhead cuts every unlocked track", () => {
    const { p, v, a } = setup(); addClip(p, mediaClip(p.assets.va, 0), v); addClip(p, mediaClip(p.assets.mu, 0), a);
    p.tracks.find((t) => t.id === a)!.locked = true;
    expect(splitAt(p, 4).length).toBe(1);
  });
  it("ripple delete closes the gap; close gap works on a track", () => {
    const { p, v } = setup(); const a = addClip(p, mediaClip(p.assets.va, 0), v); const b = addClip(p, mediaClip(p.assets.vb, 10), v); const c = addClip(p, mediaClip(p.assets.im, 18), v);
    deleteClips(p, [b.id], true); expect(clip(p, c.id).start).toBe(10);
    moveClip(p, c.id, 15); expect(closeGap(p, v, 12)).toBe(true); expect(clip(p, c.id).start).toBe(10); expect(clip(p, a.id).start).toBe(0);
  });
  it("a locked track can't be changed", () => {
    const { p, v } = setup(); const a = addClip(p, mediaClip(p.assets.va, 0), v); p.tracks.find((t) => t.id === v)!.locked = true;
    expect(trim(p, a.id, "end", 4)).toBe(false); expect(split(p, a.id, 3)).toBe(null); expect(deleteClips(p, [a.id])).toBe(0);
  });
});

describe("slip, roll, slide, speed, freeze, detach", () => {
  it("slip moves the content inside the clip, bounded by the source", () => {
    const { p, v } = setup(); const a = addClip(p, mediaClip(p.assets.va, 0, { dur: 4 }), v);
    slip(p, a.id, 3); expect(clip(p, a.id).in).toBe(3); slip(p, a.id, 50); expect(clip(p, a.id).in).toBe(6); slip(p, a.id, -50); expect(clip(p, a.id).in).toBe(0);
  });
  it("roll moves a cut, slide moves a clip between its neighbours", () => {
    const { p, v } = setup();
    const a = addClip(p, mediaClip(p.assets.va, 0, { dur: 5 }), v); const b = addClip(p, mediaClip(p.assets.vb, 5, { dur: 4, in: 2 }), v); const c = addClip(p, mediaClip(p.assets.va, 9, { dur: 4, in: 1 }), v);
    roll(p, a.id, 6); expect([clip(p, a.id).dur, clip(p, b.id).start, clip(p, b.id).dur, clip(p, b.id).in]).toEqual([6, 6, 3, 3]);
    roll(p, a.id, 2); expect(clip(p, b.id).in).toBe(0);                        // b can't start before its source
    expect(clip(p, a.id).dur).toBe(3);
    slide(p, b.id, 1);
    expect([clip(p, a.id).dur, clip(p, b.id).start, clip(p, c.id).start, clip(p, c.id).in, clip(p, c.id).dur]).toEqual([4, 4, 10, 2, 3]);
  });
  it("speed changes the length and pushes what follows; freeze inserts a still", () => {
    const { p, v } = setup(); const a = addClip(p, mediaClip(p.assets.va, 0, { dur: 4 }), v); const b = addClip(p, mediaClip(p.assets.im, 4), v);
    setSpeed(p, a.id, 2); expect([clip(p, a.id).dur, clip(p, b.id).start]).toEqual([2, 2]);
    setSpeed(p, a.id, 0.5); expect(clip(p, a.id).dur).toBe(8); expect(clip(p, b.id).start).toBe(8);
    const fz = freezeFrame(p, a.id, 4, 2) as MediaClip; expect(fz.freeze).toBe(2); expect(fz.start).toBe(4); expect(clip(p, b.id).start).toBe(10);
  });
  it("reverse plays the same source range backwards", () => {
    const { p, v } = setup(); const a = addClip(p, mediaClip(p.assets.va, 0, { dur: 4, in: 2, reverse: true }), v) as MediaClip;
    expect(sourceTime(a, 0)).toBe(6); expect(sourceTime(a, 4)).toBe(2);
    trim(p, a.id, "end", 6); expect([clip(p, a.id).dur, clip(p, a.id).in]).toEqual([6, 0]);
  });
  it("detach puts the sound on an audio track and mutes the video", () => {
    const { p, v } = setup(); const a = addClip(p, mediaClip(p.assets.va, 0), v);
    const s = detachAudio(p, a.id)!; expect(findClip(p, s.id)!.track.kind).toBe("audio"); expect(clip(p, a.id).muted).toBe(true); expect((s as MediaClip).link).toBe(a.id);
  });
});

describe("transitions, layers, snapping, keyframes", () => {
  it("a transition overlaps the cut; layers come bottom to top", () => {
    const { p, v } = setup(); const a = addClip(p, mediaClip(p.assets.va, 0, { dur: 4 }), v); const b = addClip(p, mediaClip(p.assets.vb, 4, { dur: 4 }), v);
    const t = addTransition(p, a.id, "fade", 1)!; expect(t.b).toBe(b.id);
    const L = layersAt(p, 3.75); expect(L.map((l) => [l.clip.id, l.trans?.role, Math.round((l.trans?.k || 0) * 100)])).toEqual([[a.id, "a", 25], [b.id, "b", 25]]);
    const top = addClip(p, textClip("hi", 0)); const L2 = layersAt(p, 1); expect(L2[L2.length - 1].clip.id).toBe(top.id);
    moveClip(p, b.id, 6); expect(p.transitions.length).toBe(0);               // pulled apart: the transition goes
  });
  it("snaps to edges, markers and beats", () => {
    const { p, v } = setup(); addClip(p, mediaClip(p.assets.va, 0, { dur: 4 }), v); addMarker(p, 7); p.beats = [5.5];
    const pts = snapPoints(p, { playhead: 2 });
    expect(snap(4.08, pts, 0.1).t).toBe(4); expect(snap(6.95, pts, 0.1).t).toBe(7); expect(snap(5.46, pts, 0.1).t).toBe(5.5); expect(snap(3, pts, 0.1).snapped).toBe(false);
  });
  it("keyframes ease between values", () => {
    expect(bezier([0.42, 0, 0.58, 1], 0.5)).toBeCloseTo(0.5, 3);
    let k = setKeyframe({}, "scale", 0, 1, "linear"); k = setKeyframe(k, "scale", 2, 2);
    expect(valueAt(k.scale, 1, 1)).toBeCloseTo(1.5, 5); expect(valueAt(k.scale, 9, 1)).toBe(2);
    k = setKeyframe(k, "scale", 0, 1, "easeIn"); expect(valueAt(k.scale, 1, 1)).toBeLessThan(1.5);
  });
  it("fades and volume keyframes shape the sound", () => {
    const c = mediaClip({ id: "x", kind: "video", name: "x", src: "", duration: 10, createdAt: 0 }, 0, { fadeIn: 1, fadeOut: 2, volume: 0.8 });
    expect(gainAt(c, 0.5)).toBeCloseTo(0.4, 5); expect(gainAt(c, 5)).toBeCloseTo(0.8, 5); expect(gainAt(c, 9)).toBeCloseTo(0.4, 5);
  });
});

describe("store, commands, presets, migration, sound analysis", () => {
  it("undo/redo, drag transactions are one step, 300 steps kept", () => {
    const { p, v } = setup(); const e = new Editor(p);
    const c = e.run("add", (d) => addClip(d, mediaClip(d.assets.va, 0), v));
    e.begin("drag"); for (let i = 1; i <= 5; i++) e.live((d) => moveClip(d, c.id, i)); e.commit();
    expect(clip(e.project, c.id).start).toBe(5); expect(e.past.length).toBe(2);
    e.undo(); expect(clip(e.project, c.id).start).toBe(0); e.redo(); expect(clip(e.project, c.id).start).toBe(5);
    for (let i = 0; i < 320; i++) e.run("n", (d) => { d.name = "n" + i; });
    expect(e.past.length).toBe(300);
  });
  it("named commands: 'remove the first 3 seconds and zoom' in one step", () => {
    const { p, v } = setup(); const e = new Editor(p); const c = e.run("add", (d) => addClip(d, mediaClip(d.assets.va, 0), v));
    const r = e.run("ai", (d) => { const res = runSteps(d, [{ cmd: "cutRange", args: { from: 0, to: 3 } }]); const first = d.tracks.flatMap((t) => t.clips).find((x) => x.start === 0)!; runSteps(d, [{ cmd: "zoomOn", args: { id: first.id, scale: 1.5 } }]); return res; });
    expect(r.ok).toBe(1); const all = e.project.tracks.flatMap((t) => t.clips); expect(all.length).toBe(1); expect((all[0] as MediaClip).in).toBe(3); expect(all[0].dur).toBe(7);
    expect(all[0].keyframes.scale?.length).toBe(2); expect(runSteps(e.project, [{ cmd: "nope", args: {} }]).failed).toEqual(["nope"]);
    void c; void cutRange;
  });
  it("presets and frame sizes", () => {
    expect(frameSize("9:16", "1080p")).toEqual({ w: 1080, h: 1920 }); expect(frameSize("4:5", "1080p")).toEqual({ w: 1080, h: 1350 }); expect(frameSize("16:9", "4k")).toEqual({ w: 3840, h: 2160 });
    expect(PRESETS.map((x) => x.id)).toEqual(expect.arrayContaining(["tiktok", "reels", "youtube", "snapchat", "x"])); expect(TRANSITIONS.length).toBeGreaterThanOrEqual(30);
    expect(aspectOf(1080, 1350)).toBe("4:5");
  });
  it("reads damaged or old projects", () => {
    const m = migrate({ name: "old", tracks: [{ id: "t", kind: "video", clips: [{ id: "c", type: "media", asset: "a", start: -3, dur: "x", speed: 99 }, { bad: 1 }] }], transitions: [{ a: "c", b: "zz" }] });
    expect(m.tracks[0].clips.length).toBe(1); const c = m.tracks[0].clips[0] as MediaClip; expect([c.start, c.dur, c.speed]).toEqual([0, 1, 10]); expect(m.transitions.length).toBe(0);
    expect(() => migrate({ schema: 99 })).toThrow(); expect(migrate(null).tracks.length).toBeGreaterThan(0);
  });
  it("peaks, beats and speech spans", () => {
    const rate = 8000, s = new Float32Array(rate * 4);
    for (const b of [0.5, 1.5, 2.5, 3.5]) for (let i = 0; i < 400; i++) s[Math.floor(b * rate) + i] = Math.sin(i / 3) * (1 - i / 400);
    const bt = beats(s, rate); expect(bt.length).toBe(4); bt.forEach((t, i) => expect(Math.abs(t - (0.5 + i))).toBeLessThan(0.05));
    expect(peaks(s, 8).every((x) => x >= 0 && x <= 1)).toBe(true);
    const v = new Float32Array(rate * 3); for (let i = rate; i < 2 * rate; i++) v[i] = Math.sin(i / 5) * 0.3;
    const sp = loudSpans(v, rate); expect(sp.length).toBe(1); expect(Math.abs(sp[0][0] - 0.92)).toBeLessThan(0.1);
    expect(duckGain(sp, 1.5, 0.7)).toBeCloseTo(0.3, 5); expect(duckGain(sp, 2.8, 0.7)).toBe(1);
  });
});
