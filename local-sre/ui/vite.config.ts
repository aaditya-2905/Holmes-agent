import { defineConfig } from "vite";
import preact from "@preact/preset-vite";

export default defineConfig({
  plugins: [preact()],
  build: {
    target: "es2022",
    cssMinify: true,
    modulePreload: { polyfill: false },
    reportCompressedSize: false,
  },
  server: {
    proxy: { "/api": "http://127.0.0.1:5050", "/healthz": "http://127.0.0.1:5050" },
  },
});
