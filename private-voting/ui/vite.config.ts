process.env.VITE_TLA_FORCE_WASM = "true";
import path from "path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import wasm from "vite-plugin-wasm";
import topLevelAwait from "vite-plugin-top-level-await";
import { nodePolyfills } from "vite-plugin-node-polyfills";
import _commonjs from "@originjs/vite-plugin-commonjs";

// Handle CJS/ESM default export differences safely
const commonjs = (typeof _commonjs === "function"
  ? _commonjs
  : (_commonjs as any).default || (_commonjs as any).viteCommonjs) as any;

// Keep wasm, topLevelAwait, nodePolyfills, and commonjs. Vite 7 native TLA is
// not a substitute — Midnight WASM needs these plugins or the published page
// is a blank #root even when dist/index.html exists. If a plugin import fails,
// install the package; do not delete the plugin.

export default defineConfig({
  base: './',
  plugins: [
    react(),
    tailwindcss(),
    wasm(),
    topLevelAwait(),
    commonjs(),
    nodePolyfills({
      include: ["buffer", "process", "util", "crypto", "stream"],
      globals: { Buffer: true, process: true },
    }),
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    target: "esnext",
    minify: false,
  },
});
