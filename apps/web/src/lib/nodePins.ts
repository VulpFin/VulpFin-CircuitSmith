import type { ChipDefinition, NodeInstance, PinDefinition } from '@vfcs/circuit-model';
import { DEFAULT_NODE_LIBRARY } from '@vfcs/sim-core';

export interface ResolvedNodePins {
  inputPins: PinDefinition[];
  outputPins: PinDefinition[];
}

export interface ChipPinLayoutPoint {
  x: number;
  y: number;
}

const FALLBACK_PINS: ResolvedNodePins = {
  inputPins: [],
  outputPins: [],
};

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function normalizePoint(value: unknown, fallbackX: number, fallbackY: number): ChipPinLayoutPoint {
  if (typeof value !== 'object' || value === null) {
    return { x: fallbackX, y: fallbackY };
  }

  const point = value as Record<string, unknown>;
  const x = typeof point.x === 'number' && Number.isFinite(point.x) ? point.x : fallbackX;
  const y = typeof point.y === 'number' && Number.isFinite(point.y) ? point.y : fallbackY;

  return {
    x: clamp(x, 5, 95),
    y: clamp(y, 5, 95),
  };
}

function chipPinsByDirection(chip: ChipDefinition): ResolvedNodePins {
  return {
    inputPins: chip.publicPins.filter(
      (pin) => pin.direction === 'input' || pin.direction === 'bidirectional',
    ),
    outputPins: chip.publicPins.filter(
      (pin) => pin.direction === 'output' || pin.direction === 'bidirectional',
    ),
  };
}

function chipFromNode(node: NodeInstance, chipLibrary: ChipDefinition[]): ChipDefinition | null {
  if (node.nodeType !== 'CHIP' || !node.chipRefId) {
    return null;
  }

  return chipLibrary.find((entry) => entry.id === node.chipRefId) ?? null;
}

export function resolveNodePins(node: NodeInstance, chipLibrary: ChipDefinition[]): ResolvedNodePins {
  const chip = chipFromNode(node, chipLibrary);
  if (chip) {
    return chipPinsByDirection(chip);
  }

  const definition = DEFAULT_NODE_LIBRARY[node.nodeType];
  if (!definition) {
    return FALLBACK_PINS;
  }

  return {
    inputPins: definition.inputPins,
    outputPins: definition.outputPins,
  };
}

export function resolveChipPinLayout(
  node: NodeInstance,
  chipLibrary: ChipDefinition[],
): Record<string, ChipPinLayoutPoint> {
  const chip = chipFromNode(node, chipLibrary);
  if (!chip) {
    return {};
  }

  const fromNodeParams = node.parameters?.pinLayout;
  const fromChipMeta = chip.metadata?.pinLayout;

  const layoutRaw =
    typeof fromNodeParams === 'object' && fromNodeParams !== null
      ? (fromNodeParams as Record<string, unknown>)
      : typeof fromChipMeta === 'object' && fromChipMeta !== null
        ? (fromChipMeta as Record<string, unknown>)
        : {};

  const pins = chip.publicPins;
  const total = Math.max(1, pins.length);
  const output: Record<string, ChipPinLayoutPoint> = {};

  pins.forEach((pin, index) => {
    const fallbackY = 10 + (index / total) * 80;
    const fallbackX = pin.direction === 'output' ? 95 : pin.direction === 'input' ? 5 : 50;
    output[pin.id] = normalizePoint(layoutRaw[pin.id], fallbackX, fallbackY);
  });

  return output;
}

export function nodeSymbol(node: NodeInstance, chipLibrary: ChipDefinition[]): string {
  if (node.nodeType === 'CHIP') {
    const chip = chipFromNode(node, chipLibrary);
    const appearance = (chip?.metadata?.appearance as Record<string, unknown> | undefined) ?? undefined;
    const symbol = typeof appearance?.symbol === 'string' ? appearance.symbol : null;
    if (symbol && symbol.trim().length > 0) {
      return symbol.trim().slice(0, 6).toUpperCase();
    }
    return 'CHIP';
  }

  const known: Record<string, string> = {
    INPUT: 'IN',
    OUTPUT: 'OUT',
    LED: 'LED',
    CLOCK: 'CLK',
    NOT: 'NOT',
    AND: 'AND',
    OR: 'OR',
    NAND: 'NAND',
    NOR: 'NOR',
    XOR: 'XOR',
    XNOR: 'XNOR',
    DFF: 'D',
    TFF: 'T',
  };

  return known[node.nodeType] ?? node.nodeType;
}

export interface ChipAppearanceView {
  shape: 'rect' | 'rounded' | 'seven-segment';
  bodyColor: string;
  accentColor: string;
  textColor: string;
  symbol: string;
}

const DEFAULT_APPEARANCE: ChipAppearanceView = {
  shape: 'rect',
  bodyColor: '#173a53',
  accentColor: '#3bd5ff',
  textColor: '#d8ecff',
  symbol: 'CHIP',
};

export function resolveChipAppearance(
  node: NodeInstance,
  chipLibrary: ChipDefinition[],
): ChipAppearanceView | null {
  if (node.nodeType !== 'CHIP') {
    return null;
  }

  const chip = chipFromNode(node, chipLibrary);
  const appearance = chip?.metadata?.appearance as Record<string, unknown> | undefined;

  return {
    shape:
      appearance?.shape === 'rounded' || appearance?.shape === 'seven-segment'
        ? appearance.shape
        : DEFAULT_APPEARANCE.shape,
    bodyColor:
      typeof appearance?.bodyColor === 'string' ? appearance.bodyColor : DEFAULT_APPEARANCE.bodyColor,
    accentColor:
      typeof appearance?.accentColor === 'string'
        ? appearance.accentColor
        : DEFAULT_APPEARANCE.accentColor,
    textColor:
      typeof appearance?.textColor === 'string' ? appearance.textColor : DEFAULT_APPEARANCE.textColor,
    symbol: typeof appearance?.symbol === 'string' ? appearance.symbol : DEFAULT_APPEARANCE.symbol,
  };
}
