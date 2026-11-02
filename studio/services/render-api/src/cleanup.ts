// Every hour: renders older than RENDER_KEEP_DAYS (7) are deleted with their files, and so are unused preview copies and
// half-finished uploads. Uploaded media stays while UPLOAD_KEEP_DAYS is 0 (projects still use it).
import fs from "node:fs";
import path from "node:path";
import { CFG } from "./config";
import type { Store } from "./store";

const oldFiles = (dir: string, days: number) => { const n: string[] = []; if (!days || !fs.existsSync(dir)) return n;
  for (const f of fs.readdirSync(dir)) { const p = path.join(dir, f); try { const s = fs.statSync(p); if (s.isFile() && Date.now() - s.mtimeMs > days * 864e5) { fs.unlinkSync(p); n.push(f); } } catch { /* */ } } return n; };

export async function cleanup(store: Store): Promise<{ renders: number; files: number }> {
  let renders = 0;
  for (const r of await store.expired(new Date())) { if (r.outputPath) try { fs.unlinkSync(r.outputPath); } catch { /* */ } await store.deleteRender(r.id); renders++; }
  const files = oldFiles(path.join(CFG.renderDir, "proxies"), CFG.keepDays).length + oldFiles(path.join(CFG.uploadDir, "partial"), 2).length + oldFiles(CFG.uploadDir, +(process.env.UPLOAD_KEEP_DAYS || 0)).length;
  return { renders, files };
}
export function startCleanup(store: Store): () => void {
  const run = () => void cleanup(store).catch(() => undefined);
  const t = setInterval(run, 3600_000); t.unref(); setTimeout(run, 10_000).unref();
  return () => clearInterval(t);
}
