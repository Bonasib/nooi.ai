// Who is asking: the browser's own nooi.ai token is passed to the nooi.ai server (/v1/me, /v1/billing) — the same accounts and
// sessions, nothing stored here. A minute's cache keeps it quick.
import { CFG } from "./config";

export interface Who { uid: string; plan: string; staff: boolean; admin: boolean }
const cache = new Map<string, { at: number; who: Who }>();
export async function whoIs(headers: Record<string, string | string[] | undefined>): Promise<Who | null> {
  const auth = String(headers.authorization || ""), dev = String(headers["x-dev-user"] || "");
  const key = auth + "|" + dev; const c = cache.get(key); if (c && Date.now() - c.at < 60_000) return c.who;
  const h: Record<string, string> = {}; if (auth) h.authorization = auth; if (dev) h["x-dev-user"] = dev;
  try {
    const [me, bill] = await Promise.all([fetch(CFG.appUrl + "/v1/me", { headers: h }), fetch(CFG.appUrl + "/v1/billing", { headers: h })]);
    if (!me.ok) return null;
    const m = (await me.json()) as { uid: string; role?: string | null }; const b = bill.ok ? ((await bill.json()) as { plan?: string; staff?: boolean }) : {};
    const who: Who = { uid: String(m.uid), plan: String(b.plan || "free"), staff: !!b.staff, admin: m.role === "owner" || m.role === "admin" };
    cache.set(key, { at: Date.now(), who }); if (cache.size > 5000) cache.clear();
    return who;
  } catch { return null; }
}
