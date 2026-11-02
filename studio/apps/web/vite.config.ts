import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";

// web (default): built into the site's public/studio (served by the nooi.ai server at /studio/ — no build step on the server)
// desktop / mobile: built into the app's own folder with relative paths; the server is VITE_SITE (https://nooi.ai by default)
export default defineConfig(({ mode }) => {
  const app = mode === "desktop" || mode === "mobile";
  const out = mode === "desktop" ? "../desktop/dist" : mode === "mobile" ? "../mobile/dist" : "../../../public/studio";
  if (app && !process.env.VITE_SITE) process.env.VITE_SITE = "https://nooi.ai";
  return {
    base: app ? "./" : "/studio/",
    plugins: [react()],
    build: { outDir: fileURLToPath(new URL(out, import.meta.url)), emptyOutDir: true, target: "es2022", sourcemap: false, chunkSizeWarningLimit: 1500 },
    server: { port: 5199, proxy: { "/v1": "http://localhost:8080", "/media": "http://localhost:8080", "/render-api": { target: "http://localhost:8080", ws: true } } },
  };
});
