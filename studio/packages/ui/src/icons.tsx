// nooi Studio's own line icons (24 grid, 1.7 stroke) — drawn for this app.
import type { CSSProperties } from "react";

const P: Record<string, string> = {
  link: "M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1 M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1",
  package: "M12 3l8 4.5v9L12 21l-8-4.5v-9z M4 7.5l8 4.5 8-4.5 M12 12v9",
  settings: "M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6z M19.4 13.5l1.6 1.2-2 3.4-1.9-.7a7 7 0 0 1-1.8 1l-.3 2h-4l-.3-2a7 7 0 0 1-1.8-1l-1.9.7-2-3.4 1.6-1.2a7 7 0 0 1 0-3L3 9.3l2-3.4 1.9.7a7 7 0 0 1 1.8-1l.3-2h4l.3 2a7 7 0 0 1 1.8 1l1.9-.7 2 3.4-1.6 1.2a7 7 0 0 1 0 3z",
  download: "M12 4v11 M7 10l5 5 5-5 M5 20h14",
  phone: "M8 3h8a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z M11 18h2",
  cut: "M6 6a2.5 2.5 0 1 0 0 .01 M6 18a2.5 2.5 0 1 0 0 .01 M8 7.5L20 18 M8 16.5L20 6",
  sticker: "M5 4h10l4 4v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z M15 4v4h4 M8 13.5c1 1.4 2.3 2 4 2s3-.6 4-2 M9 10h.01 M15 10h.01",
  template: "M4 4h7v7H4z M13 4h7v7h-7z M4 13h7v7H4z M13 13h7v7h-7z",
  chat: "M5 5h14a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-7l-5 4v-4H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2z M8 10h8 M8 13h5",
  history: "M4 12a8 8 0 1 0 2.3-5.6 M4 4v4h4 M12 8v4l3 2",
  mic: "M12 3a3 3 0 0 1 3 3v6a3 3 0 0 1-6 0V6a3 3 0 0 1 3-3z M5 11a7 7 0 0 0 14 0 M12 18v3",
  chevron: "M6 9l6 6 6-6",
  layout: "M4 5h16v14H4z M4 10h16 M10 10v9",
  stock: "M4 6h16v12H4z M4 9h16 M8 6v3 M16 6v3 M12 12l1 2 2 .3-1.5 1.4.4 2-1.9-1-1.9 1 .4-2L9 14.3l2-.3z",
  media: "M4 5h16v14H4z M4 15l4-4 4 4 3-3 5 5 M15 9.5a1.5 1.5 0 1 0 0-.01",
  audio: "M9 18V6l10-2v12 M9 18a2.5 2.5 0 1 1-5 0 2.5 2.5 0 0 1 5 0z M19 16a2.5 2.5 0 1 1-5 0 2.5 2.5 0 0 1 5 0z",
  text: "M5 6V4h14v2 M12 4v16 M9 20h6",
  captions: "M3 6h18v12H3z M7 11h4 M13 11h4 M7 14h6 M15 14h2",
  effects: "M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z M19 16l.7 2 2 .7-2 .7-.7 2-.7-2-2-.7 2-.7z",
  transitions: "M4 6h7v12H4z M13 6h7v12h-7z M9 12h6 M13 10l2 2-2 2",
  color: "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z M12 3v18 M12 3a9 9 0 0 1 0 18",
  ai: "M12 3v3 M12 18v3 M3 12h3 M18 12h3 M6 6l2 2 M16 16l2 2 M6 18l2-2 M16 8l2-2 M9 12a3 3 0 1 0 6 0 3 3 0 0 0-6 0",
  upload: "M12 16V4 M7 9l5-5 5 5 M4 20h16",
  folder: "M3 6h6l2 2h10v11H3z",
  play: "M7 4l13 8-13 8z", pause: "M7 4h4v16H7z M13 4h4v16h-4z",
  prev: "M6 5v14 M19 5l-10 7 10 7z", next: "M18 5v14 M5 5l10 7-10 7z",
  undo: "M9 14L4 9l5-5 M4 9h10a6 6 0 0 1 0 12h-3", redo: "M15 14l5-5-5-5 M20 9H10a6 6 0 0 0 0 12h3",
  split: "M12 3v18 M8 7l-4 5 4 5 M16 7l4 5-4 5", trash: "M4 7h16 M9 7V4h6v3 M6 7l1 13h10l1-13",
  copy: "M8 8h12v12H8z M4 16V4h12", magnet: "M6 4v8a6 6 0 0 0 12 0V4 M6 4h4v8a2 2 0 0 0 4 0V4h4",
  marker: "M6 3v18 M6 4h11l-3 4 3 4H6", lock: "M6 11h12v9H6z M8 11V8a4 4 0 0 1 8 0v3", unlock: "M6 11h12v9H6z M8 11V8a4 4 0 0 1 7.5-2",
  eye: "M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6z", eyeoff: "M3 3l18 18 M10.6 6.1A10 10 0 0 1 12 6c6 0 10 6 10 6a17 17 0 0 1-3.2 3.8 M6.5 7.6C3.9 9.4 2 12 2 12s4 6 10 6a9.6 9.6 0 0 0 4.3-1",
  mute: "M4 9h4l5-4v14l-5-4H4z M17 9l4 6 M21 9l-4 6", volume: "M4 9h4l5-4v14l-5-4H4z M17 8a5 5 0 0 1 0 8 M19.5 5.5a9 9 0 0 1 0 13",
  zoomIn: "M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14z M21 21l-5-5 M8 11h6 M11 8v6", zoomOut: "M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14z M21 21l-5-5 M8 11h6",
  search: "M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14z M21 21l-5-5", export: "M12 4v12 M7 11l5 5 5-5 M4 20h16", close: "M6 6l12 12 M18 6L6 18",
  plus: "M12 5v14 M5 12h14", minus: "M5 12h14", check: "M5 12l5 5 9-10", cloud: "M7 18a5 5 0 0 1-.5-10A6 6 0 0 1 18 9a4.5 4.5 0 0 1-.5 9z",
  speed: "M12 13l4-4 M4 17a8 8 0 1 1 16 0", crop: "M6 3v15h15 M3 6h15v15", rotate: "M20 12a8 8 0 1 1-2.3-5.7 M20 4v5h-5", flip: "M12 3v18 M8 7L3 17h5z M16 7l5 10h-5z",
  keyframe: "M12 4l8 8-8 8-8-8z", reverse: "M4 12a8 8 0 0 1 14-5.3 M18 3v4h-4 M20 12a8 8 0 0 1-14 5.3 M6 21v-4h4", freeze: "M12 3v18 M5 7l14 10 M19 7L5 17",
  detach: "M4 8h10 M4 16h10 M17 6l3 2-3 2 M17 14l3 2-3 2", ripple: "M3 12h6 M15 12h6 M9 8v8 M15 8v8 M12 10v4", slip: "M4 12h16 M7 9l-3 3 3 3 M17 9l3 3-3 3 M9 6h6v12H9z",
  roll: "M12 4v16 M8 9l-3 3 3 3 M16 9l3 3-3 3", slide: "M3 8h4v8H3z M17 8h4v8h-4z M9 10h6v4H9z", select: "M5 3l14 9-6 1.5L10 20z",
  sun: "M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8z M12 2v2 M12 20v2 M2 12h2 M20 12h2 M5 5l1.5 1.5 M17.5 17.5L19 19 M5 19l1.5-1.5 M17.5 6.5L19 5",
  moon: "M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z", globe: "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z M3 12h18 M12 3c3 3.5 3 14.5 0 18 M12 3c-3 3.5-3 14.5 0 18",
  fit: "M4 9V4h5 M20 9V4h-5 M4 15v5h5 M20 15v5h-5", film: "M4 4h16v16H4z M8 4v16 M16 4v16 M4 8h4 M4 12h4 M4 16h4 M16 8h4 M16 12h4 M16 16h4",
  image: "M4 5h16v14H4z M4 16l5-5 4 4 2-2 5 5", wave: "M3 12h2 M7 8v8 M11 5v14 M15 9v6 M19 11v2 M21 12h0", gear: "M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6z M19 12l2-1-1-3-2 .3-1.4-1.4.3-2-3-1-1 2h-2l-1-2-3 1 .3 2L6.3 7.3 4 7l-1 3 2 1v2l-2 1 1 3 2.3-.3 1.4 1.4-.3 2 3 1 1-2h2l1 2 3-1-.3-2 1.4-1.4 2 .3 1-3-2-1z",
  wand: "M4 20L15 9 M14 4v3 M19 9h-3 M17.5 5.5l-2 2 M12 3l.5 1.5 M20 11l1.5.5", sparkle: "M12 3l2 6 6 2-6 2-2 6-2-6-6-2 6-2z", users: "M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z M2 21a7 7 0 0 1 14 0 M17 3a4 4 0 0 1 0 8 M22 21a7 7 0 0 0-4-6.3",
  grip: "M9 6h.01 M15 6h.01 M9 12h.01 M15 12h.01 M9 18h.01 M15 18h.01", beat: "M3 12h3l2-6 3 12 3-9 2 3h5", denoise: "M3 12c2-4 4-4 6 0s4 4 6 0 4-4 6 0 M5 18h14",
  home: "M3 11l9-7 9 7 M5 10v10h14V10",
};
export type IconName = keyof typeof P | string;
export function Icon({ name, size = 16, style, label }: { name: IconName; size?: 14 | 16 | 18 | 20 | 22 | 24; style?: CSSProperties; label?: string }) {
  const d = P[name] || P.sparkle;
  return (
    <svg className={"ns-ic" + (size !== 16 ? " s" + size : "")} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round"
      aria-hidden={label ? undefined : true} role={label ? "img" : undefined} aria-label={label} style={style}>
      {d.split(" M").map((seg, i) => <path key={i} d={(i ? "M" : "") + seg} />)}
    </svg>
  );
}
export const ICON_NAMES = Object.keys(P);
