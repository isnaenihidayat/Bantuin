import { resolve } from "node:path";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@bantuin/client": resolve(import.meta.dirname, "../../packages/client/src/index.ts"),
    },
  },
  build: { outDir: "../../dist/web", emptyOutDir: true },
  server: {
    port: 5173,
    proxy: { "/v1": "http://127.0.0.1:4310", "/health": "http://127.0.0.1:4310" },
  },
});
