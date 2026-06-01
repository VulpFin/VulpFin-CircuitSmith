import type { CircuitDefinition, NodeInstance } from '@vfcs/circuit-model';

export interface VerilogExportResult {
  filename: string;
  content: string;
  warnings: string[];
}

type GateType = 'NOT' | 'AND' | 'OR' | 'NAND' | 'NOR' | 'XOR' | 'XNOR';

const GATE_TYPES = new Set<GateType>(['NOT', 'AND', 'OR', 'NAND', 'NOR', 'XOR', 'XNOR']);

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
    if (GATE_TYPES.has(node.nodeType as GateType)) {
      wireSignals.push(nodePinSignal(node.id, 'OUT'));
    }

    if (node.nodeType === 'DFF') {
      regSignals.push(nodePinSignal(node.id, 'Q'));
      wireSignals.push(nodePinSignal(node.id, 'Q_BAR'));
    }

    if (node.nodeType === 'TFF') {
      regSignals.push(nodePinSignal(node.id, 'Q'));
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

    if (node.nodeType === 'INPUT' || node.nodeType === 'OUTPUT' || node.nodeType === 'LED' || node.nodeType === 'CLOCK') {
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
