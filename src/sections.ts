import { ControlledGate, type GateSpecObject } from './controlledGate.js';
import { PIXELS_PER_FOOT } from './constants.js';
import { canvasWidth, groundY } from './globals.js';
import defaultSectionDefinitions from './sectionsDb.js';
import { budgetSections } from './budget.js';

export type SectionGateSet = {
  top?: GateSpecObject[];
};

export type CollectibleSpawn = {
  offsetFeet: number;
  xPercent?: number;
  formation?: 'line' | 'square' | 'triangle' | 'pyramid' | string;
  count: number;
  title?: string;
  value?: number;
  type?: 'income';
  spreadFeet?: number;
  staggerSeconds?: number;
};

export type SectionDefinition = {
  id?: string;
  title?: string;
  heightFeet?: number;
  widthPercent?: number;
  theme?: {
    background?: string;
  };
  gates?: SectionGateSet;
  enemies?: number[];
  collectibles?: CollectibleSpawn[];
  metadata?: Record<string, unknown>;
};

export interface SectionState {
  id: string;
  index: number;
  title: string;
  heightFeet: number;
  widthPercent: number;
  theme: { background: string };
  gates: SectionGateSet;
  enemies: number[];
  collectibles: CollectibleSpawn[];
  metadata?: Record<string, unknown>;
  startFeet: number;
  endFeet: number;
  active: boolean;
}

interface SectionInternal extends SectionState {
  gatesInstances: ControlledGate[];
  gatesCreated: boolean;
  gateHandled: boolean[];
}

const DEFAULT_THEME = '#000';
const DEFAULT_GATE_SPEC: GateSpecObject = {};

let storedDefinitions: SectionDefinition[] = [];
let sections: SectionInternal[] = [];

function cloneDefinition(definition: SectionDefinition): SectionDefinition {
  return {
    ...definition,
    theme: definition.theme ? { ...definition.theme } : undefined,
    gates: definition.gates
      ? {
          top: definition.gates.top ? definition.gates.top.map((spec) => ({ ...spec })) : undefined,
        }
      : undefined,
    enemies: definition.enemies ? [...definition.enemies] : undefined,
    collectibles: definition.collectibles
      ? definition.collectibles.map((spawn) => ({ ...spawn }))
      : undefined,
    metadata: definition.metadata ? { ...definition.metadata } : undefined,
  };
}

function definitionForIndex(index: number): SectionDefinition | undefined {
  if (!storedDefinitions.length) return undefined;
  return storedDefinitions[index] ?? storedDefinitions[index % storedDefinitions.length];
}

function cloneGateSet(gates?: SectionGateSet): SectionGateSet {
  const top = gates?.top && gates.top.length > 0 ? gates.top.map((spec) => ({ ...spec })) : [
    { ...DEFAULT_GATE_SPEC },
  ];
  return { top };
}

function cloneCollectibles(spawns?: CollectibleSpawn[]): CollectibleSpawn[] {
  if (!spawns) return [];
  return spawns.map((spawn) => ({ ...spawn }));
}

function normalizeEnemies(enemies?: number[]): number[] {
  if (!Array.isArray(enemies)) return [];
  return enemies
    .map((value) => (typeof value === 'number' && Number.isFinite(value) ? value : 0))
    .filter((value) => value > 0);
}

function buildSection(
  index: number,
  startFeet: number,
  endFeet: number,
  definition?: SectionDefinition
): SectionInternal {
  const resolved = definition ? cloneDefinition(definition) : undefined;
  const id = resolved?.id ?? `${index}`;
  const title = resolved?.title ?? `Section ${id}`;
  const defaultHeight = endFeet > startFeet ? endFeet - startFeet : 20;
  const requestedHeight = resolved?.heightFeet ?? defaultHeight;
  const heightFeet = Math.max(1, requestedHeight);
  const widthPercent = Math.min(100, Math.max(5, resolved?.widthPercent ?? 100));
  const theme = {
    background: resolved?.theme?.background ?? DEFAULT_THEME,
  };
  const gates = cloneGateSet(resolved?.gates);
  const enemies = normalizeEnemies(resolved?.enemies);
  const collectibles = cloneCollectibles(resolved?.collectibles);
  const metadata = resolved?.metadata ? { ...resolved.metadata } : undefined;

  return {
    id,
    index,
    title,
    heightFeet,
    widthPercent,
    theme,
    gates,
    enemies,
    collectibles,
    metadata,
    startFeet,
    endFeet,
    active: false,
    gatesInstances: [],
    gatesCreated: false,
    gateHandled: [],
  };
}

function sectionTopY(section: SectionInternal): number {
  return groundY - section.endFeet * PIXELS_PER_FOOT;
}

function sectionWidthPixels(section: SectionInternal): { width: number; offsetX: number } {
  const width = (canvasWidth * section.widthPercent) / 100;
  const offsetX = (canvasWidth - width) / 2;
  return { width, offsetX };
}

function ensureGateHandledArray(section: SectionInternal) {
  if (section.gateHandled.length === section.gatesInstances.length) return;
  section.gateHandled = section.gatesInstances.map((_, index) => section.gateHandled[index] ?? false);
}

function createGatesForSection(section: SectionInternal): ControlledGate[] {
  const gateSpecs = section.gates.top && section.gates.top.length > 0 ? section.gates.top : [{ ...DEFAULT_GATE_SPEC }];
  const { width, offsetX } = sectionWidthPixels(section);
  const y = sectionTopY(section);

  return gateSpecs.map((spec) => {
    const gateDefinition = {
      width: 100,
      gate: spec && Object.keys(spec).length > 0 ? spec : true,
    };
    const gate = new ControlledGate({
      y,
      canvasWidth: width,
      definition: gateDefinition,
      xOffset: offsetX,
    });
    gate.sectionIndex = section.index;
    return gate;
  });
}

export function getSectionStates(): SectionState[] {
  return sections.map((section) => ({
    id: section.id,
    index: section.index,
    title: section.title,
    heightFeet: section.heightFeet,
    widthPercent: section.widthPercent,
    theme: { ...section.theme },
    gates: {
      top: section.gates.top ? section.gates.top.map((spec) => ({ ...spec })) : [],
    },
    enemies: [...section.enemies],
    collectibles: cloneCollectibles(section.collectibles),
    metadata: section.metadata ? { ...section.metadata } : undefined,
    startFeet: section.startFeet,
    endFeet: section.endFeet,
    active: section.active,
  }));
}

export function initializeSections(definitions: SectionDefinition[] = defaultSectionDefinitions): void {
  storedDefinitions = definitions.map(cloneDefinition);
  sections = [];

  if (budgetSections.length) {
    budgetSections.forEach((budgetSection, index) => {
      const template = definitionForIndex(index);
      const startFeet = budgetSection.startFeet;
      const endFeet = budgetSection.endFeet;
      sections.push(buildSection(index, startFeet, endFeet, template));
    });
  } else {
    let cursorFeet = 0;
    const source = storedDefinitions.length ? storedDefinitions : [DEFAULT_SECTION_FALLBACK];
    source.forEach((definition, index) => {
      const height = Math.max(1, definition.heightFeet ?? 20);
      const startFeet = cursorFeet;
      const endFeet = cursorFeet + height;
      cursorFeet = endFeet;
      sections.push(buildSection(index, startFeet, endFeet, definition));
    });
  }
}

const DEFAULT_SECTION_FALLBACK: SectionDefinition = {
  title: 'Section',
  gates: { top: [{ ...DEFAULT_GATE_SPEC }] },
};

type GateCreatedCallback = (section: SectionState, gate: ControlledGate, gateIndex: number) => void;

function currentSectionIndexForFeet(feet: number): number {
  if (!sections.length) return -1;
  for (let i = 0; i < sections.length; i++) {
    const section = sections[i];
    if (feet >= section.startFeet && feet < section.endFeet) return i;
  }
  return feet < sections[0].startFeet ? 0 : sections.length - 1;
}

export function ensureSectionsForSprite(
  spriteY: number,
  onGateCreated?: GateCreatedCallback,
): void {
  if (!sections.length) return;

  const currentFeet = Math.max(0, Math.floor((groundY - spriteY) / PIXELS_PER_FOOT));
  const currentIndex = currentSectionIndexForFeet(currentFeet);
  const activeIndices = new Set<number>();
  if (currentIndex >= 0) {
    activeIndices.add(currentIndex);
    if (currentIndex + 1 < sections.length) activeIndices.add(currentIndex + 1);
  }

  sections.forEach((section, index) => {
    const shouldBeActive = activeIndices.has(index);
    section.active = shouldBeActive;
    if (!shouldBeActive) return;

    if (!section.gatesCreated) {
      section.gatesInstances = createGatesForSection(section);
      section.gatesCreated = true;
      section.gateHandled = new Array(section.gatesInstances.length).fill(false);
    } else {
      ensureGateHandledArray(section);
    }

    if (!onGateCreated) return;

    section.gatesInstances.forEach((gate, gateIndex) => {
      if (section.gateHandled[gateIndex]) return;
      onGateCreated(section, gate, gateIndex);
      section.gateHandled[gateIndex] = true;
    });
  });
}

export function getActiveSectionGates(): ControlledGate[] {
  const gates: ControlledGate[] = [];
  for (const section of sections) {
    if (!section.active || !section.gatesCreated) continue;
    gates.push(...section.gatesInstances);
  }
  return gates;
}

export function refreshSectionsLayout(): void {
  for (const section of sections) {
    if (!section.gatesCreated) continue;
    const { width, offsetX } = sectionWidthPixels(section);
    const y = sectionTopY(section);
    section.gatesInstances.forEach((gate) => {
      gate.y = y;
      gate.setCanvasWidth(width, offsetX);
    });
  }
}

if (typeof window !== 'undefined') {
  window.addEventListener('resize', () => {
    refreshSectionsLayout();
  });
}

export function resetSections(): void {
  sections = [];
}

export function getSectionByIndex(index: number): SectionState | undefined {
  const section = sections[index];
  if (!section) return undefined;
  return {
    id: section.id,
    index: section.index,
    title: section.title,
    heightFeet: section.heightFeet,
    widthPercent: section.widthPercent,
    theme: { ...section.theme },
    gates: {
      top: section.gates.top ? section.gates.top.map((spec) => ({ ...spec })) : [],
    },
    enemies: [...section.enemies],
    collectibles: cloneCollectibles(section.collectibles),
    metadata: section.metadata ? { ...section.metadata } : undefined,
    startFeet: section.startFeet,
    endFeet: section.endFeet,
    active: section.active,
  };
}
