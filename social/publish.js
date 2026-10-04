// Publishing to each platform. Media must be reachable at a public https URL (PUBLIC_BASE_URL/media/...).
import fs from "fs";
import { localPath, download } from "../lib/media.js";
import { freshToken } from "./oauth.js";
const V = () => process.env.META_GRAPH_VERSION || "v21.0";
const G = (p) => `https://graph.facebook.com/${V()}/${p}`;
const isVideo = (u) => /\.(mp4|mov|webm)(\?|$)/i.test(u || "");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const text = (post) => [post.caption, post.hashtags].filter(Boolean).join("\n\n");

async function instagram(post, acc) {
  const token = acc.token, ig = acc.igUserId, url = post.mediaUrl;
  if (!url) throw new Error("Instagram needs a video or image");
  const body = new URLSearchParams({ caption: text(post), access_token: token });
  if (isVideo(url)) { body.set("media_type", post.format === "story" ? "STORIES" : "REELS"); body.set("video_url", url); } else { if (post.format === "story") body.set("media_type", "STORIES"); body.set("image_url", url); }
  const c = await (await fetch(G(`${ig}/media`), { method: "POST", body })).json();
  if (!c.id) throw new Error("Instagram: " + JSON.stringify(c.error || c));
  for (let i = 0; i < 60; i++) { const s = await (await fetch(G(`${c.id}?fields=status_code&access_token=${token}`))).json(); if (s.status_code === "FINISHED") break; if (s.status_code === "ERROR") throw new Error("Instagram processing failed"); await sleep(5000); }
  const p = await (await fetch(G(`${ig}/media_publish`), { method: "POST", body: new URLSearchParams({ creation_id: c.id, access_token: token }) })).json();
  if (!p.id) throw new Error("Instagram publish: " + JSON.stringify(p.error || p));
  return p.id;
}
async function facebook(post, acc) {
  const url = post.mediaUrl, token = acc.token;
  const ep = !url ? `${acc.pageId}/feed` : isVideo(url) ? `${acc.pageId}/videos` : `${acc.pageId}/photos`;
  const body = new URLSearchParams({ access_token: token });
  if (!url) body.set("message", text(post)); else if (isVideo(url)) { body.set("file_url", url); body.set("description", text(post)); } else { body.set("url", url); body.set("caption", text(post)); }
  const r = await (await fetch(G(ep), { method: "POST", body })).json();
  if (!r.id && !r.post_id) throw new Error("Facebook: " + JSON.stringify(r.error || r));
  return r.post_id || r.id;
}
async function tiktok(post, acc) {
  // PULL_FROM_URL requires your media domain to be verified in the TikTok developer portal.
  if (!isVideo(post.mediaUrl)) throw new Error("TikTok needs a video");
  const token = await freshToken("tiktok", acc);
  const r = await (await fetch("https://open.tiktokapis.com/v2/post/publish/video/init/", { method: "POST", headers: { Authorization: "Bearer " + token, "Content-Type": "application/json; charset=UTF-8" },
    body: JSON.stringify({ post_info: { title: text(post).slice(0, 2200), privacy_level: process.env.TIKTOK_PRIVACY || "SELF_ONLY", disable_comment: false }, source_info: { source: "PULL_FROM_URL", video_url: post.mediaUrl } }) })).json();
  if (r.error && r.error.code !== "ok") throw new Error("TikTok: " + (r.error.message || r.error.code));
  return r.data && r.data.publish_id;
}
async function youtube(post, acc) {
  if (!isVideo(post.mediaUrl)) throw new Error("YouTube needs a video");
  const token = await freshToken("youtube", acc);
  const file = localPath(post.mediaUrl) || (await download(post.mediaUrl)).file;
  const size = fs.statSync(file).size;
  const meta = { snippet: { title: (post.title || post.caption || "nooi.ai").slice(0, 100), description: text(post).slice(0, 5000), tags: (post.hashtags || "").split(/\s+/).map((h) => h.replace(/^#/, "")).filter(Boolean).slice(0, 15) }, status: { privacyStatus: process.env.YOUTUBE_PRIVACY || "private", selfDeclaredMadeForKids: false } };
  const init = await fetch("https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status", { method: "POST", headers: { Authorization: "Bearer " + token, "Content-Type": "application/json; charset=UTF-8", "X-Upload-Content-Length": String(size), "X-Upload-Content-Type": "video/*" }, body: JSON.stringify(meta) });
  const loc = init.headers.get("location"); if (!loc) throw new Error("YouTube: " + (await init.text()).slice(0, 300));
  const up = await fetch(loc, { method: "PUT", headers: { "Content-Type": "video/*", "Content-Length": String(size) }, body: fs.readFileSync(file) });
  const d = await up.json(); if (!d.id) throw new Error("YouTube upload: " + JSON.stringify(d.error || d).slice(0, 300));
  return d.id;
}
async function notYet(name) { throw new Error(`${name} publishing needs its current media-upload API wired in — send me your app's API access details and I'll finish it.`); }

export const PUBLISHERS = { instagram, facebook, tiktok, youtube, x: () => notYet("X"), linkedin: () => notYet("LinkedIn"), snapchat: () => notYet("Snapchat") };
export async function publishPost(post, accounts) {
  const results = {}, errors = [];
  for (const p of post.platforms) {
    const acc = accounts[p];
    if (!acc) { errors.push(`${p}: account not connected`); continue; }
    try { results[p] = await PUBLISHERS[p](post, acc); } catch (e) { errors.push(`${p}: ${e.message}`); }
  }
  return { results, errors };
}
