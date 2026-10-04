// Provider error classes → one user-facing message each, plus retry policy.
export function providerError(name, status, body) {
  const text = String(body || "").slice(0, 300);
  const e = new Error(`${name} ${status}: ${text}`);
  e.status = status; e.provider = name;
  e.type = status === 401 || status === 403 ? "auth" : status === 429 ? "rate" : status >= 500 ? "provider" : status === 402 ? "quota" : "input";
  e.retryable = e.type === "rate" || e.type === "provider";
  return e;
}
export function classify(e) {
  if (e && e.type) return e;
  const m = String(e && e.message || e).match(/\b(\d{3})\b/); const st = m ? +m[1] : 0;
  const out = new Error(String(e && e.message || e)); out.status = st;
  out.type = /timeout|ECONN|ENOTFOUND|fetch failed|network/i.test(out.message) ? "network" : st === 401 || st === 403 ? "auth" : st === 429 ? "rate" : st >= 500 ? "provider" : st === 402 ? "quota" : "input";
  out.retryable = ["network", "rate", "provider"].includes(out.type); return out;
}
export const USER_MSG = {
  auth: "The AI provider rejected our key — support has been notified. Your credits were refunded.",
  rate: "High demand right now — we retried automatically. Please try again in a minute.",
  provider: "The AI provider is temporarily unavailable. Your credits were refunded.",
  network: "We couldn't reach the AI provider. Your credits were refunded.",
  quota: "The provider account is out of quota — support has been notified. Your credits were refunded.",
  input: "The provider couldn't process this request. Try rephrasing or a different model."
};
export async function withRetry(fn, { tries = 3, base = 1000 } = {}) {
  let last; for (let i = 0; i < tries; i++) { try { return await fn(i); } catch (e) { last = classify(e); if (!last.retryable || i === tries - 1) throw last; await new Promise((r) => setTimeout(r, base * Math.pow(3, i))); } } throw last;
}
