// ChatGPT-style MCP connection test: a fresh nooi server (own data folder, Studio plan), a personal token,
// then the exact handshake ChatGPT's connector does over Streamable HTTP: initialize → notifications/initialized
// → tools/list → tools/call, with the token in the URL (ChatGPT "no authentication") and as a Bearer header.
// Run: node tests/mcp_chatgpt.mjs
import { spawn } from "child_process"; import fs from "fs"; import os from "os"; import path from "path"; import url from "url";
const ROOT = path.resolve(path.dirname(url.fileURLToPath(import.meta.url)), ".."), PORT = 8089;
const dir = fs.mkdtempSync(path.join(os.tmpdir(), "nooi-mcp-")); fs.mkdirSync(path.join(dir, "data"));
fs.writeFileSync(path.join(dir, "data/db.json"), JSON.stringify({ users: { local: { plan: "studio", credits: 4321, jobs: {}, ledger: [] } } }));
const srv = spawn("node", [path.join(ROOT, "server.js")], { cwd: dir, env: { ...process.env, PORT: String(PORT), SECRET_KEY: "m".repeat(40), FIREBASE_PROJECT_ID: "" }, stdio: "ignore" });
let pass = 0, fail = 0; const ok = (c, m) => { c ? pass++ : fail++; console.log((c ? "✓ " : "✗ ") + m); };
const B = `http://localhost:${PORT}`;
const post = async (p, body, headers = {}) => { const r = await fetch(B + p, { method: "POST", headers: { "content-type": "application/json", ...headers }, body: JSON.stringify(body) }); return { status: r.status, h: r.headers, d: r.status === 202 ? null : await r.json().catch(() => null) }; };
try {
  for (let i = 0; i < 80; i++) { try { await fetch(B + "/v1/config"); break; } catch { await new Promise((r) => setTimeout(r, 250)); } }
  const tk = (await post("/v1/tokens", { name: "ChatGPT" })).d?.token; ok(/^nooi_/.test(tk || ""), "a personal token is created for the connector");
  const gpt = { Accept: "application/json, text/event-stream", "MCP-Protocol-Version": "2025-06-18", "User-Agent": "openai-mcp/1.0" }, U = "/mcp?token=" + encodeURIComponent(tk);
  const init = await post(U, { jsonrpc: "2.0", id: 0, method: "initialize", params: { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "openai-mcp", version: "1.0.0" } } }, gpt);
  ok(init.status === 200 && init.d?.result?.protocolVersion === "2025-06-18" && init.d.result.capabilities?.tools && init.d.result.serverInfo?.name === "nooi.ai", "initialize: protocol 2025-06-18, tools capability, server name");
  ok(/application\/json/.test(init.h.get("content-type") || ""), "answers with JSON (allowed by Streamable HTTP when the client accepts JSON)");
  const n = await post(U, { jsonrpc: "2.0", method: "notifications/initialized" }, gpt); ok(n.status === 202, "notifications/initialized → 202 Accepted");
  const tl = await post(U, { jsonrpc: "2.0", id: 1, method: "tools/list", params: {} }, gpt), tools = tl.d?.result?.tools || [];
  ok(tools.length >= 7 && tools.every((t) => /^[a-z0-9_]{1,64}$/.test(t.name) && t.description && t.inputSchema?.type === "object"), "tools/list: " + tools.length + " tools with names, descriptions and object input schemas");
  const c = await post(U, { jsonrpc: "2.0", id: 2, method: "tools/call", params: { name: "nooi_credits", arguments: {} } }, gpt);
  ok(JSON.parse(c.d?.result?.content?.[0]?.text || "{}").credits === 4321, "tools/call nooi_credits returns the account's credits");
  const bad = await post(U, { jsonrpc: "2.0", id: 3, method: "tools/call", params: { name: "nooi_nope", arguments: {} } }, gpt); ok(bad.status === 200 && (bad.d?.result?.isError || bad.d?.error), "unknown tool → error result, not a crash");
  const bearer = await post("/mcp", { jsonrpc: "2.0", id: 4, method: "ping" }, { ...gpt, Authorization: "Bearer " + tk }); ok(bearer.status === 200 && bearer.d?.result, "the same token works as a Bearer header (OAuth-style clients)");
  const no = await post("/mcp?token=nooi_wrong", { jsonrpc: "2.0", id: 5, method: "ping" }, gpt); ok(no.status === 401 && /Bearer/.test(no.h.get("www-authenticate") || ""), "a wrong token → 401 with WWW-Authenticate");
  const batch = await post(U, [{ jsonrpc: "2.0", id: 6, method: "ping" }, { jsonrpc: "2.0", id: 7, method: "tools/list" }], gpt); ok(Array.isArray(batch.d) && batch.d.length === 2, "batched requests answered together");
  const g = await fetch(B + U, { headers: gpt }); ok(g.status === 405, "GET /mcp → 405 (no server-sent stream needed)");
} catch (e) { ok(false, "crashed: " + e.message); }
finally { srv.kill(); try { fs.rmSync(dir, { recursive: true, force: true }); } catch {} }
console.log(`\n${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
