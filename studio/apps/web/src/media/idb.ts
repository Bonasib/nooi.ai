// Files kept on this device (IndexedDB): the media you add, before (and after) it reaches your account.
const DB = "nooi-studio", STORE = "files";
let dbp: Promise<IDBDatabase> | null = null;
function db(): Promise<IDBDatabase> {
  if (!dbp) dbp = new Promise((res, rej) => { const r = indexedDB.open(DB, 1); r.onupgradeneeded = () => r.result.createObjectStore(STORE); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
  return dbp;
}
async function tx<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const d = await db(); return new Promise((res, rej) => { const t = d.transaction(STORE, mode); const q = fn(t.objectStore(STORE)); q.onsuccess = () => res(q.result); q.onerror = () => rej(q.error); });
}
export const putFile = (k: string, v: Blob) => tx("readwrite", (s) => s.put(v, k)).then(() => undefined).catch(() => undefined);
export const getFile = (k: string) => tx<Blob | undefined>("readonly", (s) => s.get(k) as IDBRequest<Blob | undefined>).catch(() => undefined);
export const delFile = (k: string) => tx("readwrite", (s) => s.delete(k)).then(() => undefined).catch(() => undefined);
export const putJSON = (k: string, v: unknown) => putFile(k, new Blob([JSON.stringify(v)], { type: "application/json" }));
export async function getJSON<T>(k: string): Promise<T | null> { const b = await getFile(k); if (!b) return null; try { return JSON.parse(await b.text()) as T; } catch { return null; } }
