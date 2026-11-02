// Settings come from the environment (never from the client). Docker Compose passes them; .env.example lists them.
import os from "node:os";
import path from "node:path";
const env = process.env;
export const CFG = {
  port: +(env.RENDER_PORT || 8790),
  host: env.RENDER_HOST || "127.0.0.1",
  // the nooi.ai server: who the user is, their plan and role (the token the browser already has is passed on)
  appUrl: (env.NOOI_APP_URL || "http://127.0.0.1:8080").replace(/\/$/, ""),
  databaseUrl: env.DATABASE_URL || "",           // empty → kept in memory (development and tests)
  redisUrl: env.REDIS_URL || "",                 // empty → an in-process queue
  mediaDir: path.resolve(env.MEDIA_DIR || "media"),            // the nooi.ai server's /media (shared on the VPS)
  uploadDir: path.resolve(env.UPLOAD_DIR || ".data/uploads"),
  renderDir: path.resolve(env.RENDER_DIR || ".data/renders"),
  publicMedia: env.PUBLIC_MEDIA_PREFIX || "/media/",
  publicRenders: env.PUBLIC_RENDER_PREFIX || "/render-api/files/",
  maxUpload: +(env.MAX_UPLOAD_MB || 4096) * 1024 * 1024,
  clamHost: env.CLAMAV_HOST || "", clamPort: +(env.CLAMAV_PORT || 3310),
  ffmpeg: env.FFMPEG_PATH || "ffmpeg",
  concurrency: +(env.RENDER_CONCURRENCY || Math.max(1, Math.floor(os.cpus().length / 2))),
  keepDays: +(env.RENDER_KEEP_DAYS || 7),
  maxSeconds: +(env.RENDER_MAX_SECONDS || 1800),
  // how many renders one account may have waiting or running, by plan; the top plan goes first in the queue
  planLimit: JSON.parse(env.RENDER_PLAN_LIMITS || '{"free":1,"creator":1,"pro":2,"studio":3,"staff":4}') as Record<string, number>,
  planPriority: JSON.parse(env.RENDER_PLAN_PRIORITY || '{"studio":1,"staff":1,"pro":3,"creator":5,"free":8}') as Record<string, number>,
};
