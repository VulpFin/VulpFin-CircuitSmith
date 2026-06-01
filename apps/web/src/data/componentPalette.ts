import { DEFAULT_NODE_LIBRARY } from '@vfcs/sim-core';

export interface PaletteItem {
  type: string;
  label: string;
  category: string;
  symbol: string;
}

const ORDER = [
  'INPUT',
  'VCC',
  'GND',
  'VSS',
  'LED',
  'OUTPUT',
  'CLOCK',
  'NOT',
  'AND',
  'OR',
  'NAND',
  'NOR',
  'XOR',
  'XNOR',
  'DFF',
  'TFF',
];

const SYMBOL_BY_TYPE: Record<string, string> = {
  INPUT: 'IN',
  VCC: 'VCC',
  GND: 'GND',
  VSS: 'VSS',
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
  CHIP: 'CHIP',
};

export const PALETTE_ITEMS: PaletteItem[] = ORDER.map((nodeType) => {
  const definition = DEFAULT_NODE_LIBRARY[nodeType];
  return {
    type: nodeType,
    label: definition?.label ?? nodeType,
    category: definition?.category ?? 'logic',
    symbol: SYMBOL_BY_TYPE[nodeType] ?? nodeType,
  };
});
