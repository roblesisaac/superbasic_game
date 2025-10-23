import { budgetData } from '../controllers/budget_controller.js';

export let showSettings = false;

export function toggleSettings(): void {
  showSettings = !showSettings;
}

export function hideSettings(): void {
  showSettings = false;
}

export function showSettingsPanel(): void {
  showSettings = true;
}

export function getBudgetData() {
  return budgetData;
}
