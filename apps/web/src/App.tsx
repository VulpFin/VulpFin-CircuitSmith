import { useEffect, useMemo, useRef, useState } from 'react';
import {
  BRANDING,
  cloneCircuit,
  createChipDefinitionFromCircuit,
  createNodeInstanceId,
  createWireId,
  recalculateNets,
  removeNodeAndConnections,
  sanitizeId,
  type ChipAppearance,
  type ChipDefinition,
  type CircuitDefinition,
  type LogicValue,
  type Position,
} from '@vfcs/circuit-model';
import { exportCircuitAsLigicJson, exportCircuitAsVerilog } from '@vfcs/exporters';
import { searchDigikeyParts } from '@vfcs/integrations';
import { DEFAULT_NODE_LIBRARY, SimulationEngine, type SimulationSnapshot } from '@vfcs/sim-core';
import { ChipLibraryPanel, type ChipAppearanceDraft, type ChipPinDraft } from './components/ChipLibraryPanel.js';
import { ComponentPalette } from './components/ComponentPalette.js';
import { InspectorPanel } from './components/InspectorPanel.js';
import { StatusPanel } from './components/StatusPanel.js';
import { WorkspaceCanvas } from './components/WorkspaceCanvas.js';
import { PALETTE_ITEMS } from './data/componentPalette.js';
import { T_FLIP_FLOP_DEMO } from './data/demoCircuit.js';
import {
  buildChipPinsFromDrafts,
  createDefaultPinPosition,
  sanitizePinId,
} from './lib/chipDesigner.js';
import { resolveChipPinLayout, resolveNodePins } from './lib/nodePins.js';

const CHIP_LIBRARY_STORAGE_KEY = 'vfcs.chip-library.v1';
const WORKSPACE_NODE_WIDTH = 164;
const WORKSPACE_NODE_HEIGHT = 100;
const MIN_WORKSPACE_WIDTH = 900;
const MIN_WORKSPACE_HEIGHT = 440;

interface WorkspaceSize {
  width: number;
  height: number;
}

interface PendingWireSource {
  nodeId: string;
  pinId: string;
}

const DEFAULT_CHIP_APPEARANCE: ChipAppearanceDraft = {
  shape: 'rect',
  bodyColor: '#173a53',
  accentColor: '#3bd5ff',
  textColor: '#d8ecff',
  symbol: 'CHIP',
};

function initialCircuit(): CircuitDefinition {
  return recalculateNets(cloneCircuit(T_FLIP_FLOP_DEMO));
}

function initialExportPreview(): string {
  const verilog = exportCircuitAsVerilog(T_FLIP_FLOP_DEMO);
  return verilog.content;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function clampNodeToWorkspace(position: Position, workspaceSize: WorkspaceSize): Position {
  return {
    x: clamp(position.x, 0, Math.max(0, workspaceSize.width - WORKSPACE_NODE_WIDTH)),
    y: clamp(position.y, 0, Math.max(0, workspaceSize.height - WORKSPACE_NODE_HEIGHT)),
  };
}

function frequencyToHalfCycleTicks(frequencyHz: number): number {
  const minHz = 1;
  const maxHz = 10_000_000_000;
  const clamped = Math.min(maxHz, Math.max(minHz, frequencyHz));
  const normalized = (Math.log10(clamped) - Math.log10(minHz)) / (Math.log10(maxHz) - Math.log10(minHz));
  const slowestHalfCycleTicks = 12;
  const fastestHalfCycleTicks = 1;
  const mapped =
    slowestHalfCycleTicks - normalized * (slowestHalfCycleTicks - fastestHalfCycleTicks);

  return Math.max(fastestHalfCycleTicks, Math.round(mapped));
}

function spawnPosition(nodeIndex: number, workspaceSize: WorkspaceSize): Position {
  const maxColumns = Math.max(1, Math.floor((workspaceSize.width - 40) / 170));
  const column = nodeIndex % maxColumns;
  const row = Math.floor(nodeIndex / maxColumns);
  const raw = {
    x: 40 + column * 170,
    y: 40 + row * 110,
  };
  return clampNodeToWorkspace(raw, workspaceSize);
}

function readChipLibrary(): ChipDefinition[] {
  if (typeof window === 'undefined') {
    return [];
  }

  try {
    const raw = window.localStorage.getItem(CHIP_LIBRARY_STORAGE_KEY);
    if (!raw) {
      return [];
    }

    const parsed = JSON.parse(raw) as ChipDefinition[];
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed;
  } catch {
    return [];
  }
}

function createDraftId(): string {
  return `draft_${Math.random().toString(36).slice(2, 9)}`;
}

function buildPinDraftsFromCircuit(circuit: CircuitDefinition, existing: ChipPinDraft[]): ChipPinDraft[] {
  const bySourceId = new Map<string, ChipPinDraft>();
  for (const draft of existing) {
    if (draft.sourceNodeId) {
      bySourceId.set(draft.sourceNodeId, draft);
    }
  }

  let inputIndex = 0;
  let outputIndex = 0;

  const linkedDrafts = circuit.nodes
    .filter(
      (node) =>
        node.nodeType === 'INPUT'
        || node.nodeType === 'OUTPUT'
        || node.nodeType === 'LED'
        || node.nodeType === 'CLOCK',
    )
    .map((node) => {
      const direction = node.nodeType === 'OUTPUT' || node.nodeType === 'LED' ? 'output' : 'input';
      const basePosition =
        direction === 'output'
          ? createDefaultPinPosition(direction, outputIndex++)
          : createDefaultPinPosition(direction, inputIndex++);
      const current = bySourceId.get(node.id);
      if (current) {
        return {
          ...current,
          direction,
          pinX: current.pinX ?? basePosition.x,
          pinY: current.pinY ?? basePosition.y,
        } satisfies ChipPinDraft;
      }

      const label = node.label ?? node.id;

      return {
        draftId: createDraftId(),
        enabled: true,
        id: sanitizePinId(label),
        name: label,
        direction,
        sourceNodeId: node.id,
        pinX: basePosition.x,
        pinY: basePosition.y,
      } satisfies ChipPinDraft;
    });

  const customDrafts = existing
    .filter((draft) => !draft.sourceNodeId)
    .map((draft, index) => ({
      ...draft,
      pinX: draft.pinX ?? createDefaultPinPosition(draft.direction, index).x,
      pinY: draft.pinY ?? createDefaultPinPosition(draft.direction, index).y,
    }));

  return [...linkedDrafts, ...customDrafts];
}

export default function App() {
  const [circuit, setCircuit] = useState<CircuitDefinition>(initialCircuit);
  const [workspaceSize, setWorkspaceSize] = useState<WorkspaceSize>({
    width: 980,
    height: MIN_WORKSPACE_HEIGHT,
  });
  const [nodePositions, setNodePositions] = useState<Record<string, Position>>(() =>
    Object.fromEntries(initialCircuit().nodes.map((node) => [node.id, node.position])),
  );

  const engineRef = useRef<SimulationEngine>(new SimulationEngine(circuit, { chipLibrary: readChipLibrary() }));
  const [snapshot, setSnapshot] = useState<SimulationSnapshot>(() => engineRef.current.getSnapshot());

  const [running, setRunning] = useState(false);
  const [statusMessage, setStatusMessage] = useState('Ready.');
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>('tff_main');
  const [pendingWireSource, setPendingWireSource] = useState<PendingWireSource | null>(null);
  const [exportPreview, setExportPreview] = useState(initialExportPreview);

  const [chipLibrary, setChipLibrary] = useState<ChipDefinition[]>(readChipLibrary);
  const [chipIdDraft, setChipIdDraft] = useState('chip_tff_demo');
  const [chipNameDraft, setChipNameDraft] = useState('T Flip-Flop Demo Chip');
  const [chipPinDrafts, setChipPinDrafts] = useState<ChipPinDraft[]>(() =>
    buildPinDraftsFromCircuit(initialCircuit(), []),
  );
  const [chipAppearanceDraft, setChipAppearanceDraft] =
    useState<ChipAppearanceDraft>(DEFAULT_CHIP_APPEARANCE);

  const displayCircuit = useMemo<CircuitDefinition>(() => {
    return {
      ...circuit,
      nodes: circuit.nodes.map((node) => ({
        ...node,
        position: nodePositions[node.id] ?? node.position,
      })),
    };
  }, [circuit, nodePositions]);

  const ledSignal = useMemo<LogicValue>(() => {
    const outputNode = displayCircuit.nodes.find((node) => node.nodeType === 'LED')
      ?? displayCircuit.nodes.find((node) => node.nodeType === 'OUTPUT');
    if (!outputNode) {
      return 'X';
    }

    return (snapshot.nodeStates[outputNode.id]?.value as LogicValue) ?? 'X';
  }, [displayCircuit.nodes, snapshot.nodeStates]);

  const clockNodes = useMemo(() => {
    return displayCircuit.nodes.filter((node) => node.nodeType === 'CLOCK');
  }, [displayCircuit.nodes]);

  const nextClockTransitions = useMemo(() => {
    return clockNodes.map((node) => {
      const frequencyHzRaw = Number(node.parameters?.frequencyHz ?? 1);
      const frequencyHz = Number.isFinite(frequencyHzRaw) ? Math.max(1, frequencyHzRaw) : 1;
      const halfCycleTicks = frequencyToHalfCycleTicks(frequencyHz);
      const current = (snapshot.nodeOutputs[node.id]?.OUT as LogicValue) ?? '0';
      const remainder = snapshot.tick % halfCycleTicks;
      const ticksUntilToggle = remainder === 0 ? halfCycleTicks : halfCycleTicks - remainder;
      const nextTick = snapshot.tick + ticksUntilToggle;
      const nextState: LogicValue = current === '1' ? '0' : '1';
      const hzPerTick = running ? 1000 / 120 : null;
      const secondsToToggle = hzPerTick ? ticksUntilToggle / hzPerTick : null;

      return {
        nodeId: node.id,
        label: node.label ?? node.id,
        frequencyHz,
        current,
        nextTick,
        nextState,
        ticksUntilToggle,
        secondsToToggle,
      };
    });
  }, [clockNodes, running, snapshot.nodeOutputs, snapshot.tick]);

  const inputNodes = useMemo(() => {
    return displayCircuit.nodes.filter((node) => node.nodeType === 'INPUT');
  }, [displayCircuit.nodes]);

  useEffect(() => {
    const next = engineRef.current.getSnapshot();
    setSnapshot(next);
  }, []);

  useEffect(() => {
    const nextEngine = new SimulationEngine(circuit, { chipLibrary });
    engineRef.current = nextEngine;
    setSnapshot(nextEngine.getSnapshot());
  }, [circuit, chipLibrary]);

  useEffect(() => {
    setNodePositions((previous) => {
      const next: Record<string, Position> = {};
      for (const node of circuit.nodes) {
        next[node.id] = clampNodeToWorkspace(previous[node.id] ?? node.position, workspaceSize);
      }
      return next;
    });
  }, [circuit.nodes, workspaceSize]);

  useEffect(() => {
    setChipPinDrafts((previous) => buildPinDraftsFromCircuit(circuit, previous));
  }, [circuit]);

  useEffect(() => {
    if (!running) {
      return;
    }

    const handle = window.setInterval(() => {
      setSnapshot(engineRef.current.step());
    }, 120);

    return () => {
      window.clearInterval(handle);
    };
  }, [running]);

  useEffect(() => {
    window.localStorage.setItem(CHIP_LIBRARY_STORAGE_KEY, JSON.stringify(chipLibrary));
  }, [chipLibrary]);

  const step = () => {
    setSnapshot(engineRef.current.step());
    setStatusMessage('Advanced one simulation step.');
  };

  const reset = () => {
    setRunning(false);
    setSnapshot(engineRef.current.reset());
    setStatusMessage('Simulation reset.');
  };

  const toggleRunPause = () => {
    setRunning((previous) => !previous);
    setStatusMessage(running ? 'Paused simulation.' : 'Running simulation.');
  };

  const updateCircuitNode = (
    nodeId: string,
    updater: (node: CircuitDefinition['nodes'][number]) => CircuitDefinition['nodes'][number],
  ) => {
    setCircuit((previous) => {
      const next = cloneCircuit(previous);
      next.nodes = next.nodes.map((node) => (node.id === nodeId ? updater(node) : node));
      return next;
    });
  };

  const toggleInputNode = (nodeId: string) => {
    const node = circuit.nodes.find((entry) => entry.id === nodeId);
    if (!node || node.nodeType !== 'INPUT') {
      setStatusMessage(`Input node ${nodeId} was not found.`);
      return;
    }

    const current = (engineRef.current.getSnapshot().nodeOutputs[nodeId]?.OUT as LogicValue) ?? '0';
    const nextValue: LogicValue = current === '1' ? '0' : '1';

    engineRef.current.setInput(nodeId, nextValue);
    setSnapshot(engineRef.current.step());
    updateCircuitNode(nodeId, (entry) => ({
      ...entry,
      state: {
        ...(entry.state ?? {}),
        value: nextValue,
      },
    }));
    setStatusMessage(`Toggled ${nodeId} to ${nextValue} and stepped simulation.`);
  };

  const updateClockFrequency = (nodeId: string, frequencyHz: number) => {
    updateCircuitNode(nodeId, (entry) => ({
      ...entry,
      parameters: {
        ...(entry.parameters ?? {}),
        frequencyHz,
      },
    }));
    setStatusMessage(`Clock ${nodeId} frequency set to ${frequencyHz.toLocaleString()} Hz.`);
  };

  const updateNodeLabel = (nodeId: string, label: string) => {
    updateCircuitNode(nodeId, (entry) => ({
      ...entry,
      label,
    }));
  };

  const addComponent = (nodeType: string) => {
    const definition = DEFAULT_NODE_LIBRARY[nodeType];
    if (!definition) {
      setStatusMessage(`Unknown node type: ${nodeType}`);
      return;
    }

    setCircuit((previous) => {
      const id = createNodeInstanceId(previous, nodeType);
      const nodeIndex = previous.nodes.length;
      const position = spawnPosition(nodeIndex, workspaceSize);

      const nextCircuit: CircuitDefinition = {
        ...cloneCircuit(previous),
        nodes: [
          ...previous.nodes,
          {
            id,
            nodeType,
            label:
              nodeType === 'INPUT'
                ? `IN${previous.nodes.filter((item) => item.nodeType === 'INPUT').length + 1}`
                : nodeType === 'LED'
                  ? `LED${previous.nodes.filter((item) => item.nodeType === 'LED').length + 1}`
                  : nodeType === 'OUTPUT'
                    ? `OUT${previous.nodes.filter((item) => item.nodeType === 'OUTPUT').length + 1}`
                  : definition.label,
            position,
            parameters: definition.defaultParameters,
            state: definition.defaultState,
          },
        ],
      };

      setSelectedNodeId(id);
      return recalculateNets(nextCircuit);
    });

    setStatusMessage(`Added ${nodeType} to workspace.`);
  };

  const addChipInstance = (chipId: string) => {
    const chip = chipLibrary.find((entry) => entry.id === chipId);
    if (!chip) {
      setStatusMessage(`Chip ${chipId} not found in library.`);
      return;
    }

    setCircuit((previous) => {
      const id = createNodeInstanceId(previous, 'CHIP');
      const nodeIndex = previous.nodes.length;
      const position = spawnPosition(nodeIndex, workspaceSize);

      const next = cloneCircuit(previous);
      next.nodes.push({
        id,
        nodeType: 'CHIP',
        label: chip.name,
        position,
        chipRefId: chip.id,
        parameters: {
          appearance: chip.metadata?.appearance,
          pinLayout: chip.metadata?.pinLayout,
          pinBindings: chip.metadata?.pinBindings,
        },
      });

      setSelectedNodeId(id);
      return recalculateNets(next);
    });

    setStatusMessage(`Placed custom chip ${chip.name} on workspace.`);
  };

  const moveNode = (nodeId: string, position: Position) => {
    setNodePositions((previous) => ({
      ...previous,
      [nodeId]: clampNodeToWorkspace(position, workspaceSize),
    }));
  };

  const deleteNode = (nodeId: string) => {
    setCircuit((previous) => removeNodeAndConnections(previous, nodeId));
    setSelectedNodeId((previous) => (previous === nodeId ? null : previous));
    if (pendingWireSource?.nodeId === nodeId) {
      setPendingWireSource(null);
    }
    setStatusMessage(`Deleted node ${nodeId} and detached connected wires.`);
  };

  const startWireFromPin = (source: PendingWireSource) => {
    setPendingWireSource(source);
    setStatusMessage(`Wire mode active from ${source.nodeId}.${source.pinId}. Click a target node in workspace.`);
  };

  const connectPendingWireToPin = (targetNodeId: string, targetPinId: string) => {
    if (!pendingWireSource) {
      return;
    }

    if (pendingWireSource.nodeId === targetNodeId) {
      setStatusMessage('Cannot connect a wire from a node back to itself in this MVP editor.');
      return;
    }

    const sourceNode = displayCircuit.nodes.find((node) => node.id === pendingWireSource.nodeId);
    const targetNode = displayCircuit.nodes.find((node) => node.id === targetNodeId);
    if (!sourceNode || !targetNode) {
      setStatusMessage('Source or target node was not found.');
      return;
    }

    const sourcePins = resolveNodePins(sourceNode, chipLibrary);
    const targetPins = resolveNodePins(targetNode, chipLibrary);

    if (!sourcePins.outputPins.some((pin) => pin.id === pendingWireSource.pinId)) {
      setStatusMessage(`Pin ${pendingWireSource.pinId} is not an output pin on ${sourceNode.id}.`);
      return;
    }

    if (targetPins.inputPins.length === 0) {
      setStatusMessage(`Node ${targetNodeId} has no input pins available.`);
      return;
    }

    const targetPin = targetPins.inputPins.find((pin) => pin.id === targetPinId);
    if (!targetPin) {
      setStatusMessage(`Pin ${targetPinId} is not an input pin on ${targetNodeId}.`);
      return;
    }

    const existingWire = circuit.wires.find(
      (wire) => wire.to.nodeId === targetNodeId && wire.to.pinId === targetPin.id,
    );
    if (existingWire) {
      setStatusMessage(`Pin ${targetNodeId}.${targetPin.id} is already connected. Remove that wire first.`);
      return;
    }

    setCircuit((previous) => {
      const wireId = createWireId(previous);
      const next = cloneCircuit(previous);
      next.wires = [
        ...next.wires,
        {
          id: wireId,
          from: { nodeId: pendingWireSource.nodeId, pinId: pendingWireSource.pinId },
          to: { nodeId: targetNodeId, pinId: targetPin.id },
        },
      ];
      return recalculateNets(next);
    });

    setPendingWireSource(null);
    setStatusMessage(
      `Connected ${pendingWireSource.nodeId}.${pendingWireSource.pinId} -> ${targetNodeId}.${targetPin.id}.`,
    );
  };

  const attemptConnectToNode = (targetNodeId: string) => {
    if (!pendingWireSource) {
      return;
    }

    const sourceNode = displayCircuit.nodes.find((node) => node.id === pendingWireSource.nodeId);
    const targetNode = displayCircuit.nodes.find((node) => node.id === targetNodeId);
    if (!sourceNode || !targetNode) {
      setStatusMessage('Source or target node was not found.');
      return;
    }

    const targetPins = resolveNodePins(targetNode, chipLibrary).inputPins;
    if (targetPins.length === 0) {
      setStatusMessage(`Node ${targetNodeId} has no input pins available.`);
      return;
    }

    const openPins = targetPins.filter(
      (pin) => !circuit.wires.some((wire) => wire.to.nodeId === targetNodeId && wire.to.pinId === pin.id),
    );
    const candidatePins = openPins.length > 0 ? openPins : targetPins;

    let pinToUse = candidatePins[0];
    if (targetNode.nodeType === 'CHIP') {
      const layout = resolveChipPinLayout(targetNode, chipLibrary);
      const sourceY = sourceNode.position.y + WORKSPACE_NODE_HEIGHT * 0.5;
      pinToUse = [...candidatePins].sort((a, b) => {
        const yA = targetNode.position.y + WORKSPACE_NODE_HEIGHT * ((layout[a.id]?.y ?? 50) / 100);
        const yB = targetNode.position.y + WORKSPACE_NODE_HEIGHT * ((layout[b.id]?.y ?? 50) / 100);
        return Math.abs(yA - sourceY) - Math.abs(yB - sourceY);
      })[0];
    }

    connectPendingWireToPin(targetNodeId, pinToUse.id);
  };

  const createChip = () => {
    const chipId = sanitizeId(chipIdDraft || chipNameDraft || 'chip');
    if (!chipId || !chipNameDraft.trim()) {
      setStatusMessage('Chip ID and chip name are required.');
      return;
    }

    const built = buildChipPinsFromDrafts(chipPinDrafts);

    if (built.publicPins.length === 0) {
      setStatusMessage('Select at least one valid public pin in the chip designer.');
      return;
    }

    const chipAppearance: ChipAppearance = {
      shape: chipAppearanceDraft.shape,
      bodyColor: chipAppearanceDraft.bodyColor,
      accentColor: chipAppearanceDraft.accentColor,
      textColor: chipAppearanceDraft.textColor,
      symbol: chipAppearanceDraft.symbol.trim() || 'CHIP',
    };

    const chip = createChipDefinitionFromCircuit({
      sourceCircuit: displayCircuit,
      chipId,
      chipName: chipNameDraft.trim(),
      publicPins: built.publicPins,
      metadata: {
        appearance: chipAppearance,
        pinLayout: built.pinLayout,
        pinBindings: built.pinBindings,
      },
    });

    setChipLibrary((previous) => {
      const filtered = previous.filter((entry) => entry.id !== chip.id);
      return [chip, ...filtered];
    });

    setStatusMessage(
      `Saved chip ${chip.name} (${chip.id}) with ${chip.publicPins.length} public pins and custom layout.`,
    );
  };

  const clearChipLibrary = () => {
    setChipLibrary([]);
    setStatusMessage('Cleared local chip library.');
  };

  const addChipPinDraft = () => {
    setChipPinDrafts((previous) => {
      const basePos = createDefaultPinPosition('input', previous.length);
      return [
        ...previous,
        {
          draftId: createDraftId(),
          enabled: true,
          id: `PIN_${previous.length + 1}`,
          name: `Pin ${previous.length + 1}`,
          direction: 'input',
          pinX: basePos.x,
          pinY: basePos.y,
        },
      ];
    });
  };

  const removeChipPinDraft = (draftId: string) => {
    setChipPinDrafts((previous) => previous.filter((draft) => draft.draftId !== draftId));
  };

  const updateChipPinDraft = (draftId: string, patch: Partial<ChipPinDraft>) => {
    setChipPinDrafts((previous) =>
      previous.map((draft) => (draft.draftId === draftId ? { ...draft, ...patch } : draft)),
    );
  };

  const exportLigic = () => {
    const file = exportCircuitAsLigicJson(displayCircuit);
    setExportPreview(file.content);
    setStatusMessage(`Generated ${file.filename}.`);
  };

  const exportVerilog = () => {
    const file = exportCircuitAsVerilog(displayCircuit);
    const warningPrefix = file.warnings.length > 0 ? ` (${file.warnings.length} warning(s))` : '';
    setExportPreview(file.content);
    setStatusMessage(`Generated ${file.filename}${warningPrefix}.`);
  };

  const findRealParts = async () => {
    const result = await searchDigikeyParts({ logicalType: 'TFF', keyword: 'flip' });
    const preview = {
      integration: result.integration,
      status: result.status,
      message: result.message,
      topResults: result.results.slice(0, 6),
    };

    setExportPreview(JSON.stringify(preview, null, 2));
    setStatusMessage(`Found ${result.results.length} seeded part matches via DigiKey adapter.`);
  };

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-[1600px] flex-col gap-4 p-4 md:p-6">
      <header className="rounded-xl border border-panelBorder bg-panel/80 p-4 shadow-panelGlow backdrop-blur-sm">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold tracking-wide text-slate-100">{BRANDING.appName}</h1>
            <p className="text-sm text-accent">{BRANDING.tagline}</p>
            <p className="text-xs uppercase tracking-[0.2em] text-accentSoft">By {BRANDING.creatorBrand}</p>
          </div>

          <div className="flex flex-wrap gap-2 text-sm">
            <button
              type="button"
              onClick={toggleRunPause}
              className="rounded-md border border-accent bg-[#083251] px-3 py-2 font-semibold hover:bg-[#0a3b5f]"
            >
              {running ? 'Pause Simulation' : 'Run Simulation'}
            </button>
            <button
              type="button"
              onClick={step}
              className="rounded-md border border-panelBorder bg-[#06233d] px-3 py-2 hover:border-accent"
            >
              Step
            </button>
            <button
              type="button"
              onClick={reset}
              className="rounded-md border border-panelBorder bg-[#06233d] px-3 py-2 hover:border-accent"
            >
              Reset
            </button>
            <button
              type="button"
              onClick={createChip}
              className="rounded-md border border-panelBorder bg-[#06233d] px-3 py-2 hover:border-accent"
            >
              Make Chip
            </button>
            <button
              type="button"
              onClick={exportLigic}
              className="rounded-md border border-panelBorder bg-[#06233d] px-3 py-2 hover:border-accent"
            >
              Export Ligic JSON
            </button>
            <button
              type="button"
              onClick={exportVerilog}
              className="rounded-md border border-panelBorder bg-[#06233d] px-3 py-2 hover:border-accent"
            >
              Export Verilog
            </button>
            <button
              type="button"
              onClick={findRealParts}
              className="rounded-md border border-panelBorder bg-[#06233d] px-3 py-2 hover:border-accent"
            >
              Find Real Parts
            </button>
          </div>
        </div>
      </header>

      <section className="flex flex-wrap gap-2 rounded-xl border border-panelBorder bg-panel/80 p-3 text-xs shadow-panelGlow backdrop-blur-sm">
        {inputNodes.length === 0 ? (
          <span className="rounded border border-panelBorder px-2 py-1 text-slate-300">No INPUT nodes in this circuit.</span>
        ) : (
          inputNodes.map((node) => (
            <button
              key={node.id}
              type="button"
              onClick={() => toggleInputNode(node.id)}
              className="rounded border border-panelBorder bg-[#031a30] px-2 py-1 uppercase tracking-[0.15em] hover:border-accent"
            >
              Toggle {node.label ?? node.id}
            </button>
          ))
        )}

        <span className="rounded border border-panelBorder px-2 py-1 text-slate-300">
          {pendingWireSource
            ? `Wire mode: ${pendingWireSource.nodeId}.${pendingWireSource.pinId} -> click target node`
            : 'Wire mode inactive'}
        </span>

        <label className="rounded border border-panelBorder px-2 py-1 text-slate-300">
          Canvas W
          <input
            type="number"
            min={MIN_WORKSPACE_WIDTH}
            max={3200}
            value={workspaceSize.width}
            onChange={(event) => {
              const next = Number(event.target.value);
              if (!Number.isFinite(next)) {
                return;
              }
              setWorkspaceSize((previous) => ({
                ...previous,
                width: clamp(Math.round(next), MIN_WORKSPACE_WIDTH, 3200),
              }));
            }}
            className="ml-2 w-20 rounded border border-panelBorder bg-[#031a30] px-1 py-[1px] text-slate-100"
          />
        </label>
        <label className="rounded border border-panelBorder px-2 py-1 text-slate-300">
          Canvas H
          <input
            type="number"
            min={MIN_WORKSPACE_HEIGHT}
            max={2000}
            value={workspaceSize.height}
            onChange={(event) => {
              const next = Number(event.target.value);
              if (!Number.isFinite(next)) {
                return;
              }
              setWorkspaceSize((previous) => ({
                ...previous,
                height: clamp(Math.round(next), MIN_WORKSPACE_HEIGHT, 2000),
              }));
            }}
            className="ml-2 w-20 rounded border border-panelBorder bg-[#031a30] px-1 py-[1px] text-slate-100"
          />
        </label>
      </section>

      <section className="grid flex-1 gap-4 lg:grid-cols-[280px_minmax(0,1fr)_320px]">
        <ComponentPalette
          items={PALETTE_ITEMS}
          onAddComponent={addComponent}
          chipLibrary={chipLibrary}
          onAddChipInstance={addChipInstance}
        />
        <WorkspaceCanvas
          circuit={displayCircuit}
          workspaceSize={workspaceSize}
          nodeOutputs={snapshot.nodeOutputs}
          nodeStates={snapshot.nodeStates}
          selectedNodeId={selectedNodeId}
          pendingWireSource={pendingWireSource}
          chipLibrary={chipLibrary}
          onSelectNode={setSelectedNodeId}
          onMoveNode={moveNode}
          onAttemptConnectToNode={attemptConnectToNode}
          onToggleInputNode={toggleInputNode}
        />
        <InspectorPanel
          circuit={displayCircuit}
          selectedNodeId={selectedNodeId}
          nodeOutputs={snapshot.nodeOutputs}
          pendingWireSource={pendingWireSource}
          chipLibrary={chipLibrary}
          onStartWireFromPin={startWireFromPin}
          onCancelPendingWire={() => setPendingWireSource(null)}
          onConnectPendingWireToPin={connectPendingWireToPin}
          onDeleteNode={deleteNode}
          onToggleInputNode={toggleInputNode}
          onUpdateNodeLabel={updateNodeLabel}
          onUpdateClockFrequency={updateClockFrequency}
          clockTick={snapshot.tick}
          clockRunning={running}
          clockInfo={nextClockTransitions}
        />
      </section>

      <ChipLibraryPanel
        chipIdDraft={chipIdDraft}
        chipNameDraft={chipNameDraft}
        chipLibrary={chipLibrary}
        chipPinDrafts={chipPinDrafts}
        chipAppearanceDraft={chipAppearanceDraft}
        onChipIdDraftChange={setChipIdDraft}
        onChipNameDraftChange={setChipNameDraft}
        onChipPinDraftChange={updateChipPinDraft}
        onAddChipPinDraft={addChipPinDraft}
        onRemoveChipPinDraft={removeChipPinDraft}
        onChipAppearanceDraftChange={(patch) => setChipAppearanceDraft((previous) => ({ ...previous, ...patch }))}
        onCreateChip={createChip}
        onClearLibrary={clearChipLibrary}
        onAddChipToWorkspace={addChipInstance}
      />

      <StatusPanel
        tick={snapshot.tick}
        running={running}
        ledSignal={ledSignal}
        clockInfo={nextClockTransitions}
        statusMessage={statusMessage}
        exportPreview={exportPreview}
        diagnostics={snapshot.diagnostics}
      />
    </main>
  );
}
