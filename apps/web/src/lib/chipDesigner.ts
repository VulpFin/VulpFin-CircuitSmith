import type { PinDefinition, PinDirection } from '@vfcs/circuit-model';
import type { ChipPinDraft } from '../components/ChipLibraryPanel.js';

const PIN_MIN = 5;
const PIN_MAX = 95;

export interface ChipPinLayoutPoint {
  x: number;
  y: number;
}

export interface BuiltChipPins {
  publicPins: PinDefinition[];
  pinLayout: Record<string, ChipPinLayoutPoint>;
  pinBindings: Record<
    string,
    {
      sourceNodeId?: string;
      sourcePinId?: string;
      direction: PinDirection;
    }
  >;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function sanitizePinPercent(value: number): number {
  if (!Number.isFinite(value)) {
    return 50;
  }
  return clamp(Math.round(value * 10) / 10, PIN_MIN, PIN_MAX);
}

export function sanitizePinId(source: string): string {
  const normalized = source
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
  return normalized || 'PIN';
}

function fallbackPosition(direction: PinDirection, index: number, count: number): ChipPinLayoutPoint {
  if (count <= 1) {
    if (direction === 'input') {
      return { x: 5, y: 50 };
    }
    if (direction === 'output') {
      return { x: 95, y: 50 };
    }
    return { x: 50, y: 50 };
  }

  const step = 80 / (count - 1);
  const y = 10 + index * step;
  if (direction === 'input') {
    return { x: 5, y };
  }
  if (direction === 'output') {
    return { x: 95, y };
  }
  return { x: 50, y };
}

export function buildChipPinsFromDrafts(drafts: ChipPinDraft[]): BuiltChipPins {
  const enabled = drafts.filter(
    (draft) => draft.enabled && draft.id.trim().length > 0 && draft.name.trim().length > 0,
  );

  const counts = {
    input: enabled.filter((item) => item.direction === 'input').length,
    output: enabled.filter((item) => item.direction === 'output').length,
    bidirectional: enabled.filter((item) => item.direction === 'bidirectional').length,
  };

  let inputIndex = 0;
  let outputIndex = 0;
  let bidirectionalIndex = 0;

  const idUseCount = new Map<string, number>();
  const publicPins: PinDefinition[] = [];
  const pinLayout: Record<string, ChipPinLayoutPoint> = {};
  const pinBindings: BuiltChipPins['pinBindings'] = {};

  for (const draft of enabled) {
    const baseId = sanitizePinId(draft.id);
    const count = idUseCount.get(baseId) ?? 0;
    idUseCount.set(baseId, count + 1);
    const uniqueId = count === 0 ? baseId : `${baseId}_${count + 1}`;

    publicPins.push({
      id: uniqueId,
      name: draft.name.trim(),
      direction: draft.direction,
    });

    let fallback: ChipPinLayoutPoint;
    if (draft.direction === 'input') {
      fallback = fallbackPosition('input', inputIndex, counts.input);
      inputIndex += 1;
    } else if (draft.direction === 'output') {
      fallback = fallbackPosition('output', outputIndex, counts.output);
      outputIndex += 1;
    } else {
      fallback = fallbackPosition('bidirectional', bidirectionalIndex, counts.bidirectional);
      bidirectionalIndex += 1;
    }

    pinLayout[uniqueId] = {
      x: sanitizePinPercent(draft.pinX ?? fallback.x),
      y: sanitizePinPercent(draft.pinY ?? fallback.y),
    };
    pinBindings[uniqueId] = {
      sourceNodeId: draft.sourceNodeId,
      sourcePinId: draft.sourcePinId,
      direction: draft.direction,
    };
  }

  return {
    publicPins,
    pinLayout,
    pinBindings,
  };
}

export function createDefaultPinPosition(direction: PinDirection, index: number): ChipPinLayoutPoint {
  if (direction === 'input') {
    return { x: 5, y: sanitizePinPercent(15 + index * 12) };
  }

  if (direction === 'output') {
    return { x: 95, y: sanitizePinPercent(15 + index * 12) };
  }

  return { x: 50, y: sanitizePinPercent(20 + index * 12) };
}
