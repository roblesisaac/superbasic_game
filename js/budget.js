import {
    TOTAL_ITEMS, MAX_ITEMS_PER_SECTION, GROUP_SPACING, ITEM_SPACING,
    PIXELS_PER_FOOT, ENEMY_SPAWN_CHANCE,
    DEFAULT_BUDGET_DATA
  } from './constants.js';
  import { Collectible } from './collectibles.js';
  import { Enemy } from './enemies.js';
  import { groundY, canvasWidth } from './globals.js';
  
  export let budgetData = [...DEFAULT_BUDGET_DATA];
  export let budgetSections = [];
  export let collectibles = [];
  export let enemies = [];
  export let gameStats = {};
  export let preloadedSections = new Set();
  export let createdGates = new Set();
  
  export function resetBudgetContainers() {
    collectibles.length = 0;
    enemies.length = 0;
    preloadedSections.clear();
    createdGates.clear();
  }
  
  // formations
  const FORMATIONS = {
    line: (count, ITEM_SPACING) => {
      const positions = [];
      for (let i = 0; i < count; i++) positions.push({ x: i * ITEM_SPACING, y: 0 });
      return positions;
    },
    square: (count, ITEM_SPACING) => {
      if (count === 4) {
        return [
          { x: 0, y: 0 },
          { x: ITEM_SPACING, y: 0 },
          { x: 0, y: ITEM_SPACING },
          { x: ITEM_SPACING, y: ITEM_SPACING }
        ];
      }
      return FORMATIONS.line(count, ITEM_SPACING);
    },
    triangle: (count, ITEM_SPACING) => {
      if (count === 3) {
        return [
          { x: ITEM_SPACING/2, y: 0 },
          { x: 0, y: ITEM_SPACING },
          { x: ITEM_SPACING, y: ITEM_SPACING }
        ];
      }
      return FORMATIONS.line(count, ITEM_SPACING);
    },
    pyramid: (count, ITEM_SPACING) => {
      if (count === 6) {
        return [
          { x: 0, y: ITEM_SPACING },
          { x: ITEM_SPACING, y: ITEM_SPACING },
          { x: ITEM_SPACING * 2, y: ITEM_SPACING },
          { x: ITEM_SPACING/2, y: 0 },
          { x: ITEM_SPACING * 1.5, y: 0 },
          { x: ITEM_SPACING, y: -ITEM_SPACING },
        ];
      }
      return FORMATIONS.line(count, ITEM_SPACING);
    }
  };
  
  export function calculateBudgetSections() {
    const totalAmount = budgetData.reduce((sum, [_, amount]) => sum + Math.abs(amount), 0);
    budgetSections = [];
    gameStats = {};
    let currentFeet = 0;
  
    for (const [title, amount] of budgetData) {
      const percentage = Math.abs(amount) / totalAmount;
      const itemCount = Math.round(TOTAL_ITEMS * percentage);
      const sectionsNeeded = Math.ceil(itemCount / MAX_ITEMS_PER_SECTION);
  
      gameStats[title] = { target: amount, collected: 0, total: itemCount };
  
      for (let i = 0; i < sectionsNeeded; i++) {
        const itemsInThis = Math.min(MAX_ITEMS_PER_SECTION, itemCount - (i * MAX_ITEMS_PER_SECTION));
        budgetSections.push({
          title, amount, itemCount: itemsInThis,
          startFeet: currentFeet, endFeet: currentFeet + 100,
          spawned: 0
        });
        currentFeet += 100;
      }
    }
  }
  
  function createFormationGroup(baseX, baseY, groupSize, title, value, type) {
    const keys = Object.keys(FORMATIONS);
    const formationType = keys[Math.floor(Math.random() * keys.length)];
    const positions = FORMATIONS[formationType](groupSize, ITEM_SPACING);
    return positions.map(pos => new Collectible(baseX + pos.x, baseY + pos.y, value, title, type));
  }
  
  export function preloadSectionCollectibles(sectionIndex, gates = []) {
    if (preloadedSections.has(sectionIndex)) return;
    const section = budgetSections[sectionIndex];
    if (!section) return;

    const sectionBaseY = groundY - section.startFeet * PIXELS_PER_FOOT;
    const sectionHeight = 100 * PIXELS_PER_FOOT;
    const type = section.amount > 0 ? 'income' : 'expense';

    let itemsToPlace = section.itemCount;
    let currentY = sectionBaseY - 50;

    // Spawn collectibles
    while (itemsToPlace > 0) {
      const groupSize = Math.min(itemsToPlace, Math.floor(Math.random() * 4) + 3);
      const groupBaseX = Math.random() * (canvasWidth - 100) + 50;
      const group = createFormationGroup(groupBaseX, currentY, groupSize, section.title, section.amount, type);
      collectibles.push(...group);
      itemsToPlace -= groupSize;
      currentY -= GROUP_SPACING;
      if (currentY < sectionBaseY - sectionHeight + 100) currentY = sectionBaseY - 50;
    }

    // Spawn enemies on gates for expense sections
    if (type === 'expense') {
      spawnEnemiesInSection(sectionIndex, gates);
    }

    preloadedSections.add(sectionIndex);
  }

  function spawnEnemiesInSection(sectionIndex, gates) {
    const section = budgetSections[sectionIndex];
    if (!section || !gates) return;

    const sectionStartY = groundY - section.startFeet * PIXELS_PER_FOOT;
    const sectionEndY = groundY - section.endFeet * PIXELS_PER_FOOT;

    // Find gates within this section
    const sectionGates = gates.filter(gate => 
      gate.y <= sectionStartY && gate.y >= sectionEndY
    );

    // Spawn enemies on gates in this section with some randomness
    for (const gate of sectionGates) {
      if (Math.random() < ENEMY_SPAWN_CHANCE) {
        const enemyCount = Math.floor(Math.random() * 2) + 1;
        
        for (let i = 0; i < enemyCount; i++) {
          const rects = gate.getRects();
          if (rects.length > 0) {
            // Choose a random platform segment
            const rect = rects[Math.floor(Math.random() * rects.length)];
            
            // Position enemy on the platform
            const enemyX = rect.x + Math.random() * rect.w;
            const enemyY = rect.y + rect.h / 2;
            
            const enemy = new Enemy(enemyX, enemyY, gate);
            enemies.push(enemy);
          }
        }
      }
    }
  }
  