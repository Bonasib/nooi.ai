// Resumable uploads (the tus protocol): a big video keeps going after a dropped connection. When a file is complete it is checked
// (what the bytes really are, the size, ClamAV when configured), moved to the uploads folder and recorded for its owner.
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { Server } from "@tus/server";
import { FileStore } from "@tus/file-store";
import { CFG } from "./config";
import { whoIs } from "./auth";
import { sniff, EXT, clamScan } from "./scan";
import type { Store } from "./store";
import { UPLOAD_PREFIX } from "./files";

type Hdrs = { get(k: string): string | null; forEach(f: (v: string, k: string) => void): void };
const headersOf = (h: Hdrs) => { const o: Record<string, string> = {}; h.forEach((v, k) => { o[k] = v; }); return o; };
const fail = (status_code: number, body: string) => ({ status_code, body: JSON.stringify({ error: body }) });

export function tusServer(store: Store) {
  const tmp = path.join(CFG.uploadDir, "partial"); fs.mkdirSync(tmp, { recursive: true });
  const server = new Server({
    path: "/uploads/files",
    datastore: new FileStore({ directory: tmp, expirationPeriodInMilliseconds: 24 * 3600 * 1000 }),
    maxSize: CFG.maxUpload,
    respectForwardedHeaders: true,
    relativeLocation: false,
    generateUrl: (_req, o) => `${o.proto}://${o.host}/render-api/uploads/files/${o.id}`,
    namingFunction: () => crypto.randomBytes(16).toString("hex"),
    async onIncomingRequest(req) { const who = await whoIs(headersOf(req.headers as Hdrs)); if (!who) throw fail(401, "sign in first"); },
    async onUploadCreate(req, upload) {
      const who = await whoIs(headersOf(req.headers as Hdrs)); if (!who) throw fail(401, "sign in first");
      if (upload.size != null && upload.size > CFG.maxUpload) throw fail(413, "file too big");
      return { metadata: { ...(upload.metadata || {}), owner: who.uid } };
    },
    async onUploadFinish(_req, upload) {
      const file = path.join(tmp, upload.id), meta = upload.metadata || {};
      const done = () => { for (const f of [file, file + ".json"]) try { fs.unlinkSync(f); } catch { /* */ } };
      const mime = sniff(file);
      if (!mime) { done(); throw fail(415, "this file type is not supported"); }
      let scanned = "skipped";
      try { scanned = await clamScan(file); } catch (e) { done(); throw fail(503, "the virus scan is not available: " + (e as Error).message); }
      if (scanned.startsWith("infected")) { done(); throw fail(422, "the file was refused by the virus scan"); }
      if (scanned.startsWith("error")) { done(); throw fail(503, "the virus scan failed"); }
      const id = "u" + crypto.randomBytes(9).toString("hex"), name = id + EXT[mime], dest = path.join(CFG.uploadDir, name);
      fs.renameSync(file, dest); try { fs.unlinkSync(file + ".json"); } catch { /* */ }
      const row = { id, owner: String(meta.owner || ""), name: String(meta.filename || meta.name || name).slice(0, 200), path: dest, url: UPLOAD_PREFIX + name, mime, size: fs.statSync(dest).size, scanned, createdAt: new Date() };
      await store.addMedia(row); await store.log(row.owner, "upload", { meta: { size: row.size, mime } });
      return { status_code: 204, headers: { "upload-url": row.url, "upload-id": id, "upload-mime": mime, "access-control-expose-headers": "upload-url, upload-id, upload-mime" } };
    },
  });
  return server;
}
