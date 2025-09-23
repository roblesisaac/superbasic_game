import type { CardBlueprint } from './cards.js';

export const SAMPLE_CARDS: CardBlueprint[] = [
  {
    id: 'card-intro',
    title: 'Entry Ledger',
    heightPct: 100,
    widthPct: 100,
    gates: {
      top: { width: 100, gate: true }
    },
    enemies: [{ difficulty: 10, count: 2 }],
    difficulty: 8,
    theme: { bgColor: '#12263a' }
  },
  {
    id: 'card-offset',
    title: 'Offset Hallway',
    heightPct: 110,
    gates: {
      top: [
        { width: 55, gate: { position: 45 } },
        { width: 45, y: 120 }
      ]
    },
    enemies: [{ difficulty: 18, count: 3 }],
    difficulty: 14,
    theme: { bgColor: '#19344d' }
  },
  {
    id: 'card-switchback',
    title: 'Switchback Gallery',
    heightPct: 95,
    gates: {
      top: [
        { width: 40 },
        { width: 35, y: -110, gate: { position: 35 } },
        { width: 25, y: 160 }
      ]
    },
    enemies: [{ difficulty: 30, count: 4 }],
    difficulty: 22,
    theme: { bgColor: '#162a3c' }
  },
  {
    id: 'card-vertical',
    title: 'Column Vault',
    heightPct: 120,
    gates: {
      top: [
        { width: 32 },
        { type: 'vertical', height: 240, gate: { position: 55 } },
        { width: 68, y: -90 }
      ]
    },
    enemies: [{ difficulty: 38, count: 3 }],
    difficulty: 28,
    theme: { bgColor: '#102033' }
  },
  {
    id: 'card-crossover',
    title: 'Crossover Array',
    heightPct: 105,
    gates: {
      top: [
        { width: 30, gate: { position: 70 } },
        { width: 45, y: 140 },
        { width: 25, y: -120 },
        { width: 20, y: 80 }
      ]
    },
    enemies: [{ difficulty: 42, count: 4 }],
    difficulty: 34,
    theme: { bgColor: '#1a2f49' }
  },
  {
    id: 'card-staggered',
    title: 'Staggered Loop',
    heightPct: 90,
    gates: {
      top: {
        segments: [
          { width: 28 },
          { width: 44, y: -80, gate: { position: 30, width: 48 } },
          { width: 28, y: 120 }
        ]
      }
    },
    enemies: [{ difficulty: 26, count: 2 }],
    difficulty: 20,
    theme: { bgColor: '#15263b' }
  },
  {
    id: 'card-suspension',
    title: 'Suspension Span',
    heightPct: 130,
    gates: {
      top: [
        { width: 36 },
        { type: 'vertical', height: 260 },
        { width: 64, y: -140, gate: { position: 40 } }
      ]
    },
    enemies: [{ difficulty: 48, count: 5 }],
    difficulty: 40,
    theme: { bgColor: '#0f2134' }
  },
  {
    id: 'card-escalate',
    title: 'Escalate Landing',
    heightPct: 100,
    gates: {
      top: [
        { width: 50, gate: { position: 50, width: 60 } },
        { width: 30, y: 100 },
        { width: 20, y: -150 }
      ]
    },
    enemies: [{ difficulty: 35, count: 3 }],
    difficulty: 26,
    theme: { bgColor: '#1b2f4b' }
  },
  {
    id: 'card-arcade',
    title: 'Arcade Balcony',
    heightPct: 115,
    gates: {
      top: [
        { width: 38, gate: { position: 60 } },
        { width: 34, y: -90 },
        { width: 28, y: 140 }
      ]
    },
    enemies: [{ difficulty: 32, count: 4 }],
    difficulty: 30,
    theme: { bgColor: '#14283e' }
  },
  {
    id: 'card-lantern',
    title: 'Lantern Spire',
    heightPct: 140,
    gates: {
      top: [
        { width: 24 },
        { type: 'vertical', height: 300, gate: { position: 35 } },
        { width: 76, y: -120 }
      ]
    },
    enemies: [{ difficulty: 55, count: 5 }],
    difficulty: 46,
    theme: { bgColor: '#101f31' }
  }
];
