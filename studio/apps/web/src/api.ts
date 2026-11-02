// The nooi.ai server, from the studio: the same accounts (Firebase sign-in on the same site), credits, jobs, uploads, projects.
// API keys never reach this code — the server holds them and runs the AI work.
declare global { interface Window { firebase?: FirebaseCompat; __nooiDevUser?: string } }
interface FirebaseCompat { initializeApp(c: unknown): void; apps: unknown[]; auth(): { currentUser: { getIdToken(): Promise<string>; displayName: string | null; email: string | null; uid: string } | null; onAuthStateChanged(f: (u: unknown) => void): void } }

export interface Me { signedIn: boolean; name: string; uid?: string; credits: number | null; plan?: string }
export interface Job { id: string; kind: string; status: string; prompt?: string; title?: string; resultUrl?: string; aspect?: string; dur?: number; created?: number; cost?: number; error?: string; progress?: number }
type Listener = () => void;

class Api {
  online = false; cfg: Record<string, unknown> = {}; me: Me = { signedIn: false, name: "", credits: null };
  private ready: Promise<void> | null = null; private ls = new Set<Listener>();
  on(f: Listener) { this.ls.add(f); return () => { this.ls.delete(f); }; }
  private emit() { this.ls.forEach((f) => f()); }

  init(): Promise<void> {
    if (this.ready) return this.ready;
    this.ready = (async () => {
      try {
        const h = await fetch("/v1/health"); if (!h.ok) return; this.online = true;
        this.cfg = await (await fetch("/v1/config")).json();
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
    const r = await fetch(path, { ...o, method: o.method || (o.json !== undefined ? "POST" : "GET"), headers, body });
    const tx = await r.text(); let d: unknown; try { d = JSON.parse(tx); } catch { d = { error: tx }; }
    if (!r.ok) { const e = d as { error?: string; errorAr?: string }; throw Object.assign(new Error(e.error || r.statusText), { status: r.status, errorAr: e.errorAr }); }
    return d as T;
  }
  async refresh() {
    if (!this.online) return;
    try {
      const u = window.firebase?.auth().currentUser || null;
      const c = await this.req<{ credits?: number; balance?: number; plan?: string }>("/v1/billing").catch(() => null);
      this.me = { signedIn: !!u || !this.cfg.firebase, name: u ? (u.displayName || (u.email || "").split("@")[0] || "") : "", uid: u?.uid, credits: c ? (c.credits ?? c.balance ?? null) : null, plan: c?.plan };
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
      const x = new XMLHttpRequest(); x.open("POST", "/v1/uploads"); if (tk) x.setRequestHeader("Authorization", "Bearer " + tk);
      if (window.__nooiDevUser) x.setRequestHeader("X-Dev-User", window.__nooiDevUser);
      x.upload.onprogress = (e) => { if (e.lengthComputable && onProgress) onProgress(e.loaded / e.total); };
      x.onload = () => { try { const d = JSON.parse(x.responseText); if (x.status < 300 && d.url) res(d.url); else rej(new Error(d.error || "Upload failed")); } catch { rej(new Error("Upload failed")); } };
      x.onerror = () => rej(new Error("Upload failed")); x.send(fd);
    });
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
