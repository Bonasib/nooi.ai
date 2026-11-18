// v245: the edit for another editor (FCPXML 1.10, CMX3600 EDL, MLT)
import { describe, expect, it } from "vitest";
import { spawnSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { addAssetClip, addTrack, emptyProject, fileName, spineOf, tc, toEDL, toFCPXML, toMLT } from "../src";
import type { Asset, MediaClip } from "../src";

const vid = (id: string, name: string, d = 20): Asset => ({ id, kind: "video", name, src: "local:" + id, mime: "video/mp4", w: 1920, h: 1080, duration: d, hasAudio: true, createdAt: 0 });
function edit() {   // two shots on V1 (the second at 2× speed), a logo over the first, music under all, a marker
  const p = emptyProject(); p.name = "Trip & friends"; p.fps = 30; p.export.fps = 30; p.assets.a = vid("a", "beach"); p.assets.b = vid("b", "city.mov"); p.assets.m = { id: "m", kind: "audio", name: "song", src: "local:m", mime: "audio/mpeg", duration: 60, createdAt: 0 };
  p.assets.l = { id: "l", kind: "image", name: "logo", src: "local:l", mime: "image/png", w: 400, h: 400, createdAt: 0 };
  const v1 = spineOf(p)!; const a = addAssetClip(p, p.assets.a, 0, v1.id) as MediaClip; a.in = 1; a.dur = 4;
  const b = addAssetClip(p, p.assets.b, 4, v1.id) as MediaClip; b.in = 2; b.speed = 2; b.dur = 3;
  const v2 = addTrack(p, "video", p.tracks.indexOf(v1)); const l = addAssetClip(p, p.assets.l, 1, v2.id) as MediaClip; l.dur = 2;
  const at = p.tracks.find((t) => t.kind === "audio")!; const m = addAssetClip(p, p.assets.m, 0, at.id) as MediaClip; m.dur = 7; m.volume = 0.5;
  p.markers.push({ id: "k", t: 4, name: "City", color: "#fff" }); return p;
}
const xmllint = spawnSync("xmllint", ["--version"]).status === 0;
const wellFormed = (xml: string) => { const d = mkdtempSync(join(tmpdir(), "nle-")), f = join(d, "x.xml"); writeFileSync(f, xml); const r = spawnSync("xmllint", ["--noout", f], { encoding: "utf8" }); return r.status === 0 ? "" : r.stderr; };

describe("v245 the edit for another editor", () => {
  it("file names: the asset's name with its extension", () => { const p = edit(); expect(fileName(p.assets.a)).toBe("beach.mp4"); expect(fileName(p.assets.b)).toBe("city.mov"); expect(fileName(p.assets.m)).toBe("song.mp3"); expect(tc(30 * 61 + 5, 30)).toBe("00:01:01:05"); });
  it("EDL: the main track's two shots with source and record timecodes, the 2× speed, the marker", () => {
    const e = toEDL(edit()); const ev = e.split("\n").filter((l) => /^\d{3} /.test(l));
    expect(ev).toEqual(["001  BEACH    AA/V  C        00:00:01:00 00:00:05:00 00:00:00:00 00:00:04:00", "002  CITY     AA/V  C        00:00:02:00 00:00:08:00 00:00:04:00 00:00:07:00"]);
    expect(e).toContain("M2   CITY     0060.0"); expect(e).toContain("* FROM CLIP NAME: city.mov"); expect(e).toContain("* MARKER 00:00:04:00 City"); expect(e.startsWith("TITLE: Trip & friends")).toBe(true);
  });
  it("FCPXML 1.10: well formed; the spine holds both shots, the logo and the music are connected, the speed is a time map", () => {
    const x = toFCPXML(edit()); if (xmllint) expect(wellFormed(x)).toBe("");
    expect(x).toContain('<fcpxml version="1.10">'); expect(x).toContain('frameDuration="1/30s" width="1920" height="1080"');
    expect(x).toMatch(/<asset-clip ref="r\d" offset="0\/30s" name="beach" start="30\/30s" duration="120\/30s"/); expect(x).toContain('src="./beach.mp4"');
    expect(x).toMatch(/lane="1" offset="60\/30s"/); expect(x).toMatch(/lane="-1" offset="30\/30s"/);   // the logo 1 s in (beach starts 1 s into its file), the music at the start
    expect(x).toContain('<timept time="90/30s" value="240/30s" interp="linear"/>'); expect(x).toContain('<adjust-volume amount="-6.0dB"/>'); expect(x).toContain('<marker start="120/30s"');
    expect(x).toContain("Trip &amp; friends");
  });
  it("MLT: well formed; a playlist per track (bottom first), blanks for gaps, the 2× clip through timewarp", () => {
    const x = toMLT(edit()); if (xmllint) expect(wellFormed(x)).toBe("");
    expect((x.match(/<playlist /g) || []).length).toBe(3); expect(x).toContain('<blank length="30"/>'); expect(x).toContain('<property name="mlt_service">timewarp</property>');
    expect(x).toContain("2.0000:city.mov"); expect(x).toContain('frame_rate_num="30"'); expect(x).toContain('hide="video"');
  });
});
