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
  'TRISTATE_BUFFER',
  'MUX2',
  'MUX4',
  'DEMUX2',
  'DECODER2TO4',
  'HALF_ADDER',
  'FULL_ADDER',
  'BUS_JOIN8',
  'BUS_SPLIT8',
  'BUS_PROBE8',
  'DFF',
  'TFF',
  'REGISTER8',
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
  TRISTATE_BUFFER: 'TRI',
  MUX2: 'MUX2',
  MUX4: 'MUX4',
  DEMUX2: 'DMX',
  DECODER2TO4: 'DEC',
  HALF_ADDER: 'HA',
  FULL_ADDER: 'FA',
  BUS_JOIN8: 'BUS+',
  BUS_SPLIT8: 'BUS-',
  BUS_PROBE8: 'BUS?',
  DFF: 'D',
  TFF: 'T',
  REGISTER8: 'REG8',
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
