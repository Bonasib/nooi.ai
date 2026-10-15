// Gemma 4 on Google's Gemini API as nooi's text AI (providers/localtext.js), against a mocked Google server:
// Google's own request (generateContent, key in the x-goog-api-key header only), the system text folded in, thinking parts
// skipped, pictures as inline data, errors that never show the key, the Google key reused, use=off, the next text AI taking
// over, a Google address in "Your own text AI", the health check and "Compare text AIs". Run: node tests/gemma_google.mjs
import http from "http"; import fs from "fs"; import os from "os"; import path from "path";
for (const k of Object.keys(process.env)) if (/^(LLM_|ANTHROPIC_|NVIDIA_|LOCAL_LLM|GEMMA_|GOOGLE_|DASHSCOPE_)/.test(k)) delete process.env[k];
process.env.SECRET_KEY = "test-only-secret-0123456789abcdef";   // saved keys are encrypted
process.chdir(fs.mkdtempSync(path.join(os.tmpdir(), "gemma-")));   // an empty store: no saved provider keys
let pass = 0, fail = 0; const ok = (c, m) => { c ? pass++ : fail++; console.log((c ? "✓ " : "✗ ") + m); };
const seen = []; let mode = "ok";
const srv = http.createServer((req, res) => { let b = ""; req.on("data", (c) => (b += c)); req.on("end", () => {
  const body = b ? JSON.parse(b) : {}; seen.push({ url: req.url, method: req.method, key: req.headers["x-goog-api-key"], auth: req.headers.authorization, body });
  const send = (st, o) => { res.writeHead(st, { "content-type": "application/json" }); res.end(JSON.stringify(o)); };
  if (req.url.startsWith("/claude/v1/messages")) return send(200, { content: [{ type: "text", text: "from the next text AI" }] });
  if (req.method === "GET") return /gemma-9/.test(req.url) ? send(404, { error: { code: 404, message: "models/gemma-9 is not found" } }) : req.headers["x-goog-api-key"] === "bad" ? send(400, { error: { code: 400, message: "API key not valid.", status: "INVALID_ARGUMENT" } }) : send(200, { name: "models/gemma-4-26b-a4b-it" });
  if (mode === "429") return send(429, { error: { code: 429, message: "Resource has been exhausted (e.g. check quota).", status: "RESOURCE_EXHAUSTED" } });
  if (mode === "blocked") return send(200, { promptFeedback: { blockReason: "SAFETY" } });
  const txt = body.contents?.[0]?.parts?.find((p) => p.text)?.text || "";
  if (/Respond with only the JSON object/.test(txt)) {   // "Compare text AIs" tasks
    const o = /skills/.test(txt) ? { skills: [{ title: "Name the light", how: "Light every shot from a source you can name." }, { title: "One lens", how: "Keep one lens for the whole scene." }] }
      : /brief_ar/.test(txt) ? { brief_ar: "إعلان قصير لمقهى في جدة عند الغروب", prompt_en: "A warm sunset commercial for a cafe in Jeddah, people laughing at golden hour" }
      : /LINES/.test(txt) ? { lines: [{ i: 0, text: "مرحباً بعودتكم" }, { i: 1, text: "اليوم نضيء صورة" }, { i: 2, text: "ضوء ناعم من النافذة" }, { i: 3, text: "شكراً لكم" }] }
      : /storyboard/.test(txt) ? { scenes: [{ shot: "ews", action: "A kite rises over Riyadh." }, { shot: "ms", action: "A child pulls the string." }, { shot: "cu", action: "The kite tail flutters." }] }
      : { summary: "A short guide that says a 35mm lens feels natural." };
    return send(200, { candidates: [{ content: { role: "model", parts: [{ text: JSON.stringify(o) }] }, finishReason: "STOP" }] });
  }
  send(200, { candidates: [{ content: { role: "model", parts: [{ text: "Planning the answer…", thought: true }, { text: "Hello " }, { text: "from Gemma" }] }, finishReason: "STOP" }] });
}); });
await new Promise((r) => srv.listen(0, "127.0.0.1", r));
const G = `http://127.0.0.1:${srv.address().port}`;
const { localOn, localChat, localInfo, localVision } = await import("../providers/localtext.js");
const { llm, llmInfo } = await import("../providers/anthropic.js");
const { testProvider } = await import("../lib/health.js");
const { compareText } = await import("../lib/llmcheck.js");
const { saveCfg, configured } = await import("../lib/settings.js");
const last = () => seen[seen.length - 1];

ok(!localOn(), "nothing set → Gemma is off");
process.env.GEMMA_API_KEY = "gk-test-123"; process.env.GEMMA_BASE_URL = G + "/v1beta";
ok(localOn() && localInfo().provider === "google" && localInfo().model === "gemma-4-26b-a4b-it", "a Google key alone → Gemma 4 26B A4B on Google");
const out = await localChat("Write one line.", { system: "You are nooi's writer.", maxTokens: 300 });
ok(out === "Hello from Gemma", "the answer joins the text parts and skips the thinking part");
ok(last().url === "/v1beta/models/gemma-4-26b-a4b-it:generateContent" && last().method === "POST", "Google's own request: models/<model>:generateContent");
ok(last().key === "gk-test-123" && !last().auth && !/gk-test/.test(last().url), "the key goes only in the x-goog-api-key header (never in the address)");
const parts = last().body.contents[0].parts;
ok(parts.length === 1 && parts[0].text.startsWith("You are nooi's writer.") && parts[0].text.endsWith("Write one line.") && !last().body.systemInstruction, "the system text goes in front of the request (no separate system instruction)");
ok(last().body.generationConfig.maxOutputTokens === 300 && !last().body.generationConfig.thinkingConfig, "the answer length is passed; no thinking unless asked");
process.env.GEMMA_MODEL = "models/gemma-4-31b-it"; process.env.GEMMA_THINKING = "high";
await localChat("Plan a scene.", { maxTokens: 1000 });
ok(last().url.endsWith("/models/gemma-4-31b-it:generateContent") && last().body.generationConfig.thinkingConfig?.thinkingLevel === "high" && last().body.generationConfig.maxOutputTokens > 1000, "gemma-4-31b-it with thinking high (room left for the thinking)");
delete process.env.GEMMA_THINKING;
ok(localVision(), "Gemma 4 on Google reads pictures");
await localChat("What is in the picture?", { images: ["data:image/png;base64,iVBORw0KGgo="] });
const ip = last().body.contents[0].parts;
ok(ip[0].inline_data?.mime_type === "image/png" && ip[0].inline_data.data === "iVBORw0KGgo=" && ip[1].text, "pictures go along as inline data before the text");
let err = ""; try { await localChat("x", { images: ["http://example.com/a.png"] }); } catch (e) { err = e.message; }
ok(/as data only/.test(err), "a picture address (not data) is refused before anything is sent");
process.env.GEMMA_MODEL = "../../evil"; err = ""; try { await localChat("x"); } catch (e) { err = e.message; }
ok(/isn't valid/.test(err), "a model name that isn't a name is refused"); process.env.GEMMA_MODEL = "gemma-4-26b-a4b-it";
mode = "429"; err = ""; try { await localChat("x"); } catch (e) { err = e.message; }
ok(/^Gemma on Google 429: Resource has been exhausted/.test(err) && !/gk-test/.test(err), "Google's limit message comes through, the key never does");
mode = "blocked"; err = ""; try { await localChat("x"); } catch (e) { err = e.message; }
ok(/returned no text \(blocked: SAFETY\)/.test(err), "a blocked request says why");
// the site's text AI: Gemma first, the next text AI takes over when Google refuses
mode = "ok"; ok(await llm("Say hello") === "Hello from Gemma" && llmInfo().provider === "google", "the site's text tasks run on Gemma first");
process.env.LLM_API_KEY = "claude-test"; process.env.LLM_BASE_URL = G + "/claude"; process.env.LLM_MODEL = "claude-test-model";
mode = "429"; ok(await llm("Say hello") === "from the next text AI", "Google out of quota → the next text AI answers");
mode = "ok"; ok(await llm("Say hello", { noLocal: true }) === "from the next text AI", "noLocal skips Gemma");
delete process.env.LLM_API_KEY; delete process.env.LLM_BASE_URL; delete process.env.LLM_MODEL; saveCfg("providers", "qwentext", { apiKey: "q-1", baseUrl: G + "/claude" });
mode = "429"; ok(await llm("Say hello") === "from the next text AI" && last().url === "/claude/v1/messages" && last().body.model === "claude-sonnet-5", "the next text AI gets its own model name, never Gemma's"); mode = "ok";
process.env.GEMMA_USE = "off"; ok(!localOn(), "use=off switches Gemma off without deleting the key"); delete process.env.GEMMA_USE;
// the Google key saved for Nano Banana is reused once a model is typed
delete process.env.GEMMA_API_KEY; delete process.env.GEMMA_MODEL; process.env.GOOGLE_API_KEY = "google-key-9";
ok(!configured("gemma") && !localOn(), "the Google picture key alone doesn't switch the text AI");
saveCfg("providers", "gemma", { model: "gemma-4-26b-a4b-it" });
ok(configured("gemma") && localOn(), "typing a model reuses the Google key");
await localChat("Hi"); ok(last().key === "google-key-9", "…and sends that key");
// a Google address in "Your own text AI" also takes Google's own route
saveCfg("providers", "gemma", { use: "off" }); delete process.env.GOOGLE_API_KEY;
process.env.LOCAL_LLM_URL = G + "/generativelanguage.googleapis.com/v1beta/openai"; process.env.LOCAL_LLM_MODEL = "gemma-4-31b-it"; process.env.LOCAL_LLM_KEY = "lk-1";
await localChat("Hi", { system: "Be brief." });
ok(last().url === "/generativelanguage.googleapis.com/v1beta/models/gemma-4-31b-it:generateContent" && last().key === "lk-1", "a Google address in \"Your own text AI\" (even …/openai) takes Google's own route");
process.env.LOCAL_LLM_URL = G + "/v1"; process.env.LOCAL_LLM_MODEL = "gemma4:e4b";
ok(localInfo().provider === "local", "an Ollama address keeps the OpenAI-compatible route");
delete process.env.LOCAL_LLM_URL; delete process.env.LOCAL_LLM_MODEL; delete process.env.LOCAL_LLM_KEY;
// health check (Admin → Status): model found / bad key / unknown model
saveCfg("providers", "gemma", { use: "on", apiKey: "gk-test-123" }); process.env.GEMMA_BASE_URL = G + "/v1beta";
let h = await testProvider("gemma"); ok(h.state === "online" && last().url === "/v1beta/models/gemma-4-26b-a4b-it" && last().key === "gk-test-123", "health check asks Google for the model");
saveCfg("providers", "gemma", { apiKey: "bad" }); h = await testProvider("gemma"); ok(h.state === "down" && h.type === "auth", "a bad Google key shows as rejected");
saveCfg("providers", "gemma", { apiKey: "gk-test-123", model: "gemma-9" }); h = await testProvider("gemma"); ok(h.state === "down" && /no model/.test(h.note), "a model Google doesn't have shows as down");
saveCfg("providers", "gemma", { model: "gemma-4-26b-a4b-it" });
// Compare text AIs: Gemma on Google against the current text AI
const cmp = await compareText();
ok(cmp.local?.provider === "google" && cmp.local.model === "gemma-4-26b-a4b-it" && cmp.local.score === 5, "Compare text AIs runs nooi's five tasks on Gemma on Google (5 / 5 on the mock)");
ok(cmp.site && !cmp.site.error, "…and on the current text AI");
srv.close();
console.log(`\n${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
