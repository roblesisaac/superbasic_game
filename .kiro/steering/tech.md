---
inclusion: always
---

# Technology Stack

## Build System

- Vite 6.x bundler with TypeScript (ES2020 target, ESNext modules)
- TypeScript strict mode is **disabled** - avoid strict-only patterns
- Node.js >= 18.0.0 required

## Runtime Environment

- Vanilla TypeScript/JavaScript - **no frameworks or external runtime dependencies**
- Canvas 2D API for all rendering
- Service Worker for PWA offline support

## Development Commands

```bash
npm run dev      # Dev server on port 5173
npm run build    # Production build to dist/
npm run preview  # Preview production build
```

## Build Output

- Output: `dist/` directory
- Public assets: `public/` directory (copied as-is)
- Source maps enabled in production
