import { budgetData } from './budget.js';

export let showSettings = false;
export let asciiArtEnabled = true;

export function toggleSettings(): void {
  showSettings = !showSettings;
}

export function hideSettings(): void {
  showSettings = false;
}

export function showSettingsPanel(): void {
  showSettings = true;
}

export function setAsciiArtEnabled(value: boolean): void {
  asciiArtEnabled = !!value;
}

export function getBudgetData() {
  return budgetData;
}
