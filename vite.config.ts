import { defineConfig } from 'vite';

export default defineConfig({
  root: '.', // Root directory (where index.html is located)
  build: {
    outDir: 'dist',
    sourcemap: true,
    rollupOptions: {
      input: {
        main: './index.html'
      }
    }
  },
  server: {
    port: 5173,
    open: true
  },
  // Handle TypeScript files
  esbuild: {
    target: 'es2020'
  },
  // Copy service worker and other static assets
  publicDir: 'public'
});
