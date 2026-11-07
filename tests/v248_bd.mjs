// v248 — "bd@dreamina-seedance-2-0-260128: Seedance (ByteDance): no task id": the answer to a new task, in every shape it may
// come in, and the Base URL as owners save it (BytePlus's real answer and every other one checked with a stand-in fetch)
//  · the Base URL: empty, without /api/v3, with the full task path pasted, the console's address → the API's address
//  · the task id from {id}, {task_id}, {data:{id}}, {data:{task_id}}; the task's state from {status} or {data:{status}}, any case
//  · a web page with "OK", or an error inside an "OK" answer, says what it is (the Base URL, the error's words) — not "no task id"
//  · a key's name typed in the Model id field doesn't change the model
// Run: node tests/v248_bd.mjs
import fs from "fs"; import os from "os"; import path from "path";
const D = fs.mkdtempSync(path.join(os.tmpdir(), "nooi-v248-")); process.chdir(D); fs.mkdirSync("data"); fs.mkdirSync("media"); fs.writeFileSync("data/db.json", JSON.stringify({ users: {} }));
const ROOT = path.dirname(path.dirname(new URL(import.meta.url).pathname));
process.env.SEEDANCE_API_KEY = "bd-test"; process.env.SEEDANCE_MODEL = "apikey-20261106235400-h99gb"; process.env.SECRET_KEY = "f".repeat(40);
const BD = await import(ROOT + "/providers/bytedance241.js");
let n = 0, bad = 0; const ok = (c, m, info) => { n++; if (!c) { bad++; console.log("✗ " + m + (info !== undefined ? " · " + JSON.stringify(info).slice(0, 400) : "")); } };
const DEF = "https://ark.ap-southeast.bytepluses.com/api/v3";
for (const [u, want] of [["", DEF], ["https://ark.ap-southeast.bytepluses.com", DEF], ["https://ark.ap-southeast.bytepluses.com/api/v3/", DEF], [DEF + "/contents/generations/tasks", DEF], ["ark.ap-southeast.bytepluses.com/api/v3", DEF],
  ["https://console.byteplus.com/ark/region:ark+ap-southeast-1/apiKey", DEF], ["https://docs.byteplus.com/en/docs/ModelArk", DEF], ["https://ark.cn-beijing.volces.com", "https://ark.cn-beijing.volces.com/api/v3"], ["https://api.other-seedance.example/v1", "https://api.other-seedance.example/v1"]])
  ok(BD.bdBase248(u) === want, `Base URL ${JSON.stringify(u)} → ${want}`, BD.bdBase248(u));
let reply = null, last = null;
globalThis.fetch = async (url, init) => { last = { url, init }; const r = reply(url, init); return new Response(typeof r.body === "string" ? r.body : JSON.stringify(r.body), { status: r.status || 200, headers: { "Content-Type": r.html ? "text/html" : "application/json" } }); };
const a = BD.bytedance241("dreamina-seedance-2-0-260128"), P = { kind: "video", model: "seedance20", prompt: "a red car in the rain", dur: 5, aspect: "16:9" };
for (const [body, id] of [[{ id: "cgt-1" }, "cgt-1"], [{ task_id: "t2" }, "t2"], [{ data: { id: "cgt-3" } }, "cgt-3"], [{ code: 0, data: { task_id: "t4" } }, "t4"], [{ code: 200, msg: "ok", data: "t5" }, "t5"]]) {
  reply = () => ({ body }); const r = await a.submit(P).catch((e) => ({ err: e.message }));
  ok(r.remoteId === id, "the task id from " + JSON.stringify(body), r);
}
const sent = JSON.parse(last.init.body); ok(last.url === DEF + "/contents/generations/tasks" && sent.model === "dreamina-seedance-2-0-260128" && sent.content[0].type === "text", "sent to BytePlus's address with the model (the key's name in Model id is ignored)", { url: last.url, model: sent.model });
reply = () => ({ body: "<!doctype html><html><body>Console</body></html>", html: true }); let e = await a.submit(P).catch((x) => x);
ok(/web page, not the API/.test(e.message) && /Base URL/.test(e.message), "a web page with OK says the Base URL is wrong", e.message);
reply = () => ({ body: { error: { code: "ModelNotOpen", message: "Your account has not activated the model dreamina-seedance-2-0-260128" } } }); e = await a.submit(P).catch((x) => x);
ok(/has not activated the model/.test(e.message), "an error inside an OK answer says its words", e.message);
reply = () => ({ body: { code: 40301, msg: "insufficient balance" } }); e = await a.submit(P).catch((x) => x);
ok(/insufficient balance/.test(e.message), "a code inside an OK answer says its words", e.message);
reply = () => ({ body: { foo: 1 } }); e = await a.submit(P).catch((x) => x);
ok(/no task id — it said: \{"foo":1\}/.test(e.message), "an answer with nothing usable shows what it said", e.message);
reply = () => ({ status: 401, body: { error: { code: "AuthenticationError", message: "The API key is invalid" } } }); e = await a.submit(P).catch((x) => x);
ok(/401/.test(e.message) && /invalid/.test(e.message), "a refused key: the status and the words (as before)", e.message);
for (const [body, st, url] of [[{ id: "x", status: "succeeded", content: { video_url: "https://v/1.mp4" } }, "done", "https://v/1.mp4"], [{ data: { status: "SUCCESS", video_url: "https://v/2.mp4" } }, "done", "https://v/2.mp4"],
  [{ status: "running" }, "rendering", undefined], [{ data: { status: "queued" } }, "queued", undefined], [{ status: "failed", error: { message: "bad prompt" } }, "failed", undefined]]) {
  reply = () => ({ body }); const r = await a.poll("x"); ok(r.status === st && (url === undefined || r.url === url), "the task's state from " + JSON.stringify(body), r);
}
fs.rmSync(D, { recursive: true, force: true });
console.log(`${n - bad} passed, ${bad} failed`); if (bad) { console.log("v248 FAIL"); process.exit(1); } console.log("v248 OK");
