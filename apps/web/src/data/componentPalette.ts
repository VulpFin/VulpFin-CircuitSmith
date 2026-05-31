import { DEFAULT_NODE_LIBRARY } from '@vfcs/sim-core';

export interface PaletteItem {
  type: string;
  label: string;
  category: string;
}

const ORDER = ['INPUT', 'OUTPUT', 'CLOCK', 'NOT', 'AND', 'OR', 'NAND', 'NOR', 'XOR', 'XNOR', 'DFF', 'TFF'];

export const PALETTE_ITEMS: PaletteItem[] = ORDER.map((nodeType) => {
  const definition = DEFAULT_NODE_LIBRARY[nodeType];
  return {
    type: nodeType,
    label: definition?.label ?? nodeType,
    category: definition?.category ?? 'logic',
  };
});