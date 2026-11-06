// The nooi.ai server, from the studio: the same accounts (Firebase sign-in on the same site), credits, jobs, uploads, projects.
// API keys never reach this code — the server holds them and runs the AI work.
declare global { interface Window { firebase?: FirebaseCompat; __nooiDevUser?: string } }
interface FirebaseCompat { initializeApp(c: unknown): void; apps: unknown[]; auth(): { currentUser: { getIdToken(): Promise<string>; displayName: string | null; email: string | null; uid: string } | null; onAuthStateChanged(f: (u: unknown) => void): void } }

export interface Me { signedIn: boolean; name: string; uid?: string; credits: number | null; plan?: string; role?: string | null; free?: boolean }   // free: the owner and admins (the server charges the team nothing)
export interface Job { id: string; kind: string; status: string; prompt?: string; title?: string; resultUrl?: string; aspect?: string; dur?: number; created?: number; cost?: number; error?: string; progress?: number }
export interface RenderJob { id: string; status: "queued" | "running" | "done" | "failed" | "cancelled"; progress: number; url: string | null; error: string | null; format: string; seconds: number; expiresAt?: string }
import { at } from "./site";
type Listener = () => void;

class Api {
  online = false; cfg: Record<string, unknown> = {};
  /** v240: "Only my MiniMax key" is on — tools that need the AI engine (swaps, motion, replacing things in a video, picture edits) are off */
  get engineOff(): boolean { return !!(this.cfg.providers as Record<string, unknown> | undefined)?.mmOnly240; } me: Me = { signedIn: false, name: "", credits: null };
  private ready: Promise<void> | null = null; private ls = new Set<Listener>();
  on(f: Listener) { this.ls.add(f); return () => { this.ls.delete(f); }; }
  private emit() { this.ls.forEach((f) => f()); }

  init(): Promise<void> {
    if (this.ready) return this.ready;
    this.ready = (async () => {
      try {
        const h = await fetch(at("/v1/health")); if (!h.ok) return; this.online = true;
        this.cfg = await (await fetch(at("/v1/config"))).json();
        const fb = this.cfg.firebase as Record<string, unknown> | undefined;
        if (fb) {
          await script("https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js"); await script("https://www.gstatic.com/firebasejs/10.12.2/firebase-auth-compat.js");
          const F = window.firebase!; if (!F.apps.length) F.initializeApp(fb);
          await new Promise<void>((res) => { let done = false; F.auth().onAuthStateChanged(() => { if (!done) { done = true; res(); } this.refresh(); }); setTimeout(() => { if (!done) { done = true; res(); } }, 4000); });
        }
        await this.refresh();
      } catch { this.online = false; }
    })();
    return this.ready;
  }
  async token(): Promise<string | null> { try { const u = window.firebase?.auth().currentUser; return u ? await u.getIdToken() : null; } catch { return null; } }
  async req<T = unknown>(path: string, o: RequestInit & { json?: unknown } = {}): Promise<T> {
    const headers: Record<string, string> = { ...(o.headers as Record<string, string> || {}) };
    const tk = await this.token(); if (tk) headers.Authorization = "Bearer " + tk;
    if (window.__nooiDevUser) headers["X-Dev-User"] = window.__nooiDevUser;
    let body = o.body; if (o.json !== undefined) { body = JSON.stringify(o.json); headers["Content-Type"] = "application/json"; }
    const r = await fetch(at(path), { ...o, method: o.method || (o.json !== undefined ? "POST" : "GET"), headers, body });
    const tx = await r.text(); let d: unknown; try { d = JSON.parse(tx); } catch { d = { error: tx }; }
    if (!r.ok) { const e = d as { error?: string; errorAr?: string }; throw Object.assign(new Error(e.error || r.statusText), { status: r.status, errorAr: e.errorAr }); }
    return d as T;
  }
  async refresh() {
    if (!this.online) return;
    try {
      const u = window.firebase?.auth().currentUser || null;
      const [c, m] = await Promise.all([this.req<{ credits?: number; balance?: number; plan?: string }>("/v1/billing").catch(() => null), this.req<{ role?: string | null }>("/v1/me").catch(() => null)]);
      const role = m?.role || null;
      this.me = { signedIn: !!u || !this.cfg.firebase, name: u ? (u.displayName || (u.email || "").split("@")[0] || "") : "", uid: u?.uid, credits: c ? (c.credits ?? c.balance ?? null) : null, plan: c?.plan, role, free: role === "owner" || role === "admin" };
    } catch { /* offline */ }
    this.emit();
  }
  // ---- jobs (AI on the server; credits are held when a job starts, taken on success, given back on failure)
  jobs() { return this.req<{ jobs: Job[] }>("/v1/jobs").then((r) => r.jobs).catch(() => [] as Job[]); }
  job(id: string) { return this.req<Job>("/v1/jobs/" + encodeURIComponent(id)); }
  startJob(body: Record<string, unknown>) { return this.req<Job>("/v1/jobs", { json: body }); }
  quote(body: Record<string, unknown>) { return this.req<{ cost: number; balance?: number }>("/v1/jobs/quote", { json: body }); }
  // ---- files (kept on the server's disk for now; S3 storage later is a setting)
  async upload(b: Blob, name: string, onProgress?: (k: number) => void): Promise<string> {
    const tk = await this.token(); const fd = new FormData(); fd.append("file", b, name);
    return new Promise((res, rej) => {
      const x = new XMLHttpRequest(); x.open("POST", at("/v1/uploads")); if (tk) x.setRequestHeader("Authorization", "Bearer " + tk);
      if (window.__nooiDevUser) x.setRequestHeader("X-Dev-User", window.__nooiDevUser);
      x.upload.onprogress = (e) => { if (e.lengthComputable && onProgress) onProgress(e.loaded / e.total); };
      x.onload = () => { try { const d = JSON.parse(x.responseText); if (x.status < 300 && d.url) res(d.url); else rej(new Error(d.error || "Upload failed")); } catch { rej(new Error("Upload failed")); } };
      x.onerror = () => rej(new Error("Upload failed")); x.send(fd);
    });
  }
  // ---- the render service (/render-api on the same site): resumable uploads, server renders, live status
  async authHeaders(): Promise<Record<string, string>> { const h: Record<string, string> = {}; const tk = await this.token(); if (tk) h.Authorization = "Bearer " + tk; if (window.__nooiDevUser) h["X-Dev-User"] = window.__nooiDevUser; return h; }
  renderOn() { return fetch(at("/render-api/health")).then((r) => r.ok).catch(() => false); }
  // the tus protocol: the file goes in 8 MB pieces; after a dropped connection it asks where it stopped and goes on from there
  async tus(b: Blob, name: string, onProgress?: (k: number) => void, signal?: AbortSignal): Promise<string> {
    const base = { "Tus-Resumable": "1.0.0" };
    const meta = "filename " + btoa(unescape(encodeURIComponent(name))) + ",filetype " + btoa(b.type || "application/octet-stream");
    const c = await fetch(at("/render-api/uploads/files"), { method: "POST", signal, headers: { ...(await this.authHeaders()), ...base, "Upload-Length": String(b.size), "Upload-Metadata": meta } });
    if (c.status !== 201) throw new Error(((await c.json().catch(() => ({}))) as { error?: string }).error || "Upload failed");
    const loc = at(new URL(c.headers.get("Location") || "", location.href).pathname);
    let off = 0, tries = 0; const PIECE = 8 * 1024 * 1024;
    for (;;) {
      try {
        const r = await fetch(loc, { method: "PATCH", signal, headers: { ...(await this.authHeaders()), ...base, "Upload-Offset": String(off), "Content-Type": "application/offset+octet-stream" }, body: b.slice(off, Math.min(b.size, off + PIECE)) });
        if (r.status !== 204) { const e = ((await r.json().catch(() => ({}))) as { error?: string }).error; throw Object.assign(new Error(e || "Upload failed"), { final: r.status >= 400 && r.status < 500 && r.status !== 409 }); }
        off = +(r.headers.get("Upload-Offset") || off); tries = 0; onProgress?.(b.size ? off / b.size : 1);
        if (off >= b.size) { const url = r.headers.get("Upload-Url"); if (!url) throw new Error("Upload failed"); return url; }
      } catch (e) {
        if (signal?.aborted || (e as { final?: boolean }).final || ++tries > 5) throw e;
        await new Promise((ok) => setTimeout(ok, 1000 * 2 ** tries));
        const h = await fetch(loc, { method: "HEAD", signal, headers: { ...(await this.authHeaders()), ...base } }).catch(() => null);
        if (h && h.ok) off = +(h.headers.get("Upload-Offset") || off);
      }
    }
  }
  startRender(body: Record<string, unknown>) { return this.req<RenderJob>("/render-api/renders", { json: body }); }
  cancelRender(id: string) { return this.req("/render-api/renders/" + id, { method: "DELETE" }).catch(() => null); }
  // live status: Server-Sent Events when signed in with a token, else a check every 1.5 s
  async watchRender(id: string, on: (r: RenderJob) => void, signal?: AbortSignal): Promise<RenderJob> {
    const end = (r: RenderJob) => ["done", "failed", "cancelled"].includes(r.status);
    const tk = await this.token();
    if (tk && typeof EventSource !== "undefined") {
      const r = await new Promise<RenderJob | null>((ok) => {
        const es = new EventSource(at(`/render-api/renders/${id}/events?token=${encodeURIComponent(tk)}`)); let last: RenderJob | null = null;
        const stop = () => { es.close(); ok(last && end(last) ? last : null); };
        es.onmessage = (m) => { try { last = JSON.parse(m.data); on(last!); if (end(last!)) stop(); } catch { /* */ } };
        es.onerror = () => stop(); signal?.addEventListener("abort", stop);
      });
      if (r) return r;
    }
    for (;;) {
      if (signal?.aborted) throw Object.assign(new Error("aborted"), { name: "AbortError" });
      const r = await this.req<RenderJob>("/render-api/renders/" + id).catch(() => null);
      if (r) { on(r); if (end(r)) return r; }
      await new Promise((ok) => setTimeout(ok, 1500));
    }
  }
  // ---- projects (the same list as the account's other editor projects)
  listProjects() { return this.req<{ projects: { id: string; name: string; updated: number; kind?: string }[] }>("/v1/projects").then((r) => r.projects).catch(() => []); }
  getProject(id: string) { return this.req<{ id: string; name: string; doc: Record<string, unknown> }>("/v1/projects/" + id); }
  saveProject(id: string, name: string, studio: unknown, base?: number) { return this.req<{ id: string; updated: number }>("/v1/projects/" + id, { method: "PUT", json: { name, doc: { studio }, ...(base ? { base } : {}) } }); }
}
function script(src: string): Promise<void> {
  return new Promise((res, rej) => { if (document.querySelector(`script[src="${src}"]`)) return res(); const s = document.createElement("script"); s.src = src; s.onload = () => res(); s.onerror = () => rej(new Error("script")); document.head.appendChild(s); });
}
export const api = new Api();
