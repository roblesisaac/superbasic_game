import { defineConfig } from "vite";
import path from "path";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"), // 👈 add this line
    },
  },
  build: {
    outDir: "dist",
    sourcemap: true,
  },
  server: {
    port: 5174,
    open: true,
    host: true,
    hmr: { port: 5174 },
  },
  esbuild: { target: "es2020" },
  publicDir: "public",
});
