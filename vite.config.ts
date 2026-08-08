import { readFileSync } from "node:fs";
import react from "@vitejs/plugin-react-swc";
import { defineConfig, type Plugin } from "vite";

// dev サーバーでも本番と同じ /items.json を返す（data/items.json を都度読む）。
// 本番は scripts/build_site.mjs が _site/items.json を書き出す。
const ALLOWED_SOURCES = new Set(["app_store", "google_play"]);

function serveItemsJson(): Plugin {
  return {
    name: "serve-items-json",
    configureServer(server) {
      server.middlewares.use("/items.json", (_req, res) => {
        const raw = readFileSync("data/items.json", "utf8");
        const items = JSON.parse(raw).filter((item: { source: string }) =>
          ALLOWED_SOURCES.has(item.source),
        );
        res.setHeader("Content-Type", "application/json");
        res.end(JSON.stringify(items));
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), serveItemsJson()],
  // 既定ポートが埋まっているときに割り当てられたポートで起動できるようにする
  server: process.env.PORT ? { port: Number(process.env.PORT) } : undefined,
  build: {
    outDir: "_site",
    emptyOutDir: true,
  },
});
