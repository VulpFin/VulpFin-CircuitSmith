import type { CircuitDefinition, NodeInstance } from '@vfcs/circuit-model';

export interface VerilogExportResult {
  filename: string;
  content: string;
  warnings: string[];
}

type GateType = 'NOT' | 'AND' | 'OR' | 'NAND' | 'NOR' | 'XOR' | 'XNOR';

const GATE_TYPES = new Set<GateType>(['NOT', 'AND', 'OR', 'NAND', 'NOR', 'XOR', 'XNOR']);
const SOURCE_TYPES = new Set(['INPUT', 'CLOCK', 'VCC', 'GND', 'VSS']);
const SINK_TYPES = new Set(['OUTPUT', 'LED', 'BUS_PROBE8']);

const OUTPUT_PINS_BY_TYPE: Record<string, string[]> = {
  NOT: ['OUT'],
  AND: ['OUT'],
  OR: ['OUT'],
  NAND: ['OUT'],
  NOR: ['OUT'],
  XOR: ['OUT'],
  XNOR: ['OUT'],
  MUX2: ['OUT'],
  MUX4: ['OUT'],
  DEMUX2: ['Y0', 'Y1'],
  DECODER2TO4: ['Y0', 'Y1', 'Y2', 'Y3'],
  HALF_ADDER: ['SUM', 'CARRY'],
  FULL_ADDER: ['SUM', 'COUT'],
  BUS_JOIN8: ['Q0', 'Q1', 'Q2', 'Q3', 'Q4', 'Q5', 'Q6', 'Q7'],
  BUS_SPLIT8: ['Q0', 'Q1', 'Q2', 'Q3', 'Q4', 'Q5', 'Q6', 'Q7'],
  DFF: ['Q', 'Q_BAR'],
  TFF: ['Q'],
  REGISTER8: ['Q0', 'Q1', 'Q2', 'Q3', 'Q4', 'Q5', 'Q6', 'Q7'],
};

function sanitizeIdentifier(raw: string): string {
  const clean = raw.replace(/[^a-zA-Z0-9_]/g, '_');
  if (/^[0-9]/.test(clean)) {
    return `n_${clean}`;
  }
  return clean;
}

function nodePinSignal(nodeId: string, pinId: string): string {
  return sanitizeIdentifier(`${nodeId}_${pinId}`);
}

function inputSignalForNode(node: NodeInstance): string {
  return sanitizeIdentifier(node.id);
}

function driverSignals(circuit: CircuitDefinition, nodeId: string, pinId: string): string[] {
  const incoming = circuit.wires.filter((wire) => wire.to.nodeId === nodeId && wire.to.pinId === pinId);

  return incoming
    .map((wire) => {
      const sourceNode = circuit.nodes.find((node) => node.id === wire.from.nodeId);
      if (!sourceNode) {
        return null;
      }

      if (sourceNode.nodeType === 'INPUT' || sourceNode.nodeType === 'CLOCK') {
        return inputSignalForNode(sourceNode);
      }
      if (sourceNode.nodeType === 'VCC') {
        return "1'b1";
      }
      if (sourceNode.nodeType === 'GND' || sourceNode.nodeType === 'VSS') {
        return "1'b0";
      }

      return nodePinSignal(wire.from.nodeId, wire.from.pinId);
    })
    .filter((item): item is string => Boolean(item));
}

function resolveSingleDriver(
  circuit: CircuitDefinition,
  nodeId: string,
  pinId: string,
  warnings: string[],
  fallback: string,
): string {
  const drivers = driverSignals(circuit, nodeId, pinId);

  if (drivers.length === 0) {
    warnings.push(`Node ${nodeId}.${pinId} has no driver; emitted fallback ${fallback}.`);
    return fallback;
  }

  if (drivers.length > 1) {
    warnings.push(
      `Node ${nodeId}.${pinId} has ${drivers.length} drivers in circuit graph. Verilog export uses first driver ${drivers[0]}.`,
    );
  }

  return drivers[0];
}

function renderGateAssign(node: NodeInstance, circuit: CircuitDefinition, warnings: string[]): string | null {
  if (!GATE_TYPES.has(node.nodeType as GateType)) {
    return null;
  }

  const out = nodePinSignal(node.id, 'OUT');
  const gateType = node.nodeType as GateType;
  switch (gateType) {
    case 'NOT': {
      const inPin = resolveSingleDriver(circuit, node.id, 'IN', warnings, "1'bx");
      return `assign ${out} = ~(${inPin});`;
    }
    case 'AND': {
      const a = resolveSingleDriver(circuit, node.id, 'A', warnings, "1'bx");
      const b = resolveSingleDriver(circuit, node.id, 'B', warnings, "1'bx");
      return `assign ${out} = (${a}) & (${b});`;
    }
    case 'OR': {
      const a = resolveSingleDriver(circuit, node.id, 'A', warnings, "1'bx");
      const b = resolveSingleDriver(circuit, node.id, 'B', warnings, "1'bx");
      return `assign ${out} = (${a}) | (${b});`;
    }
    case 'NAND': {
      const a = resolveSingleDriver(circuit, node.id, 'A', warnings, "1'bx");
      const b = resolveSingleDriver(circuit, node.id, 'B', warnings, "1'bx");
      return `assign ${out} = ~((${a}) & (${b}));`;
    }
    case 'NOR': {
      const a = resolveSingleDriver(circuit, node.id, 'A', warnings, "1'bx");
      const b = resolveSingleDriver(circuit, node.id, 'B', warnings, "1'bx");
      return `assign ${out} = ~((${a}) | (${b}));`;
    }
    case 'XOR': {
      const a = resolveSingleDriver(circuit, node.id, 'A', warnings, "1'bx");
      const b = resolveSingleDriver(circuit, node.id, 'B', warnings, "1'bx");
      return `assign ${out} = (${a}) ^ (${b});`;
    }
    case 'XNOR': {
      const a = resolveSingleDriver(circuit, node.id, 'A', warnings, "1'bx");
      const b = resolveSingleDriver(circuit, node.id, 'B', warnings, "1'bx");
      return `assign ${out} = ~((${a}) ^ (${b}));`;
    }
    default:
      return null;
  }
}

function renderBuildingBlockAssigns(node: NodeInstance, circuit: CircuitDefinition, warnings: string[]): string[] {
  const out = (pinId: string) => nodePinSignal(node.id, pinId);
  const input = (pinId: string, fallback = "1'bx") => resolveSingleDriver(circuit, node.id, pinId, warnings, fallback);

  if (node.nodeType === 'MUX2') {
    return [`assign ${out('OUT')} = (${input('SEL', "1'b0")}) ? ${input('B')} : ${input('A')};`];
  }

  if (node.nodeType === 'MUX4') {
    const sel = `{${input('S1', "1'b0")}, ${input('S0', "1'b0")}}`;
    return [
      `assign ${out('OUT')} = (${sel} == 2'b00) ? ${input('I0')} :`,
      `                    (${sel} == 2'b01) ? ${input('I1')} :`,
      `                    (${sel} == 2'b10) ? ${input('I2')} : ${input('I3')};`,
    ];
  }

  if (node.nodeType === 'DEMUX2') {
    return [
      `assign ${out('Y0')} = (${input('SEL', "1'b0")}) ? 1'b0 : ${input('IN')};`,
      `assign ${out('Y1')} = (${input('SEL', "1'b0")}) ? ${input('IN')} : 1'b0;`,
    ];
  }

  if (node.nodeType === 'DECODER2TO4') {
    const en = input('EN', "1'b0");
    const a0 = input('A0', "1'b0");
    const a1 = input('A1', "1'b0");
    return [0, 1, 2, 3].map((index) => {
      const bit0 = index & 1 ? a0 : `~(${a0})`;
      const bit1 = index & 2 ? a1 : `~(${a1})`;
      return `assign ${out(`Y${index}`)} = (${en}) & (${bit0}) & (${bit1});`;
    });
  }

  if (node.nodeType === 'HALF_ADDER') {
    const a = input('A');
    const b = input('B');
    return [`assign ${out('SUM')} = (${a}) ^ (${b});`, `assign ${out('CARRY')} = (${a}) & (${b});`];
  }

  if (node.nodeType === 'FULL_ADDER') {
    const a = input('A');
    const b = input('B');
    const cin = input('CIN', "1'b0");
    return [
      `assign ${out('SUM')} = (${a}) ^ (${b}) ^ (${cin});`,
      `assign ${out('COUT')} = ((${a}) & (${b})) | ((${cin}) & ((${a}) ^ (${b})));`,
    ];
  }

  if (node.nodeType === 'BUS_JOIN8' || node.nodeType === 'BUS_SPLIT8') {
    return Array.from({ length: 8 }, (_, index) => `assign ${out(`Q${index}`)} = ${input(`D${index}`)};`);
  }

  return [];
}

function renderSequentialBlock(
  node: NodeInstance,
  circuit: CircuitDefinition,
  warnings: string[],
): string[] {
  const outputSignal = nodePinSignal(node.id, 'Q');
  const clockSignal = resolveSingleDriver(circuit, node.id, 'CLK', warnings, "1'b0");

  if (node.nodeType === 'DFF') {
    const dSignal = resolveSingleDriver(circuit, node.id, 'D', warnings, "1'bx");
    return [
      `always @(posedge ${clockSignal}) begin`,
      `  ${outputSignal} <= ${dSignal};`,
      'end',
      `assign ${nodePinSignal(node.id, 'Q_BAR')} = ~${nodePinSignal(node.id, 'Q')};`,
    ];
  }

  if (node.nodeType === 'TFF') {
    const tSignal = resolveSingleDriver(circuit, node.id, 'T', warnings, "1'b0");
    return [
      `always @(posedge ${clockSignal}) begin`,
      `  if (${tSignal}) ${outputSignal} <= ~${outputSignal};`,
      'end',
    ];
  }

  if (node.nodeType === 'REGISTER8') {
    const clockSignal = resolveSingleDriver(circuit, node.id, 'CLK', warnings, "1'b0");
    const loadSignal = resolveSingleDriver(circuit, node.id, 'LOAD', warnings, "1'b0");
    const clearSignal = resolveSingleDriver(circuit, node.id, 'CLR', warnings, "1'b0");
    const lines = [`always @(posedge ${clockSignal} or posedge ${clearSignal}) begin`, `  if (${clearSignal}) begin`];
    for (let index = 0; index < 8; index += 1) {
      lines.push(`    ${nodePinSignal(node.id, `Q${index}`)} <= 1'b0;`);
    }
    lines.push(`  end else if (${loadSignal}) begin`);
    for (let index = 0; index < 8; index += 1) {
      const dSignal = resolveSingleDriver(circuit, node.id, `D${index}`, warnings, "1'bx");
      lines.push(`    ${nodePinSignal(node.id, `Q${index}`)} <= ${dSignal};`);
    }
    lines.push('  end', 'end');
    return lines;
  }

  return [];
}

export function exportCircuitAsVerilog(circuit: CircuitDefinition): VerilogExportResult {
  const warnings: string[] = [];
  const moduleName = sanitizeIdentifier(circuit.id || 'vfcs_circuit');

  const inputNodes = circuit.nodes.filter((node) => node.nodeType === 'INPUT' || node.nodeType === 'CLOCK');
  const outputNodes = circuit.nodes.filter((node) => node.nodeType === 'OUTPUT' || node.nodeType === 'LED');

  const ports = [
    ...inputNodes.map((node) => inputSignalForNode(node)),
    ...outputNodes.map((node) => sanitizeIdentifier(node.id)),
  ];

  const regSignals: string[] = [];
  const wireSignals: string[] = [];

  for (const node of circuit.nodes) {
    if (SOURCE_TYPES.has(node.nodeType) || SINK_TYPES.has(node.nodeType)) {
      continue;
    }

    const outputPins = OUTPUT_PINS_BY_TYPE[node.nodeType] ?? [];
    if (outputPins.length === 0) {
      continue;
    }

    for (const pinId of outputPins) {
      if (node.nodeType === 'DFF' && pinId === 'Q') {
        regSignals.push(nodePinSignal(node.id, pinId));
      } else if (node.nodeType === 'TFF' || node.nodeType === 'REGISTER8') {
        regSignals.push(nodePinSignal(node.id, pinId));
      } else {
        wireSignals.push(nodePinSignal(node.id, pinId));
      }
    }
  }

  const lines: string[] = [];
  lines.push(`module ${moduleName}(`);
  if (ports.length > 0) {
    lines.push(`  ${[...new Set(ports)].join(',\n  ')}`);
  }
  lines.push(');');
  lines.push('');

  inputNodes.forEach((node) => {
    lines.push(`input ${inputSignalForNode(node)};`);
    if (node.nodeType === 'CLOCK') {
      warnings.push(`CLOCK node ${node.id} is exported as an input port for synthesis-friendly output.`);
    }
  });
  outputNodes.forEach((node) => lines.push(`output ${sanitizeIdentifier(node.id)};`));
  lines.push('');

  if (wireSignals.length > 0) {
    lines.push(`wire ${[...new Set(wireSignals)].join(', ')};`);
  }
  if (regSignals.length > 0) {
    lines.push(`reg ${[...new Set(regSignals)].join(', ')};`);
  }
  lines.push('');

  for (const node of circuit.nodes) {
    const assignLine = renderGateAssign(node, circuit, warnings);
    if (assignLine) {
      lines.push(assignLine);
      continue;
    }

    if (node.nodeType === 'DFF' || node.nodeType === 'TFF') {
      lines.push(...renderSequentialBlock(node, circuit, warnings));
      continue;
    }

    if (node.nodeType === 'REGISTER8') {
      lines.push(...renderSequentialBlock(node, circuit, warnings));
      continue;
    }

    const buildingBlockLines = renderBuildingBlockAssigns(node, circuit, warnings);
    if (buildingBlockLines.length > 0) {
      lines.push(...buildingBlockLines);
      continue;
    }

    if (
      node.nodeType === 'INPUT'
      || node.nodeType === 'OUTPUT'
      || node.nodeType === 'LED'
      || node.nodeType === 'CLOCK'
      || node.nodeType === 'VCC'
      || node.nodeType === 'GND'
      || node.nodeType === 'VSS'
      || node.nodeType === 'BUS_PROBE8'
    ) {
      continue;
    }

    if (node.chipRefId) {
      lines.push(`// TODO: map chip instance ${node.id} (${node.chipRefId}) to module instantiation.`);
      warnings.push(`Chip instance ${node.id} was emitted as placeholder comment.`);
      continue;
    }

    lines.push(`// TODO: implement Verilog export for node ${node.id} (${node.nodeType})`);
    warnings.push(`Node type ${node.nodeType} was not translated and is emitted as placeholder.`);
  }

  lines.push('');
  outputNodes.forEach((node) => {
    const source = resolveSingleDriver(circuit, node.id, 'IN', warnings, "1'bx");
    lines.push(`assign ${sanitizeIdentifier(node.id)} = ${source};`);
  });

  lines.push('endmodule');

  return {
    filename: `${moduleName}.v`,
    content: lines.join('\n'),
    warnings,
  };
}
