// Import styles
import './styles/game.css';

// Starfield background
import './environment/starfield';

// Import and start the game
import '../defold/runtime/game_app.js';

// Register service worker
if (import.meta.env.PROD && "serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("/service-worker.js")
      .catch((err) => console.error("SW registration failed:", err));
  });
}
