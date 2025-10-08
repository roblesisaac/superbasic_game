// Import styles
import './styles/styles.css';

// Starfield background
import './ui/starfield';

// Import and start the game
import './core/game.js';

// Register service worker
if (import.meta.env.PROD && "serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("/service-worker.js")
      .catch((err) => console.error("SW registration failed:", err));
  });
}
