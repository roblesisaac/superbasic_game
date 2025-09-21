import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    outDir: 'dist',
    sourcemap: true
  },
  server: {
    port: 5173,
    open: true
  },
  esbuild: {
    target: 'es2020'
  },
  publicDir: 'public'
});
