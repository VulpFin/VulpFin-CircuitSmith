import type { NodeDefinition, PinDefinition, PinDirection } from '@vfcs/circuit-model';

const bitPins = (prefix: string, namePrefix: string, direction: PinDirection, count = 8): PinDefinition[] =>
  Array.from({ length: count }, (_, index) => ({
    id: `${prefix}${index}`,
    name: `${namePrefix}${index}`,
    direction,
  }));

const busInputPins = bitPins('D', 'D', 'input');
const busOutputPins = bitPins('Q', 'Q', 'output');

export const DEFAULT_NODE_LIBRARY: Record<string, NodeDefinition> = {
  INPUT: {
    type: 'INPUT',
    label: 'Input',
    category: 'io',
    outputPins: [{ id: 'OUT', name: 'Out', direction: 'output' }],
    inputPins: [],
    defaultState: { value: '0' },
  },
  OUTPUT: {
    type: 'OUTPUT',
    label: 'Output Probe',
    category: 'io',
    inputPins: [{ id: 'IN', name: 'In', direction: 'input' }],
    outputPins: [],
    defaultState: { value: 'X' },
  },
  LED: {
    type: 'LED',
    label: 'LED Output',
    category: 'io',
    inputPins: [{ id: 'IN', name: 'In', direction: 'input' }],
    outputPins: [],
    defaultState: { value: 'X' },
  },
  VCC: {
    type: 'VCC',
    label: 'VCC (+1)',
    category: 'io',
    inputPins: [],
    outputPins: [{ id: 'OUT', name: 'Out', direction: 'output' }],
    defaultState: { value: '1' },
  },
  GND: {
    type: 'GND',
    label: 'GND (0)',
    category: 'io',
    inputPins: [],
    outputPins: [{ id: 'OUT', name: 'Out', direction: 'output' }],
    defaultState: { value: '0' },
  },
  VSS: {
    type: 'VSS',
    label: 'VSS (0)',
    category: 'io',
    inputPins: [],
    outputPins: [{ id: 'OUT', name: 'Out', direction: 'output' }],
    defaultState: { value: '0' },
  },
  CLOCK: {
    type: 'CLOCK',
    label: 'Clock',
    category: 'clock',
    inputPins: [],
    outputPins: [{ id: 'OUT', name: 'Out', direction: 'output' }],
    defaultParameters: { frequencyHz: 1 },
    defaultState: { value: '0' },
  },
  NOT: {
    type: 'NOT',
    label: 'NOT',
    category: 'logic',
    inputPins: [{ id: 'IN', name: 'In', direction: 'input' }],
    outputPins: [{ id: 'OUT', name: 'Out', direction: 'output' }],
  },
  AND: {
    type: 'AND',
    label: 'AND',
    category: 'logic',
    inputPins: [
      { id: 'A', name: 'A', direction: 'input' },
      { id: 'B', name: 'B', direction: 'input' },
    ],
    outputPins: [{ id: 'OUT', name: 'Out', direction: 'output' }],
  },
  OR: {
    type: 'OR',
    label: 'OR',
    category: 'logic',
    inputPins: [
      { id: 'A', name: 'A', direction: 'input' },
      { id: 'B', name: 'B', direction: 'input' },
    ],
    outputPins: [{ id: 'OUT', name: 'Out', direction: 'output' }],
  },
  NAND: {
    type: 'NAND',
    label: 'NAND',
    category: 'logic',
    inputPins: [
      { id: 'A', name: 'A', direction: 'input' },
      { id: 'B', name: 'B', direction: 'input' },
    ],
    outputPins: [{ id: 'OUT', name: 'Out', direction: 'output' }],
  },
  NOR: {
    type: 'NOR',
    label: 'NOR',
    category: 'logic',
    inputPins: [
      { id: 'A', name: 'A', direction: 'input' },
      { id: 'B', name: 'B', direction: 'input' },
    ],
    outputPins: [{ id: 'OUT', name: 'Out', direction: 'output' }],
  },
  XOR: {
    type: 'XOR',
    label: 'XOR',
    category: 'logic',
    inputPins: [
      { id: 'A', name: 'A', direction: 'input' },
      { id: 'B', name: 'B', direction: 'input' },
    ],
    outputPins: [{ id: 'OUT', name: 'Out', direction: 'output' }],
  },
  XNOR: {
    type: 'XNOR',
    label: 'XNOR',
    category: 'logic',
    inputPins: [
      { id: 'A', name: 'A', direction: 'input' },
      { id: 'B', name: 'B', direction: 'input' },
    ],
    outputPins: [{ id: 'OUT', name: 'Out', direction: 'output' }],
  },
  TRISTATE_BUFFER: {
    type: 'TRISTATE_BUFFER',
    label: 'Tri-State Buffer',
    category: 'logic',
    inputPins: [
      { id: 'DATA', name: 'Data', direction: 'input' },
      { id: 'EN', name: 'Enable', direction: 'input' },
    ],
    outputPins: [{ id: 'OUT', name: 'Out', direction: 'output' }],
  },
  MUX2: {
    type: 'MUX2',
    label: '2:1 MUX',
    category: 'logic',
    inputPins: [
      { id: 'A', name: 'A', direction: 'input' },
      { id: 'B', name: 'B', direction: 'input' },
      { id: 'SEL', name: 'SEL', direction: 'input' },
    ],
    outputPins: [{ id: 'OUT', name: 'Out', direction: 'output' }],
  },
  MUX4: {
    type: 'MUX4',
    label: '4:1 MUX',
    category: 'logic',
    inputPins: [
      { id: 'I0', name: 'I0', direction: 'input' },
      { id: 'I1', name: 'I1', direction: 'input' },
      { id: 'I2', name: 'I2', direction: 'input' },
      { id: 'I3', name: 'I3', direction: 'input' },
      { id: 'S0', name: 'S0', direction: 'input' },
      { id: 'S1', name: 'S1', direction: 'input' },
    ],
    outputPins: [{ id: 'OUT', name: 'Out', direction: 'output' }],
  },
  DEMUX2: {
    type: 'DEMUX2',
    label: '1:2 DEMUX',
    category: 'logic',
    inputPins: [
      { id: 'IN', name: 'In', direction: 'input' },
      { id: 'SEL', name: 'SEL', direction: 'input' },
    ],
    outputPins: [
      { id: 'Y0', name: 'Y0', direction: 'output' },
      { id: 'Y1', name: 'Y1', direction: 'output' },
    ],
  },
  DECODER2TO4: {
    type: 'DECODER2TO4',
    label: '2-to-4 Decoder',
    category: 'logic',
    inputPins: [
      { id: 'A0', name: 'A0', direction: 'input' },
      { id: 'A1', name: 'A1', direction: 'input' },
      { id: 'EN', name: 'EN', direction: 'input' },
    ],
    outputPins: [
      { id: 'Y0', name: 'Y0', direction: 'output' },
      { id: 'Y1', name: 'Y1', direction: 'output' },
      { id: 'Y2', name: 'Y2', direction: 'output' },
      { id: 'Y3', name: 'Y3', direction: 'output' },
    ],
  },
  HALF_ADDER: {
    type: 'HALF_ADDER',
    label: 'Half Adder',
    category: 'logic',
    inputPins: [
      { id: 'A', name: 'A', direction: 'input' },
      { id: 'B', name: 'B', direction: 'input' },
    ],
    outputPins: [
      { id: 'SUM', name: 'SUM', direction: 'output' },
      { id: 'CARRY', name: 'CARRY', direction: 'output' },
    ],
  },
  FULL_ADDER: {
    type: 'FULL_ADDER',
    label: 'Full Adder',
    category: 'logic',
    inputPins: [
      { id: 'A', name: 'A', direction: 'input' },
      { id: 'B', name: 'B', direction: 'input' },
      { id: 'CIN', name: 'CIN', direction: 'input' },
    ],
    outputPins: [
      { id: 'SUM', name: 'SUM', direction: 'output' },
      { id: 'COUT', name: 'COUT', direction: 'output' },
    ],
  },
  BUS_JOIN8: {
    type: 'BUS_JOIN8',
    label: '8-bit Bus Join',
    category: 'logic',
    inputPins: bitPins('D', 'D', 'input'),
    outputPins: bitPins('Q', 'Q', 'output'),
  },
  BUS_SPLIT8: {
    type: 'BUS_SPLIT8',
    label: '8-bit Bus Split',
    category: 'logic',
    inputPins: bitPins('D', 'D', 'input'),
    outputPins: bitPins('Q', 'Q', 'output'),
  },
  BUS_PROBE8: {
    type: 'BUS_PROBE8',
    label: '8-bit Bus Probe',
    category: 'io',
    inputPins: bitPins('D', 'D', 'input'),
    outputPins: [],
    defaultState: { bits: 'ZZZZZZZZ', hex: 'ZZ' },
  },
  DFF: {
    type: 'DFF',
    label: 'D Flip-Flop',
    category: 'sequential',
    inputPins: [
      { id: 'D', name: 'D', direction: 'input' },
      { id: 'CLK', name: 'CLK', direction: 'input' },
    ],
    outputPins: [
      { id: 'Q', name: 'Q', direction: 'output' },
      { id: 'Q_BAR', name: 'Q_BAR', direction: 'output' },
    ],
    defaultState: { q: '0', prevClk: '0' },
  },
  TFF: {
    type: 'TFF',
    label: 'T Flip-Flop',
    category: 'sequential',
    inputPins: [
      { id: 'T', name: 'T', direction: 'input' },
      { id: 'CLK', name: 'CLK', direction: 'input' },
    ],
    outputPins: [{ id: 'Q', name: 'Q', direction: 'output' }],
    defaultState: { q: '0', prevClk: '0' },
  },
  REGISTER8: {
    type: 'REGISTER8',
    label: '8-bit Register',
    category: 'sequential',
    inputPins: [
      ...busInputPins,
      { id: 'CLK', name: 'CLK', direction: 'input' },
      { id: 'LOAD', name: 'LOAD', direction: 'input' },
      { id: 'CLR', name: 'CLR', direction: 'input' },
    ],
    outputPins: busOutputPins,
    defaultState: { qBits: ['0', '0', '0', '0', '0', '0', '0', '0'], prevClk: '0' },
  },
  CHIP: {
    type: 'CHIP',
    label: 'Custom Chip',
    category: 'chip',
    inputPins: [],
    outputPins: [],
    defaultState: {},
  },
};

export const GATE_NODE_TYPES = new Set(['NOT', 'AND', 'OR', 'NAND', 'NOR', 'XOR', 'XNOR']);
export const COMBINATIONAL_NODE_TYPES = new Set([
  ...GATE_NODE_TYPES,
  'TRISTATE_BUFFER',
  'MUX2',
  'MUX4',
  'DEMUX2',
  'DECODER2TO4',
  'HALF_ADDER',
  'FULL_ADDER',
  'BUS_JOIN8',
  'BUS_SPLIT8',
]);
export const SEQUENTIAL_NODE_TYPES = new Set(['DFF', 'TFF', 'REGISTER8']);
