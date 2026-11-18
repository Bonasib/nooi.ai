// Where the nooi.ai server is. On the site itself: the same origin (relative paths). In the desktop (Tauri) and phone (Capacitor)
// apps the studio runs from the app's own files, so the server is VITE_SITE (https://nooi.ai unless the build says otherwise).
export const SITE = String(import.meta.env.VITE_SITE || "").replace(/\/$/, "");
export const at = (p: string) => (SITE && p.startsWith("/") && !p.startsWith("//") ? SITE + p : p);
const w = (typeof window !== "undefined" ? window : {}) as Record<string, unknown>;
export const TAURI = !!w.__TAURI_INTERNALS__;
export const CAPACITOR = !!(w.Capacitor as { isNativePlatform?: () => boolean } | undefined)?.isNativePlatform?.();
export const NATIVE = TAURI || CAPACITOR;
