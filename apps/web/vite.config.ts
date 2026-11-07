import { fileURLToPath, URL } from "node:url";
import { readFile } from "node:fs/promises";
import { cloudflare } from "@cloudflare/vite-plugin";
import react, { reactCompilerPreset } from "@vitejs/plugin-react";
import babel from "@rolldown/plugin-babel";
import { defineConfig, lazyPlugins, type Plugin } from "vite-plus";
import tailwindcss from "@tailwindcss/vite";
import { tanstackRouter } from "@tanstack/router-plugin/vite";

const devDataset: Plugin = {
  name: "cqa-dev-dataset",
  apply: "serve",
  configureServer(server) {
    server.middlewares.use("/__cqa_dev_dataset", (request, response, next) => {
      if (request.method !== "GET" || request.url !== "/") return next();
      response.setHeader("Cache-Control", "no-store");
      void readFile(new URL("../../data/invoke.json", import.meta.url)).then(
        (body) => {
          response.setHeader("Content-Type", "application/json");
          response.end(body);
        },
        () => {
          response.statusCode = 404;
          response.end("Local DEV dataset unavailable");
        },
      );
    });
  },
};

export default defineConfig(({ mode }) => ({
  plugins: lazyPlugins(() => [
    devDataset,
    tanstackRouter({ target: "react", autoCodeSplitting: true, quoteStyle: "double" }),
    react(),
    babel({ presets: [reactCompilerPreset()] }),
    tailwindcss(),
    cloudflare({
      inspectorPort: mode === "test" ? false : undefined,
      configPath: process.env.CLOUDFLARE_CONFIG_PATH ?? "../api/wrangler.jsonc",
      persistState: {
        path:
          process.env.CLOUDFLARE_STATE_PATH ??
          fileURLToPath(new URL("../../.wrangler/state", import.meta.url)),
      },
    }),
  ]),
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
}));
