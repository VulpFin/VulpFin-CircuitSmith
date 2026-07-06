import {
  recalculateNets,
  sanitizeId,
  type CircuitDefinition,
  type NodeInstance,
  type PinReference,
  type Wire,
} from '@vfcs/circuit-model';
import {
  clamp,
  WORKSPACE_DEFAULT_HEIGHT,
  WORKSPACE_DEFAULT_WIDTH,
  WORKSPACE_MAX_HEIGHT,
  WORKSPACE_MAX_WIDTH,
  type WorkspaceSize,
} from './nodeSizing.js';

type TruthTableBit = '0' | '1' | 'X' | 'Z';

interface TruthTableRow {
  inputs: TruthTableBit[];
  outputs: TruthTableBit[];
}

interface ParsedTruthTable {
  inputNames: string[];
  outputNames: string[];
  rows: TruthTableRow[];
}

interface LogicFridayEquation {
  outputName: string;
  expression: string;
  terms: Array<Map<string, TruthTableBit>>;
  constant?: '0' | '1';
}

interface BuiltTerm {
  ref: PinReference;
  expression: string;
}

export interface TruthTableImportSummary {
  inputCount: number;
  outputCount: number;
  rowCount: number;
  nodeCount: number;
  wireCount: number;
  logicGateCount: number;
  generatedTermCount: number;
  warnings: string[];
  equations: string[];
}

export interface TruthTableImportResult {
  circuit: CircuitDefinition;
  workspaceSize: WorkspaceSize;
  summary: TruthTableImportSummary;
  preview: string;
}

interface OutputBuildContext {
  outputIndex: number;
  outputName: string;
  y: number;
}

const IMPORTED_NODE_WIDTH = 100;
const IMPORTED_NODE_HEIGHT = 58;
const IMPORTED_IO_WIDTH = 130;
const IMPORTED_IO_HEIGHT = 70;
const ROW_GAP = 86;
const COLUMN_GAP = 170;

export function isNativeLogicFridayBinary(bytes: Uint8Array): boolean {
  return (
    bytes.length >= 4
    && bytes[0] === 0x4c
    && bytes[1] === 0x54
    && bytes[2] === 0x4b
    && bytes[3] === 0x31
  );
}

export function buildCircuitFromTruthTableText(source: string, sourceName = 'truth table'): TruthTableImportResult {
  const parsed = parseTruthTableText(source);
  return buildCircuitFromParsedTruthTable(parsed, sourceName);
}

export function buildCircuitFromLogicFridayBytes(bytes: Uint8Array, sourceName = 'Logic Friday file'): TruthTableImportResult {
  if (!isNativeLogicFridayBinary(bytes)) {
    const text = new TextDecoder('utf-8').decode(bytes);
    return buildCircuitFromTruthTableText(text, sourceName);
  }

  const equations = extractLogicFridayEquations(bytes);
  if (equations.length === 0) {
    throw new Error(
      'Native Logic Friday binary detected, but no embedded "Imported from file" SOP equations were found. Export/copy the table as CSV text for this file.',
    );
  }

  const parsed = truthTableFromLogicFridayEquations(equations);
  const result = buildCircuitFromParsedTruthTable(parsed, sourceName, { warnOutputDontCares: false });

  return {
    ...result,
    circuit: {
      ...result.circuit,
      description: 'Generated from embedded Logic Friday SOP equations.',
      metadata: {
        ...(result.circuit.metadata ?? {}),
        generatedBy: 'logic-friday-binary-equation-import',
        recoveredEquationCount: equations.length,
      },
    },
    preview: [
      'Logic Friday Binary Import',
      '',
      `Recovered equations: ${equations.length}`,
      '',
      ...equations.map((equation) => `${equation.outputName} = ${equation.expression};`),
      '',
      result.preview,
    ].join('\n'),
  };
}

function parseTruthTableText(source: string): ParsedTruthTable {
  const rows = source
    .replace(/^\uFEFF/, '')
    .split(/\r?\n/)
    .map((line, index) => ({ line: line.trim(), lineNumber: index + 1 }))
    .filter(({ line }) => line.length > 0 && !line.startsWith('#') && !line.startsWith('//'));

  if (rows.length < 2) {
    throw new Error('Paste or upload a header plus at least one truth-table row.');
  }

  const header = parseTruthTableLine(rows[0].line);
  const separatorIndex = header.findIndex((cell) => cell.trim() === '');
  if (separatorIndex <= 0 || separatorIndex >= header.length - 1) {
    throw new Error('Truth tables need a blank separator column between inputs and outputs, for example: A,B,,Y.');
  }

  const inputNames = uniquifySignalNames(header.slice(0, separatorIndex), 'IN');
  const outputNames = uniquifySignalNames(header.slice(separatorIndex + 1), 'OUT');
  const expectedWithSeparator = inputNames.length + outputNames.length + 1;
  const expectedWithoutSeparator = inputNames.length + outputNames.length;
  const parsedRows: TruthTableRow[] = [];

  for (const { line, lineNumber } of rows.slice(1)) {
    const cells = parseTruthTableLine(line);
    let inputCells: string[];
    let outputCells: string[];

    if (cells.length === expectedWithSeparator) {
      inputCells = cells.slice(0, inputNames.length);
      outputCells = cells.slice(inputNames.length + 1);
    } else if (cells.length === expectedWithoutSeparator) {
      inputCells = cells.slice(0, inputNames.length);
      outputCells = cells.slice(inputNames.length);
    } else {
      throw new Error(
        `Line ${lineNumber} has ${cells.length} column(s), but expected ${expectedWithSeparator} with the separator column.`,
      );
    }

    parsedRows.push({
      inputs: inputCells.map((cell) => normalizeTruthTableBit(cell, lineNumber, 'input')),
      outputs: outputCells.map((cell) => normalizeTruthTableBit(cell, lineNumber, 'output')),
    });
  }

  return {
    inputNames,
    outputNames,
    rows: parsedRows,
  };
}

function parseTruthTableLine(line: string): string[] {
  const pipeIndex = findUnquotedPipe(line);
  if (pipeIndex >= 0) {
    return [
      ...parseLooseColumns(line.slice(0, pipeIndex)),
      '',
      ...parseLooseColumns(line.slice(pipeIndex + 1)),
    ];
  }

  if (line.includes(',')) {
    return parseCsvLine(line).map((cell) => cell.trim());
  }

  return line.split(/\s+/).map((cell) => cell.trim());
}

function findUnquotedPipe(line: string): number {
  let inQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === '|' && !inQuotes) {
      return index;
    }
  }

  return -1;
}

function parseLooseColumns(segment: string): string[] {
  const trimmed = segment.trim();
  if (!trimmed) {
    return [];
  }

  if (trimmed.includes(',')) {
    return parseCsvLine(trimmed).map((cell) => cell.trim()).filter(Boolean);
  }

  return trimmed.split(/\s+/).map((cell) => cell.trim()).filter(Boolean);
}

function parseCsvLine(line: string): string[] {
  const cells: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const nextChar = line[index + 1];

    if (char === '"' && inQuotes && nextChar === '"') {
      current += '"';
      index += 1;
      continue;
    }

    if (char === '"') {
      inQuotes = !inQuotes;
      continue;
    }

    if (char === ',' && !inQuotes) {
      cells.push(current);
      current = '';
      continue;
    }

    current += char;
  }

  cells.push(current);
  return cells;
}

function uniquifySignalNames(rawNames: string[], fallbackPrefix: string): string[] {
  const used = new Set<string>();

  return rawNames.map((rawName, index) => {
    const fallback = `${fallbackPrefix}${index + 1}`;
    const base = rawName.trim() || fallback;
    let candidate = base;
    let suffix = 2;

    while (used.has(candidate.toLowerCase())) {
      candidate = `${base}_${suffix}`;
      suffix += 1;
    }

    used.add(candidate.toLowerCase());
    return candidate;
  });
}

function normalizeTruthTableBit(cell: string, lineNumber: number, role: 'input' | 'output'): TruthTableBit {
  const normalized = cell.trim().toUpperCase();

  if (normalized === '' || normalized === 'X' || normalized === '-' || normalized === '?' || normalized === '*') {
    return 'X';
  }

  if (normalized === '0' || normalized === 'L' || normalized === 'LOW' || normalized === 'FALSE') {
    return '0';
  }

  if (normalized === '1' || normalized === 'H' || normalized === 'HIGH' || normalized === 'TRUE') {
    return '1';
  }

  if (
    role === 'output'
    && (normalized === 'Z'
      || normalized === 'HZ'
      || normalized === 'HIGH-Z'
      || normalized === 'HIGHZ'
      || normalized === 'HI-Z'
      || normalized === 'HIZ')
  ) {
    return 'Z';
  }

  throw new Error(
    `Line ${lineNumber} uses unsupported truth-table value "${cell}". Use 0, 1, X, -, or ?${role === 'output' ? ', or Z' : ''}.`,
  );
}

function extractLogicFridayEquations(bytes: Uint8Array): LogicFridayEquation[] {
  const strings = extractPrintableStrings(bytes, 2);
  const markerIndex = strings.map((entry) => entry.text).lastIndexOf('Imported from file:');

  if (markerIndex < 0) {
    return [];
  }

  const equationLines: string[] = [];
  for (const entry of strings.slice(markerIndex + 1)) {
    if (looksLikeEquation(entry.text)) {
      equationLines.push(entry.text);
    } else if (equationLines.length > 0) {
      break;
    }
  }

  return parseLogicFridayEquationLines(equationLines);
}

function extractPrintableStrings(bytes: Uint8Array, minLength: number): Array<{ offset: number; text: string }> {
  const strings: Array<{ offset: number; text: string }> = [];
  let current = '';
  let start = 0;

  for (let index = 0; index < bytes.length; index += 1) {
    const byte = bytes[index];
    const isPrintable = (byte >= 32 && byte <= 126) || byte === 9;

    if (isPrintable) {
      if (!current) {
        start = index;
      }
      current += String.fromCharCode(byte);
      continue;
    }

    if (current.length >= minLength) {
      strings.push({ offset: start, text: current.trim() });
    }
    current = '';
  }

  if (current.length >= minLength) {
    strings.push({ offset: start, text: current.trim() });
  }

  return strings;
}

function looksLikeEquation(line: string): boolean {
  return /^[A-Za-z0-9_]+\s*=\s*.+;?\s*$/.test(line.trim());
}

function parseLogicFridayEquationLines(lines: string[]): LogicFridayEquation[] {
  const equations: LogicFridayEquation[] = [];
  const seenOutputs = new Set<string>();

  for (const line of lines) {
    const match = /^([A-Za-z0-9_]+)\s*=\s*(.+?);?\s*$/.exec(line.trim());
    if (!match) {
      continue;
    }

    const outputName = match[1];
    if (seenOutputs.has(outputName.toLowerCase())) {
      continue;
    }

    const expression = match[2].trim().replace(/;$/, '').trim();
    const normalizedExpression = expression.toUpperCase();

    if (normalizedExpression === '0' || normalizedExpression === 'CONST0') {
      equations.push({ outputName, expression: '0', terms: [], constant: '0' });
      seenOutputs.add(outputName.toLowerCase());
      continue;
    }

    if (normalizedExpression === '1' || normalizedExpression === 'CONST1') {
      equations.push({ outputName, expression: '1', terms: [new Map()], constant: '1' });
      seenOutputs.add(outputName.toLowerCase());
      continue;
    }

    const terms = expression
      .split('+')
      .map((term) => parseLogicFridayProductTerm(term))
      .filter((term): term is Map<string, TruthTableBit> => term !== null);

    equations.push({ outputName, expression, terms });
    seenOutputs.add(outputName.toLowerCase());
  }

  return equations;
}

function parseLogicFridayProductTerm(term: string): Map<string, TruthTableBit> | null {
  const literals = new Map<string, TruthTableBit>();
  const factors = term.trim().split(/[\s*]+/).filter(Boolean);

  if (factors.length === 0) {
    return new Map();
  }

  for (const factor of factors) {
    const trimmed = factor.trim();
    const normalized = trimmed.toUpperCase();
    if (normalized === '1' || normalized === 'CONST1') {
      continue;
    }
    if (normalized === '0' || normalized === 'CONST0') {
      return null;
    }

    const match = /^([!~]?)([A-Za-z0-9_]+)('?)$/.exec(trimmed);
    if (!match) {
      throw new Error(`Unsupported Logic Friday product term "${term}". Only SOP equations are supported right now.`);
    }

    const variableName = match[2];
    const isNegated = Boolean(match[1]) !== Boolean(match[3]);
    const value: TruthTableBit = isNegated ? '0' : '1';
    const existing = literals.get(variableName);
    if (existing && existing !== value) {
      return null;
    }
    literals.set(variableName, value);
  }

  return literals;
}

function truthTableFromLogicFridayEquations(equations: LogicFridayEquation[]): ParsedTruthTable {
  const inputNames: string[] = [];
  const inputNameSet = new Set<string>();
  const outputNames = equations.map((equation) => equation.outputName);
  const rows: TruthTableRow[] = [];

  for (const equation of equations) {
    for (const term of equation.terms) {
      for (const inputName of term.keys()) {
        const key = inputName.toLowerCase();
        if (!inputNameSet.has(key)) {
          inputNameSet.add(key);
          inputNames.push(inputName);
        }
      }
    }
  }

  equations.forEach((equation, outputIndex) => {
    if (equation.constant === '0') {
      return;
    }

    if (equation.constant === '1') {
      const outputs = outputNames.map(() => 'X' as TruthTableBit);
      outputs[outputIndex] = '1';
      rows.push({
        inputs: inputNames.map(() => 'X' as TruthTableBit),
        outputs,
      });
      return;
    }

    for (const term of equation.terms) {
      const outputs = outputNames.map(() => 'X' as TruthTableBit);
      outputs[outputIndex] = '1';
      rows.push({
        inputs: inputNames.map((inputName) => term.get(inputName) ?? 'X'),
        outputs,
      });
    }
  });

  return {
    inputNames,
    outputNames,
    rows,
  };
}

function buildCircuitFromParsedTruthTable(
  parsed: ParsedTruthTable,
  sourceName: string,
  options: { warnOutputDontCares?: boolean } = {},
): TruthTableImportResult {
  const shouldWarnOutputDontCares = options.warnOutputDontCares ?? true;
  const nodes: NodeInstance[] = [];
  const wires: Wire[] = [];
  const usedNodeIds = new Set<string>();
  const equations: string[] = [];
  const warnings = new Set<string>();
  const inputRefs: PinReference[] = [];
  const invertedInputRefs = new Map<number, PinReference>();
  const termRefsByOutput = new Map<number, BuiltTerm[]>();
  let wireIndex = 1;
  let generatedTermCount = 0;
  let maxX = 0;
  let maxY = 0;

  const createNodeId = (base: string): string => {
    const cleanBase = sanitizeId(base);
    let candidate = cleanBase;
    let suffix = 2;

    while (usedNodeIds.has(candidate)) {
      candidate = `${cleanBase}_${suffix}`;
      suffix += 1;
    }

    usedNodeIds.add(candidate);
    return candidate;
  };

  const addNode = (
    nodeType: string,
    label: string,
    x: number,
    y: number,
    parameters: Record<string, unknown> = {},
  ): NodeInstance => {
    const id = createNodeId(label || nodeType);
    const size = nodeType === 'INPUT' || nodeType === 'OUTPUT'
      ? { width: IMPORTED_IO_WIDTH, height: IMPORTED_IO_HEIGHT }
      : { width: IMPORTED_NODE_WIDTH, height: IMPORTED_NODE_HEIGHT };
    const node: NodeInstance = {
      id,
      nodeType,
      label,
      position: { x, y },
      parameters: {
        width: size.width,
        height: size.height,
        ...parameters,
      },
    };

    if (nodeType === 'INPUT') {
      node.state = { value: '0' };
    } else if (nodeType === 'OUTPUT') {
      node.state = { value: 'X' };
    }

    nodes.push(node);
    maxX = Math.max(maxX, x + size.width);
    maxY = Math.max(maxY, y + size.height);
    return node;
  };

  const addWire = (from: PinReference, to: PinReference) => {
    wires.push({
      id: `wire_${wireIndex}`,
      from,
      to,
    });
    wireIndex += 1;
  };

  parsed.inputNames.forEach((inputName, index) => {
    const node = addNode('INPUT', inputName, 40, 50 + index * ROW_GAP);
    inputRefs[index] = { nodeId: node.id, pinId: 'OUT' };
  });

  const ensureInvertedInput = (inputIndex: number): PinReference => {
    const existing = invertedInputRefs.get(inputIndex);
    if (existing) {
      return existing;
    }

    const inputName = parsed.inputNames[inputIndex] ?? `IN${inputIndex + 1}`;
    const y = 50 + inputIndex * ROW_GAP;
    const node = addNode('NOT', `NOT ${inputName}`, 40 + COLUMN_GAP, y);
    addWire(inputRefs[inputIndex], { nodeId: node.id, pinId: 'IN' });
    const ref = { nodeId: node.id, pinId: 'OUT' };
    invertedInputRefs.set(inputIndex, ref);
    return ref;
  };

  const constantRefs = new Map<'0' | '1', PinReference>();
  const ensureConstant = (value: '0' | '1'): PinReference => {
    const existing = constantRefs.get(value);
    if (existing) {
      return existing;
    }

    const y = 50 + parsed.inputNames.length * ROW_GAP + constantRefs.size * ROW_GAP;
    const nodeType = value === '1' ? 'VCC' : 'GND';
    const node = addNode(nodeType, value === '1' ? 'CONST 1' : 'CONST 0', 40, y);
    const ref = { nodeId: node.id, pinId: 'OUT' };
    constantRefs.set(value, ref);
    return ref;
  };

  const literalForInput = (inputIndex: number, bit: TruthTableBit): BuiltTerm | null => {
    const inputName = parsed.inputNames[inputIndex] ?? `IN${inputIndex + 1}`;

    if (bit === 'X') {
      return null;
    }

    if (bit === '1') {
      return {
        ref: inputRefs[inputIndex],
        expression: inputName,
      };
    }

    return {
      ref: ensureInvertedInput(inputIndex),
      expression: `!${inputName}`,
    };
  };

  const buildProductTerm = (row: TruthTableRow, outputContext: OutputBuildContext, termIndex: number): BuiltTerm => {
    const literals = row.inputs
      .map((bit, inputIndex) => literalForInput(inputIndex, bit))
      .filter((term): term is BuiltTerm => term !== null);

    if (literals.length === 0) {
      return {
        ref: ensureConstant('1'),
        expression: '1',
      };
    }

    if (literals.length === 1) {
      return literals[0];
    }

    const termY = outputContext.y + termIndex * ROW_GAP;
    let current = literals[0];

    for (let literalIndex = 1; literalIndex < literals.length; literalIndex += 1) {
      const x = 40 + COLUMN_GAP * (2 + literalIndex - 1);
      const node = addNode(
        'AND',
        `${outputContext.outputName} AND ${termIndex + 1}.${literalIndex}`,
        x,
        termY,
      );
      addWire(current.ref, { nodeId: node.id, pinId: 'A' });
      addWire(literals[literalIndex].ref, { nodeId: node.id, pinId: 'B' });
      current = {
        ref: { nodeId: node.id, pinId: 'OUT' },
        expression: `(${current.expression} & ${literals[literalIndex].expression})`,
      };
    }

    return current;
  };

  const buildSopForRows = (
    rowsToCover: TruthTableRow[],
    outputContext: OutputBuildContext,
    conflictRows: TruthTableRow[],
    conflictLabel: string,
  ): { ref: PinReference; expression: string; terms: BuiltTerm[] } => {
    const terms: BuiltTerm[] = [];
    const seenTermKeys = new Set<string>();

    rowsToCover.forEach((row) => {
      const termKey = row.inputs.join('');
      if (seenTermKeys.has(termKey)) {
        return;
      }

      const conflictingRow = conflictRows.some((candidate) => rowCoversCandidate(row.inputs, candidate.inputs));
      if (conflictingRow) {
        warnings.add(
          `Output ${outputContext.outputName} has an input don't-care row that overlaps a ${conflictLabel} row; generated SOP may be broader than intended.`,
        );
      }

      seenTermKeys.add(termKey);
      generatedTermCount += 1;
      terms.push(buildProductTerm(row, outputContext, terms.length));
    });

    if (terms.length === 0) {
      return {
        ref: ensureConstant('0'),
        expression: '0',
        terms,
      };
    }

    if (terms.length === 1) {
      return {
        ref: terms[0].ref,
        expression: terms[0].expression,
        terms,
      };
    }

    let current = terms[0];
    const orX = 40 + COLUMN_GAP * (parsed.inputNames.length + 2);

    for (let termIndex = 1; termIndex < terms.length; termIndex += 1) {
      const node = addNode(
        'OR',
        `${outputContext.outputName} OR ${termIndex}`,
        orX + (termIndex - 1) * COLUMN_GAP,
        outputContext.y + termIndex * ROW_GAP,
      );
      addWire(current.ref, { nodeId: node.id, pinId: 'A' });
      addWire(terms[termIndex].ref, { nodeId: node.id, pinId: 'B' });
      current = {
        ref: { nodeId: node.id, pinId: 'OUT' },
        expression: `(${current.expression} | ${terms[termIndex].expression})`,
      };
    }

    return {
      ref: current.ref,
      expression: terms.map((term) => term.expression).join(' | '),
      terms,
    };
  };

  const buildOutputExpression = (outputContext: OutputBuildContext, outputNode: NodeInstance): string => {
    const oneRows = parsed.rows.filter((row) => row.outputs[outputContext.outputIndex] === '1');
    const zeroRows = parsed.rows.filter((row) => row.outputs[outputContext.outputIndex] === '0');
    const zRows = parsed.rows.filter((row) => row.outputs[outputContext.outputIndex] === 'Z');
    const drivenRows = parsed.rows.filter((row) =>
      row.outputs[outputContext.outputIndex] === '0' || row.outputs[outputContext.outputIndex] === '1',
    );
    const outputCareRows = parsed.rows.filter((row) => row.outputs[outputContext.outputIndex] !== 'X');
    const hasDontCareOutputs = parsed.rows.length !== outputCareRows.length;

    if (hasDontCareOutputs && shouldWarnOutputDontCares) {
      warnings.add(
        'Output X/-/? cells are accepted as don\'t-care rows, but this first-pass builder does not use them for minimization yet.',
      );
    }

    if (zRows.length > 0) {
      const data = buildSopForRows(
        oneRows,
        {
          ...outputContext,
          outputName: `${outputContext.outputName} DATA`,
        },
        zeroRows,
        '0',
      );
      const enable = buildSopForRows(
        drivenRows,
        {
          ...outputContext,
          outputName: `${outputContext.outputName} ENABLE`,
          y: outputContext.y + Math.max(1, oneRows.length) * ROW_GAP,
        },
        zRows,
        'Z',
      );
      termRefsByOutput.set(outputContext.outputIndex, data.terms);

      const triNode = addNode(
        'TRISTATE_BUFFER',
        `${outputContext.outputName} Tri-State`,
        Math.max(40, outputNode.position.x - COLUMN_GAP),
        outputContext.y,
      );
      addWire(data.ref, { nodeId: triNode.id, pinId: 'DATA' });
      addWire(enable.ref, { nodeId: triNode.id, pinId: 'EN' });
      addWire({ nodeId: triNode.id, pinId: 'OUT' }, { nodeId: outputNode.id, pinId: 'IN' });

      return `${outputContext.outputName} = ${data.expression} when (${enable.expression}) else Z`;
    }

    const data = buildSopForRows(oneRows, outputContext, zeroRows, '0');
    termRefsByOutput.set(outputContext.outputIndex, data.terms);
    addWire(data.ref, { nodeId: outputNode.id, pinId: 'IN' });
    return `${outputContext.outputName} = ${data.expression}`;
  };

  const generatedRowsPerOutput = parsed.outputNames.map((_, outputIndex) => {
    const oneRowCount = parsed.rows.filter((row) => row.outputs[outputIndex] === '1').length;
    const drivenRowCount = parsed.rows.filter(
      (row) => row.outputs[outputIndex] === '0' || row.outputs[outputIndex] === '1',
    ).length;
    const hasHighZRows = parsed.rows.some((row) => row.outputs[outputIndex] === 'Z');
    return hasHighZRows ? oneRowCount + drivenRowCount + 1 : oneRowCount;
  });
  const totalGeneratedRows = generatedRowsPerOutput.reduce((sum, count) => sum + Math.max(1, count), 0);
  const outputBaseY = Math.max(50, 50 + (parsed.inputNames.length + 2) * ROW_GAP);
  let outputCursorY = outputBaseY;

  parsed.outputNames.forEach((outputName, outputIndex) => {
    const outputY = outputCursorY;
    const termCount = Math.max(1, generatedRowsPerOutput[outputIndex] ?? 1);
    const outputNodeX = 40 + COLUMN_GAP * (parsed.inputNames.length + Math.max(4, termCount + 3));
    const outputNode = addNode('OUTPUT', outputName, outputNodeX, outputY);
    const expression = buildOutputExpression(
      {
        outputIndex,
        outputName,
        y: outputY,
      },
      outputNode,
    );
    equations.push(expression);
    outputCursorY += Math.max(1, termCount) * ROW_GAP + ROW_GAP;
  });

  if (totalGeneratedRows > 32) {
    warnings.add('Large truth tables can generate a lot of direct SOP gates; minimization is a good next upgrade.');
  }

  const workspaceSize = {
    width: clamp(maxX + 160, WORKSPACE_DEFAULT_WIDTH, WORKSPACE_MAX_WIDTH),
    height: clamp(maxY + 160, WORKSPACE_DEFAULT_HEIGHT, WORKSPACE_MAX_HEIGHT),
  };
  const circuit = recalculateNets({
    id: sanitizeId(sourceName || 'truth_table_import'),
    name: `${sourceName} Import`,
    description: 'Generated from a Logic Friday-style truth table import.',
    nodes,
    wires,
    nets: [],
    metadata: {
      generatedBy: 'truth-table-import',
      sourceName,
      inputNames: parsed.inputNames,
      outputNames: parsed.outputNames,
      rowCount: parsed.rows.length,
      outputTerms: Object.fromEntries(
        [...termRefsByOutput.entries()].map(([outputIndex, terms]) => [
          parsed.outputNames[outputIndex],
          terms.map((term) => term.expression),
        ]),
      ),
    },
  } satisfies CircuitDefinition);

  const logicGateCount = nodes.filter(
    (node) =>
      node.nodeType === 'NOT'
      || node.nodeType === 'AND'
      || node.nodeType === 'OR'
      || node.nodeType === 'TRISTATE_BUFFER',
  ).length;
  const summary = {
    inputCount: parsed.inputNames.length,
    outputCount: parsed.outputNames.length,
    rowCount: parsed.rows.length,
    nodeCount: nodes.length,
    wireCount: wires.length,
    logicGateCount,
    generatedTermCount,
    warnings: [...warnings],
    equations,
  } satisfies TruthTableImportSummary;

  return {
    circuit,
    workspaceSize,
    summary,
    preview: formatImportPreview(summary),
  };
}

function rowCoversCandidate(source: TruthTableBit[], candidate: TruthTableBit[]): boolean {
  return source.every((bit, index) => bit === 'X' || candidate[index] === 'X' || bit === candidate[index]);
}

function formatImportPreview(summary: TruthTableImportSummary): string {
  const lines = [
    'Truth Table Import',
    '',
    `Inputs: ${summary.inputCount}`,
    `Outputs: ${summary.outputCount}`,
    `Rows: ${summary.rowCount}`,
    `Nodes: ${summary.nodeCount}`,
    `Wires: ${summary.wireCount}`,
    `Logic gates: ${summary.logicGateCount}`,
    `Product terms: ${summary.generatedTermCount}`,
    '',
    'Generated equations:',
    ...summary.equations.map((equation) => `  ${equation}`),
  ];

  if (summary.warnings.length > 0) {
    lines.push('', 'Warnings:', ...summary.warnings.map((warning) => `  - ${warning}`));
  }

  return lines.join('\n');
}
