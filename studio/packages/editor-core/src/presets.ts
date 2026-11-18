import type { ExportSettings } from "./schema";

export type Aspect = "9:16" | "1:1" | "4:5" | "16:9";
export const ASPECTS: Aspect[] = ["9:16", "1:1", "4:5", "16:9"];
export const RESOLUTIONS = { "720p": 720, "1080p": 1080, "4k": 2160 } as const;

// the frame size for an aspect at a resolution (the short side is the resolution; even numbers for the encoders)
export function frameSize(aspect: Aspect, res: keyof typeof RESOLUTIONS): { w: number; h: number } {
  const s = RESOLUTIONS[res]; const [a, b] = aspect.split(":").map(Number);
  const even = (n: number) => Math.round(n / 2) * 2;
  return a >= b ? { w: even((s * a) / b), h: s } : { w: s, h: even((s * b) / a) };
}
export function aspectOf(w: number, h: number): Aspect {
  const r = w / h; let best: Aspect = "16:9", bd = 9;
  for (const a of ASPECTS) { const [x, y] = a.split(":").map(Number); const d = Math.abs(x / y - r); if (d < bd) { bd = d; best = a; } }
  return best;
}

export interface Preset { id: string; name: string; nameAr: string; aspect: Aspect; res: keyof typeof RESOLUTIONS; fps: number; maxSec?: number; format: ExportSettings["format"]; bitrate: number }
export const PRESETS: Preset[] = [
  { id: "tiktok", name: "TikTok", nameAr: "تيك توك", aspect: "9:16", res: "1080p", fps: 30, maxSec: 600, format: "mp4", bitrate: 8e6 },
  { id: "reels", name: "Instagram Reels", nameAr: "ريلز إنستغرام", aspect: "9:16", res: "1080p", fps: 30, maxSec: 180, format: "mp4", bitrate: 8e6 },
  { id: "igfeed", name: "Instagram Feed 4:5", nameAr: "منشور إنستغرام 4:5", aspect: "4:5", res: "1080p", fps: 30, format: "mp4", bitrate: 8e6 },
  { id: "igsquare", name: "Instagram 1:1", nameAr: "إنستغرام 1:1", aspect: "1:1", res: "1080p", fps: 30, format: "mp4", bitrate: 8e6 },
  { id: "youtube", name: "YouTube", nameAr: "يوتيوب", aspect: "16:9", res: "1080p", fps: 30, format: "mp4", bitrate: 12e6 },
  { id: "youtube4k", name: "YouTube 4K", nameAr: "يوتيوب 4K", aspect: "16:9", res: "4k", fps: 30, format: "mp4", bitrate: 40e6 },
  { id: "shorts", name: "YouTube Shorts", nameAr: "شورتس يوتيوب", aspect: "9:16", res: "1080p", fps: 30, maxSec: 180, format: "mp4", bitrate: 8e6 },
  { id: "snapchat", name: "Snapchat", nameAr: "سناب شات", aspect: "9:16", res: "1080p", fps: 30, maxSec: 60, format: "mp4", bitrate: 6e6 },
  { id: "x", name: "X", nameAr: "إكس", aspect: "16:9", res: "720p", fps: 30, maxSec: 140, format: "mp4", bitrate: 5e6 },
  { id: "xsquare", name: "X 1:1", nameAr: "إكس 1:1", aspect: "1:1", res: "720p", fps: 30, maxSec: 140, format: "mp4", bitrate: 5e6 },
];
export const presetById = (id: string) => PRESETS.find((p) => p.id === id) || PRESETS[4];
