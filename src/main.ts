// Import styles
import './styles/styles.css';

// Ensure orientation guard is ready before booting the game
import { initOrientationHandling } from './core/orientation.js';

initOrientationHandling();

// Import and start the game lazily so orientation setup runs first
void import('./core/game.js');

// Register service worker
if (import.meta.env.PROD && "serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("/service-worker.js")
      .catch((err) => console.error("SW registration failed:", err));
  });
}
