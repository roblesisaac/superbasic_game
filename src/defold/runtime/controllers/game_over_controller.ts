import { gameOverContainer, gameOverPanel } from '../state/ui_state.js';
import { gameStats } from '../../modules/budget.js';

export type GameOverRestartHandler = () => void;

export function presentGameOverScreen(onRestart: GameOverRestartHandler): void {
  let html = '<div style="color: white; font-family: Arial; font-size: 18px;"><h2>Final Budget Report</h2>';
  let totalNet = 0;

  for (const [title, stats] of Object.entries(gameStats)) {
    const isIncome = stats.target > 0;
    const percentage = Math.round((stats.collected / Math.abs(stats.target)) * 100);
    const color = isIncome ? '#4CAF50' : '#F44336';

    html += `<div style="margin: 10px 0; color: ${color};">`;
    html += `<strong>${title}:</strong> `;

    if (isIncome) {
      html += `Collected ${stats.collected} of ${stats.target} (${percentage}%)`;
      totalNet += stats.collected;
    } else {
      html += `Avoided ${stats.target - stats.collected} of ${Math.abs(stats.target)} expenses`;
      totalNet += stats.target + stats.collected;
    }
    html += '</div>';
  }

  const netColor = totalNet >= 0 ? '#4CAF50' : '#F44336';
  html += `<div style="margin: 20px 0; font-size: 24px; color: ${netColor}; border-top: 2px solid white; padding-top: 10px;">`;
  html += `<strong>Net Result: ${totalNet.toFixed(2)}</strong>`;
  html += '</div></div>';
  html += '<button id="tryAgainBtn" style="margin-top: 20px; padding: 10px 20px; font-size: 18px; background: #4CAF50; color: white; border: none; border-radius: 6px; cursor: pointer;">Try Again</button>';

  gameOverPanel.innerHTML = html;
  const restartButton = document.getElementById('tryAgainBtn');
  restartButton?.addEventListener('click', onRestart);

  gameOverContainer.style.display = 'flex';
}

export function hideGameOverScreen(): void {
  gameOverContainer.style.display = 'none';
}
