export const BRANDING = {
  appName: 'VulpFin CircuitSmith',
  shortName: 'VFCS',
  tagline: 'From logic to living hardware.',
  creatorBrand: 'TG11',
  projectNamespace: '@vfcs',
} as const;

export const LIGIC_SCHEMA = {
  name: 'vfcs-ligic',
  version: '0.2.0',
} as const;

export type LogicValue = '0' | '1' | 'X' | 'Z' | 'ERR';

export type PinDirection = 'input' | 'output' | 'bidirectional';

export interface Position {
  x: number;
  y: number;
}

export interface PinDefinition {
  id: string;
  name: string;
  direction: PinDirection;
  width?: number;
  description?: string;
}

export interface PinReference {
  nodeId: string;
  pinId: string;
}

export interface NodeDefinition {
  type: string;
  label: string;
  category: 'io' | 'logic' | 'clock' | 'sequential' | 'chip';
  description?: string;
  inputPins: PinDefinition[];
  outputPins: PinDefinition[];
  defaultParameters?: Record<string, unknown>;
  defaultState?: Record<string, unknown>;
}

export interface NodeInstance {
  id: string;
  nodeType: string;
  label?: string;
  position: Position;
  parameters?: Record<string, unknown>;
  state?: Record<string, unknown>;
  chipRefId?: string;
}

export interface Wire {
  id: string;
  from: PinReference;
  to: PinReference;
}

export interface Net {
  id: string;
  wireIds: string[];
  driverPins: PinReference[];
  loadPins: PinReference[];
  value?: LogicValue;
}

export interface CircuitDefinition {
  id: string;
  name: string;
  description?: string;
  nodes: NodeInstance[];
  wires: Wire[];
  nets: Net[];
  metadata?: Record<string, unknown>;
}

export interface CircuitSchemaMetadata {
  schemaName: string;
  schemaVersion: string;
  updatedAt: string;
}

export interface ComponentDefinition {
  id: string;
  name: string;
  logicalType: string;
  pinout: PinDefinition[];
  behaviorHint?: string;
  description?: string;
}

export interface ChipDefinition {
  id: string;
  name: string;
  version: string;
  publicPins: PinDefinition[];
  internalCircuit: CircuitDefinition;
  metadata?: Record<string, unknown>;
}

export interface ChipAppearance {
  shape: 'rect' | 'rounded' | 'seven-segment';
  bodyColor: string;
  accentColor: string;
  textColor: string;
  symbol: string;
}

export interface PhysicalPart {
  id: string;
  manufacturerPartNumber: string;
  vendorPartNumber?: string;
  family: string;
  packageType?: string;
  description: string;
  capabilities: string[];
}

export interface PhysicalImplementationOption {
  optionId: string;
  title: string;
  description: string;
  parts?: PhysicalPart[];
  notes?: string;
}

export interface PhysicalMapping {
  logicalComponentType: string;
  options: PhysicalImplementationOption[];
}

export type ExportTarget = 'ligic-json' | 'verilog' | 'kicad-schematic' | 'kicad-netlist';

export interface ProjectDefinition {
  id: string;
  name: string;
  description?: string;
  circuits: CircuitDefinition[];
  components: ComponentDefinition[];
  chips: ChipDefinition[];
  mappings: PhysicalMapping[];
  exportTargets: ExportTarget[];
  metadata?: Record<string, unknown>;
}

export interface MakeChipRequest {
  sourceCircuit: CircuitDefinition;
  chipId: string;
  chipName: string;
  version?: string;
  publicPins: PinDefinition[];
  metadata?: Record<string, unknown>;
}

export function createChipDefinitionFromCircuit(request: MakeChipRequest): ChipDefinition {
  return {
    id: request.chipId,
    name: request.chipName,
    version: request.version ?? '0.1.0',
    publicPins: request.publicPins,
    internalCircuit: request.sourceCircuit,
    metadata: {
      generatedBy: 'createChipDefinitionFromCircuit',
      generatedAt: new Date().toISOString(),
      status: 'placeholder-architecture',
      ...(request.metadata ?? {}),
    },
  };
}

export interface LigicJsonEnvelope {
  schema: typeof LIGIC_SCHEMA;
  generatedAt: string;
  payloadType: 'circuit' | 'project';
  circuit?: CircuitDefinition;
  project?: ProjectDefinition;
}

export function cloneCircuit(circuit: CircuitDefinition): CircuitDefinition {
  return structuredClone(circuit);
}

export function withCircuitSchemaMetadata(circuit: CircuitDefinition): CircuitDefinition {
  const metadata = {
    ...(circuit.metadata ?? {}),
    schemaName: LIGIC_SCHEMA.name,
    schemaVersion: LIGIC_SCHEMA.version,
    updatedAt: new Date().toISOString(),
  } satisfies CircuitSchemaMetadata;

  return {
    ...cloneCircuit(circuit),
    metadata,
  };
}

export function sanitizeId(source: string): string {
  const id = source
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
  return id.length > 0 ? id : 'node';
}

export function createNodeInstanceId(circuit: CircuitDefinition, nodeType: string): string {
  const base = sanitizeId(nodeType);
  let idx = 1;
  let candidate = `${base}_${idx}`;
  const ids = new Set(circuit.nodes.map((node) => node.id));

  while (ids.has(candidate)) {
    idx += 1;
    candidate = `${base}_${idx}`;
  }

  return candidate;
}

export function createWireId(circuit: CircuitDefinition): string {
  let idx = circuit.wires.length + 1;
  let candidate = `wire_${idx}`;
  const ids = new Set(circuit.wires.map((wire) => wire.id));

  while (ids.has(candidate)) {
    idx += 1;
    candidate = `wire_${idx}`;
  }

  return candidate;
}

export function recalculateNets(circuit: CircuitDefinition): CircuitDefinition {
  const grouped = new Map<string, Wire[]>();
  for (const wire of circuit.wires) {
    const key = `${wire.from.nodeId}:${wire.from.pinId}`;
    const wires = grouped.get(key) ?? [];
    wires.push(wire);
    grouped.set(key, wires);
  }

  const nets: Net[] = [];
  let netIndex = 1;
  for (const [key, wires] of grouped.entries()) {
    const [nodeId, pinId] = key.split(':');
    nets.push({
      id: `net_${netIndex}`,
      wireIds: wires.map((wire) => wire.id),
      driverPins: [{ nodeId, pinId }],
      loadPins: wires.map((wire) => ({ nodeId: wire.to.nodeId, pinId: wire.to.pinId })),
    });
    netIndex += 1;
  }

  return {
    ...cloneCircuit(circuit),
    nets,
  };
}

export function removeNodeAndConnections(circuit: CircuitDefinition, nodeId: string): CircuitDefinition {
  const nextCircuit = cloneCircuit(circuit);
  nextCircuit.nodes = nextCircuit.nodes.filter((node) => node.id !== nodeId);
  nextCircuit.wires = nextCircuit.wires.filter(
    (wire) => wire.from.nodeId !== nodeId && wire.to.nodeId !== nodeId,
  );
  return recalculateNets(nextCircuit);
}
