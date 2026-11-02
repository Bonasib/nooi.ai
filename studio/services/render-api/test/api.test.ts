/* eslint-disable @typescript-eslint/no-explicit-any */
// The render service end to end: a stand-in nooi.ai server answers who the user is; real FFmpeg renders a small project with a
// video, a picture, a sound, a text PNG, a transition and colour; a resumable upload goes through the tus protocol.
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import http from "node:http";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import type { FastifyInstance } from "fastify";

const root = fs.mkdtempSync(path.join(os.tmpdir(), "nooi-render-"));
let fake: http.Server, app: FastifyInstance, base = "", closeQueue = async () => {};
const H = (u = "u1") => ({ authorization: "Bearer " + u, "content-type": "application/json" });
const ff = (...a: string[]) => execFileSync("ffmpeg", ["-y", "-loglevel", "error", ...a]);
const probe = (f: string) => JSON.parse(execFileSync("ffprobe", ["-v", "error", "-show_entries", "format=duration:stream=codec_type,codec_name,width,height", "-of", "json", f]).toString());

beforeAll(async () => {
  // who is who: u1 free, u2 another free user, boss = owner
  fake = http.createServer((req, res) => {
    const u = String(req.headers.authorization || "").replace(/^Bearer /, ""); res.setHeader("content-type", "application/json");
    if (!["u1", "u2", "boss"].includes(u)) { res.statusCode = 401; return res.end("{}"); }
    if (req.url === "/v1/me") return res.end(JSON.stringify({ uid: u, role: u === "boss" ? "owner" : null }));
    if (req.url === "/v1/billing") return res.end(JSON.stringify({ plan: "free", staff: u === "boss" }));
    res.statusCode = 404; res.end("{}");
  });
  await new Promise<void>((ok) => fake.listen(0, "127.0.0.1", () => ok()));
  const media = path.join(root, "media"); fs.mkdirSync(media, { recursive: true });
  Object.assign(process.env, { NOOI_APP_URL: `http://127.0.0.1:${(fake.address() as { port: number }).port}`, MEDIA_DIR: media, UPLOAD_DIR: path.join(root, "up"), RENDER_DIR: path.join(root, "out"), RENDER_CONCURRENCY: "1", CLAMAV_HOST: "" });
  ff("-f", "lavfi", "-i", "testsrc=size=320x180:rate=25:duration=2", "-f", "lavfi", "-i", "sine=frequency=440:duration=2", "-c:v", "libvpx-vp9", "-deadline", "realtime", "-cpu-used", "8", "-c:a", "libopus", "-shortest", path.join(media, "a.webm"));
  ff("-f", "lavfi", "-i", "color=c=red:size=200x200", "-frames:v", "1", path.join(media, "p.png"));
  ff("-f", "lavfi", "-i", "sine=frequency=220:duration=3", path.join(media, "s.wav"));
  ff("-f", "lavfi", "-i", "color=c=white@0.0:size=320x180,format=rgba", "-vf", "drawbox=x=40:y=60:w=240:h=50:color=white@1:t=fill", "-frames:v", "1", path.join(root, "t.png"));
  // memory by default; with DATABASE_URL and REDIS_URL set this runs on PostgreSQL and BullMQ, as on the VPS
  const { parts } = await import("../src/boot");
  const { buildApp } = await import("../src/server");
  const { store, queue } = await parts(true); closeQueue = () => queue.close();
  app = await buildApp({ store, queue });
  await app.listen({ port: 0, host: "127.0.0.1" }); base = `http://127.0.0.1:${(app.server.address() as { port: number }).port}`;
}, 60_000);
afterAll(async () => { await app?.close(); await closeQueue(); fake?.close(); fs.rmSync(root, { recursive: true, force: true }); });

async function project() {
  const C = await import("@nooi/editor-core");
  const p = C.emptyProject({ width: 320, height: 180, fps: 25 });
  const v = { id: "av", kind: "video" as const, name: "a.webm", src: "/media/a.webm", duration: 2, hasAudio: true, createdAt: 0 };
  const im = { id: "ai", kind: "image" as const, name: "p.png", src: "/media/p.png", w: 200, h: 200, createdAt: 0 };
  const s = { id: "as", kind: "audio" as const, name: "s.wav", src: "/media/s.wav", duration: 3, createdAt: 0 };
  p.assets = { av: v, ai: im, as: s };
  const V1 = p.tracks.find((t) => t.name === "V1")!, A1 = p.tracks.find((t) => t.name === "A1")!, T1 = p.tracks.find((t) => t.name === "T1")!;
  const c1 = C.mediaClip(v, 0, { id: "c1" }), c2 = C.mediaClip(im, 2, { id: "c2", dur: 1.5 });
  c1.color.saturation = 0.3; c2.effects = [{ id: "e1", type: "blur", enabled: true, params: { amount: 0.4 } }];
  V1.clips.push(c1, c2); A1.clips.push(C.mediaClip(s, 0, { id: "c3", volume: 0.5 }));
  T1.clips.push(C.textClip("Hello", 0.5, { id: "x1", dur: 2 }));
  C.addTransition(p, "c1", "fade", 0.5);
  return p;
}
const wait = async (id: string, who = "u1") => { for (let i = 0; i < 240; i++) { const r = await (await fetch(`${base}/renders/${id}`, { headers: H(who) })).json() as any; if (["done", "failed", "cancelled"].includes(r.status)) return r; await new Promise((ok) => setTimeout(ok, 250)); } throw new Error("timeout"); };

describe("render-api", () => {
  it("answers health and refuses strangers", async () => {
    expect((await (await fetch(base + "/health")).json() as any).ok).toBe(true);
    expect((await fetch(base + "/renders", { headers: H("nobody") })).status).toBe(401);
  });
  it("renders a real MP4 with sound, text, a transition and colour", async () => {
    const p = await project(); const png = "data:image/png;base64," + fs.readFileSync(path.join(root, "t.png")).toString("base64");
    const res = await fetch(base + "/renders", { method: "POST", headers: H(), body: JSON.stringify({ project: p, texts: { x1: png }, format: "mp4", width: 320, height: 180, fps: 25, quality: "low" }) });
    expect(res.status).toBe(202); const q = await res.json() as any; expect(q.status).toBe("queued");
    const r = await wait(q.id); expect(r.error).toBe(null); expect(r.status).toBe("done");
    const f = path.join(root, "out", path.basename(r.url)); const pr = probe(f);
    expect(pr.streams.map((s: { codec_type: string }) => s.codec_type).sort()).toEqual(["audio", "video"]);
    expect(pr.streams.find((s: { codec_type: string }) => s.codec_type === "video")).toMatchObject({ codec_name: "h264", width: 320, height: 180 });
    expect(Math.abs(+pr.format.duration - 3.5)).toBeLessThan(0.3);
    const dl = await fetch(base + "/files/" + path.basename(r.url), { headers: { range: "bytes=0-99" } });
    expect(dl.status).toBe(206); expect((await dl.arrayBuffer()).byteLength).toBe(100);
    expect((await fetch(`${base}/renders/${q.id}`, { headers: H("u2") })).status).toBe(404);   // not someone else's
  }, 120_000);
  it("renders GIF and MP3", async () => {
    const p = await project();
    for (const [format, codec] of [["gif", "gif"], ["mp3", "mp3"]] as const) {
      const q = await (await fetch(base + "/renders", { method: "POST", headers: H(), body: JSON.stringify({ project: p, format, width: 160, height: 90, fps: 10 }) })).json() as any;
      const r = await wait(q.id); expect(r.status, r.error).toBe("done");
      expect(probe(path.join(root, "out", path.basename(r.url))).streams[0].codec_name).toBe(codec);
    }
  }, 120_000);
  it("refuses outside files, paths out of the media folder and an empty timeline", async () => {
    const p = await project(); p.assets.av.src = "https://example.com/x.mp4";
    let r = await fetch(base + "/renders", { method: "POST", headers: H(), body: JSON.stringify({ project: p, width: 320, height: 180 }) });
    expect(r.status).toBe(400); expect((await r.json() as any).code).toBe("media");
    p.assets.av.src = "/media/../../etc/passwd";
    r = await fetch(base + "/renders", { method: "POST", headers: H(), body: JSON.stringify({ project: p, width: 320, height: 180 }) }); expect(r.status).toBe(400);
    const C = await import("@nooi/editor-core");
    r = await fetch(base + "/renders", { method: "POST", headers: H(), body: JSON.stringify({ project: C.emptyProject(), width: 320, height: 180 }) }); expect(r.status).toBe(400);
  });
  it("keeps to the plan's limit and can cancel", async () => {
    const p = await project(); const body = JSON.stringify({ project: p, format: "webm", width: 320, height: 180, fps: 25 });
    const a = await (await fetch(base + "/renders", { method: "POST", headers: H("u2"), body })).json() as any;
    const b = await fetch(base + "/renders", { method: "POST", headers: H("u2"), body }); expect(b.status).toBe(429);   // free: one at a time
    expect((await fetch(`${base}/renders/${a.id}`, { method: "DELETE", headers: H("u2") })).status).toBe(200);
    expect((await wait(a.id, "u2")).status).toBe("cancelled");
    const admin = await (await fetch(base + "/admin/queue", { headers: H("boss") })).json() as any; expect(admin.counts).toBeTruthy();
    expect((await fetch(base + "/admin/usage", { headers: H("u1") })).status).toBe(403);
  }, 60_000);
  it("streams status over SSE", async () => {
    const p = await project();
    const q = await (await fetch(base + "/renders", { method: "POST", headers: H(), body: JSON.stringify({ project: p, format: "wav", width: 320, height: 180 }) })).json() as any;
    const res = await fetch(`${base}/renders/${q.id}/events?token=u1`); const text = await res.text();
    const last = JSON.parse(text.trim().split("\n\n").filter((x) => x.startsWith("data:")).pop()!.slice(5));
    expect(last.status).toBe("done");
  }, 60_000);
  it("takes a resumable upload, checks the bytes and renders from it", async () => {
    const file = fs.readFileSync(path.join(root, "media", "a.webm")), meta = "filename " + Buffer.from("clip.webm").toString("base64");
    const c = await fetch(base + "/uploads/files", { method: "POST", headers: { authorization: "Bearer u1", "tus-resumable": "1.0.0", "upload-length": String(file.length), "upload-metadata": meta } });
    expect(c.status).toBe(201); const loc = new URL(c.headers.get("location")!).pathname.replace(/^\/render-api/, "");
    const half = Math.floor(file.length / 2);
    let r = await fetch(base + loc, { method: "PATCH", headers: { authorization: "Bearer u1", "tus-resumable": "1.0.0", "upload-offset": "0", "content-type": "application/offset+octet-stream" }, body: file.subarray(0, half) });
    expect(r.status).toBe(204);
    const h = await fetch(base + loc, { method: "HEAD", headers: { authorization: "Bearer u1", "tus-resumable": "1.0.0" } }); expect(h.headers.get("upload-offset")).toBe(String(half));
    r = await fetch(base + loc, { method: "PATCH", headers: { authorization: "Bearer u1", "tus-resumable": "1.0.0", "upload-offset": String(half), "content-type": "application/offset+octet-stream" }, body: file.subarray(half) });
    expect(r.status).toBe(204); const url = r.headers.get("upload-url")!; expect(url).toMatch(/^\/render-api\/uploads\/u[0-9a-f]+\.webm$/);
    expect((await fetch(base + "/uploads/" + path.basename(url), { headers: H("u2") })).status).toBe(404);
    const p = await project(); p.assets.av.src = "local:abc";
    const q = await (await fetch(base + "/renders", { method: "POST", headers: H(), body: JSON.stringify({ project: p, media: { av: url }, format: "mp4", width: 320, height: 180, quality: "low" }) })).json() as any;
    expect((await wait(q.id)).status).toBe("done");
    // a text file named .mp4 is refused
    const bad = Buffer.from("not a video at all");
    const c2 = await fetch(base + "/uploads/files", { method: "POST", headers: { authorization: "Bearer u1", "tus-resumable": "1.0.0", "upload-length": String(bad.length) } });
    const loc2 = new URL(c2.headers.get("location")!).pathname.replace(/^\/render-api/, "");
    r = await fetch(base + loc2, { method: "PATCH", headers: { authorization: "Bearer u1", "tus-resumable": "1.0.0", "upload-offset": "0", "content-type": "application/offset+octet-stream" }, body: bad });
    expect(r.status).toBe(415);
    expect((await fetch(base + "/uploads/files", { method: "POST", headers: { "tus-resumable": "1.0.0", "upload-length": "10" } })).status).toBe(401);
  }, 120_000);
  it("cleans expired renders", async () => {
    const { MemoryStore } = await import("../src/store"); const { cleanup } = await import("../src/cleanup");
    const s = new MemoryStore(); const f = path.join(root, "out", "old.mp4"); fs.writeFileSync(f, "x");
    await s.addRender({ id: "old", owner: "u", plan: "free", status: "done", progress: 1, format: "mp4", width: 2, height: 2, fps: 1, seconds: 1, outputPath: f, url: null, error: null, priority: 1, createdAt: new Date(0), startedAt: null, finishedAt: null, expiresAt: new Date(1) });
    expect((await cleanup(s)).renders).toBe(1); expect(fs.existsSync(f)).toBe(false);
  });
});
