import type { ChipDefinition, CircuitDefinition, LogicValue, NodeInstance, PinReference } from '@vfcs/circuit-model';
import { LogicConstants, logicGateOutput, invert, resolveDrivers } from './logic.js';
import { DEFAULT_NODE_LIBRARY, GATE_NODE_TYPES, SEQUENTIAL_NODE_TYPES } from './library.js';

type PinValueMap = Record<string, LogicValue>;

interface ChipPinBinding {
  sourceNodeId?: string;
  direction?: 'input' | 'output' | 'bidirectional';
}

interface ChipRuntime {
  engine: SimulationEngine;
  inputBindings: Record<string, string>;
  outputBindings: Record<string, string>;
}

export interface SimulationEngineOptions {
  chipLibrary?: ChipDefinition[];
  chipDepth?: number;
  maxChipDepth?: number;
}

export type SimulationDiagnosticCode =
  | 'floating-input'
  | 'conflicting-drivers'
  | 'missing-node-definition'
  | 'combinational-not-stable';

export interface SimulationDiagnostic {
  code: SimulationDiagnosticCode;
  severity: 'warning' | 'error';
  message: string;
  nodeId?: string;
  pinId?: string;
  netId?: string;
}

export interface SimulationSnapshot {
  tick: number;
  running: boolean;
  nodeOutputs: Record<string, PinValueMap>;
  nodeStates: Record<string, Record<string, unknown>>;
  netValues: Record<string, LogicValue>;
  diagnostics: SimulationDiagnostic[];
  stabilized: boolean;
}

interface NodeRuntimeState {
  q?: LogicValue;
  prevClk?: LogicValue;
  value?: LogicValue;
}

interface InboundEntry {
  from: PinReference;
}

export class SimulationEngine {
  private readonly library = DEFAULT_NODE_LIBRARY;

  private readonly inboundMap: Map<string, Map<string, InboundEntry[]>> = new Map();

  private readonly orderedNodes: NodeInstance[];

  private readonly chipLibrary: ChipDefinition[];

  private readonly chipById: Map<string, ChipDefinition> = new Map();

  private readonly chipRuntimeByNodeId: Map<string, ChipRuntime> = new Map();

  private readonly chipDepth: number;

  private readonly maxChipDepth: number;

  private outputs: Record<string, PinValueMap> = {};

  private states: Record<string, NodeRuntimeState> = {};

  private running = false;

  private tick = 0;

  private netValues: Record<string, LogicValue> = {};

  private diagnostics: SimulationDiagnostic[] = [];

  private diagnosticKeys = new Set<string>();

  private stabilized = true;

  constructor(
    private readonly circuit: CircuitDefinition,
    options: SimulationEngineOptions = {},
  ) {
    this.chipLibrary = options.chipLibrary ?? [];
    this.chipDepth = options.chipDepth ?? 0;
    this.maxChipDepth = options.maxChipDepth ?? 4;
    for (const chip of this.chipLibrary) {
      this.chipById.set(chip.id, chip);
    }
    this.orderedNodes = [...circuit.nodes].sort((a, b) => a.id.localeCompare(b.id));
    this.initializeInboundMap();
    this.reset();
  }

  public setRunning(value: boolean): void {
    this.running = value;
  }

  public isRunning(): boolean {
    return this.running;
  }

  public setInput(nodeId: string, value: LogicValue): void {
    const node = this.requireNode(nodeId);
    if (node.nodeType !== 'INPUT') {
      throw new Error(`Node ${nodeId} is not an INPUT node.`);
    }

    this.states[nodeId] = {
      ...this.states[nodeId],
      value,
    };
    this.outputs[nodeId] = { OUT: value };
  }

  public getSnapshot(): SimulationSnapshot {
    return {
      tick: this.tick,
      running: this.running,
      nodeOutputs: structuredClone(this.outputs),
      nodeStates: structuredClone(this.states) as Record<string, Record<string, unknown>>,
      netValues: structuredClone(this.netValues),
      diagnostics: [...this.diagnostics],
      stabilized: this.stabilized,
    };
  }

  public reset(): SimulationSnapshot {
    this.tick = 0;
    this.outputs = {};
    this.states = {};
    this.netValues = {};
    this.diagnostics = [];
    this.diagnosticKeys.clear();
    this.stabilized = true;
    this.chipRuntimeByNodeId.clear();

    for (const node of this.orderedNodes) {
      const definition = this.library[node.nodeType];
      if (!definition) {
        this.addDiagnostic({
          code: 'missing-node-definition',
          severity: 'error',
          nodeId: node.id,
          message: `No node definition was found for ${node.nodeType}.`,
        });
        continue;
      }

      const baseState = {
        ...(definition.defaultState as Record<string, unknown> | undefined),
        ...(node.state as Record<string, unknown> | undefined),
      };

      const runtimeState: NodeRuntimeState = {
        q: (baseState?.q as LogicValue | undefined) ?? '0',
        prevClk: (baseState?.prevClk as LogicValue | undefined) ?? '0',
        value: (baseState?.value as LogicValue | undefined) ?? '0',
      };

      this.states[node.id] = runtimeState;

      if (node.nodeType === 'INPUT') {
        this.outputs[node.id] = { OUT: runtimeState.value ?? '0' };
      } else if (node.nodeType === 'CLOCK') {
        this.outputs[node.id] = { OUT: '0' };
      } else if (node.nodeType === 'VCC') {
        this.outputs[node.id] = { OUT: '1' };
      } else if (node.nodeType === 'GND' || node.nodeType === 'VSS') {
        this.outputs[node.id] = { OUT: '0' };
      } else if (node.nodeType === 'DFF') {
        const q = runtimeState.q ?? '0';
        this.outputs[node.id] = { Q: q, Q_BAR: invert(q) };
      } else if (node.nodeType === 'TFF') {
        this.outputs[node.id] = { Q: runtimeState.q ?? '0' };
      } else if (node.nodeType === 'CHIP') {
        const chip = node.chipRefId ? this.chipById.get(node.chipRefId) : null;
        if (!chip) {
          this.addDiagnostic({
            code: 'missing-node-definition',
            severity: 'error',
            nodeId: node.id,
            message: `No chip definition was found for ${node.chipRefId ?? '(missing chipRefId)'}.`,
          });
          this.outputs[node.id] = {};
          continue;
        }

        const outputPins = chip.publicPins.filter(
          (pin) => pin.direction === 'output' || pin.direction === 'bidirectional',
        );
        this.outputs[node.id] = Object.fromEntries(
          outputPins.map((pin) => [pin.id, LogicConstants.LOGIC_UNKNOWN]),
        ) as PinValueMap;
      } else if (definition.outputPins.length > 0) {
        const outputPins = Object.fromEntries(
          definition.outputPins.map((pin) => [pin.id, LogicConstants.LOGIC_UNKNOWN]),
        ) as PinValueMap;
        this.outputs[node.id] = outputPins;
      }
    }

    this.refreshNetValues();
    return this.getSnapshot();
  }

  public step(): SimulationSnapshot {
    this.tick += 1;
    this.diagnostics = [];
    this.diagnosticKeys.clear();

    this.evaluateSources();
    const stabilizedBeforeChip = this.evaluateCombinational();
    this.evaluateChipInstances();
    const stabilizedAfterChip = this.evaluateCombinational();
    this.stabilized = stabilizedBeforeChip && stabilizedAfterChip;
    this.evaluateSequential();
    this.captureOutputNodes();
    this.refreshNetValues();

    if (!this.stabilized) {
      this.addDiagnostic({
        code: 'combinational-not-stable',
        severity: 'warning',
        message:
          'Combinational network did not stabilize within the pass limit. This may indicate an oscillation or unresolved feedback loop.',
      });
    }

    return this.getSnapshot();
  }

  public runSteps(count: number): SimulationSnapshot {
    for (let i = 0; i < count; i += 1) {
      this.step();
    }

    return this.getSnapshot();
  }

  private initializeInboundMap(): void {
    for (const wire of this.circuit.wires) {
      const mapByPin = this.inboundMap.get(wire.to.nodeId) ?? new Map<string, InboundEntry[]>();
      const entries = mapByPin.get(wire.to.pinId) ?? [];
      entries.push({ from: wire.from });
      mapByPin.set(wire.to.pinId, entries);
      this.inboundMap.set(wire.to.nodeId, mapByPin);
    }
  }

  private evaluateSources(): void {
    for (const node of this.orderedNodes) {
      if (node.nodeType === 'INPUT') {
        const value = (this.states[node.id]?.value ?? '0') as LogicValue;
        this.outputs[node.id] = { OUT: value };
      }

      if (node.nodeType === 'CLOCK') {
        const legacyPeriod = this.nodeParameterAsNumber(node, 'period', -1);
        const frequencyHz = this.nodeParameterAsNumber(node, 'frequencyHz', 1);
        const halfCycleTicks =
          legacyPeriod > 0 ? Math.max(1, Math.round(legacyPeriod)) : this.frequencyToHalfCycleTicks(frequencyHz);
        const phase = Math.floor(this.tick / halfCycleTicks) % 2;
        const nextValue: LogicValue = phase === 0 ? '0' : '1';
        this.outputs[node.id] = { OUT: nextValue };
      }

      if (node.nodeType === 'VCC') {
        this.outputs[node.id] = { OUT: '1' };
      }

      if (node.nodeType === 'GND' || node.nodeType === 'VSS') {
        this.outputs[node.id] = { OUT: '0' };
      }
    }
  }

  private evaluateCombinational(): boolean {
    const gateNodes = this.orderedNodes.filter((node) => GATE_NODE_TYPES.has(node.nodeType));
    const maxIterations = Math.max(4, gateNodes.length * 2);

    for (let pass = 0; pass < maxIterations; pass += 1) {
      let changed = false;

      for (const node of gateNodes) {
        const inputValues = this.readAllNodeInputs(node);
        const gate = node.nodeType as 'NOT' | 'AND' | 'OR' | 'NAND' | 'NOR' | 'XOR' | 'XNOR';
        const nextOut = logicGateOutput(gate, inputValues);

        const currentOut = this.outputs[node.id]?.OUT;
        if (currentOut !== nextOut) {
          this.outputs[node.id] = { OUT: nextOut };
          changed = true;
        }
      }

      if (!changed) {
        return true;
      }
    }

    return false;
  }

  private evaluateSequential(): void {
    for (const node of this.orderedNodes) {
      if (!SEQUENTIAL_NODE_TYPES.has(node.nodeType)) {
        continue;
      }

      const state = this.states[node.id] ?? { q: '0', prevClk: '0' };
      const prevClk = (state.prevClk ?? '0') as LogicValue;
      const clk = this.readInput(node.id, 'CLK');
      const risingEdge = prevClk !== '1' && clk === '1';
      let q = (state.q ?? '0') as LogicValue;

      if (node.nodeType === 'DFF' && risingEdge) {
        const d = this.readInput(node.id, 'D');
        q = d === '0' || d === '1' ? d : 'X';
      }

      if (node.nodeType === 'TFF' && risingEdge) {
        const t = this.readInput(node.id, 'T');
        if (t === '1') {
          q = q === '0' ? '1' : q === '1' ? '0' : 'X';
        } else if (t !== '0') {
          q = 'X';
        }
      }

      state.q = q;
      if (clk === '0' || clk === '1') {
        state.prevClk = clk;
      }
      this.states[node.id] = state;

      if (node.nodeType === 'DFF') {
        this.outputs[node.id] = { Q: q, Q_BAR: invert(q) };
      }

      if (node.nodeType === 'TFF') {
        this.outputs[node.id] = { Q: q };
      }
    }
  }

  private evaluateChipInstances(): void {
    for (const node of this.orderedNodes) {
      if (node.nodeType !== 'CHIP') {
        continue;
      }

      const runtime = this.resolveChipRuntime(node);
      if (!runtime) {
        continue;
      }

      const parentOutputMap = this.outputs[node.id] ?? {};

      for (const [publicPinId, internalNodeId] of Object.entries(runtime.inputBindings)) {
        const inputValue = this.readInput(node.id, publicPinId);
        runtime.engine.setInput(internalNodeId, inputValue);
      }

      const childSnapshot = runtime.engine.step();

      for (const [publicPinId, internalNodeId] of Object.entries(runtime.outputBindings)) {
        const fromOutput = childSnapshot.nodeOutputs[internalNodeId]?.OUT as LogicValue | undefined;
        const fromState = childSnapshot.nodeStates[internalNodeId]?.value as LogicValue | undefined;
        parentOutputMap[publicPinId] = fromOutput ?? fromState ?? LogicConstants.LOGIC_UNKNOWN;
      }

      this.outputs[node.id] = parentOutputMap;
    }
  }

  private captureOutputNodes(): void {
    for (const node of this.orderedNodes) {
      if (node.nodeType !== 'OUTPUT' && node.nodeType !== 'LED') {
        continue;
      }

      const value = this.readInput(node.id, 'IN');
      this.states[node.id] = {
        ...this.states[node.id],
        value,
      };
    }
  }

  private refreshNetValues(): void {
    const values: Record<string, LogicValue> = {};

    for (const net of this.circuit.nets) {
      const driverValues = net.driverPins.map(
        (driver) => this.outputs[driver.nodeId]?.[driver.pinId] ?? LogicConstants.LOGIC_HIGH_Z,
      );
      const value = resolveDrivers(driverValues);
      values[net.id] = value;

      if (value === LogicConstants.LOGIC_ERROR) {
        this.addDiagnostic({
          code: 'conflicting-drivers',
          severity: 'error',
          netId: net.id,
          message: `Net ${net.id} has conflicting driver values.`,
        });
      }
    }

    this.netValues = values;
  }

  private readAllNodeInputs(node: NodeInstance): LogicValue[] {
    const definition = this.library[node.nodeType];
    if (!definition) {
      this.addDiagnostic({
        code: 'missing-node-definition',
        severity: 'error',
        nodeId: node.id,
        message: `No node definition was found for ${node.nodeType}.`,
      });
      return [LogicConstants.LOGIC_UNKNOWN];
    }

    return definition.inputPins.map((pin) => this.readInput(node.id, pin.id));
  }

  private readInput(nodeId: string, pinId: string): LogicValue {
    const entries = this.inboundMap.get(nodeId)?.get(pinId) ?? [];
    if (entries.length === 0) {
      this.addDiagnostic({
        code: 'floating-input',
        severity: 'warning',
        nodeId,
        pinId,
        message: `Input ${nodeId}.${pinId} is floating (no incoming wire).`,
      });
      return LogicConstants.LOGIC_HIGH_Z;
    }

    const values = entries.map(
      (entry) => this.outputs[entry.from.nodeId]?.[entry.from.pinId] ?? LogicConstants.LOGIC_HIGH_Z,
    );

    const resolved = resolveDrivers(values);
    if (resolved === LogicConstants.LOGIC_ERROR) {
      this.addDiagnostic({
        code: 'conflicting-drivers',
        severity: 'error',
        nodeId,
        pinId,
        message: `Input ${nodeId}.${pinId} has conflicting drivers.`,
      });
    }

    return resolved;
  }

  private resolveChipRuntime(node: NodeInstance): ChipRuntime | null {
    const existing = this.chipRuntimeByNodeId.get(node.id);
    if (existing) {
      return existing;
    }

    const chip = node.chipRefId ? this.chipById.get(node.chipRefId) : null;
    if (!chip) {
      this.addDiagnostic({
        code: 'missing-node-definition',
        severity: 'error',
        nodeId: node.id,
        message: `No chip definition was found for ${node.chipRefId ?? '(missing chipRefId)'}.`,
      });
      return null;
    }

    const pinBindings = this.resolvePinBindings(node, chip);
    const childCircuit = this.prepareChipInternalCircuit(chip.internalCircuit, pinBindings);
    if (this.chipDepth >= this.maxChipDepth) {
      this.addDiagnostic({
        code: 'missing-node-definition',
        severity: 'error',
        nodeId: node.id,
        message: `Chip nesting exceeded max depth (${this.maxChipDepth}).`,
      });
      return null;
    }

    const childEngine = new SimulationEngine(childCircuit, {
      chipLibrary: this.chipLibrary,
      chipDepth: this.chipDepth + 1,
      maxChipDepth: this.maxChipDepth,
    });

    const nodeById = new Map(childCircuit.nodes.map((entry) => [entry.id, entry]));
    const inputBindings: Record<string, string> = {};
    const outputBindings: Record<string, string> = {};

    for (const publicPin of chip.publicPins) {
      const binding = pinBindings[publicPin.id];
      if (!binding?.sourceNodeId) {
        continue;
      }

      const internalNode = nodeById.get(binding.sourceNodeId);
      if (!internalNode) {
        continue;
      }

      if (publicPin.direction === 'input' || publicPin.direction === 'bidirectional') {
        if (internalNode.nodeType === 'INPUT') {
          inputBindings[publicPin.id] = internalNode.id;
        }
      }

      if (publicPin.direction === 'output' || publicPin.direction === 'bidirectional') {
        if (
          internalNode.nodeType === 'OUTPUT'
          || internalNode.nodeType === 'LED'
          || internalNode.nodeType === 'INPUT'
          || internalNode.nodeType === 'CLOCK'
        ) {
          outputBindings[publicPin.id] = internalNode.id;
        }
      }
    }

    const runtime: ChipRuntime = {
      engine: childEngine,
      inputBindings,
      outputBindings,
    };
    this.chipRuntimeByNodeId.set(node.id, runtime);

    return runtime;
  }

  private resolvePinBindings(node: NodeInstance, chip: ChipDefinition): Record<string, ChipPinBinding> {
    const fromNode = this.asPinBindingRecord(node.parameters?.pinBindings);
    const fromChip = this.asPinBindingRecord(chip.metadata?.pinBindings);
    const merged: Record<string, ChipPinBinding> = { ...fromChip, ...fromNode };

    const nodeById = new Map(chip.internalCircuit.nodes.map((entry) => [entry.id, entry]));
    const unboundInputNodes = chip.internalCircuit.nodes
      .filter((entry) => entry.nodeType === 'INPUT' || entry.nodeType === 'CLOCK')
      .map((entry) => entry.id);
    const unboundOutputNodes = chip.internalCircuit.nodes
      .filter((entry) => entry.nodeType === 'OUTPUT' || entry.nodeType === 'LED')
      .map((entry) => entry.id);

    for (const binding of Object.values(merged)) {
      if (!binding.sourceNodeId) {
        continue;
      }
      const idxIn = unboundInputNodes.indexOf(binding.sourceNodeId);
      if (idxIn >= 0) {
        unboundInputNodes.splice(idxIn, 1);
      }
      const idxOut = unboundOutputNodes.indexOf(binding.sourceNodeId);
      if (idxOut >= 0) {
        unboundOutputNodes.splice(idxOut, 1);
      }
    }

    for (const publicPin of chip.publicPins) {
      const current = merged[publicPin.id];
      if (current?.sourceNodeId && nodeById.has(current.sourceNodeId)) {
        continue;
      }

      if (publicPin.direction === 'input' || publicPin.direction === 'bidirectional') {
        const nextInputNode = unboundInputNodes.shift();
        if (nextInputNode) {
          merged[publicPin.id] = {
            sourceNodeId: nextInputNode,
            direction: publicPin.direction,
          };
          continue;
        }
      }

      if (publicPin.direction === 'output' || publicPin.direction === 'bidirectional') {
        const nextOutputNode = unboundOutputNodes.shift();
        if (nextOutputNode) {
          merged[publicPin.id] = {
            sourceNodeId: nextOutputNode,
            direction: publicPin.direction,
          };
        }
      }
    }

    return merged;
  }

  private asPinBindingRecord(value: unknown): Record<string, ChipPinBinding> {
    if (typeof value !== 'object' || value === null) {
      return {};
    }

    const record = value as Record<string, unknown>;
    const output: Record<string, ChipPinBinding> = {};

    for (const [pinId, candidate] of Object.entries(record)) {
      if (typeof candidate !== 'object' || candidate === null) {
        continue;
      }

      const maybeBinding = candidate as Record<string, unknown>;
      const sourceNodeId =
        typeof maybeBinding.sourceNodeId === 'string' && maybeBinding.sourceNodeId.length > 0
          ? maybeBinding.sourceNodeId
          : undefined;
      const direction =
        maybeBinding.direction === 'input' || maybeBinding.direction === 'output' || maybeBinding.direction === 'bidirectional'
          ? maybeBinding.direction
          : undefined;

      output[pinId] = {
        sourceNodeId,
        direction,
      };
    }

    return output;
  }

  private prepareChipInternalCircuit(
    sourceCircuit: CircuitDefinition,
    bindings: Record<string, ChipPinBinding>,
  ): CircuitDefinition {
    const nextCircuit = structuredClone(sourceCircuit);
    const externallyDrivenNodeIds = new Set<string>();

    for (const binding of Object.values(bindings)) {
      if (!binding.sourceNodeId) {
        continue;
      }

      if (binding.direction === 'input' || binding.direction === 'bidirectional') {
        externallyDrivenNodeIds.add(binding.sourceNodeId);
      }
    }

    nextCircuit.nodes = nextCircuit.nodes.map((entry) => {
      if (entry.nodeType === 'CLOCK' && externallyDrivenNodeIds.has(entry.id)) {
        return {
          ...entry,
          nodeType: 'INPUT',
          state: {
            ...(entry.state ?? {}),
            value: '0',
          },
        };
      }

      return entry;
    });

    return nextCircuit;
  }

  private addDiagnostic(diagnostic: SimulationDiagnostic): void {
    const key = [diagnostic.code, diagnostic.nodeId, diagnostic.pinId, diagnostic.netId, diagnostic.message].join('|');
    if (this.diagnosticKeys.has(key)) {
      return;
    }

    this.diagnosticKeys.add(key);
    this.diagnostics.push(diagnostic);
  }

  private nodeParameterAsNumber(node: NodeInstance, key: string, fallback: number): number {
    const value = node.parameters?.[key];
    if (typeof value === 'number' && Number.isFinite(value)) {
      return value;
    }

    const defaultValue = this.library[node.nodeType]?.defaultParameters?.[key];
    if (typeof defaultValue === 'number' && Number.isFinite(defaultValue)) {
      return defaultValue;
    }

    return fallback;
  }

  private frequencyToHalfCycleTicks(frequencyHz: number): number {
    const minHz = 1;
    const maxHz = 10_000_000_000;
    const clamped = Math.min(maxHz, Math.max(minHz, frequencyHz));
    const normalized = (Math.log10(clamped) - Math.log10(minHz)) / (Math.log10(maxHz) - Math.log10(minHz));

    // Use a compressed clock scale for interactive UI simulation: full frequency range stays usable.
    const slowestHalfCycleTicks = 12;
    const fastestHalfCycleTicks = 1;
    const mapped =
      slowestHalfCycleTicks - normalized * (slowestHalfCycleTicks - fastestHalfCycleTicks);

    return Math.max(fastestHalfCycleTicks, Math.round(mapped));
  }

  private requireNode(nodeId: string): NodeInstance {
    const node = this.circuit.nodes.find((item) => item.id === nodeId);
    if (!node) {
      throw new Error(`Node ${nodeId} was not found.`);
    }

    return node;
  }
}
