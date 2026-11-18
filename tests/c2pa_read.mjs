// Reads the content credentials (C2PA) of files twice — with nooi's own reader (lib/label127.js, @trustnxt/c2pa-ts) and with
// the official C2PA reader (c2pa-rs as WebAssembly, @contentauth/c2pa-wasm, a dev-only package) — and prints one JSON line per
// file. Run: node tests/c2pa_read.mjs <file>...   (SECRET_KEY must be set; nothing is signed)
import fs from "fs";
import path from "path";
import url from "url";
const ROOT = path.resolve(path.dirname(url.fileURLToPath(import.meta.url)), "..");
const { readCredentials } = await import(ROOT + "/lib/label127.js");
let official = null;
try { const w = await import("@contentauth/c2pa-wasm"); w.initSync({ module: fs.readFileSync(path.join(ROOT, "node_modules/@contentauth/c2pa-wasm/pkg/c2pa_bg.wasm")) }); official = w; } catch (e) { official = null; }
const MIME = { ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".mp4": "video/mp4", ".mov": "video/quicktime" };
for (const f of process.argv.slice(2)) {
  const out = { file: path.basename(f) };
  try { out.nooi = await readCredentials(f); } catch (e) { out.nooi = { error: String(e.message || e).slice(0, 200) }; }
  if (official && MIME[path.extname(f).toLowerCase()]) {
    try { const r = await official.WasmReader.fromBytes(MIME[path.extname(f).toLowerCase()], new Uint8Array(fs.readFileSync(f)));
      const j = JSON.parse(r.json()), m = j.manifests[j.active_manifest] || {};
      out.official = { state: j.validation_state, failures: (j.validation_results?.activeManifest?.failure || []).map((x) => x.code),
        generator: (m.claim_generator_info || [])[0]?.name, actions: (m.assertions || []).filter((a) => /actions/.test(a.label)).flatMap((a) => a.data.actions || []), issuer: m.signature_info?.issuer || null };
    } catch (e) { out.official = { error: String(e.message || e).slice(0, 200) }; }
  } else if (!official) out.official = { error: "the official reader isn't installed (npm install — it is a dev package)" };
  console.log(JSON.stringify(out));
}
