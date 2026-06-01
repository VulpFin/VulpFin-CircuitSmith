import type { NodeDefinition } from '@vfcs/circuit-model';

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
export const SEQUENTIAL_NODE_TYPES = new Set(['DFF', 'TFF']);
