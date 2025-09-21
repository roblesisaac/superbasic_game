import type { SectionDefinition } from './sections.js';

export const sectionsDb: SectionDefinition[] = [
  {
    id: 'salary',
    title: 'Salary',
    heightFeet: 100,
    gates: {
      top: [{ position: 50 }],
    },
    collectibles: [
      {
        offsetFeet: 20,
        xPercent: 50,
        formation: 'line',
        count: 6,
        title: 'Salary',
        value: 1225,
        type: 'income',
        spreadFeet: 4,
      },
    ],
    metadata: { budgetCategory: 'Salary' },
  },
  {
    id: 'mcdonalds',
    title: "McDonald's",
    heightFeet: 100,
    gates: {
      top: [{ position: 60 }],
    },
    enemies: [3],
    metadata: { budgetCategory: "McDonald's" },
  },
  {
    id: 'amazon',
    title: 'Amazon',
    heightFeet: 100,
    gates: {
      top: [{ position: 40 }],
    },
    enemies: [4],
    metadata: { budgetCategory: 'Amazon' },
  },
  {
    id: 'gas-1',
    title: 'Gas',
    heightFeet: 100,
    gates: {
      top: [{ position: 45 }],
    },
    enemies: [2],
    metadata: { budgetCategory: 'Gas' },
  },
  {
    id: 'bonus',
    title: 'Bonus',
    heightFeet: 100,
    gates: {
      top: [{ position: 55 }],
    },
    collectibles: [
      {
        offsetFeet: 18,
        xPercent: 40,
        formation: 'square',
        count: 4,
        title: 'Bonus',
        value: 500,
        type: 'income',
        spreadFeet: 3,
      },
      {
        offsetFeet: 40,
        xPercent: 65,
        formation: 'line',
        count: 3,
        title: 'Bonus',
        value: 500,
        type: 'income',
        spreadFeet: 2,
      },
    ],
    metadata: { budgetCategory: 'Bonus' },
  },
  {
    id: 'rent',
    title: 'Rent',
    heightFeet: 100,
    gates: {
      top: [{ position: 35 }],
    },
    enemies: [6],
    metadata: { budgetCategory: 'Rent' },
  },
  {
    id: 'gas-2',
    title: 'Gas',
    heightFeet: 100,
    gates: {
      top: [{ position: 55 }],
    },
    enemies: [4],
    metadata: { budgetCategory: 'Gas' },
  },
  {
    id: 'groceries',
    title: 'Groceries',
    heightFeet: 100,
    gates: {
      top: [{ position: 50 }],
    },
    enemies: [5],
    metadata: { budgetCategory: 'Groceries' },
  },
  {
    id: 'insurance',
    title: 'Insurance',
    heightFeet: 100,
    gates: {
      top: [{ position: 48 }],
    },
    enemies: [5],
    metadata: { budgetCategory: 'Insurance' },
  },
];

export default sectionsDb;
