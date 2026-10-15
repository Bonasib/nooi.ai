// A tiny voice server for the backup voice (deploy/piper.sh): GET /?text=… → a WAV made by the Piper program with one voice.
// Listens on 127.0.0.1 only. Usage: node piper-server.mjs <piper binary> <voice.onnx> <port>
import http from "http"; import { spawn } from "child_process"; import fs from "fs"; import os from "os"; import path from "path"; import crypto from "crypto";
const [bin, model, port] = process.argv.slice(2);
if (!bin || !model || !port) { console.error("usage: node piper-server.mjs <piper> <voice.onnx> <port>"); process.exit(1); }
let busy = 0;
http.createServer((q, s) => {
  const text = (new URL(q.url, "http://x").searchParams.get("text") || "").replace(/\s+/g, " ").trim().slice(0, 3000);
  if (!text) { s.statusCode = 400; return s.end("no text"); }
  if (busy >= 4) { s.statusCode = 429; return s.end("busy"); }
  busy++; const out = path.join(os.tmpdir(), "piper-" + crypto.randomBytes(6).toString("hex") + ".wav");
  const p = spawn(bin, ["--model", model, "--output_file", out], { stdio: ["pipe", "ignore", "pipe"] }); let err = "";
  p.stderr.on("data", (d) => { err = (err + d).slice(-500); });
  const done = (code, body, type) => { busy--; s.statusCode = code; if (type) s.setHeader("content-type", type); s.end(body); fs.unlink(out, () => {}); };
  const t = setTimeout(() => p.kill("SIGKILL"), 120000);
  p.on("close", (c) => { clearTimeout(t); try { if (c === 0) return done(200, fs.readFileSync(out), "audio/wav"); } catch {} done(500, "piper failed " + err.slice(-200)); });
  p.on("error", (e) => { clearTimeout(t); done(500, "piper failed " + e.message); });
  p.stdin.end(text);
}).listen(+port, "127.0.0.1", () => console.log("backup voice on 127.0.0.1:" + port));
