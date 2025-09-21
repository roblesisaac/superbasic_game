import type { SectionDefinition } from './sections.js';

const defaultSections: SectionDefinition[] = [
  {
    id: 'intro',
    title: 'Welcome Walkway',
    heightFeet: 20,
    widthPercent: 100,
    theme: { background: '#0b0f1d' },
    gates: {
      top: [{ position: 50, width: 38 }],
    },
    enemies: [],
    collectibles: [],
    metadata: { difficulty: 'easy' },
  },
  {
    id: 'mid',
    title: 'Budget Bend',
    heightFeet: 20,
    widthPercent: 90,
    theme: { background: '#101828' },
    gates: {
      top: [{ position: 35, width: 32 }],
    },
    enemies: [2],
    collectibles: [],
    metadata: { difficulty: 'medium' },
  },
  {
    id: 'summit',
    title: 'Fiscal Summit',
    heightFeet: 20,
    widthPercent: 100,
    theme: { background: '#182235' },
    gates: {
      top: [{ position: 65, width: 30 }],
    },
    enemies: [3],
    collectibles: [],
    metadata: { difficulty: 'hard' },
  },
];

export default defaultSections;
