// Import styles
import '../styles.css';

// Import and start the game
import './game.ts';

// Register service worker
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("/service-worker.js")
      .catch((err) => console.error("SW registration failed:", err));
  });
}
