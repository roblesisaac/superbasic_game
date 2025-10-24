const gameOverElement = document.getElementById("gameOver");
const gameOverPanelElement = document.getElementById("gameOverPanel");

if (!(gameOverElement instanceof HTMLDivElement)) {
  throw new Error("Unable to locate game over container element.");
}

if (!(gameOverPanelElement instanceof HTMLDivElement)) {
  throw new Error("Unable to locate game over panel element.");
}

export const gameOverContainer: HTMLDivElement = gameOverElement;
export const gameOverPanel: HTMLDivElement = gameOverPanelElement;
