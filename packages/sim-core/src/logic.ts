import type { LogicValue } from '@vfcs/circuit-model';

const LOGIC_HIGH: LogicValue = '1';
const LOGIC_LOW: LogicValue = '0';
const LOGIC_UNKNOWN: LogicValue = 'X';
const LOGIC_HIGH_Z: LogicValue = 'Z';
const LOGIC_ERROR: LogicValue = 'ERR';

const isKnown = (value: LogicValue): boolean => value === LOGIC_LOW || value === LOGIC_HIGH;

export function normalizeForLogic(value: LogicValue): LogicValue {
  if (value === LOGIC_HIGH_Z) {
    return LOGIC_UNKNOWN;
  }
  return value;
}

export function invert(value: LogicValue): LogicValue {
  if (value === LOGIC_ERROR) {
    return LOGIC_ERROR;
  }
  if (value === LOGIC_LOW) {
    return LOGIC_HIGH;
  }
  if (value === LOGIC_HIGH) {
    return LOGIC_LOW;
  }
  return LOGIC_UNKNOWN;
}

export function resolveDrivers(values: LogicValue[]): LogicValue {
  if (values.length === 0) {
    return LOGIC_HIGH_Z;
  }

  if (values.includes(LOGIC_ERROR)) {
    return LOGIC_ERROR;
  }

  const nonZValues = values.filter((value) => value !== LOGIC_HIGH_Z);
  if (nonZValues.length === 0) {
    return LOGIC_HIGH_Z;
  }

  const has0 = nonZValues.includes(LOGIC_LOW);
  const has1 = nonZValues.includes(LOGIC_HIGH);

  if (has0 && has1) {
    return LOGIC_ERROR;
  }

  if (nonZValues.includes(LOGIC_UNKNOWN)) {
    return LOGIC_UNKNOWN;
  }

  return has1 ? LOGIC_HIGH : LOGIC_LOW;
}

export function logicAnd(values: LogicValue[]): LogicValue {
  if (values.some((value) => value === LOGIC_ERROR)) {
    return LOGIC_ERROR;
  }

  const normalized = values.map(normalizeForLogic);

  if (normalized.includes(LOGIC_LOW)) {
    return LOGIC_LOW;
  }

  if (normalized.every((value) => value === LOGIC_HIGH)) {
    return LOGIC_HIGH;
  }

  return LOGIC_UNKNOWN;
}

export function logicOr(values: LogicValue[]): LogicValue {
  if (values.some((value) => value === LOGIC_ERROR)) {
    return LOGIC_ERROR;
  }

  const normalized = values.map(normalizeForLogic);

  if (normalized.includes(LOGIC_HIGH)) {
    return LOGIC_HIGH;
  }

  if (normalized.every((value) => value === LOGIC_LOW)) {
    return LOGIC_LOW;
  }

  return LOGIC_UNKNOWN;
}

export function logicXor(values: LogicValue[]): LogicValue {
  if (values.some((value) => value === LOGIC_ERROR)) {
    return LOGIC_ERROR;
  }

  const normalized = values.map(normalizeForLogic);
  if (normalized.some((value) => !isKnown(value))) {
    return LOGIC_UNKNOWN;
  }

  const ones = normalized.filter((value) => value === LOGIC_HIGH).length;
  return ones % 2 === 0 ? LOGIC_LOW : LOGIC_HIGH;
}

export function logicGateOutput(
  gate: 'NOT' | 'AND' | 'OR' | 'NAND' | 'NOR' | 'XOR' | 'XNOR',
  inputs: LogicValue[],
): LogicValue {
  switch (gate) {
    case 'NOT':
      return invert(normalizeForLogic(inputs[0] ?? LOGIC_UNKNOWN));
    case 'AND':
      return logicAnd(inputs);
    case 'OR':
      return logicOr(inputs);
    case 'NAND':
      return invert(logicAnd(inputs));
    case 'NOR':
      return invert(logicOr(inputs));
    case 'XOR':
      return logicXor(inputs);
    case 'XNOR':
      return invert(logicXor(inputs));
    default:
      return LOGIC_UNKNOWN;
  }
}

export const LogicConstants = {
  LOGIC_HIGH,
  LOGIC_LOW,
  LOGIC_UNKNOWN,
  LOGIC_HIGH_Z,
  LOGIC_ERROR,
} as const;