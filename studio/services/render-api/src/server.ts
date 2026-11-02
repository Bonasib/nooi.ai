// The HTTP API. Behind the nooi.ai server at /render-api/* (same origin, same sign-in), so every route here is relative to that.
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import Fastify, { type FastifyInstance, type FastifyRequest } from "fastify";
import rateLimit from "@fastify/rate-limit";
import websocket from "@fastify/websocket";
import { migrate, duration } from "@nooi/editor-core";
import { CFG } from "./config";
import { whoIs, type Who } from "./auth";
import { events, type Store, type RenderRow } from "./store";
import type { RenderQueue } from "./queue";
import { makeProxy } from "./render";
import { resolveSrc, sendFile } from "./files";
import { tusServer } from "./uploads";

const FORMATS = ["mp4", "webm", "mov", "gif", "mp3", "wav"] as const;
type Fmt = (typeof FORMATS)[number];
const pub = (r: RenderRow) => ({ id: r.id, status: r.status, progress: r.progress, format: r.format, width: r.width, height: r.height, fps: r.fps, seconds: r.seconds, url: r.url, error: r.error, createdAt: r.createdAt, finishedAt: r.finishedAt, expiresAt: r.expiresAt });
const hdrs = (req: FastifyRequest) => { const h = { ...req.headers } as Record<string, string | string[] | undefined>; const q = req.query as { token?: string }; if (!h.authorization && q?.token) h.authorization = "Bearer " + q.token; return h; };

export async function buildApp(o: { store: Store; queue: RenderQueue; logger?: boolean }): Promise<FastifyInstance> {
  const { store, queue } = o;
  const app = Fastify({ logger: o.logger ?? false, trustProxy: true, bodyLimit: 64 * 1024 * 1024 });
  // JSON bodies; an empty one (a DELETE from some clients) is an empty object, not an error
  app.removeContentTypeParser("application/json");
  app.addContentTypeParser("application/json", { parseAs: "string" }, (_req, body, done) => { if (!body) return done(null, {}); try { done(null, JSON.parse(String(body))); } catch { done(Object.assign(new Error("bad JSON"), { statusCode: 400 }), undefined); } });
  await app.register(rateLimit, { max: 600, timeWindow: "1 minute" });
  await app.register(websocket);
  for (const d of [CFG.uploadDir, CFG.renderDir, path.join(CFG.renderDir, "proxies")]) fs.mkdirSync(d, { recursive: true });

  const who = async (req: FastifyRequest): Promise<Who> => { const w = await whoIs(hdrs(req)); if (!w) throw Object.assign(new Error("sign in first"), { statusCode: 401 }); return w; };
  const staff = async (req: FastifyRequest) => { const w = await who(req); if (!w.admin && !w.staff) throw Object.assign(new Error("staff only"), { statusCode: 403 }); return w; };
  const own = async (req: FastifyRequest, id: string) => { const w = await who(req), r = await store.getRender(id); if (!r || (r.owner !== w.uid && !w.admin && !w.staff)) throw Object.assign(new Error("not found"), { statusCode: 404 }); return r; };
  app.setErrorHandler((e: Error & { statusCode?: number }, _req, reply) => { const c = e.statusCode || 500; reply.code(c).send({ error: c >= 500 ? "server error" : e.message }); if (c >= 500) app.log.error(e); });

  app.get("/health", async () => ({ ok: true, queue: await queue.counts(), ffmpeg: CFG.ffmpeg, scanner: CFG.clamHost ? "clamav" : "off" }));
  app.get("/limits", async (req) => { const w = await who(req); return { plan: w.plan, renders: CFG.planLimit[w.staff ? "staff" : w.plan] ?? 1, active: await store.activeRenders(w.uid), maxSeconds: CFG.maxSeconds, maxUploadMB: Math.round(CFG.maxUpload / 1048576), keepDays: CFG.keepDays }; });

  // ---- uploads (tus): the raw body is the tus server's
  const tus = tusServer(store);
  app.addContentTypeParser("application/offset+octet-stream", (_req, _payload, done) => done(null));
  app.all("/uploads/files", { config: { rateLimit: { max: 120, timeWindow: "1 minute" } } }, (req, reply) => { reply.hijack(); void tus.handle(req.raw, reply.raw); });
  app.all("/uploads/files/*", (req, reply) => { reply.hijack(); void tus.handle(req.raw, reply.raw); });
  app.get("/uploads/:name", async (req, reply) => { const { name } = req.params as { name: string }; const w = await who(req); const row = await store.getMedia(name.replace(/\.[^.]+$/, ""));
    if (!row || (row.owner !== w.uid && !w.staff && !w.admin)) return reply.code(404).send({ error: "not found" }); return sendFile(req, reply, CFG.uploadDir, name); });

  // ---- renders
  app.post("/renders", { config: { rateLimit: { max: 20, timeWindow: "1 minute" } } }, async (req, reply) => {
    const w = await who(req);
    const b = (req.body || {}) as { project?: unknown; media?: Record<string, string>; texts?: Record<string, string>; format?: string; width?: number; height?: number; fps?: number; quality?: string; range?: [number, number] };
    const tier = w.staff ? "staff" : w.plan, limit = CFG.planLimit[tier] ?? 1;
    if ((await store.activeRenders(w.uid)) >= limit) return reply.code(429).send({ error: `Your plan renders ${limit} at a time — wait for the one running.`, code: "busy" });
    const format = (FORMATS as readonly string[]).includes(String(b.format)) ? (b.format as Fmt) : "mp4";
    const width = Math.round(Number(b.width) || 0), height = Math.round(Number(b.height) || 0), fps = Math.round(Number(b.fps) || 30);
    if (!(width >= 16 && width <= 3840 && height >= 16 && height <= 3840 && fps >= 1 && fps <= 60)) return reply.code(400).send({ error: "size or frame rate out of range" });
    const project = migrate(b.project), secs = duration(project);
    if (secs <= 0) return reply.code(400).send({ error: "the timeline is empty" });
    if (secs > CFG.maxSeconds) return reply.code(400).send({ error: `Longer than ${CFG.maxSeconds} s — split it into parts.` });
    // every used file must be on this disk; local-only files have to be uploaded first
    const used = new Set<string>(); for (const t of project.tracks) for (const c of t.clips) if (c.type === "media") { used.add(c.asset); if (c.lut) used.add(c.lut.asset); }
    const media: Record<string, string> = {}, luts: Record<string, string> = {};
    for (const id of used) {
      const a = project.assets[id]; if (!a) continue;
      const r = await resolveSrc(store, w, (b.media && b.media[id]) || a.src);
      if ("error" in r) return reply.code(400).send({ error: `${a.name}: ${r.error}`, asset: id, code: "media" });
      (a.kind === "lut" || /\.cube$/i.test(r.path) ? luts : media)[id] = r.path;
    }
    // texts: drawn by the browser (right shaping for every script) and sent as full-frame PNGs
    const id = "r" + crypto.randomBytes(9).toString("hex"), tdir = path.join(CFG.renderDir, "texts", id), texts: Record<string, string> = {};
    for (const [cid, data] of Object.entries(b.texts || {})) {
      const m = /^data:image\/png;base64,([A-Za-z0-9+/=]+)$/.exec(String(data)); if (!m || !/^[A-Za-z0-9_-]{1,64}$/.test(cid)) continue;
      const buf = Buffer.from(m[1], "base64"); if (buf.length > 16 * 1024 * 1024 || buf[0] !== 0x89 || buf.slice(1, 4).toString() !== "PNG") continue;
      fs.mkdirSync(tdir, { recursive: true }); const f = path.join(tdir, cid + ".png"); fs.writeFileSync(f, buf); texts[cid] = f;
    }
    const quality = (["high", "medium", "low"].includes(String(b.quality)) ? b.quality : "high") as "high" | "medium" | "low";
    const priority = CFG.planPriority[tier] ?? 5, now = new Date();
    await store.addRender({ id, owner: w.uid, plan: tier, status: "queued", progress: 0, format, width, height, fps, seconds: secs, outputPath: null, url: null, error: null, priority, createdAt: now, startedAt: null, finishedAt: null, expiresAt: new Date(+now + CFG.keepDays * 864e5) });
    await queue.add({ id, owner: w.uid, project, media, texts, luts, format, width, height, fps, quality }, priority);
    return reply.code(202).send(pub((await store.getRender(id))!));
  });
  app.get("/renders", async (req) => { const w = await who(req); return { renders: (await store.listRenders({ owner: w.uid, limit: 30 })).map(pub) }; });
  app.get("/renders/:id", async (req) => pub(await own(req, (req.params as { id: string }).id)));
  app.delete("/renders/:id", async (req) => {
    const r = await own(req, (req.params as { id: string }).id);
    if (r.status === "queued" || r.status === "running") { await queue.remove(r.id); await store.updateRender(r.id, { status: "cancelled", finishedAt: new Date() }); }
    else { if (r.outputPath) try { fs.unlinkSync(r.outputPath); } catch { /* */ } await store.deleteRender(r.id); }
    return { ok: true };
  });
  // live status: Server-Sent Events, and a WebSocket for clients that prefer it. Both also re-read the row each second, so a
  // render done by a separate worker process is seen too.
  const watch = (id: string, send: (r: RenderRow) => void, end: () => void) => {
    let last = ""; const push = (r: RenderRow | null) => { if (!r) return end(); const s = JSON.stringify(pub(r)); if (s !== last) { last = s; send(r); } if (["done", "failed", "cancelled"].includes(r.status)) end(); };
    const on = (r: RenderRow) => push(r); events.on("render:" + id, on);
    const tick = setInterval(() => { void store.getRender(id).then(push); }, 1000);
    return () => { clearInterval(tick); events.off("render:" + id, on); };
  };
  app.get("/renders/:id/events", async (req, reply) => {
    const r = await own(req, (req.params as { id: string }).id);
    reply.hijack(); const res = reply.raw; res.writeHead(200, { "content-type": "text/event-stream", "cache-control": "no-cache", "x-accel-buffering": "no", connection: "keep-alive" });
    let closed = false; const stop = watch(r.id, (x) => res.write(`data: ${JSON.stringify(pub(x))}\n\n`), () => { if (!closed) { closed = true; stop?.(); res.end(); } });
    const ping = setInterval(() => res.write(": ping\n\n"), 15000);
    req.raw.on("close", () => { closed = true; clearInterval(ping); stop(); });
    res.write(`data: ${JSON.stringify(pub(r))}\n\n`);
  });
  app.get("/ws/renders/:id", { websocket: true }, async (socket, req) => {
    let r: RenderRow; try { r = await own(req, (req.params as { id: string }).id); } catch { socket.close(4004, "not found"); return; }
    socket.send(JSON.stringify(pub(r)));
    const stop = watch(r.id, (x) => socket.send(JSON.stringify(pub(x))), () => setTimeout(() => socket.close(1000), 50));
    socket.on("close", () => stop());
  });
  app.get("/files/:name", async (req, reply) => {
    const { name } = req.params as { name: string }; const q = req.query as { download?: string };
    const r = await store.getRender(name.replace(/\.[^.]+$/, ""));   // the id is long and random: the link itself is the key, like a signed URL
    if (!r || r.status !== "done" || !r.outputPath || path.basename(r.outputPath) !== name || r.expiresAt < new Date()) return reply.code(404).send({ error: "not found or expired" });
    return sendFile(req, reply, CFG.renderDir, name, q.download === "1");
  });

  // ---- proxies: a 540p copy for smooth preview of big files (made once, kept with the renders)
  const making = new Map<string, Promise<void>>();
  app.post("/proxies", { config: { rateLimit: { max: 30, timeWindow: "1 minute" } } }, async (req, reply) => {
    const w = await who(req); const src = String((req.body as { src?: string })?.src || "");
    const r = await resolveSrc(store, w, src); if ("error" in r) return reply.code(400).send({ error: r.error });
    const key = crypto.createHash("sha1").update(r.path + fs.statSync(r.path).mtimeMs).digest("hex").slice(0, 20), name = "p" + key + ".mp4";
    const out = path.join(CFG.renderDir, "proxies", name), url = CFG.publicRenders.replace(/files\/$/, "") + "proxies/" + name;
    if (fs.existsSync(out)) return { url, ready: true };
    if (!making.has(key)) { const tmp = out + ".part.mp4"; making.set(key, makeProxy(r.path, tmp).then(() => fs.renameSync(tmp, out)).finally(() => making.delete(key))); await store.log(w.uid, "proxy", {}); }
    const done = await Promise.race([making.get(key)!.then(() => true, () => false), new Promise<boolean>((ok) => setTimeout(() => ok(false), 20000))]);
    return done && fs.existsSync(out) ? { url, ready: true } : { url, ready: false };
  });
  app.get("/proxies/:name", async (req, reply) => sendFile(req, reply, path.join(CFG.renderDir, "proxies"), (req.params as { name: string }).name));

  // ---- the admin: queue state and usage (owner and staff)
  app.get("/admin/queue", async (req) => { await staff(req); return { counts: await queue.counts(), running: (await store.listRenders({ status: "running", limit: 50 })).map((r) => ({ ...pub(r), owner: r.owner, plan: r.plan })), waiting: (await store.listRenders({ status: "queued", limit: 50 })).map((r) => ({ ...pub(r), owner: r.owner, plan: r.plan })), recent: (await store.listRenders({ limit: 30 })).map((r) => ({ ...pub(r), owner: r.owner, plan: r.plan })) }; });
  app.get("/admin/usage", async (req) => { await staff(req); const d = Math.min(365, Math.max(1, Number((req.query as { days?: string }).days) || 7)); return { days: d, users: await store.usage(d) }; });
  app.delete("/admin/renders/:id", async (req) => { await staff(req); const id = (req.params as { id: string }).id; await queue.remove(id); await store.updateRender(id, { status: "cancelled", finishedAt: new Date() }); return { ok: true }; });
  return app;
}
