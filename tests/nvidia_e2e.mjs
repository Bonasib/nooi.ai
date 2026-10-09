// NVIDIA AI across the studio, end to end: a mocked NVIDIA API catalog + a mocked Kie AI + the real nooi server (own data folder).
// Text AI (/v1/llm/json) → Nemotron chat · "nooi Auto" pictures → FLUX.1 · NVIDIA SD 3.5 → its own endpoint · picture edits → FLUX
// Kontext, and when Kontext fails the job falls back to Kie · 3D → TRELLIS via NVCF async (202 + NVCF-REQID → status poll → zip
// with a .glb; pictures go through the NVCF asset upload — NVIDIA rejects inline base64) · NVIDIA Cosmos video · switching a capability off in Admin sends "nooi Auto" back to Kie. Run: node tests/nvidia_e2e.mjs
import http from "http"; import { spawn } from "child_process"; import fs from "fs"; import os from "os"; import path from "path"; import url from "url"; import zlib from "zlib";
const ROOT = path.resolve(path.dirname(url.fileURLToPath(import.meta.url)), ".."); const NPORT = 8076, MPORT = 8075;
const D = fs.mkdtempSync(path.join(os.tmpdir(), "nooi-nv-")); fs.mkdirSync(D + "/data"); fs.mkdirSync(D + "/media"); fs.symlinkSync(ROOT + "/public", D + "/public");
fs.writeFileSync(D + "/data/db.json", JSON.stringify({ users: { local: { plan: "studio", credits: 5000, jobs: {}, ledger: [] } } }));
const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64");
const GLB = Buffer.concat([Buffer.from("glTF"), Buffer.alloc(60, 1)]), MP4 = Buffer.concat([Buffer.alloc(4), Buffer.from("ftypisom"), Buffer.alloc(40, 2)]);
function zipOf(name, data) { const c = zlib.deflateRawSync(data), h = Buffer.alloc(30); h.writeUInt32LE(0x04034b50, 0); h.writeUInt16LE(20, 4); h.writeUInt16LE(8, 8); h.writeUInt32LE(c.length, 18); h.writeUInt32LE(data.length, 22); h.writeUInt16LE(name.length, 26); return Buffer.concat([h, Buffer.from(name), c]); }
const seen = []; let n = 0, statusPolls = 0; const tasks = {};
http.createServer((req, res) => { let b = ""; req.on("data", (c) => (b += c)); req.on("end", () => {
  const u = new URL(req.url, "http://x"), body = b && /json/.test(req.headers["content-type"] || "") ? JSON.parse(b) : null, json = (d, code) => { res.statusCode = code || 200; res.setHeader("content-type", "application/json"); res.end(JSON.stringify(d)); };
  if (u.pathname.startsWith("/nv/")) { seen.push({ path: u.pathname, auth: req.headers.authorization, body });
    if (req.headers.authorization !== "Bearer nvapi-test") return json({ detail: "Unauthorized" }, 401);
    if (u.pathname === "/nv/v1/models") return json({ data: [] });
    if (u.pathname === "/nv/v1/chat/completions") { const c = body.messages.at(-1).content, img = Array.isArray(c);
      return json({ choices: [{ message: { role: "assistant", content: (body.reasoning_budget ? "<think>{thinking}</think>" : "") + JSON.stringify({ ok: true, by: body.model, img }) } }] }); }
    if (u.pathname === "/nv/genai/flux") return json({ artifacts: [{ base64: PNG.toString("base64"), finishReason: "SUCCESS", seed: 1 }] });
    if (u.pathname === "/nv/genai/sd35") return json({ image: PNG.toString("base64"), finish_reason: "SUCCESS" });
    if (u.pathname === "/nv/genai/kontext") return json({ detail: "Internal model error" }, 500);
    if (u.pathname === "/nv/assets") return json({ uploadUrl: `http://localhost:${MPORT}/upload/a1`, assetId: "a1" });
    if (u.pathname === "/nv/genai/trellis") { if (body.image !== "data:image/png;asset_id,a1" || req.headers["nvcf-input-asset-references"] !== "a1") return json({ detail: "Expected: example_id, got: base64" }, 422); res.statusCode = 202; res.setHeader("NVCF-REQID", "req-1"); return res.end(); }
    if (u.pathname === "/nv/status/req-1") { if (++statusPolls < 2) { res.statusCode = 202; return res.end(); } res.setHeader("content-type", "application/zip"); return res.end(zipOf("out/model.glb", GLB)); }
    if (u.pathname === "/nv/cosmos") return json({ b64_video: MP4.toString("base64") });
    return json({ detail: "not found" }, 404); }
  if (u.pathname === "/upload/a1" && req.method === "PUT") { seen.push({ path: "asset-put", type: req.headers["content-type"], desc: req.headers["x-amz-meta-nvcf-asset-description"], size: b.length }); res.statusCode = 200; return res.end(); }
  // Kie AI mock (fallback engine)
  if (u.pathname.startsWith("/out.")) { res.setHeader("content-type", u.pathname.endsWith(".png") ? "image/png" : "video/mp4"); return res.end(PNG); }
  const send = (d) => json({ code: 200, msg: "success", data: d });
  if (u.pathname === "/api/v1/chat/credit") return send(500);
  if (u.pathname === "/api/v1/jobs/createTask") { const id = "t" + ++n; tasks[id] = { body, polls: 0 }; seen.push({ path: "kie", body }); return send({ taskId: id }); }
  if (u.pathname === "/api/v1/jobs/recordInfo") { const t = tasks[u.searchParams.get("taskId")]; if (!t) return send(null); const img = !/video|kling|seedance|wan\//.test(t.body.model);
    return send(++t.polls >= 2 ? { state: "success", resultJson: JSON.stringify({ resultUrls: [`http://localhost:${MPORT}/out.${img ? "png" : "mp4"}`] }) } : { state: "generating" }); }
  res.statusCode = 404; res.end("{}"); }); }).listen(MPORT);
const env = Object.fromEntries(Object.entries(process.env).filter(([k]) => !/^(LLM_|ANTHROPIC_|NVIDIA_)/.test(k)));
const srv = spawn("node", [ROOT + "/server.js"], { cwd: D, env: { ...env, PORT: String(NPORT), SECRET_KEY: "v".repeat(40), FIREBASE_PROJECT_ID: "", PUBLIC_BASE_URL: `http://localhost:${NPORT}`,
  KIE_API_KEY: "kie_nv", KIE_BASE_URL: `http://localhost:${MPORT}`, NVIDIA_API_KEY: "nvapi-test", NVIDIA_BASE_URL: `http://localhost:${MPORT}/nv/v1`, NVIDIA_STATUS_URL: `http://localhost:${MPORT}/nv/status/`, NVIDIA_ASSETS_URL: `http://localhost:${MPORT}/nv/assets` }, stdio: "ignore" });
let pass = 0, fail = 0; const ok = (c, m) => { c ? pass++ : fail++; console.log((c ? "✓ " : "✗ ") + m); };
const api = async (p, j, method) => { const r = await fetch(`http://localhost:${NPORT}${p}`, { method: method || (j ? "POST" : "GET"), headers: { "content-type": "application/json" }, body: j ? JSON.stringify(j) : undefined }); return { status: r.status, d: await r.json().catch(() => ({})) }; };
const job = async (b) => { const r = await api("/v1/jobs", b); if (r.status !== 200) return { status: "http " + r.status, error: r.d.error }; let j = r.d; for (let i = 0; i < 80 && !["done", "failed"].includes(j.status); i++) { await new Promise((s) => setTimeout(s, 300)); j = (await api("/v1/jobs/" + j.id)).d; } return j; };
const media = (u) => fs.readFileSync(path.join(D, "media", path.basename(u)));
try {
  for (let i = 0; i < 80; i++) { try { await api("/v1/config"); break; } catch { await new Promise((r) => setTimeout(r, 250)); } }
  await api("/v1/admin/providers/nvidia", { imageUrl: `http://localhost:${MPORT}/nv/genai/flux`, image2Url: `http://localhost:${MPORT}/nv/genai/sd35`, editUrl: `http://localhost:${MPORT}/nv/genai/kontext`, trellisUrl: `http://localhost:${MPORT}/nv/genai/trellis`, videoUrl: `http://localhost:${MPORT}/nv/cosmos` }, "PUT");
  const cfg = (await api("/v1/config")).d;
  ok(cfg.providers.nvidia === true && cfg.providers.nvUse.image === true && cfg.providers.nvUse.video === false, "config: NVIDIA connected, pictures on, video opt-in");
  ok(cfg.llm && cfg.llm.provider === "nvidia" && cfg.llm.model === "nvidia/nemotron-3-super-120b-a12b", "the site's text AI is NVIDIA Nemotron");
  const t = await api("/v1/llm/json", { task: "test", tier: "quick", prompt: "say ok" }); ok(t.d.ok === true && t.d.by === "nvidia/nemotron-3-super-120b-a12b", "text AI request → Nemotron chat (" + JSON.stringify(t.d) + ")");
  const v = await api("/v1/llm/json", { task: "vision", tier: "quick", prompt: "describe", images: ["data:image/png;base64," + PNG.toString("base64")] });
  ok(v.d.img === true && v.d.by === "nvidia/nemotron-3-nano-omni-30b-a3b-reasoning", "pictures → Nemotron Omni (reasoning budget, <think> removed)");
  ok(seen.every((s) => !s.path.startsWith("/nv/") || s.auth === "Bearer nvapi-test"), "every NVIDIA call carries the key as Bearer");
  let k0x = seen.filter((s) => s.path === "kie").length; let j = await job({ kind: "image", model: "auto", prompt: "a lighthouse at dusk", aspect: "16:9" });
  ok(j.status === "done" && /\.png$/.test(j.url) && media(j.url).equals(PNG), "nooi Auto picture → NVIDIA FLUX.1 (" + j.status + ")"); ok(seen.filter((s) => s.path === "kie").length === k0x, "…without falling back");
  const fl = seen.filter((s) => s.path === "/nv/genai/flux").pop(); ok(fl && fl.body.width === 1344 && fl.body.height === 768 && fl.body.mode === "base", "FLUX request: size from the aspect");
  const kieN = () => seen.filter((s) => s.path === "kie").length; let k = kieN();
  j = await job({ kind: "image", model: "nvsd35", prompt: "a red apple", aspect: "1:1" }); ok(j.status === "done" && media(j.url).equals(PNG) && kieN() === k, "NVIDIA SD 3.5 → its own endpoint ({image} answer), no fallback");
  j = await job({ kind: "image", model: "auto", prompt: "make it night", aspect: "1:1", inputs: { iRef: `http://localhost:${MPORT}/out.png` } });
  ok(seen.some((s) => s.path === "/nv/genai/kontext" && s.body.image === "data:image/png;asset_id,a1"), "picture edit → FLUX Kontext with the picture as an NVCF asset");
  ok(j.status === "done" && seen.some((s) => s.path === "kie"), "Kontext failed → the job finished on Kie AI (" + j.status + ")");
  j = await job({ kind: "3d", prompt: "a vase", meta: { mode: "objects", engine: "trellis" }, inputs: { s3dImg: `http://localhost:${MPORT}/out.png` } });
  ok(j.status === "done" && /\.glb$/.test(j.url) && media(j.url).slice(0, 4).toString() === "glTF", "3D → TRELLIS: 202 → status poll → zip → .glb (" + j.status + " " + (j.url || j.error) + ")");
  ok(statusPolls >= 2, "NVCF status polled until ready");
  ok(seen.some((s) => s.path === "asset-put" && s.type === "image/png" && s.desc === "nooi-input" && s.size > 0), "the picture was uploaded to the NVCF asset store (PUT with its description)");
  k = kieN(); j = await job({ kind: "video", model: "nvcosmos", prompt: "a car on a road", dur: 5, aspect: "16:9" }); ok(kieN() === k && j.status === "done" && /\.mp4$/.test(j.url) && media(j.url).equals(MP4), "NVIDIA Cosmos video → .mp4 (" + JSON.stringify(j).slice(0, 300) + ")");
  const k0 = seen.filter((s) => s.path === "kie").length; j = await job({ kind: "video", model: "auto", prompt: "a dog runs", dur: 5, aspect: "16:9" });
  ok(seen.filter((s) => s.path === "kie").length > k0 && !seen.some((s) => s.path === "/nv/cosmos" && s.body.prompt.includes("dog")), "video stays on Kie while NVIDIA video is off");
  await api("/v1/admin/providers/nvidia", { use: "image:off, video:on" }, "PUT"); const f0 = seen.filter((s) => s.path === "/nv/genai/flux").length, k1 = seen.filter((s) => s.path === "kie").length;
  j = await job({ kind: "image", model: "auto", prompt: "a cat", aspect: "1:1" }); ok(seen.filter((s) => s.path === "/nv/genai/flux").length === f0 && seen.filter((s) => s.path === "kie").length > k1, "Admin 'image:off' → nooi Auto pictures go back to Kie");
  j = await job({ kind: "video", model: "auto", prompt: "waves on a beach", dur: 5, aspect: "16:9" }); ok(seen.some((s) => s.path === "/nv/cosmos" && s.body.prompt.includes("waves")), "Admin 'video:on' → nooi Auto video on Cosmos");
  const h = await api("/v1/admin/providers/nvidia/test", {}); ok(h.d.state === "online", "provider test probes NVIDIA (" + h.d.state + ")");
} catch (e) { fail++; console.log("✗ crashed: " + e.stack); }
finally { srv.kill(); console.log(`${pass} passed, ${fail} failed`); fs.rmSync(D, { recursive: true, force: true }); process.exit(fail ? 1 : 0); }
