// Generic async-job HTTP adapter.
// Most generation APIs follow: POST {url} → {id}   then   GET {url}/{id} → {status, output}
// Each capability gets its own instance from .env. When you send me a provider's API docs,
// only `buildBody` / `readResult` for that provider need to change — nothing else in the app.
export function genericAdapter({ name, url, key, buildBody, headers, pollUrl, readResult }) {
  const auth = { Authorization: "Bearer " + key, "Content-Type": "application/json", ...(headers || {}) };
  const read = readResult || ((d) => {
    const s = String(d.status || d.state || "").toLowerCase();
    const out = d.output_url || d.url || d.video_url || d.image_url || d.audio_url ||
      (Array.isArray(d.output) ? d.output[0] : typeof d.output === "string" ? d.output : d.output && (d.output.url || d.output.video_url)) ||
      (d.data && (d.data.url || d.data.video_url));
    const segs = d.segments || (d.output && d.output.segments) || (d.result && d.result.segments) || null;
    const done = (out || segs) && (!s || /succe|complet|done|finish|ready/.test(s));
    const failed = /fail|error|cancel/.test(s);
    return { status: failed ? "failed" : done ? "done" : /queue|pend|wait|submit/.test(s) ? "queued" : "rendering", url: done ? out : null, segments: done ? segs : null, progress: typeof d.progress === "number" ? (d.progress > 1 ? d.progress / 100 : d.progress) : null, error: failed ? (d.error || d.message || "Provider error") : null };
  });
  return {
    name, configured: !!(url && key),
    async submit(payload) {
      const r = await fetch(url, { method: "POST", headers: auth, body: JSON.stringify(buildBody ? buildBody(payload) : payload) });
      const txt = await r.text(); let d; try { d = JSON.parse(txt); } catch { d = { raw: txt }; }
      if (!r.ok) throw new Error(`${name} ${r.status}: ${d.error?.message || d.message || d.error || txt.slice(0, 200)}`);
      const res = read(d);
      if (res.status === "done") return { done: true, url: res.url, segments: res.segments };
      const id = d.id || d.task_id || d.job_id || d.request_id || d.prediction_id || (d.data && (d.data.id || d.data.task_id));
      if (!id) throw new Error(`${name}: no job id in response — adapter mapping needed`);
      return { remoteId: String(id) };
    },
    async poll(remoteId) {
      const r = await fetch(pollUrl ? pollUrl(remoteId) : url.replace(/\/$/, "") + "/" + remoteId, { headers: auth });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) return { status: "failed", error: `${name} ${r.status}: ${d.message || d.error || "poll failed"}` };
      return read(d);
    }
  };
}
