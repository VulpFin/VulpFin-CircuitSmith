import type { ChipDefinition, CircuitDefinition, LogicValue, NodeInstance, PinDefinition } from '@vfcs/circuit-model';
import { nodeSize } from './nodeSizing.js';

export type ChipVisualElementType = 'led' | 'segment' | 'label';

export interface ChipVisualElement {
  id: string;
  type: ChipVisualElementType;
  autoKey?: string;
  groupId?: string;
  groupLabel?: string;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  color: string;
  offColor: string;
  bindingPinId?: string;
  sourceNodeId?: string;
  sourcePinId?: string;
  text?: string;
}

export interface ChipVisualSource {
  nodeId: string;
  pinId?: string;
  label: string;
}

export interface AutoVisualMergeRequest {
  outputPins: PinDefinition[];
  sources?: ChipVisualSource[];
  existing: ChipVisualElement[];
  suppressedAutoKeys?: Set<string>;
}

export interface NestedChipVisualMergeRequest {
  circuit: CircuitDefinition;
  chipLibrary: ChipDefinition[];
  existing: ChipVisualElement[];
  suppressedAutoKeys?: Set<string>;
}

interface SevenSegmentPresetOptions {
  includeUnboundDecimalPoint?: boolean;
  markAuto?: boolean;
}

const clamp = (value: number, min: number, max: number): number =>
  Math.max(min, Math.min(max, value));

const numberOr = (value: unknown, fallback: number): number =>
  typeof value === 'number' && Number.isFinite(value) ? value : fallback;

const stringOr = (value: unknown, fallback: string): string =>
  typeof value === 'string' ? value : fallback;

export function createVisualElement(type: ChipVisualElementType, index = 0): ChipVisualElement {
  return {
    id: `visual_${Math.random().toString(36).slice(2, 9)}`,
    type,
    x: clamp(50 + (index % 3) * 8, 5, 95),
    y: clamp(50 + Math.floor(index / 3) * 10, 5, 95),
    width: type === 'label' ? 34 : type === 'segment' ? 30 : 12,
    height: type === 'label' ? 12 : type === 'segment' ? 7 : 12,
    rotation: 0,
    color: type === 'label' ? '#d8ecff' : '#ff3b30',
    offColor: type === 'label' ? 'transparent' : '#241313',
    text: type === 'label' ? 'LABEL' : undefined,
  };
}

export function normalizeChipVisualElements(value: unknown): ChipVisualElement[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap((candidate, index) => {
    if (typeof candidate !== 'object' || candidate === null) {
      return [];
    }

    const raw = candidate as Record<string, unknown>;
    const type: ChipVisualElementType =
      raw.type === 'segment' || raw.type === 'label' ? raw.type : 'led';
    const fallback = createVisualElement(type, index);

    return [{
      id: stringOr(raw.id, fallback.id),
      type,
      autoKey: typeof raw.autoKey === 'string' && raw.autoKey.length > 0 ? raw.autoKey : undefined,
      groupId: typeof raw.groupId === 'string' && raw.groupId.length > 0 ? raw.groupId : undefined,
      groupLabel: typeof raw.groupLabel === 'string' && raw.groupLabel.length > 0 ? raw.groupLabel : undefined,
      x: clamp(numberOr(raw.x, fallback.x), 2, 98),
      y: clamp(numberOr(raw.y, fallback.y), 2, 98),
      width: clamp(numberOr(raw.width, fallback.width), 2, 95),
      height: clamp(numberOr(raw.height, fallback.height), 2, 95),
      rotation: clamp(numberOr(raw.rotation, 0), -180, 180),
      color: stringOr(raw.color, fallback.color),
      offColor: stringOr(raw.offColor, fallback.offColor),
      bindingPinId:
        typeof raw.bindingPinId === 'string' && raw.bindingPinId.length > 0
          ? raw.bindingPinId
          : undefined,
      sourceNodeId:
        typeof raw.sourceNodeId === 'string' && raw.sourceNodeId.length > 0
          ? raw.sourceNodeId
          : undefined,
      sourcePinId:
        typeof raw.sourcePinId === 'string' && raw.sourcePinId.length > 0
          ? raw.sourcePinId
          : undefined,
      text: typeof raw.text === 'string' ? raw.text : fallback.text,
    }];
  });
}

export function createSevenSegmentPreset(
  outputPins: PinDefinition[],
  sources: ChipVisualSource[] = [],
  options: SevenSegmentPresetOptions = {},
): ChipVisualElement[] {
  const byName = new Map(
    outputPins.map((pin) => [pin.id.replace(/[^a-z0-9]/gi, '').toUpperCase(), pin.id]),
  );
  const sourceByName = new Map<string, ChipVisualSource>();
  for (const source of sources) {
    const names = [source.pinId, source.label, source.nodeId].filter(Boolean) as string[];
    for (const name of names) {
      sourceByName.set(name.replace(/[^a-z0-9]/gi, '').toUpperCase(), source);
    }
  }
  const binding = (name: string): string | undefined =>
    byName.get(name) ?? byName.get(`SEG${name}`) ?? byName.get(`SEGMENT${name}`);
  const source = (name: string): ChipVisualSource | undefined =>
    sourceByName.get(name)
    ?? sourceByName.get(`SEG${name}`)
    ?? sourceByName.get(`SEGMENT${name}`);
  const segment = (
    name: string,
    x: number,
    y: number,
    width: number,
    height: number,
  ): ChipVisualElement => {
    const matchedSource = source(name);
    const bindingPinId = binding(name);
    return {
      id: `segment_${name.toLowerCase()}_${Math.random().toString(36).slice(2, 7)}`,
      type: 'segment',
      autoKey: options.markAuto && bindingPinId ? autoKeyForPinVisual('segment', bindingPinId) : undefined,
      x,
      y,
      width,
      height,
      rotation: 0,
      color: '#ff3b30',
      offColor: '#2a1010',
      bindingPinId,
      sourceNodeId: matchedSource?.nodeId,
      sourcePinId: matchedSource?.pinId,
    };
  };

  const segments = [
    segment('A', 50, 18, 34, 7),
    segment('B', 69, 34, 7, 27),
    segment('C', 69, 66, 7, 27),
    segment('D', 50, 82, 34, 7),
    segment('E', 31, 66, 7, 27),
    segment('F', 31, 34, 7, 27),
    segment('G', 50, 50, 34, 7),
  ];

  const matchedDecimalSource = source('DP');
  const decimalBinding = binding('DP');
  if (decimalBinding || options.includeUnboundDecimalPoint !== false) {
    segments.push({
      ...createVisualElement('led'),
      id: `segment_dp_${Math.random().toString(36).slice(2, 7)}`,
      autoKey: options.markAuto && decimalBinding ? autoKeyForPinVisual('led', decimalBinding) : undefined,
      x: 82,
      y: 81,
      width: 7,
      height: 7,
      bindingPinId: decimalBinding,
      sourceNodeId: matchedDecimalSource?.nodeId,
      sourcePinId: matchedDecimalSource?.pinId,
    });
  }

  return segments;
}

export function visualSignal(
  element: ChipVisualElement,
  pinValues: Record<string, LogicValue>,
): LogicValue {
  const internalKey = `__visual_${element.id}`;
  if (internalKey in pinValues) {
    return pinValues[internalKey];
  }
  return element.bindingPinId ? pinValues[element.bindingPinId] ?? 'Z' : '0';
}

export function mergeAutoVisualElements({
  outputPins,
  sources = [],
  existing,
  suppressedAutoKeys = new Set<string>(),
}: AutoVisualMergeRequest): ChipVisualElement[] {
  if (outputPins.length === 0) {
    return existing;
  }

  const additions: ChipVisualElement[] = [];
  const handledPinIds = new Set<string>();
  const segmentPins = sevenSegmentPins(outputPins);

  if (segmentPins) {
    const preset = createSevenSegmentPreset(outputPins, sources, {
      includeUnboundDecimalPoint: false,
      markAuto: true,
    });
    for (const element of preset) {
      const pinId = element.bindingPinId;
      if (!pinId) {
        continue;
      }
      handledPinIds.add(pinId);
      const key = element.autoKey ?? autoKeyForPinVisual(element.type, pinId);
      if (suppressedAutoKeys.has(key) || hasExistingVisualForPin(existing, pinId)) {
        continue;
      }
      additions.push(element);
    }
  }

  const ledPins = outputPins.filter((pin) => !handledPinIds.has(pin.id));
  const ledCount = ledPins.length;
  ledPins.forEach((pin, index) => {
    const key = autoKeyForPinVisual('led', pin.id);
    if (suppressedAutoKeys.has(key) || hasExistingVisualForPin(existing, pin.id)) {
      return;
    }

    const source = findSourceForPin(pin, sources);
    additions.push(createAutoLedVisual(pin, source, index, ledCount));
  });

  if (additions.length === 0) {
    return existing;
  }

  return [...existing, ...additions];
}

export function mergeNestedChipVisualElements({
  circuit,
  chipLibrary,
  existing,
  suppressedAutoKeys = new Set<string>(),
}: NestedChipVisualMergeRequest): ChipVisualElement[] {
  const additions = createNestedChipVisualElements(circuit, chipLibrary, existing, suppressedAutoKeys);
  if (additions.length === 0) {
    return existing;
  }

  return [...existing, ...additions];
}

export function autoVisualKey(element: ChipVisualElement): string | null {
  if (element.autoKey) {
    return element.autoKey;
  }

  if (element.bindingPinId) {
    return autoKeyForPinVisual(element.type, element.bindingPinId);
  }

  if (element.sourceNodeId) {
    return `source:${element.type}:${element.sourceNodeId}.${element.sourcePinId ?? 'OUT'}`;
  }

  return null;
}

function autoKeyForPinVisual(type: ChipVisualElementType, pinId: string): string {
  return `public:${type}:${pinId}`;
}

function autoKeyForNestedVisual(nodeId: string, visualId: string): string {
  return `nested:${nodeId}:${visualId}`;
}

function nestedGroupId(nodeId: string): string {
  return `chip-face:${nodeId}`;
}

function canonicalName(value: string): string {
  return value.replace(/[^a-z0-9]/gi, '').toUpperCase();
}

function sevenSegmentPins(outputPins: PinDefinition[]): Map<string, PinDefinition> | null {
  const byName = new Map<string, PinDefinition>();
  for (const pin of outputPins) {
    const names = [pin.id, pin.name].map(canonicalName);
    for (const name of names) {
      byName.set(name, pin);
    }
  }

  const result = new Map<string, PinDefinition>();
  for (const segmentName of ['A', 'B', 'C', 'D', 'E', 'F', 'G']) {
    const pin =
      byName.get(segmentName)
      ?? byName.get(`SEG${segmentName}`)
      ?? byName.get(`SEGMENT${segmentName}`);
    if (!pin) {
      return null;
    }
    result.set(segmentName, pin);
  }

  return result;
}

function hasExistingVisualForPin(existing: ChipVisualElement[], pinId: string): boolean {
  return existing.some((element) => element.bindingPinId === pinId);
}

function findSourceForPin(pin: PinDefinition, sources: ChipVisualSource[]): ChipVisualSource | undefined {
  const pinNames = [pin.id, pin.name].map(canonicalName);
  return sources.find((source) => {
    const sourceNames = [source.pinId, source.label, source.nodeId]
      .filter(Boolean)
      .map((name) => canonicalName(name as string));
    return pinNames.some((pinName) => sourceNames.includes(pinName));
  });
}

function createAutoLedVisual(
  pin: PinDefinition,
  source: ChipVisualSource | undefined,
  index: number,
  count: number,
): ChipVisualElement {
  const columns = Math.max(1, Math.min(4, Math.ceil(Math.sqrt(count))));
  const rows = Math.max(1, Math.ceil(count / columns));
  const column = index % columns;
  const row = Math.floor(index / columns);
  const xStep = columns === 1 ? 0 : 50 / (columns - 1);
  const yStep = rows === 1 ? 0 : 42 / (rows - 1);

  return {
    ...createVisualElement('led', index),
    id: `auto_led_${canonicalName(pin.id).toLowerCase()}_${Math.random().toString(36).slice(2, 7)}`,
    autoKey: autoKeyForPinVisual('led', pin.id),
    x: columns === 1 ? 50 : 25 + column * xStep,
    y: rows === 1 ? 50 : 30 + row * yStep,
    width: 9,
    height: 9,
    color: '#ff9f43',
    offColor: '#22180d',
    bindingPinId: pin.id,
    sourceNodeId: source?.nodeId,
    sourcePinId: source?.pinId,
  };
}

function createNestedChipVisualElements(
  circuit: CircuitDefinition,
  chipLibrary: ChipDefinition[],
  existing: ChipVisualElement[],
  suppressedAutoKeys: Set<string>,
): ChipVisualElement[] {
  const existingAutoKeys = new Set(existing.map((visual) => visual.autoKey).filter(Boolean) as string[]);
  const representedNodeIds = new Set(
    existing.flatMap((visual) => {
      const fromSource = visual.sourceNodeId ? [visual.sourceNodeId] : [];
      const groupNodeId = visual.groupId?.startsWith('chip-face:')
        ? visual.groupId.slice('chip-face:'.length)
        : null;
      return groupNodeId ? [...fromSource, groupNodeId] : fromSource;
    }),
  );
  const candidateNodes = circuit.nodes
    .filter((node) => node.nodeType === 'CHIP' && node.chipRefId)
    .filter((node) => !representedNodeIds.has(node.id))
    .map((node) => {
      const chip = chipLibrary.find((entry) => entry.id === node.chipRefId);
      const visuals = normalizeChipVisualElements(chip?.metadata?.visualElements);
      return { node, chip, visuals };
    })
    .filter((entry): entry is { node: NodeInstance; chip: ChipDefinition; visuals: ChipVisualElement[] } =>
      Boolean(entry.chip) && entry.visuals.length > 0,
    );

  if (candidateNodes.length === 0) {
    return [];
  }

  const visualInstances = candidateNodes.flatMap(({ node, chip, visuals }) => {
    const size = nodeSize(node);
    return visuals.map((visual) => {
      const absoluteWidth = (visual.width / 100) * size.width;
      const absoluteHeight = (visual.height / 100) * size.height;
      const centerX = node.position.x + (visual.x / 100) * size.width;
      const centerY = node.position.y + (visual.y / 100) * size.height;
      return {
        node,
        chip,
        visual,
        centerX,
        centerY,
        width: absoluteWidth,
        height: absoluteHeight,
      };
    });
  });

  const minX = Math.min(...visualInstances.map((entry) => entry.centerX - entry.width / 2));
  const maxX = Math.max(...visualInstances.map((entry) => entry.centerX + entry.width / 2));
  const minY = Math.min(...visualInstances.map((entry) => entry.centerY - entry.height / 2));
  const maxY = Math.max(...visualInstances.map((entry) => entry.centerY + entry.height / 2));
  const boxWidth = Math.max(1, maxX - minX);
  const boxHeight = Math.max(1, maxY - minY);
  const centerX = minX + boxWidth / 2;
  const centerY = minY + boxHeight / 2;
  const scale = Math.min(84 / boxWidth, 78 / boxHeight, 1.2);

  return visualInstances.flatMap(({ node, chip, visual, centerX: visualCenterX, centerY: visualCenterY, width, height }) => {
    const key = autoKeyForNestedVisual(node.id, visual.id);
    if (suppressedAutoKeys.has(key) || existingAutoKeys.has(key)) {
      return [];
    }

    const groupId = nestedGroupId(node.id);
    const groupLabel = node.label ?? chip.name;
    const next: ChipVisualElement = {
      ...visual,
      id: `nested_${node.id}_${visual.id}`.replace(/[^a-zA-Z0-9_-]/g, '_'),
      autoKey: key,
      groupId,
      groupLabel,
      x: clamp(50 + (visualCenterX - centerX) * scale, 2, 98),
      y: clamp(50 + (visualCenterY - centerY) * scale, 2, 98),
      width: clamp(width * scale, 2, 95),
      height: clamp(height * scale, 2, 95),
      sourceNodeId: visual.type === 'label' ? undefined : node.id,
      sourcePinId: visual.type === 'label' ? undefined : `__visual_${visual.id}`,
      bindingPinId: undefined,
    };

    return [next];
  });
}
