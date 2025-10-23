import { gameOverContainer, gameOverPanel } from '../state/ui_state.js';
import { gameStats } from '../../defold/runtime/controllers/budget_controller.js';

export type GameOverRestartHandler = () => void;

export function presentGameOverScreen(onRestart: GameOverRestartHandler): void {
  gameOverPanel.innerHTML = '';

  const scanOverlay = document.createElement('div');
  scanOverlay.className = 'game-over__scan';
  gameOverPanel.appendChild(scanOverlay);

  const title = document.createElement('h2');
  title.className = 'game-over__title';
  title.textContent = 'FINAL BUDGET REPORT';
  gameOverPanel.appendChild(title);

  const statsList = document.createElement('div');
  statsList.className = 'game-over__stats';
  gameOverPanel.appendChild(statsList);

  let totalNet = 0;

  for (const [titleText, stats] of Object.entries(gameStats)) {
    const isIncome = stats.target > 0;
    const percentage = Math.round((stats.collected / Math.max(1, Math.abs(stats.target))) * 100);
    const stat = document.createElement('div');
    stat.className = `game-over__stat ${isIncome ? 'game-over__stat--income' : 'game-over__stat--expense'}`;

    const label = document.createElement('div');
    label.className = 'game-over__label';
    label.textContent = titleText;
    stat.appendChild(label);

    const detail = document.createElement('div');
    detail.className = 'game-over__detail';
    if (isIncome) {
      detail.textContent = `COLLECTED ${stats.collected} / ${stats.target} (${percentage}%)`;
      totalNet += stats.collected;
    } else {
      const avoided = stats.target - stats.collected;
      detail.textContent = `AVOIDED ${Math.max(0, avoided)} / ${Math.abs(stats.target)} (${percentage}%)`;
      totalNet += stats.target + stats.collected;
    }
    stat.appendChild(detail);

    statsList.appendChild(stat);
  }

  const netLine = document.createElement('div');
  netLine.className = `game-over__net ${totalNet >= 0 ? 'game-over__net--positive' : 'game-over__net--negative'}`;
  netLine.textContent = `NET RESULT: ${totalNet.toFixed(2)}`;
  gameOverPanel.appendChild(netLine);

  const button = document.createElement('button');
  button.type = 'button';
  button.id = 'tryAgainBtn';
  button.className = 'game-over__button';
  button.textContent = 'REBOOT MISSION';
  button.addEventListener('click', (event) => {
    event.preventDefault();
    onRestart();
  });
  gameOverPanel.appendChild(button);

  gameOverContainer.style.display = 'flex';
}

export function hideGameOverScreen(): void {
  gameOverContainer.style.display = 'none';
}
