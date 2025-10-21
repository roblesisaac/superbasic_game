import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    outDir: 'dist',
    sourcemap: true
  },
  server: {
    port: 5174,
    open: true,
    host: true,
    hmr: {
      port: 5174
    }
  },
  esbuild: {
    target: 'es2020'
  },
  publicDir: 'public'
});
