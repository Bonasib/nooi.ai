// 3D object & world engines (keys in Admin → AI providers; every base URL can be changed there):
//   Tripo3D  — text or picture → textured .glb   (POST /v2/openapi/task · GET /v2/openapi/task/{id})
//   Meshy    — text or picture → textured .glb   (POST /openapi/v2/text-to-3d · /openapi/v1/image-to-3d · GET …/{id})
//   Blockade Labs Skybox — words → 360° equirectangular world + depth map   (POST /api/v1/skybox · GET /api/v1/imagine/requests/{id})
// Results are mirrored to /media (the 3D viewer, the editor and exports read them from the site itself).
import { cfg, configured } from "../lib/settings.js";
import { download } from "../lib/media.js";

const j = async (r, name) => { const t = await r.text(); let d; try { d = JSON.parse(t); } catch { d = { raw: t }; } if (!r.ok) { const e = new Error(`${name} ${r.status}: ${d.message || d.error?.message || d.error || d.detail || t.slice(0, 200)}`); e.status = r.status; throw e; } return d; };
const prompt = (p) => [p.prompt, p.meta?.style && `Style: ${p.meta.style}`].filter(Boolean).join(". ").slice(0, 1000);
const pic = (p) => { const i = p.inputs || {}; return i.s3dImg || i.s3dCap || i.iRef || i.wRef || null; };
const toDataUrl = async (u) => { if (!u || u.startsWith("data:")) return u; const r = await fetch(u); if (!r.ok) throw new Error("Couldn't read the picture"); return "data:" + (r.headers.get("content-type") || "image/png").split(";")[0] + ";base64," + Buffer.from(await r.arrayBuffer()).toString("base64"); };
const mirror = async (u, ext) => { try { return (await download(u, ext)).url; } catch { return u; } };

export const tripo = () => { const c = cfg("tripo"), base = (c.baseUrl || "https://api.tripo3d.ai/v2/openapi").replace(/\/$/, ""), h = { Authorization: "Bearer " + c.apiKey, "Content-Type": "application/json" };
  return { name: "Tripo3D", configured: configured("tripo"),
    async submit(p) { const img = pic(p); let body;
      if (img) { const d = await toDataUrl(img), m = /^data:image\/(\w+);base64,(.+)$/.exec(d || ""); if (!m) throw new Error("Tripo3D needs a PNG or JPG picture");
        const fd = new FormData(); fd.append("file", new Blob([Buffer.from(m[2], "base64")], { type: "image/" + m[1] }), "input." + (m[1] === "jpeg" ? "jpg" : m[1]));
        const up = await j(await fetch(base + "/upload", { method: "POST", headers: { Authorization: h.Authorization }, body: fd }), "Tripo3D upload");
        body = { type: "image_to_model", file: { type: m[1] === "jpeg" ? "jpg" : m[1], file_token: up.data?.image_token || up.data?.file_token }, texture: true, pbr: true };
      } else body = { type: "text_to_model", prompt: prompt(p), texture: true, pbr: true };
      const d = await j(await fetch(base + "/task", { method: "POST", headers: h, body: JSON.stringify(body) }), "Tripo3D"); if (d.code && d.code !== 0) throw new Error("Tripo3D: " + (d.message || d.code));
      return { remoteId: d.data?.task_id }; },
    async poll(id) { const d = await j(await fetch(base + "/task/" + id, { headers: h }), "Tripo3D"), t = d.data || {}, s = String(t.status || "").toLowerCase();
      if (s === "success") { const o = t.output || {}, u = o.pbr_model || o.model || o.base_model; return u ? { status: "done", url: await mirror(u, ".glb") } : { status: "failed", error: "Tripo3D returned no model" }; }
      if (["failed", "cancelled", "banned", "expired", "unknown"].includes(s)) return { status: "failed", error: "Tripo3D: " + s };
      return { status: s === "queued" ? "queued" : "rendering", progress: typeof t.progress === "number" ? t.progress / 100 : null }; } }; };

export const meshy = () => { const c = cfg("meshy"), base = (c.baseUrl || "https://api.meshy.ai/openapi").replace(/\/$/, ""), h = { Authorization: "Bearer " + c.apiKey, "Content-Type": "application/json" };
  return { name: "Meshy", configured: configured("meshy"),
    async submit(p) { const img = pic(p);
      const d = img ? await j(await fetch(base + "/v1/image-to-3d", { method: "POST", headers: h, body: JSON.stringify({ image_url: await toDataUrl(img), enable_pbr: true, should_texture: true }) }), "Meshy")
                    : await j(await fetch(base + "/v2/text-to-3d", { method: "POST", headers: h, body: JSON.stringify({ mode: "preview", prompt: prompt(p), art_style: "realistic", should_remesh: true }) }), "Meshy");
      return { remoteId: (img ? "i:" : "t:") + d.result }; },
    async poll(rid) { const [k, id] = [rid.slice(0, 1), rid.slice(2)], url = base + (k === "i" ? "/v1/image-to-3d/" : "/v2/text-to-3d/") + id;
      const d = await j(await fetch(url, { headers: h }), "Meshy"), s = String(d.status || "").toUpperCase();
      if (s === "SUCCEEDED") { const u = d.model_urls?.glb; return u ? { status: "done", url: await mirror(u, ".glb") } : { status: "failed", error: "Meshy returned no .glb" }; }
      if (s === "FAILED" || s === "CANCELED" || s === "EXPIRED") return { status: "failed", error: "Meshy: " + (d.task_error?.message || s) };
      return { status: s === "PENDING" ? "queued" : "rendering", progress: typeof d.progress === "number" ? d.progress / 100 : null }; } }; };

export const blockade = () => { const c = cfg("blockade"), base = (c.baseUrl || "https://backyard.blockadelabs.com/api/v1").replace(/\/$/, ""), h = { "x-api-key": c.apiKey, "Content-Type": "application/json" };
  return { name: "Blockade Labs Skybox", configured: configured("blockade"),
    async submit(p) { const body = { prompt: prompt(p), ...(c.model ? { skybox_style_id: +c.model || undefined } : {}), ...(p.meta?.neg ? { negative_text: p.meta.neg } : {}) };
      const d = await j(await fetch(base + "/skybox", { method: "POST", headers: h, body: JSON.stringify(body) }), "Skybox");
      if (d.status === "complete" && d.file_url) return { done: true, url: await mirror(d.file_url, ".jpg"), segments: d.depth_map_url ? [await mirror(d.depth_map_url, ".jpg")] : undefined };
      return { remoteId: String(d.id) }; },
    async poll(id) { const d = await j(await fetch(base + "/imagine/requests/" + id, { headers: h }), "Skybox"), r = d.request || d, s = String(r.status || "").toLowerCase();
      if (s === "complete" && r.file_url) return { status: "done", url: await mirror(r.file_url, ".jpg"), segments: r.depth_map_url ? [await mirror(r.depth_map_url, ".jpg")] : undefined };
      if (s === "error" || s === "abort") return { status: "failed", error: "Skybox: " + (r.error_message || s) };
      return { status: s === "pending" ? "queued" : "rendering" }; } }; };

// World Labs (Marble) — words or a picture → a whole walkable 3D world: Gaussian splats (light 100k / sharp 500k), a collider
// mesh to walk on, the 360° picture and a caption. https://api.worldlabs.ai · header WLT-Api-Key · POST /marble/v1/worlds:generate
// → an operation, polled at GET /marble/v1/operations/{id}. The job's segments keep the files in a fixed order:
// [splat 100k, splat 500k, collider .glb, panorama, thumbnail] (empty strings where World Labs sent none).
export const worldlabs = () => { const c = cfg("worldlabs"), base = (c.baseUrl || "https://api.worldlabs.ai").replace(/\/$/, ""), h = { "WLT-Api-Key": c.apiKey, "Content-Type": "application/json" };
  return { name: "World Labs", configured: configured("worldlabs"),
    async submit(p) { const img = p.inputs?.wRef; let wp;
      if (img) { const d = await toDataUrl(img), m = /^data:image\/(\w+);base64,(.+)$/.exec(d || ""); if (!m) throw new Error("World Labs needs a PNG, JPG or WebP picture");
        wp = { type: "image", image_prompt: { source: "data_base64", data_base64: m[2], extension: m[1] === "jpeg" ? "jpg" : m[1] }, ...(p.prompt ? { text_prompt: String(p.prompt).slice(0, 1000) } : {}) }; }
      else wp = { type: "text", text_prompt: prompt(p) };
      const d = await j(await fetch(base + "/marble/v1/worlds:generate", { method: "POST", headers: h, body: JSON.stringify({ display_name: String(p.title || p.prompt || "nooi world").slice(0, 60), world_prompt: wp, ...(c.model ? { model: c.model } : {}) }) }), "World Labs");
      if (!d.operation_id) throw new Error("World Labs didn't start the world"); return { remoteId: d.operation_id }; },
    async poll(id) { const d = await j(await fetch(base + "/marble/v1/operations/" + encodeURIComponent(id), { headers: h }), "World Labs");
      if (!d.done) { const pc = +(d.metadata?.progress_percentage ?? d.metadata?.progress ?? NaN); return { status: "rendering", progress: Number.isFinite(pc) ? Math.min(0.99, pc > 1 ? pc / 100 : pc) : null }; }
      if (d.error) return { status: "failed", error: "World Labs: " + (d.error.message || d.error.code || "failed") };
      const a = (d.response && (d.response.assets || (d.response.world && d.response.world.assets))) || {}, spz = a.splats?.spz_urls || {};
      const lo = spz["100k"] || spz["500k"] || spz.full_res, hi = spz["500k"] || spz.full_res || "";
      if (!lo) return { status: "failed", error: "World Labs returned no world" };
      const mir = async (u, ext) => (u ? mirror(u, ext) : "");
      const segs = [await mir(lo, ".spz"), hi && hi !== lo ? await mir(hi, ".spz") : "", await mir(a.mesh?.collider_mesh_url, ".glb"), await mir(a.imagery?.pano_url, ".jpg"), await mir(a.thumbnail_url, ".jpg")];
      return { status: "done", url: segs[0], segments: segs }; } }; };

// Alibaba Cloud Model Studio — 3D generation (the Tripo models it hosts) with the same DashScope key as the site's Qwen models:
// words or a picture → a textured PBR .glb. POST {base}/services/aigc/video-generation/3d-generation (X-DashScope-Async: enable)
// { model, input: { prompt } | { image }, parameters: { texture_quality } } → output.task_id; GET {base}/tasks/{id} → output.task_status
// (PENDING / RUNNING / SUCCEEDED / FAILED / CANCELED / UNKNOWN) and output.results[0].pbr_model_url (a .glb kept for 2 hours — mirrored
// at once). Admin → AI providers → Qwen: "3D model" (empty = Tripo/Tripo-P1.0, "off" = not used) and "3D API URL" (another region).
// The customer never sees the engine's name: the page only says "3D".
export const ms3dOn = () => configured("qwen") && String(cfg("qwen").model3d || "").trim().toLowerCase() !== "off";
const pubUrl = (u) => (/^\/media\//.test(u || "") ? (process.env.PUBLIC_BASE_URL || "").replace(/\/$/, "") + u : u);
export const ms3d = () => { const c = cfg("qwen"), base = (c.url3d || c.baseUrl || "https://dashscope-intl.aliyuncs.com/api/v1").replace(/\/$/, ""),
  h = { Authorization: "Bearer " + c.apiKey, "Content-Type": "application/json", "X-DashScope-Async": "enable" };
  return { name: "Model Studio 3D", configured: ms3dOn(),
    async submit(p) { const img = pic(p);
      const input = img ? { image: /^\/media\//.test(img) && !/^https?:\/\//.test(process.env.PUBLIC_BASE_URL || "") ? await toDataUrl(img) : pubUrl(img) } : { prompt: prompt(p) };
      const d = await j(await fetch(base + "/services/aigc/video-generation/3d-generation", { method: "POST", headers: h,
        body: JSON.stringify({ model: String(c.model3d || "").trim() || "Tripo/Tripo-P1.0", input, parameters: { texture_quality: p.meta?.draft ? "standard" : "detailed" } }) }), "Model Studio 3D");
      if (!d.output?.task_id) throw new Error("Model Studio 3D didn't start" + (d.message ? ": " + d.message : ""));
      return { remoteId: d.output.task_id }; },
    async poll(id) { const d = await j(await fetch(base + "/tasks/" + encodeURIComponent(id), { headers: { Authorization: h.Authorization } }), "Model Studio 3D"), o = d.output || {}, s = String(o.task_status || "").toUpperCase();
      if (s === "SUCCEEDED") { const r = (Array.isArray(o.results) && o.results[0]) || o.result || o, u = r.pbr_model_url || r.model_url || r.base_model_url;
        return u ? { status: "done", url: await mirror(u, ".glb") } : { status: "failed", error: "Model Studio 3D returned no model" }; }
      if (["FAILED", "CANCELED", "UNKNOWN"].includes(s)) return { status: "failed", error: "Model Studio 3D: " + (o.message || o.code || d.message || s) };
      return { status: s === "PENDING" ? "queued" : "rendering" }; } }; };

export const GEN3D = { tripo, meshy, blockade, worldlabs, ms3d };
// which engine runs a 3D object / world job: the one the user picked, otherwise the first connected one (NVIDIA comes first in adapterFor)
export function gen3dRoute(cap, body) {
  const e = body.meta?.engine;
  if (body.kind === "3d" && body.meta?.mode !== "scene") {
    if (e === "tripo" || e === "meshy") return { key: e, a: GEN3D[e]() };
    if (e === "ms3d" && ms3dOn()) return { key: "ms3d", a: ms3d() };
    if (e === "auto" || body.noNv || !e) { if (ms3dOn() && !body.noMs3d) return { key: "ms3d", a: ms3d() }; for (const k of ["tripo", "meshy"]) if (configured(k)) return { key: k, a: GEN3D[k]() }; }
  }
  if (body.kind === "world" && (e === "worldlabs" || (e === "auto" && configured("worldlabs")))) return { key: "worldlabs", a: worldlabs() };
  if (body.kind === "world" && (e === "skybox" || (configured("blockade") && !configured("world")))) return { key: "blockade", a: blockade() };
  return null;
}
