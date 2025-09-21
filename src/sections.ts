import { PIXELS_PER_FOOT } from './constants.js';
import {
  ControlledGate,
  CONTROLLED_GATE_PATTERNS,
  type ControlledGateDefinition,
  type GateGapSpec,
  type GateSpec,
  type SectionEdge,
} from './controlledGate.js';

export type SectionDifficulty = 'intro' | 'standard' | 'challenge' | 'boss';

export interface SectionTheme {
  background?: string;
}

export interface CollectibleSpawn {
  offsetFeet: number;
  xPercent?: number;
  formation?: 'line' | 'square' | 'triangle' | 'pyramid' | string;
  count: number;
  title?: string;
  value?: number;
  type?: 'income' | 'expense';
  spreadFeet?: number;
  staggerSeconds?: number;
}

export interface SectionEnemySpawn {
  id?: string;
  offsetFeet?: number;
  type?: string;
  count?: number;
  formation?: string;
  metadata?: Record<string, unknown>;
}

export type SectionEnemySet = {
  air?: SectionEnemySpawn[];
  ground?: SectionEnemySpawn[];
  ambient?: SectionEnemySpawn[];
  [key: string]: SectionEnemySpawn[] | undefined;
};

export interface SectionGateSpec {
  id?: string;
  offsetFeet?: number;
  patternIndex?: number;
  definition?: ControlledGateDefinition;
  gate?: GateSpec | GateGapSpec | true;
  metadata?: Record<string, unknown>;
}

export type GateSpecObject = SectionGateSpec;

export interface SectionGateSet {
  top?: SectionGateSpec[];
  right?: SectionGateSpec[];
  bottom?: SectionGateSpec[];
  left?: SectionGateSpec[];
}

export interface SectionDefinition {
  id?: string;
  title?: string;
  heightFeet?: number;
  widthPercent?: number;
  theme?: SectionTheme;
  difficulty?: SectionDifficulty;
  gates?: SectionGateSet;
  enemies?: SectionEnemySet;
  collectibles?: CollectibleSpawn[];
  metadata?: Record<string, unknown>;
}

interface NormalizedSectionDefinition {
  id: string;
  title: string;
  heightFeet: number;
  widthPercent: number;
  theme: SectionTheme;
  difficulty: SectionDifficulty;
  gates: SectionGateSet;
  enemies: SectionEnemySet;
  collectibles: CollectibleSpawn[];
  metadata: Record<string, unknown>;
  original: SectionDefinition;
}

export interface SectionRuntime {
  definition: NormalizedSectionDefinition;
  index: number;
  startFeet: number;
  endFeet: number;
  heightFeet: number;
  startY: number;
  endY: number;
  active: boolean;
  gates: ControlledGate[];
}

interface SectionContext {
  groundY: number;
  canvasWidth: number;
}

interface EnsureContext extends SectionContext {
  spriteY: number;
}

export interface SectionActivationResult {
  newlyActivated: SectionRuntime[];
  activeSections: SectionRuntime[];
  currentIndex: number;
}

const DEFAULT_SECTION_HEIGHT_FEET = 20;
const DEFAULT_WIDTH_PERCENT = 100;
const DEFAULT_THEME: SectionTheme = { background: '#000' };
const DEFAULT_DIFFICULTY: SectionDifficulty = 'standard';

type NormalizedGateSpec = {
  id: string;
  offsetFeet: number;
  definition: ControlledGateDefinition;
  metadata: Record<string, unknown>;
};

export class SectionManager {
  private definitions: NormalizedSectionDefinition[] = [];
  private runtime: SectionRuntime[] = [];
  private activeIndices: Set<number> = new Set();
  private context: SectionContext = { groundY: 0, canvasWidth: 0 };
  private patternCursor = 0;

  setDefinitions(definitions: SectionDefinition[]): void {
    this.definitions = definitions.map((def, index) => this.#normalizeDefinition(def, index));
    this.runtime = [];

    let cursorFeet = 0;
    this.definitions.forEach((definition, index) => {
      const heightFeet = Math.max(1, definition.heightFeet);
      const startFeet = cursorFeet;
      const endFeet = startFeet + heightFeet;
      cursorFeet = endFeet;

      this.runtime.push({
        definition,
        index,
        startFeet,
        endFeet,
        heightFeet,
        startY: 0,
        endY: 0,
        active: false,
        gates: [],
      });
    });

    this.reset();
  }

  reset(): void {
    for (const section of this.runtime) {
      this.#deactivateSection(section);
    }
    this.activeIndices.clear();
    this.patternCursor = 0;
  }

  ensureActiveSections(context: EnsureContext): SectionActivationResult {
    if (this.runtime.length === 0) {
      this.context = { groundY: context.groundY, canvasWidth: context.canvasWidth };
      return { newlyActivated: [], activeSections: [], currentIndex: -1 };
    }

    const contextChanged =
      context.canvasWidth !== this.context.canvasWidth ||
      context.groundY !== this.context.groundY;

    this.context = { groundY: context.groundY, canvasWidth: context.canvasWidth };

    if (contextChanged) {
      for (const index of this.activeIndices) {
        const runtime = this.runtime[index];
        this.#deactivateSection(runtime);
        this.#activateSection(runtime);
      }
    }

    const feet = Math.max(0, Math.floor((context.groundY - context.spriteY) / PIXELS_PER_FOOT));
    const currentIndex = this.getSectionIndexForFeet(feet);

    const indicesToKeep = new Set<number>();
    if (currentIndex !== -1) {
      indicesToKeep.add(currentIndex);
      if (currentIndex + 1 < this.runtime.length) indicesToKeep.add(currentIndex + 1);
    } else if (this.runtime.length > 0) {
      indicesToKeep.add(0);
    }

    const newlyActivated: SectionRuntime[] = [];
    for (const index of indicesToKeep) {
      const section = this.runtime[index];
      if (!section.active) {
        this.#activateSection(section);
        newlyActivated.push(section);
      }
    }

    for (const index of Array.from(this.activeIndices)) {
      if (!indicesToKeep.has(index)) {
        this.#deactivateSection(this.runtime[index]);
      }
    }

    this.activeIndices = indicesToKeep;

    const activeSections = Array.from(indicesToKeep)
      .sort((a, b) => a - b)
      .map((index) => this.runtime[index]);

    return { newlyActivated, activeSections, currentIndex };
  }

  getSectionIndexForFeet(feet: number): number {
    if (this.runtime.length === 0) return -1;

    for (const section of this.runtime) {
      if (feet >= section.startFeet && feet < section.endFeet) return section.index;
    }

    if (feet >= this.runtime[this.runtime.length - 1].endFeet) {
      return this.runtime.length - 1;
    }

    return 0;
  }

  getSectionIndexForY(y: number, groundY: number): number {
    const feet = Math.max(0, Math.floor((groundY - y) / PIXELS_PER_FOOT));
    return this.getSectionIndexForFeet(feet);
  }

  getActiveGates(): ControlledGate[] {
    const gates: ControlledGate[] = [];
    for (const index of this.activeIndices) {
      const section = this.runtime[index];
      for (const gate of section.gates) {
        if (gate && gate.active !== false) gates.push(gate);
      }
    }
    return gates;
  }

  getActiveSections(): SectionRuntime[] {
    return Array.from(this.activeIndices)
      .sort((a, b) => a - b)
      .map((index) => this.runtime[index]);
  }

  #normalizeDefinition(definition: SectionDefinition, index: number): NormalizedSectionDefinition {
    const id = definition.id ?? String(index);
    const title = definition.title ?? `Section ${id}`;
    const heightFeet = Math.max(1, definition.heightFeet ?? DEFAULT_SECTION_HEIGHT_FEET);
    const widthPercent = definition.widthPercent ?? DEFAULT_WIDTH_PERCENT;
    const theme = { ...DEFAULT_THEME, ...(definition.theme ?? {}) };
    const difficulty = definition.difficulty ?? DEFAULT_DIFFICULTY;
    const gates: SectionGateSet = {
      top: [...(definition.gates?.top ?? [])],
      right: [...(definition.gates?.right ?? [])],
      bottom: [...(definition.gates?.bottom ?? [])],
      left: [...(definition.gates?.left ?? [])],
    };
    const enemies: SectionEnemySet = { ...(definition.enemies ?? {}) };
    const collectibles = [...(definition.collectibles ?? [])];
    const metadata = { ...(definition.metadata ?? {}) };

    return {
      id,
      title,
      heightFeet,
      widthPercent,
      theme,
      difficulty,
      gates,
      enemies,
      collectibles,
      metadata,
      original: definition,
    };
  }

  #activateSection(section: SectionRuntime): void {
    if (!this.context) return;

    const { groundY, canvasWidth } = this.context;
    section.startY = groundY - section.startFeet * PIXELS_PER_FOOT;
    section.endY = groundY - section.endFeet * PIXELS_PER_FOOT;

    const gates: ControlledGate[] = [];
    const edges: SectionEdge[] = ['bottom', 'left', 'right', 'top'];
    for (const edge of edges) {
      const edgeGates = this.#createGatesForEdge(section, edge, canvasWidth);
      gates.push(...edgeGates);
    }

    section.gates = gates;
    section.active = true;
  }

  #deactivateSection(section: SectionRuntime): void {
    for (const gate of section.gates) {
      if (gate) gate.active = false;
    }
    section.gates = [];
    section.active = false;
  }

  #createGatesForEdge(section: SectionRuntime, edge: SectionEdge, canvasWidth: number): ControlledGate[] {
    const specs = section.definition.gates[edge];
    if (!specs || specs.length === 0 || canvasWidth <= 0) return [];

    const gates: ControlledGate[] = [];
    specs.forEach((spec, index) => {
      const normalized = this.#normalizeGateSpec(spec, section, edge, index);
      const gate = this.#buildGate(section, edge, normalized, canvasWidth);
      if (gate) gates.push(gate);
    });
    return gates;
  }

  #normalizeGateSpec(
    spec: SectionGateSpec | undefined,
    section: SectionRuntime,
    edge: SectionEdge,
    index: number,
  ): NormalizedGateSpec {
    const defaultOffset =
      edge === 'top'
        ? section.heightFeet
        : edge === 'bottom'
          ? 0
          : section.heightFeet / 2;

    const rawOffset = spec?.offsetFeet ?? defaultOffset;
    const offsetFeet = Math.max(0, Math.min(section.heightFeet, rawOffset));

    const id = spec?.id ?? `${section.definition.id}-${edge}-${index}`;
    const definition = this.#cloneDefinition(this.#resolveGateDefinition(spec));
    const metadata = { ...(spec?.metadata ?? {}) };

    return { id, offsetFeet, definition, metadata };
  }

  #resolveGateDefinition(spec?: SectionGateSpec): ControlledGateDefinition {
    if (spec?.definition) return spec.definition;

    if (typeof spec?.patternIndex === 'number') {
      return this.#getPatternByIndex(spec.patternIndex);
    }

    if (spec?.gate) {
      return { width: 100, gate: spec.gate } as ControlledGateDefinition;
    }

    return this.#getNextPatternDefinition();
  }

  #buildGate(
    section: SectionRuntime,
    edge: SectionEdge,
    spec: NormalizedGateSpec,
    canvasWidth: number,
  ): ControlledGate | null {
    if (!this.context) return null;

    const baseY = this.context.groundY - section.startFeet * PIXELS_PER_FOOT;
    const y = baseY - spec.offsetFeet * PIXELS_PER_FOOT;

    const metadata = {
      ...section.definition.metadata,
      ...spec.metadata,
      edge,
    };

    return new ControlledGate({
      y,
      canvasWidth,
      definition: spec.definition,
      id: spec.id,
      sectionId: section.definition.id,
      sectionIndex: section.index,
      sectionEdge: edge,
      sectionStartFeet: section.startFeet,
      sectionEndFeet: section.endFeet,
      sectionOffsetFeet: spec.offsetFeet,
      metadata,
    });
  }

  #getPatternByIndex(index: number): ControlledGateDefinition {
    if (CONTROLLED_GATE_PATTERNS.length === 0) {
      return { width: 100, gate: true } as ControlledGateDefinition;
    }
    const safeIndex = ((index % CONTROLLED_GATE_PATTERNS.length) + CONTROLLED_GATE_PATTERNS.length) % CONTROLLED_GATE_PATTERNS.length;
    return CONTROLLED_GATE_PATTERNS[safeIndex];
  }

  #getNextPatternDefinition(): ControlledGateDefinition {
    const pattern = this.#getPatternByIndex(this.patternCursor);
    this.patternCursor += 1;
    return pattern;
  }

  #cloneDefinition(definition: ControlledGateDefinition): ControlledGateDefinition {
    if (typeof definition === 'number') return definition;
    try {
      return JSON.parse(JSON.stringify(definition)) as ControlledGateDefinition;
    } catch (err) {
      console.warn('Unable to clone gate definition, reusing original.', err);
      return definition;
    }
  }
}

export const sectionManager = new SectionManager();
