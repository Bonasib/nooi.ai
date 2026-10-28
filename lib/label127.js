// v127: what AI made says so.
//  · Content credentials (C2PA): every picture and video the AI makes here, and every video exported from the editor, carries a
//    signed record inside the file — "created by AI" (IPTC trainedAlgorithmicMedia; compositeWithTrainedAlgorithmicMedia when
//    the customer's own picture or video went in), the app (nooi.ai) — that apps and sites read (Content Credentials, social
//    networks). PNG, JPEG and MP4/MOV; other kinds (WebP, GIF, audio, MXF) are left as they are. Pure TypeScript, Apache-2.0
//    (@trustnxt/c2pa-ts), no native code. The signer is nooi's own certificate, made here once (readers show "unknown signer"
//    until the owner adds a certificate from a C2PA-trusted provider in Admin → Features).
//  · A visible "Made with AI" mark (public/brand/ai-mark127.png, bottom corner): always on Replace the person (a face swap must
//    never pass for a real recording), and on everything else when the customer switches it on (Account → AI label).
// The file keeps its address: the work is done on a copy that then takes the original's place, before the job is shown as done.
import fs from "fs";
import path from "path";
import crypto from "crypto";
import { spawn } from "child_process";
import { fileURLToPath } from "url";
import { col, save, user, hasUser, uid } from "./store.js";
import { S as platformS } from "./settings.js";
import { encrypt, decrypt } from "./secrets.js";
import { MEDIA_DIR } from "./media.js";
import { title157 } from "./promo157.js";

export const MARK127 = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../public/brand/ai-mark127.png");
const MAX_MB = () => +process.env.C2PA_MAX_MB || 400;
const conf = () => { const s = platformS(); return (s.label127 = s.label127 || { credentials: true }); };
export const credentialsOn = () => conf().credentials !== false && process.env.C2PA !== "false";
const SRC = { ai: "http://cv.iptc.org/newscodes/digitalsourcetype/trainedAlgorithmicMedia", mix: "http://cv.iptc.org/newscodes/digitalsourcetype/compositeWithTrainedAlgorithmicMedia" };
const FMT = { ".png": ["image/png", "PNG"], ".jpg": ["image/jpeg", "JPEG"], ".jpeg": ["image/jpeg", "JPEG"], ".mp4": ["video/mp4", "BMFF"], ".m4v": ["video/mp4", "BMFF"], ".mov": ["video/quicktime", "BMFF"] };

// ---- the library, loaded the first time it's needed (a missing package never stops the server)
let LIB = null;
async function lib() {
  if (!LIB) LIB = (async () => {
    await import("reflect-metadata");   // (@peculiar/x509 needs it before it loads)
    const x509 = await import("@peculiar/x509"); x509.cryptoProvider.set(crypto.webcrypto);
    const [a, m, c, j] = await Promise.all([import("@trustnxt/c2pa-ts/asset"), import("@trustnxt/c2pa-ts/manifest"), import("@trustnxt/c2pa-ts/cose"), import("@trustnxt/c2pa-ts/jumbf")]);
    return { x509, ...a, ...m, ...c, ...j };
  })().catch((e) => { LIB = null; throw e; });
  return LIB;
}

// ---- the signer: the owner's certificate if one was added, else nooi's own (made once: a small certificate authority that
// signs one ES256 signing certificate; only the signing key is kept, encrypted)
const ALG = { name: "ECDSA", namedCurve: "P-256", hash: "SHA-256" };
const pems = (t) => String(t || "").match(/-----BEGIN CERTIFICATE-----[\s\S]+?-----END CERTIFICATE-----/g) || [];
const der = (pem) => new Uint8Array(Buffer.from(String(pem).replace(/-----(BEGIN|END)[^-]+-----/g, "").replace(/\s+/g, ""), "base64"));
async function makeOwn(L) {
  const { x509 } = L, day = 864e5, sub = crypto.webcrypto.subtle;
  const rk = await sub.generateKey(ALG, true, ["sign", "verify"]), ek = await sub.generateKey(ALG, true, ["sign", "verify"]);
  const root = await x509.X509CertificateGenerator.createSelfSigned({ serialNumber: crypto.randomBytes(8).toString("hex"), name: "CN=nooi.ai Content Credentials CA, O=nooi.ai", notBefore: new Date(Date.now() - day), notAfter: new Date(Date.now() + 10 * 365 * day), signingAlgorithm: ALG, keys: rk,
    extensions: [new x509.BasicConstraintsExtension(true, 0, true), new x509.KeyUsagesExtension(x509.KeyUsageFlags.keyCertSign | x509.KeyUsageFlags.cRLSign, true), await x509.SubjectKeyIdentifierExtension.create(rk.publicKey)] });
  const ee = await x509.X509CertificateGenerator.create({ serialNumber: crypto.randomBytes(8).toString("hex"), subject: "CN=nooi.ai, O=nooi.ai", issuer: root.subject, notBefore: new Date(Date.now() - day), notAfter: new Date(Date.now() + 5 * 365 * day), signingAlgorithm: ALG, publicKey: ek.publicKey, signingKey: rk.privateKey,
    extensions: [new x509.BasicConstraintsExtension(false, undefined, true), new x509.KeyUsagesExtension(x509.KeyUsageFlags.digitalSignature, true), new x509.ExtendedKeyUsageExtension(["1.3.6.1.5.5.7.3.4"], false), await x509.SubjectKeyIdentifierExtension.create(ek.publicKey), await x509.AuthorityKeyIdentifierExtension.create(root)] });
  return { key: Buffer.from(await sub.exportKey("pkcs8", ek.privateKey)).toString("base64"), cert: ee.toString("pem"), chain: root.toString("pem"), own: true, made: Date.now() };
}
let SIGNER = null;
async function signer() {
  if (SIGNER) return SIGNER;
  const L = await lib(), c = col("label127", {});
  let s = c.signer ? decrypt(c.signer) : null;
  if (!s || !s.key || !s.cert) { s = await makeOwn(L); c.signer = encrypt(s); save(); }
  const certs = [...pems(s.cert), ...pems(s.chain)].map((p) => new L.x509.X509Certificate(p));
  const key = /BEGIN/.test(s.key) ? der(s.key) : new Uint8Array(Buffer.from(s.key, "base64"));
  const curve = certs[0].publicKey.algorithm?.namedCurve, alg = curve === "P-384" ? L.CoseAlgorithmIdentifier.ES384 : curve === "P-521" ? L.CoseAlgorithmIdentifier.ES512 : certs[0].publicKey.algorithm?.name === "Ed25519" ? L.CoseAlgorithmIdentifier.Ed25519 : L.CoseAlgorithmIdentifier.ES256;
  SIGNER = { s: new L.LocalSigner(key, alg, certs[0], certs.slice(1)), own: !!s.own, subject: certs[0].subject, until: certs[0].notAfter.getTime() };
  return SIGNER;
}

// one file at a time (a long video is read whole into memory)
let chain = Promise.resolve();
const oneAtATime = (fn) => { const p = chain.then(fn, fn); chain = p.catch(() => {}); return p; };

// ---- content credentials into one file (in place). → "signed" | "kept" (it already had some) | "" (not a kind we sign)
export async function signFile(file, { mix = false, what = "" } = {}) {
  const f = FMT[path.extname(file).toLowerCase()]; if (!f || !fs.existsSync(file) || fs.statSync(file).size > MAX_MB() * 1e6) return "";
  const L = await lib(), sg = await signer(), C = L[f[1]], buf = await fs.promises.readFile(file);
  if (!(await C.canRead(buf))) return "";
  const asset = await C.create(buf);
  if (await asset.getManifestJUMBF()) return "kept";   // the engine already put its own credentials in (they say AI made it)
  const store = new L.ManifestStore();
  const m = store.createManifest({ assetFormat: f[0], instanceID: "xmp:iid:" + crypto.randomUUID(), defaultHashAlgorithm: "SHA-256", signer: sg.s });
  m.claim.claimGeneratorName = "nooi.ai"; m.claim.title = path.basename(file);
  const act = new L.ActionAssertion(); act.label = L.AssertionLabels.actionsV2;
  act.actions = [{ action: "c2pa.created", digitalSourceType: mix ? SRC.mix : SRC.ai, softwareAgent: { name: "nooi.ai" }, description: what || (mix ? "Made with AI from the creator's own media on nooi.ai" : "Made with AI on nooi.ai") }];
  const hash = f[1] === "BMFF" ? L.BMFFHashAssertion.createV3("jumbf manifest", "SHA-256") : L.DataHashAssertion.create("SHA-256");
  m.addAssertion(act); m.addAssertion(hash);
  await asset.ensureManifestSpace(store.measureSize());
  await hash.updateWithAsset(asset);
  await m.sign(sg.s);
  await asset.writeManifestJUMBF(store.getBytes());
  const tmp = path.join(path.dirname(file), "." + uid() + path.extname(file));
  await fs.promises.writeFile(tmp, await asset.getDataRange()); await fs.promises.rename(tmp, file);
  return "signed";
}
// what a file's credentials say (for tests and the owner's check): null when it has none
export async function readCredentials(file) {
  const f = FMT[path.extname(file).toLowerCase()]; if (!f) return null;
  const L = await lib(), C = L[f[1]], buf = await fs.promises.readFile(file); if (!(await C.canRead(buf))) return null;
  const asset = await C.create(buf), j = await asset.getManifestJUMBF(); if (!j) return null;
  const ms = L.ManifestStore.read(L.SuperBox.fromBuffer(j)), v = await ms.validate(asset), am = ms.getActiveManifest();
  const actions = (am?.assertions?.assertions || []).filter((a) => a instanceof L.ActionAssertion).flatMap((a) => a.actions);
  return { valid: v.isValid, problems: v.statusEntries.filter((e) => !e.success).map((e) => e.code), generator: am?.claim?.claimGeneratorName, actions };
}

// ---- the visible mark (in place), bottom corner, about a fifth of the picture's width
const run = (bin, args, ms) => new Promise((ok, no) => { const p = spawn(bin, args); let err = ""; const t = setTimeout(() => p.kill("SIGKILL"), ms);
  p.stderr.on("data", (d) => (err = (err + d).slice(-400))); p.on("error", (e) => { clearTimeout(t); no(e); }); p.on("close", (c) => { clearTimeout(t); c === 0 ? ok() : no(new Error("ffmpeg " + c + " " + err.trim())); }); });
const size = (file) => new Promise((ok) => { const p = spawn(process.env.FFPROBE_PATH || "ffprobe", ["-v", "error", "-select_streams", "v:0", "-show_entries", "stream=width,height", "-of", "csv=p=0:s=x", file]); let s = "";
  p.stdout.on("data", (d) => (s += d)); p.on("error", () => ok(null)); p.on("close", () => { const m = /(\d+)x(\d+)/.exec(s); ok(m ? { w: +m[1], h: +m[2] } : null); }); });
export async function markVisible(file) {
  const ext = path.extname(file).toLowerCase(), img = [".png", ".jpg", ".jpeg"].includes(ext), vid = [".mp4", ".mov", ".m4v"].includes(ext);
  if (!img && !vid) return false;
  const d = await size(file); if (!d) return false;
  const bw = Math.max(110, Math.round(Math.min(d.w, d.h * 1.4) * 0.2 / 2) * 2), pad = Math.max(8, Math.round(Math.min(d.w, d.h) * 0.025));
  const tmp = path.join(path.dirname(file), "." + uid() + ext), fc = `[1:v]scale=${bw}:-1[m];[0:v][m]overlay=W-w-${pad}:H-h-${pad}${img ? ":format=rgb" : ""}`;   // (a picture stays RGB: only the corner changes)
  const args = ["-y", "-v", "error", "-i", file, "-i", MARK127, "-filter_complex", fc + (vid ? ",format=yuv420p[v]" : "[v]"), "-map", "[v]",
    ...(vid ? ["-map", "0:a?", "-c:a", "copy", "-c:v", "libx264", "-preset", "veryfast", "-crf", "18", "-movflags", "+faststart"] : ["-frames:v", "1", ...(ext === ".png" ? [] : ["-q:v", "2"])]), tmp];
  try { await run(process.env.FFMPEG_PATH || "ffmpeg", args, vid ? 20 * 60000 : 60000); await fs.promises.rename(tmp, file); return true; }
  finally { fs.unlink(tmp, () => {}); }
}

// ---- a finished job's file: the mark (when it's due), then the credentials. A face swap that can't carry its mark fails
// (it is never handed over without it); anything else that can't be labelled is handed over as it is.
const fileOf = (url) => { const m = /^(?:https?:\/\/[^/]+)?\/media\/([A-Za-z0-9][A-Za-z0-9._-]{0,200})(?:[?#]|$)/.exec(String(url || "")); if (!m) return null;
  const f = path.join(MEDIA_DIR, path.basename(m[1])); return fs.existsSync(f) ? f : null; };
export const isSwap = (job) => job?.payload?.model === "mcswap" || !!job?.payload?.meta?.swap93;
export function labelAI(job, url, uidv) {
  const file = fileOf(url); if (!file) return Promise.resolve(url);
  return oneAtATime(async () => {
    // v157: a promo's word over its last seconds first (lib/promo157.js) — a film that can't take it is handed over without it
    if (job?.payload?.meta?.title157) try { await title157(job, url); } catch (e) { console.warn("promo title", job.id, e.message); job.title157 = { error: String(e.message).slice(0, 160) }; }
    const swap = isSwap(job), wants = swap || (!!uidv && hasUser(uidv) && user(uidv).aiMark127 === true), out = {};
    if (wants) {
      try { out.mark = await markVisible(file); } catch (e) { if (swap) throw Object.assign(new Error("The \"Made with AI\" mark couldn't be added: " + e.message), { code: 500 }); console.warn("ai mark", job.id, e.message); }
      if (swap && out.mark === false && /\.(mp4|mov|m4v|png|jpe?g)$/i.test(file)) throw Object.assign(new Error("The \"Made with AI\" mark couldn't be added"), { code: 500 });
    }
    if (credentialsOn()) try { out.cr = await signFile(file, { mix: swap || Object.keys(job?.payload?.inputs || {}).length > 0 }); } catch (e) { out.cr = ""; console.warn("content credentials", job.id, e.message); }
    job.label127 = out; return url;
  });
}
// the editor's export (an MP4 or MOV made from the customer's clips, AI-made or not): credentials only
export const labelExport = (file) => credentialsOn() ? oneAtATime(() => signFile(file, { mix: true, what: "Edited on nooi.ai; may contain media made with AI" }).catch((e) => { console.warn("content credentials (export)", e.message); return ""; })) : Promise.resolve("");

// ---- Admin and Account
export async function labelInfo() {
  let s = null; try { s = await signer(); } catch (e) { return { credentials: credentialsOn(), ready: false, error: String(e.message || e).slice(0, 160) }; }
  return { credentials: credentialsOn(), ready: true, own: s.own, signer: s.subject, until: s.until };
}
export async function setLabels(b = {}) {
  const c = conf();
  if ("credentials" in b) c.credentials = b.credentials === true || b.credentials === "true";
  if (b.reset) { delete col("label127", {}).signer; SIGNER = null; }
  if (b.cert && b.key) {   // the owner's certificate (PEM chain + PKCS#8 key) from a C2PA-trusted provider: tried on a small picture first
    const certs = pems(b.cert + "\n" + (b.chain || "")); if (!certs.length || !/BEGIN [A-Z ]*PRIVATE KEY/.test(b.key)) throw Object.assign(new Error("Paste the certificate (PEM) and its private key (PKCS#8 PEM)."), { code: 400, errorAr: "الصق الشهادة (PEM) ومفتاحها الخاص (PKCS#8 PEM)." });
    const keep = col("label127", {}).signer; col("label127", {}).signer = encrypt({ key: b.key.trim(), cert: certs[0], chain: certs.slice(1).join("\n"), own: false, made: Date.now() }); SIGNER = null;
    const probe = path.join(MEDIA_DIR, ".probe127-" + uid() + ".png");
    try { await fs.promises.writeFile(probe, Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64")); await signFile(probe); const r = await readCredentials(probe); if (!r || r.problems.some((p) => !/untrusted|trust/i.test(p))) throw new Error((r && r.problems.join(", ")) || "no record"); }
    catch (e) { col("label127", {}).signer = keep; SIGNER = null; save(); throw Object.assign(new Error("This certificate and key don't sign: " + String(e.message || e).slice(0, 160)), { code: 400, errorAr: "هذه الشهادة والمفتاح لا يوقّعان." }); }
    finally { fs.unlink(probe, () => {}); }
  }
  save(); return labelInfo();
}
export function setAiMark(uidv, on) { const u = user(uidv); u.aiMark127 = on === true || on === "true"; save(); return { on: u.aiMark127 }; }
