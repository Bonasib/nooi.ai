// nooi.ai MCP server (Streamable HTTP, JSON responses). Lets Claude, ChatGPT, Qwen and other MCP clients use nooi.ai.
import { user, save, uid } from "./store.js";
import { createJob, publicJob } from "./jobs.js";
import { balance } from "./billing.js";
import { llmJson, llmConfigured } from "../providers/anthropic.js";
const VERSION = "1.0.0";
const tools = [
  { name: "nooi_generate_video", description: "Generate a short AI video clip from a text prompt (optionally from a start image). Returns a job id; poll nooi_job_status.", inputSchema: { type: "object", properties: { prompt: { type: "string" }, duration: { type: "integer", enum: [3, 5, 8, 10, 15], default: 8 }, aspect: { type: "string", enum: ["16:9", "9:16", "1:1", "4:5", "21:9"], default: "16:9" }, model: { type: "string", enum: ["auto", "ltxfast", "wan22", "wan30", "hunyuan", "ltx23"], default: "auto" }, start_image_url: { type: "string" } }, required: ["prompt"] } },
  { name: "nooi_generate_image", description: "Generate an image from a prompt. Returns a job id.", inputSchema: { type: "object", properties: { prompt: { type: "string" }, aspect: { type: "string", default: "1:1" }, model: { type: "string", enum: ["auto", "sdxl", "dotimg", "flux"], default: "auto" } }, required: ["prompt"] } },
  { name: "nooi_storyboard", description: "Turn a story or script into a shot-by-shot storyboard (shots, camera, dialogue, sound, transitions).", inputSchema: { type: "object", properties: { script: { type: "string" }, language: { type: "string", default: "ar" }, frames: { type: "integer", default: 8 } }, required: ["script"] } },
  { name: "nooi_job_status", description: "Get the status and result URL of a nooi.ai job.", inputSchema: { type: "object", properties: { job_id: { type: "string" } }, required: ["job_id"] } },
  { name: "nooi_list_assets", description: "List finished videos, images and 3D assets in the user's library.", inputSchema: { type: "object", properties: { kind: { type: "string", enum: ["video", "image", "3d", "any"], default: "any" }, limit: { type: "integer", default: 20 } } } },
  { name: "nooi_schedule_post", description: "Schedule a social media post (Instagram, TikTok, YouTube, Facebook, X, LinkedIn) with a media URL.", inputSchema: { type: "object", properties: { caption: { type: "string" }, platforms: { type: "array", items: { type: "string" } }, media_url: { type: "string" }, at: { type: "string", description: "ISO date-time" } }, required: ["caption", "platforms", "at"] } },
  { name: "nooi_credits", description: "Show the user's credit balance.", inputSchema: { type: "object", properties: {} } }
];
const text = (o) => ({ content: [{ type: "text", text: typeof o === "string" ? o : JSON.stringify(o, null, 2) }] });
async function call(uidv, name, a) {
  const u = { uid: uidv };
  switch (name) {
    case "nooi_generate_video": { const j = await createJob(u, { kind: "video", prompt: a.prompt, dur: a.duration || 8, aspect: a.aspect || "16:9", model: a.model === "auto" || !a.model ? "wan22" : a.model, inputs: a.start_image_url ? { vStart: a.start_image_url } : {}, meta: { via: "mcp" }, title: a.prompt }); return text({ job_id: j.id, status: j.status, cost_credits: j.cost, next: "Call nooi_job_status with this job_id." }); }
    case "nooi_generate_image": { const j = await createJob(u, { kind: "image", prompt: a.prompt, aspect: a.aspect || "1:1", model: a.model === "auto" || !a.model ? "dotimg" : a.model, meta: { via: "mcp" }, title: a.prompt }); return text({ job_id: j.id, status: j.status, cost_credits: j.cost }); }
    case "nooi_job_status": { const j = user(uidv).jobs[a.job_id]; return j ? text(publicJob(j)) : { ...text("Job not found"), isError: true }; }
    case "nooi_list_assets": { const k = a.kind || "any"; const list = Object.values(user(uidv).jobs).filter((j) => j.status === "done" && j.url && (k === "any" || j.kind === k)).sort((x, y) => y.created - x.created).slice(0, a.limit || 20).map((j) => ({ id: j.id, kind: j.kind, title: j.title, url: j.url })); return text(list); }
    case "nooi_storyboard": { if (!llmConfigured()) return { ...text("Text AI is not connected on this server."), isError: true }; const out = await llmJson(`You are a professional storyboard artist. Break this script into ${a.frames || 8} frames. Language: ${a.language || "ar"}.\nSCRIPT:\n${a.script}\nReturn JSON {"frames":[{"shot":"","camera":"","action":"","dialogue":"","speaker":"","sfx":"","music":"","transition":"","dur":3}]}`, { tier: "complex", maxTokens: 6000 }); return text(out); }
    case "nooi_schedule_post": { const U = user(uidv); const id = uid(); U.posts[id] = { id, clientId: "mcp-" + id, caption: a.caption, hashtags: "", platforms: a.platforms, mediaUrl: a.media_url || null, at: a.at, status: "scheduled", format: "reel", error: "" }; save(); return text({ post_id: id, status: "scheduled", at: a.at }); }
    case "nooi_credits": return text({ credits: balance(uidv) });
  }
  return { ...text("Unknown tool " + name), isError: true };
}
export async function handleMcp(uidv, msg) {
  const reply = (result) => ({ jsonrpc: "2.0", id: msg.id, result });
  const error = (code, message) => ({ jsonrpc: "2.0", id: msg.id, error: { code, message } });
  if (msg.id === undefined || msg.id === null) return null;                 // notification (e.g. notifications/initialized)
  switch (msg.method) {
    case "initialize": return reply({ protocolVersion: msg.params?.protocolVersion || "2025-06-18", capabilities: { tools: { listChanged: false } }, serverInfo: { name: "nooi.ai", version: VERSION }, instructions: "nooi.ai creates AI videos, images and storyboards, and schedules social posts. Generation is asynchronous: start a job, then poll nooi_job_status. All actions use the user's nooi.ai credits." });
    case "ping": return reply({});
    case "tools/list": return reply({ tools });
    case "tools/call": try { return reply(await call(uidv, msg.params?.name, msg.params?.arguments || {})); } catch (e) { return reply({ ...text("Error: " + e.message), isError: true }); }
    default: return error(-32601, "Method not found: " + msg.method);
  }
}
