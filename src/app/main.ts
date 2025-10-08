import '../styles/base.css';
import { fitCanvasToDisplay, resolveCanvasElement } from './platform/canvas';
import { GameEngine } from './runtime/engine';
import { createMainCollection } from '../defold/collections/main.collection';

document.addEventListener('DOMContentLoaded', () => {
  const canvas = resolveCanvasElement('gameCanvas');
  const engine = new GameEngine(canvas, {
    logicalSize: { x: 320, y: 180 },
    clearColor: '#04040d'
  });

  fitCanvasToDisplay(canvas);
  engine.loadCollection(createMainCollection);
  engine.start();
});
