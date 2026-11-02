import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";

// built into the site's public/studio (served by the nooi.ai server at /studio/ — no build step on the server)
export default defineConfig({
  base: "/studio/",
  plugins: [react()],
  build: { outDir: fileURLToPath(new URL("../../../public/studio", import.meta.url)), emptyOutDir: true, target: "es2022", sourcemap: false, chunkSizeWarningLimit: 1500 },
  server: { port: 5199, proxy: { "/v1": "http://localhost:8787", "/media": "http://localhost:8787" } },
});
