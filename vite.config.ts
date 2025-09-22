import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    outDir: 'dist',
    sourcemap: true
  },
  server: {
    port: 5173,
    open: true,
    host: true,
    hmr: {
      port: 5173
    }
  },
  esbuild: {
    target: 'es2020'
  },
  publicDir: 'public'
});
