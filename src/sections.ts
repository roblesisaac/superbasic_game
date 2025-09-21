import { ControlledGate, type ControlledGateDefinition, type GateSpecObject } from './controlledGate.js';
import { GATE_GAP_WIDTH, PIXELS_PER_FOOT } from './constants.js';

export type CollectibleSpawn = {
  offsetFeet: number;
  xPercent?: number;
  formation?: 'line' | 'square' | 'triangle' | 'pyramid' | string;
  count: number;
  title?: string;
  value?: number;
  type?: 'income' | 'expense' | string;
  spreadFeet?: number;
  staggerSeconds?: number;
};

export type SectionGateSpec = GateSpecObject & {
  id?: string;
  definition?: ControlledGateDefinition;
  offsetFeet?: number;
  yOffsetFeet?: number;
};

export type SectionGateSet = {
  top?: SectionGateSpec[];
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

export interface SectionLayoutEntry {
  id: string;
  title: string;
  startFeet: number;
  endFeet: number;
  heightFeet: number;
}

export type SectionGate = ControlledGate & {
  sectionIndex: number;
  gateIndex: number;
  sectionId: string;
  gateId: string;
};

type NormalizedGateSpec = {
  id: string;
  position: number;
  width: number;
  offsetFeet: number;
  definition?: ControlledGateDefinition;
};

type NormalizedSectionDefinition = SectionDefinition & {
  id: string;
  title: string;
  heightFeet: number;
  widthPercent: number;
  theme: { background: string };
  gates: { top: NormalizedGateSpec[] };
  enemies: number[];
  collectibles: CollectibleSpawn[];
  metadata: Record<string, unknown>;
};

type SectionInstance = {
  index: number;
  startFeet: number;
  endFeet: number;
  definition: NormalizedSectionDefinition;
  gates: SectionGate[];
  lastCanvasWidth: number | null;
  lastGroundY: number | null;
  spawnedGateIndices: Set<number>;
  enemyPlan: number[];
  enemySpawned: number[];
};

export interface SectionEnsureResult {
  activeGates: SectionGate[];
  newlyActivatedGates: SectionGate[];
}

export class SectionManager {
  private sections: SectionInstance[];
  private activeIndices: Set<number> = new Set();
  private canvasWidth: number;
  private groundY: number;

  constructor(definitions: SectionDefinition[], options: { canvasWidth: number; groundY: number }) {
    this.canvasWidth = options.canvasWidth;
    this.groundY = options.groundY;
    this.sections = this.buildSections(definitions);
  }

  ensureSections({
    spriteY,
    canvasWidth,
    groundY,
  }: {
    spriteY: number;
    canvasWidth: number;
    groundY: number;
  }): SectionEnsureResult {
    this.updateMetrics({ canvasWidth, groundY });

    if (!Number.isFinite(spriteY) || !this.sections.length) {
      return { activeGates: [], newlyActivatedGates: [] };
    }

    const indices = this.determineActiveIndices(spriteY);
    const newIndices = new Set<number>();
    const newlyActivated: SectionGate[] = [];

    for (const index of indices) {
      const section = this.sections[index];
      if (!section) continue;
      newIndices.add(index);
      newlyActivated.push(...this.ensureSectionGates(section));
    }

    this.activeIndices = newIndices;

    return {
      activeGates: this.collectActiveGates(),
      newlyActivatedGates: newlyActivated,
    };
  }

  draw(ctx: CanvasRenderingContext2D, cameraY: number): void {
    const indices = Array.from(this.activeIndices).sort((a, b) => a - b);
    for (const index of indices) {
      const section = this.sections[index];
      if (!section) continue;
      for (const gate of section.gates) gate.draw(ctx, cameraY);
    }
  }

  getSectionCount(): number {
    return this.sections.length;
  }

  getSectionDefinition(index: number): NormalizedSectionDefinition | null {
    const section = this.sections[index];
    return section ? section.definition : null;
  }

  getSectionIndexForFeet(feet: number): number {
    if (!Number.isFinite(feet)) return -1;
    for (const section of this.sections) {
      if (feet >= section.startFeet && feet < section.endFeet) return section.index;
    }
    if (this.sections.length === 0) return -1;
    const last = this.sections[this.sections.length - 1];
    if (feet >= last.endFeet) return last.index;
    return -1;
  }

  getSectionIndexForY(y: number): number {
    if (!Number.isFinite(y)) return -1;
    const feet = Math.max(0, Math.floor((this.groundY - y) / PIXELS_PER_FOOT));
    return this.getSectionIndexForFeet(feet);
  }

  getLayout(): SectionLayoutEntry[] {
    return this.sections.map((section) => ({
      id: section.definition.id,
      title: section.definition.title,
      startFeet: section.startFeet,
      endFeet: section.endFeet,
      heightFeet: section.definition.heightFeet,
    }));
  }

  getEnemyPlanValue(sectionIndex: number, gateIndex: number): number | undefined {
    const section = this.sections[sectionIndex];
    if (!section) return undefined;
    return section.enemyPlan[gateIndex];
  }

  getEnemySpawnedValue(sectionIndex: number, gateIndex: number): number {
    const section = this.sections[sectionIndex];
    if (!section) return 0;
    return section.enemySpawned[gateIndex] ?? 0;
  }

  registerEnemiesSpawned(sectionIndex: number, gateIndex: number, count: number): void {
    if (!Number.isFinite(count) || count <= 0) return;
    const section = this.sections[sectionIndex];
    if (!section) return;
    while (section.enemySpawned.length <= gateIndex) section.enemySpawned.push(0);
    section.enemySpawned[gateIndex] = (section.enemySpawned[gateIndex] ?? 0) + count;
  }

  private buildSections(definitions: SectionDefinition[]): SectionInstance[] {
    const sections: SectionInstance[] = [];
    let cursorFeet = 0;

    definitions.forEach((definition, index) => {
      const normalized = this.normalizeSection(definition, index);
      const startFeet = cursorFeet;
      const endFeet = cursorFeet + normalized.heightFeet;

      sections.push({
        index,
        startFeet,
        endFeet,
        definition: normalized,
        gates: [],
        lastCanvasWidth: null,
        lastGroundY: null,
        spawnedGateIndices: new Set<number>(),
        enemyPlan: [...normalized.enemies],
        enemySpawned: new Array(normalized.enemies.length).fill(0),
      });

      cursorFeet = endFeet;
    });

    return sections;
  }

  private normalizeSection(definition: SectionDefinition, index: number): NormalizedSectionDefinition {
    const id = definition.id ?? `${index}`;
    const title = definition.title ?? `Section ${id}`;
    const heightFeet = Math.max(1, definition.heightFeet ?? 20);
    const widthPercent = definition.widthPercent ?? 100;
    const theme = { background: '#000', ...(definition.theme ?? {}) };

    const rawGateSpecs = definition.gates?.top ?? [];
    const gateSpecs = rawGateSpecs.length
      ? rawGateSpecs.map((spec, gateIndex) => this.normalizeGateSpec(spec, id, gateIndex))
      : [this.normalizeGateSpec({}, id, 0)];

    return {
      ...definition,
      id,
      title,
      heightFeet,
      widthPercent,
      theme,
      gates: { top: gateSpecs },
      enemies: definition.enemies ? [...definition.enemies] : [],
      collectibles: definition.collectibles ? [...definition.collectibles] : [],
      metadata: definition.metadata ? { ...definition.metadata } : {},
    };
  }

  private normalizeGateSpec(
    spec: SectionGateSpec | undefined,
    sectionId: string,
    gateIndex: number,
  ): NormalizedGateSpec {
    const id = spec?.id ?? `${sectionId}-top-${gateIndex}`;
    const position = typeof spec?.position === 'number' ? spec.position : 50;
    const width = typeof spec?.width === 'number' ? spec.width : GATE_GAP_WIDTH;
    const offsetFeet =
      typeof spec?.offsetFeet === 'number'
        ? spec.offsetFeet
        : typeof spec?.yOffsetFeet === 'number'
        ? spec.yOffsetFeet
        : 0;

    const definition = spec?.definition;

    return { id, position, width, offsetFeet, definition };
  }

  private determineActiveIndices(spriteY: number): number[] {
    if (!this.sections.length) return [];
    const feet = Math.max(0, Math.floor((this.groundY - spriteY) / PIXELS_PER_FOOT));
    let currentIndex = this.getSectionIndexForFeet(feet);
    if (currentIndex === -1) currentIndex = 0;

    const indices: number[] = [currentIndex];
    const nextIndex = Math.min(this.sections.length - 1, currentIndex + 1);
    if (!indices.includes(nextIndex)) indices.push(nextIndex);

    return indices;
  }

  private ensureSectionGates(section: SectionInstance): SectionGate[] {
    const needsRebuild =
      section.gates.length === 0 ||
      section.lastCanvasWidth !== this.canvasWidth ||
      section.lastGroundY !== this.groundY;

    if (needsRebuild) {
      section.gates = [];
      section.definition.gates.top.forEach((spec, gateIndex) => {
        const definition = this.createGateDefinition(section, spec);
        const y = this.computeGateY(section, spec);
        const gate = new ControlledGate({
          y,
          canvasWidth: this.canvasWidth,
          definition,
        }) as SectionGate;
        gate.sectionIndex = section.index;
        gate.sectionId = section.definition.id;
        gate.gateIndex = gateIndex;
        gate.gateId = spec.id;
        section.gates.push(gate);
      });

      section.lastCanvasWidth = this.canvasWidth;
      section.lastGroundY = this.groundY;
    }

    const newlyActivated: SectionGate[] = [];
    for (const gate of section.gates) {
      const gateIndex = gate.gateIndex ?? 0;
      if (!section.spawnedGateIndices.has(gateIndex)) {
        newlyActivated.push(gate);
        section.spawnedGateIndices.add(gateIndex);
      }
    }

    return newlyActivated;
  }

  private createGateDefinition(section: SectionInstance, spec: NormalizedGateSpec): ControlledGateDefinition {
    if (spec.definition) return spec.definition;
    return {
      width: section.definition.widthPercent,
      gate: { position: spec.position, width: spec.width },
    } as ControlledGateDefinition;
  }

  private computeGateY(section: SectionInstance, spec: NormalizedGateSpec): number {
    const topFeet = section.endFeet - spec.offsetFeet;
    const clampedFeet = Math.max(section.startFeet, Math.min(section.endFeet, topFeet));
    return this.groundY - clampedFeet * PIXELS_PER_FOOT;
  }

  private collectActiveGates(): SectionGate[] {
    const indices = Array.from(this.activeIndices).sort((a, b) => a - b);
    const gates: SectionGate[] = [];
    for (const index of indices) {
      const section = this.sections[index];
      if (!section) continue;
      gates.push(...section.gates);
    }
    return gates;
  }

  private updateMetrics({
    canvasWidth,
    groundY,
  }: {
    canvasWidth: number;
    groundY: number;
  }): void {
    const widthChanged = this.canvasWidth !== canvasWidth;
    const groundChanged = this.groundY !== groundY;

    if (!widthChanged && !groundChanged) return;

    this.canvasWidth = canvasWidth;
    this.groundY = groundY;

    if (widthChanged || groundChanged) {
      for (const section of this.sections) {
        section.gates = [];
        section.lastCanvasWidth = null;
        section.lastGroundY = null;
      }
    }
  }
}

let currentManager: SectionManager | null = null;

export function initSections(
  definitions: SectionDefinition[],
  options: { canvasWidth: number; groundY: number },
): SectionManager {
  currentManager = new SectionManager(definitions, options);
  return currentManager;
}

export function getSectionManager(): SectionManager | null {
  return currentManager;
}

export function getSectionDefinition(index: number): NormalizedSectionDefinition | null {
  return currentManager?.getSectionDefinition(index) ?? null;
}

export function getSectionLayout(): SectionLayoutEntry[] {
  return currentManager?.getLayout() ?? [];
}

export function getSectionIndexForY(y: number): number {
  return currentManager?.getSectionIndexForY(y) ?? -1;
}

export function getSectionEnemyPlan(sectionIndex: number, gateIndex: number): number | undefined {
  return currentManager?.getEnemyPlanValue(sectionIndex, gateIndex);
}

export function getSectionEnemySpawned(sectionIndex: number, gateIndex: number): number {
  return currentManager?.getEnemySpawnedValue(sectionIndex, gateIndex) ?? 0;
}

export function registerSectionEnemiesSpawned(
  sectionIndex: number,
  gateIndex: number,
  count: number,
): void {
  currentManager?.registerEnemiesSpawned(sectionIndex, gateIndex, count);
}

export type { NormalizedSectionDefinition };
