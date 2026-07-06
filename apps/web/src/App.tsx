import { useEffect, useMemo, useRef, useState } from 'react';
import {
  BRANDING,
  type ChipAppearance,
  type ChipDefinition,
  cloneCircuit,
  createChipDefinitionFromCircuit,
  createNodeInstanceId,
  createWireId,
  recalculateNets,
  removeNodeAndConnections,
  sanitizeId,
  type CircuitDefinition,
  type LogicValue,
  type NodeInstance,
  type Position,
} from '@vfcs/circuit-model';
import { exportCircuitAsLigicJson, exportCircuitAsVerilog } from '@vfcs/exporters';
import { searchDigikeyParts } from '@vfcs/integrations';
import { DEFAULT_NODE_LIBRARY, SimulationEngine, type SimulationSnapshot } from '@vfcs/sim-core';
import {
  ChipLibraryPanel,
  type ChipAppearanceDraft,
  type ChipPinDraft,
  type ChipPinSourceOption,
} from './components/ChipLibraryPanel.js';
import { ComponentPalette } from './components/ComponentPalette.js';
import { InspectorPanel } from './components/InspectorPanel.js';
import { StatusPanel } from './components/StatusPanel.js';
import { TruthTableImportPanel } from './components/TruthTableImportPanel.js';
import { WorkspaceCanvas } from './components/WorkspaceCanvas.js';
import { PALETTE_ITEMS } from './data/componentPalette.js';
import { T_FLIP_FLOP_DEMO } from './data/demoCircuit.js';
import {
  buildChipPinsFromDrafts,
  createDefaultPinPosition,
  sanitizePinId,
} from './lib/chipDesigner.js';
import {
  clamp,
  clampNodeToWorkspace,
  defaultNodeSizeForType,
  nodeSize,
  nodeSizeBounds,
  WORKSPACE_DEFAULT_HEIGHT,
  WORKSPACE_DEFAULT_WIDTH,
  WORKSPACE_MAX_HEIGHT,
  WORKSPACE_MAX_WIDTH,
  WORKSPACE_MIN_HEIGHT,
  WORKSPACE_MIN_WIDTH,
  type WorkspaceSize,
} from './lib/nodeSizing.js';
import { resolveChipPinLayout, resolveNodePins } from './lib/nodePins.js';
import {
  autoVisualKey,
  createSevenSegmentPreset,
  createVisualElement,
  mergeAutoVisualElements,
  mergeNestedChipVisualElements,
  normalizeChipVisualElements,
  type ChipVisualElement,
  type ChipVisualElementType,
} from './lib/chipVisuals.js';
import {
  buildCircuitFromLogicFridayBytes,
  buildCircuitFromTruthTableText,
  isNativeLogicFridayBinary,
} from './lib/truthTableImport.js';

const CHIP_LIBRARY_STORAGE_KEY = 'vfcs.chip-library.v1';
const MIN_CLOCK_HZ = 1;
const MAX_CLOCK_HZ = 10_000_000_000;
const DEFAULT_NO_CLOCK_STEP_SECONDS = 1 / 60;
const MAX_REALTIME_STEPS_PER_FRAME = 2049;

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

function emptyWorkspaceCircuit(): CircuitDefinition {
  return {
    id: 'blank_workspace',
    name: 'Blank Workspace',
    description: 'An empty CircuitSmith workspace.',
    nodes: [],
    wires: [],
    nets: [],
    metadata: {
      clearedAt: new Date().toISOString(),
    },
  };
}

function initialExportPreview(): string {
  const verilog = exportCircuitAsVerilog(T_FLIP_FLOP_DEMO);
  return verilog.content;
}

function normalizeClockFrequencyHz(value: unknown): number {
  const frequencyHz = typeof value === 'number' && Number.isFinite(value) ? value : 1;
  return Math.min(MAX_CLOCK_HZ, Math.max(MIN_CLOCK_HZ, frequencyHz));
}

function clockHalfPeriodSeconds(frequencyHz: number): number {
  return 1 / (normalizeClockFrequencyHz(frequencyHz) * 2);
}

function findFastestClockHz(
  circuit: CircuitDefinition,
  chipLibrary: ChipDefinition[],
  visitedChipIds = new Set<string>(),
): number | null {
  let fastest: number | null = null;

  for (const node of circuit.nodes) {
    if (node.nodeType === 'CLOCK') {
      fastest = Math.max(fastest ?? 0, normalizeClockFrequencyHz(node.parameters?.frequencyHz));
    }

    if (node.nodeType === 'CHIP' && node.chipRefId && !visitedChipIds.has(node.chipRefId)) {
      const chip = chipLibrary.find((entry) => entry.id === node.chipRefId);
      if (!chip) {
        continue;
      }

      const nextVisited = new Set(visitedChipIds);
      nextVisited.add(node.chipRefId);
      const nestedFastest = findFastestClockHz(chip.internalCircuit, chipLibrary, nextVisited);
      if (nestedFastest) {
        fastest = Math.max(fastest ?? 0, nestedFastest);
      }
    }
  }

  return fastest;
}

function simulationStepSecondsForCircuit(circuit: CircuitDefinition, chipLibrary: ChipDefinition[]): number {
  const fastestClockHz = findFastestClockHz(circuit, chipLibrary);
  return fastestClockHz ? clockHalfPeriodSeconds(fastestClockHz) : DEFAULT_NO_CLOCK_STEP_SECONDS;
}

function spawnPosition(nodeType: string, nodeIndex: number, workspaceSize: WorkspaceSize): Position {
  const size = defaultNodeSizeForType(nodeType);
  const gapX = 28;
  const gapY = 28;
  const maxColumns = Math.max(1, Math.floor((workspaceSize.width - 40) / (size.width + gapX)));
  const column = nodeIndex % maxColumns;
  const row = Math.floor(nodeIndex / maxColumns);
  const raw = {
    x: 40 + column * (size.width + gapX),
    y: 40 + row * (size.height + gapY),
  };
  return clampNodeToWorkspace(raw, workspaceSize, size);
}

function workspaceSizeForCircuit(circuit: CircuitDefinition): WorkspaceSize {
  const padding = 160;
  const extents = circuit.nodes.reduce(
    (bounds, node) => {
      const size = nodeSize(node);
      return {
        width: Math.max(bounds.width, node.position.x + size.width + padding),
        height: Math.max(bounds.height, node.position.y + size.height + padding),
      };
    },
    { width: WORKSPACE_DEFAULT_WIDTH, height: WORKSPACE_DEFAULT_HEIGHT },
  );

  return {
    width: clamp(Math.ceil(extents.width), WORKSPACE_DEFAULT_WIDTH, WORKSPACE_MAX_WIDTH),
    height: clamp(Math.ceil(extents.height), WORKSPACE_DEFAULT_HEIGHT, WORKSPACE_MAX_HEIGHT),
  };
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

    return hydrateNestedChipVisualsInLibrary(parsed).chips;
  } catch {
    return [];
  }
}

function createDraftId(): string {
  return `draft_${Math.random().toString(36).slice(2, 9)}`;
}

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : {};
}

function sourceKey(nodeId: string, pinId?: string): string {
  return pinId ? `${nodeId}.${pinId}` : nodeId;
}

function draftSourceKey(draft: ChipPinDraft): string | null {
  return draft.sourceNodeId ? sourceKey(draft.sourceNodeId, draft.sourcePinId) : null;
}

function buildPinDraftsFromChip(chip: ChipDefinition): ChipPinDraft[] {
  const pinLayout = asRecord(chip.metadata?.pinLayout);
  const pinBindings = asRecord(chip.metadata?.pinBindings);
  const inputNodeIds = chip.internalCircuit.nodes
    .filter((node) => node.nodeType === 'INPUT' || node.nodeType === 'CLOCK')
    .map((node) => node.id);
  const outputNodeIds = chip.internalCircuit.nodes
    .filter((node) => node.nodeType === 'OUTPUT' || node.nodeType === 'LED')
    .map((node) => node.id);

  const used = new Set<string>();
  const nextInputSource = (): { sourceNodeId: string; sourcePinId?: string } | undefined => {
    const next = inputNodeIds.find((nodeId) => !used.has(nodeId));
    if (next) {
      used.add(next);
      return { sourceNodeId: next };
    }
    return undefined;
  };
  const nextOutputSource = (): { sourceNodeId: string; sourcePinId?: string } | undefined => {
    const next = outputNodeIds.find((nodeId) => !used.has(nodeId));
    if (next) {
      used.add(next);
      return { sourceNodeId: next };
    }
    return undefined;
  };

  return chip.publicPins.map((pin, index) => {
    const rawBinding = asRecord(pinBindings[pin.id]);
    let sourceNodeId = typeof rawBinding.sourceNodeId === 'string' ? rawBinding.sourceNodeId : undefined;
    let sourcePinId = typeof rawBinding.sourcePinId === 'string' ? rawBinding.sourcePinId : undefined;
    if (sourceNodeId) {
      used.add(sourceKey(sourceNodeId, sourcePinId));
    }

    if (!sourceNodeId) {
      const fallback =
        pin.direction === 'output'
          ? nextOutputSource()
          : pin.direction === 'input'
            ? nextInputSource()
            : nextInputSource() ?? nextOutputSource();
      sourceNodeId = fallback?.sourceNodeId;
      sourcePinId = fallback?.sourcePinId;
    }

    const rawPoint = asRecord(pinLayout[pin.id]);
    const fallback = createDefaultPinPosition(pin.direction, index);
    const pinX = typeof rawPoint.x === 'number' && Number.isFinite(rawPoint.x) ? rawPoint.x : fallback.x;
    const pinY = typeof rawPoint.y === 'number' && Number.isFinite(rawPoint.y) ? rawPoint.y : fallback.y;

    return {
      draftId: createDraftId(),
      enabled: true,
      id: pin.id,
      name: pin.name,
      direction: pin.direction,
      sourceNodeId,
      sourcePinId,
      pinX,
      pinY,
    } satisfies ChipPinDraft;
  });
}

function buildPinDraftsFromCircuit(circuit: CircuitDefinition, existing: ChipPinDraft[]): ChipPinDraft[] {
  const bySourceId = new Map<string, ChipPinDraft>();
  for (const draft of existing) {
    const key = draftSourceKey(draft);
    if (key) {
      bySourceId.set(key, draft);
    }
  }

  let inputIndex = 0;
  let outputIndex = 0;
  const linkedSourceKeys = new Set<string>();

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
      const key = sourceKey(node.id);
      linkedSourceKeys.add(key);
      const current = bySourceId.get(key);
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
        sourcePinId: undefined,
        pinX: basePosition.x,
        pinY: basePosition.y,
      } satisfies ChipPinDraft;
    });

  const customDrafts = existing
    .filter((draft) => {
      const key = draftSourceKey(draft);
      return !key || !linkedSourceKeys.has(key);
    })
    .map((draft, index) => ({
      ...draft,
      pinX: draft.pinX ?? createDefaultPinPosition(draft.direction, index).x,
      pinY: draft.pinY ?? createDefaultPinPosition(draft.direction, index).y,
    }));

  return [...linkedDrafts, ...customDrafts];
}

function buildChipPinSourceOptions(
  circuit: CircuitDefinition,
  chipLibrary: ChipDefinition[],
): ChipPinSourceOption[] {
  const options: ChipPinSourceOption[] = [];
  const sortedNodes = [...circuit.nodes].sort(
    (a, b) => a.position.y - b.position.y || a.position.x - b.position.x || a.id.localeCompare(b.id),
  );

  for (const node of sortedNodes) {
    const label = node.label ?? node.id;

    if (node.nodeType === 'INPUT' || node.nodeType === 'CLOCK') {
      options.push({
        id: sourceKey(node.id),
        nodeId: node.id,
        label,
        nodeType: node.nodeType,
        direction: 'input',
      });
    }

    if (node.nodeType === 'OUTPUT' || node.nodeType === 'LED') {
      options.push({
        id: sourceKey(node.id),
        nodeId: node.id,
        label,
        nodeType: node.nodeType,
        direction: 'output',
      });
    }

    for (const pin of resolveNodePins(node, chipLibrary).outputPins) {
      options.push({
        id: sourceKey(node.id, pin.id),
        nodeId: node.id,
        pinId: pin.id,
        label: `${label}.${pin.name}`,
        nodeType: node.nodeType,
        direction: pin.direction,
      });
    }
  }

  return options;
}

function findSelfReferencingChipNodes(circuit: CircuitDefinition, chipId: string): NodeInstance[] {
  return circuit.nodes.filter((node) => node.nodeType === 'CHIP' && node.chipRefId === chipId);
}

function describeSelfReferencingChip(circuit: CircuitDefinition, chipId: string): string | null {
  const recursiveNodes = findSelfReferencingChipNodes(circuit, chipId);
  if (recursiveNodes.length === 0) {
    return null;
  }

  return `Chip ${chipId} contains itself as internal node ${recursiveNodes.map((node) => node.id).join(', ')}. Rebuild it from the real internal circuit before saving.`;
}

function hydrateNestedChipVisualsInLibrary(chips: ChipDefinition[]): {
  chips: ChipDefinition[];
  addedVisualCount: number;
} {
  let nextLibrary = chips;
  let addedVisualCount = 0;

  for (let pass = 0; pass < Math.max(1, chips.length); pass += 1) {
    let changed = false;
    nextLibrary = nextLibrary.map((chip) => {
      const existingVisuals = normalizeChipVisualElements(chip.metadata?.visualElements);
      const mergedVisuals = mergeNestedChipVisualElements({
        circuit: chip.internalCircuit,
        chipLibrary: nextLibrary,
        existing: existingVisuals,
      });

      if (mergedVisuals.length === existingVisuals.length) {
        return chip;
      }

      changed = true;
      addedVisualCount += mergedVisuals.length - existingVisuals.length;
      return {
        ...chip,
        metadata: {
          ...chip.metadata,
          visualElements: mergedVisuals,
        },
      };
    });

    if (!changed) {
      break;
    }
  }

  return { chips: nextLibrary, addedVisualCount };
}

function downloadJsonFile(filename: string, payload: string): boolean {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return false;
  }

  const blob = new Blob([payload], { type: 'application/json' });
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
  return true;
}

export default function App() {
  const [circuit, setCircuit] = useState<CircuitDefinition>(initialCircuit);
  const [workspaceSize, setWorkspaceSize] = useState<WorkspaceSize>({
    width: WORKSPACE_DEFAULT_WIDTH,
    height: WORKSPACE_DEFAULT_HEIGHT,
  });
  const [nodePositions, setNodePositions] = useState<Record<string, Position>>(() =>
    Object.fromEntries(initialCircuit().nodes.map((node) => [node.id, node.position])),
  );

  const engineRef = useRef<SimulationEngine>(new SimulationEngine(circuit, { chipLibrary: readChipLibrary() }));
  const [snapshot, setSnapshot] = useState<SimulationSnapshot>(() => engineRef.current.settle());

  const [running, setRunning] = useState(false);
  const [statusMessage, setStatusMessage] = useState('Ready.');
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>('tff_main');
  const [selectedWireId, setSelectedWireId] = useState<string | null>(null);
  const [pendingWireSource, setPendingWireSource] = useState<PendingWireSource | null>(null);
  const [exportPreview, setExportPreview] = useState(initialExportPreview);
  const [clipboardNode, setClipboardNode] = useState<NodeInstance | null>(null);
  const [editingChipId, setEditingChipId] = useState<string | null>(null);
  const [truthTableImportDraft, setTruthTableImportDraft] = useState('');

  const [chipLibrary, setChipLibrary] = useState<ChipDefinition[]>(readChipLibrary);
  const [chipIdDraft, setChipIdDraft] = useState('');
  const [chipNameDraft, setChipNameDraft] = useState('');
  const [chipPinDrafts, setChipPinDrafts] = useState<ChipPinDraft[]>([]);
  const [chipAppearanceDraft, setChipAppearanceDraft] =
    useState<ChipAppearanceDraft>(DEFAULT_CHIP_APPEARANCE);
  const [chipVisualDrafts, setChipVisualDrafts] = useState<ChipVisualElement[]>([]);
  const [suppressedAutoVisualKeys, setSuppressedAutoVisualKeys] = useState<string[]>([]);

  const displayCircuit = useMemo<CircuitDefinition>(() => {
    return {
      ...circuit,
      nodes: circuit.nodes.map((node) => ({
        ...node,
        position: nodePositions[node.id] ?? node.position,
      })),
    };
  }, [circuit, nodePositions]);

  const designerSourceCircuit = displayCircuit;
  const chipPinSourceOptions = useMemo(
    () => buildChipPinSourceOptions(designerSourceCircuit, chipLibrary),
    [chipLibrary, designerSourceCircuit],
  );
  const chipVisualOutputPins = useMemo(
    () =>
      buildChipPinsFromDrafts(chipPinDrafts).publicPins.filter(
        (pin) => pin.direction === 'output' || pin.direction === 'bidirectional',
      ),
    [chipPinDrafts],
  );
  const chipVisualSourceOptions = useMemo(
    () =>
      chipPinSourceOptions.filter(
        (source) => source.direction === 'output' || source.direction === 'bidirectional',
      ),
    [chipPinSourceOptions],
  );
  const suppressedAutoVisualKeySet = useMemo(
    () => new Set(suppressedAutoVisualKeys),
    [suppressedAutoVisualKeys],
  );
  const chipDesignerWarning = editingChipId
    ? describeSelfReferencingChip(designerSourceCircuit, editingChipId)
    : null;

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

  const simulationStepSeconds = useMemo(
    () => simulationStepSecondsForCircuit(displayCircuit, chipLibrary),
    [chipLibrary, displayCircuit],
  );

  const nextClockTransitions = useMemo(() => {
    return clockNodes.map((node) => {
      const frequencyHz = normalizeClockFrequencyHz(node.parameters?.frequencyHz);
      const halfCycleSeconds = clockHalfPeriodSeconds(frequencyHz);
      const current = (snapshot.nodeOutputs[node.id]?.OUT as LogicValue) ?? '0';
      const halfCyclesElapsed = Math.floor(snapshot.timeSeconds / halfCycleSeconds + 1e-9);
      const nextTimeSeconds = (halfCyclesElapsed + 1) * halfCycleSeconds;
      const secondsToToggle = Math.max(0, nextTimeSeconds - snapshot.timeSeconds);
      const ticksUntilToggle = Math.max(1, Math.ceil(secondsToToggle / simulationStepSeconds));
      const nextTick = snapshot.tick + ticksUntilToggle;
      const nextState: LogicValue = current === '1' ? '0' : '1';

      return {
        nodeId: node.id,
        label: node.label ?? node.id,
        frequencyHz,
        current,
        nextTick,
        nextTimeSeconds,
        nextState,
        ticksUntilToggle,
        secondsToToggle,
      };
    });
  }, [clockNodes, simulationStepSeconds, snapshot.nodeOutputs, snapshot.tick, snapshot.timeSeconds]);

  const inputNodes = useMemo(() => {
    return displayCircuit.nodes.filter((node) => node.nodeType === 'INPUT');
  }, [displayCircuit.nodes]);

  useEffect(() => {
    const next = engineRef.current.settle();
    setSnapshot(next);
  }, []);

  useEffect(() => {
    const nextEngine = new SimulationEngine(circuit, { chipLibrary });
    engineRef.current = nextEngine;
    setSnapshot(nextEngine.settle());
  }, [circuit, chipLibrary]);

  useEffect(() => {
    setNodePositions((previous) => {
      const next: Record<string, Position> = {};
      for (const node of circuit.nodes) {
        next[node.id] = clampNodeToWorkspace(
          previous[node.id] ?? node.position,
          workspaceSize,
          nodeSize(node),
        );
      }
      return next;
    });
  }, [circuit.nodes, workspaceSize]);

  useEffect(() => {
    setChipPinDrafts((previous) => buildPinDraftsFromCircuit(circuit, previous));
  }, [circuit]);

  useEffect(() => {
    const sources = chipVisualSourceOptions.map((source) => ({
      nodeId: source.nodeId,
      pinId: source.pinId,
      label: source.label,
    }));

    setChipVisualDrafts((previous) =>
      mergeAutoVisualElements({
        outputPins: chipVisualOutputPins,
        sources,
        existing: previous,
        suppressedAutoKeys: suppressedAutoVisualKeySet,
      }),
    );
  }, [chipVisualOutputPins, chipVisualSourceOptions, suppressedAutoVisualKeySet]);

  useEffect(() => {
    setChipVisualDrafts((previous) =>
      mergeNestedChipVisualElements({
        circuit: designerSourceCircuit,
        chipLibrary,
        existing: previous,
        suppressedAutoKeys: suppressedAutoVisualKeySet,
      }),
    );
  }, [chipLibrary, designerSourceCircuit, suppressedAutoVisualKeySet]);

  useEffect(() => {
    if (!running) {
      return;
    }

    let frameId = 0;
    let previousTimeMs = window.performance.now();
    let accumulatedSeconds = 0;

    const runFrame = (timeMs: number) => {
      const elapsedSeconds = Math.min(0.25, Math.max(0, (timeMs - previousTimeMs) / 1000));
      previousTimeMs = timeMs;
      accumulatedSeconds += elapsedSeconds;

      const requestedSteps = Math.floor(accumulatedSeconds / simulationStepSeconds);
      if (requestedSteps > 0) {
        const stepsToRun = Math.min(requestedSteps, MAX_REALTIME_STEPS_PER_FRAME);
        accumulatedSeconds -= stepsToRun * simulationStepSeconds;

        if (requestedSteps > MAX_REALTIME_STEPS_PER_FRAME) {
          accumulatedSeconds = Math.min(
            accumulatedSeconds,
            simulationStepSeconds * MAX_REALTIME_STEPS_PER_FRAME * 2,
          );
        }

        setSnapshot(engineRef.current.runSteps(stepsToRun, simulationStepSeconds));
      }

      frameId = window.requestAnimationFrame(runFrame);
    };

    frameId = window.requestAnimationFrame(runFrame);

    return () => {
      window.cancelAnimationFrame(frameId);
    };
  }, [running, simulationStepSeconds]);

  useEffect(() => {
    window.localStorage.setItem(CHIP_LIBRARY_STORAGE_KEY, JSON.stringify(chipLibrary));
  }, [chipLibrary]);

  const selectNode = (nodeId: string) => {
    setSelectedNodeId(nodeId);
    setSelectedWireId(null);
  };

  const selectWire = (wireId: string) => {
    setSelectedWireId(wireId);
    setSelectedNodeId(null);
  };

  const clearSelection = () => {
    setSelectedNodeId(null);
    setSelectedWireId(null);
  };

  const copySelectedNode = () => {
    if (!selectedNodeId) {
      return;
    }
    const node = displayCircuit.nodes.find((entry) => entry.id === selectedNodeId);
    if (!node) {
      return;
    }
    setClipboardNode(structuredClone(node));
    setStatusMessage(`Copied node ${node.id}.`);
  };

  const pasteClipboardNode = () => {
    if (!clipboardNode) {
      setStatusMessage('No copied node yet. Select a node and press Ctrl+C first.');
      return;
    }

    setCircuit((previous) => {
      const id = createNodeInstanceId(previous, clipboardNode.nodeType);
      const existing = previous.nodes.find((entry) => entry.id === clipboardNode.id);
      const sourceNode = existing ?? clipboardNode;
      const size = nodeSize(sourceNode);
      const basePosition = nodePositions[selectedNodeId ?? ''] ?? sourceNode.position;
      const position = clampNodeToWorkspace(
        {
          x: basePosition.x + 28,
          y: basePosition.y + 24,
        },
        workspaceSize,
        size,
      );
      const next = cloneCircuit(previous);
      next.nodes.push({
        ...structuredClone(sourceNode),
        id,
        label: sourceNode.label ? `${sourceNode.label} Copy` : undefined,
        position,
      });
      setSelectedNodeId(id);
      setSelectedWireId(null);
      return recalculateNets(next);
    });
    setStatusMessage(`Pasted ${clipboardNode.nodeType} node.`);
  };

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (
        target
        && (target.tagName === 'INPUT'
          || target.tagName === 'TEXTAREA'
          || target.tagName === 'SELECT'
          || target.isContentEditable)
      ) {
        return;
      }

      const mod = event.ctrlKey || event.metaKey;

      if (mod && event.key.toLowerCase() === 'c') {
        event.preventDefault();
        copySelectedNode();
        return;
      }

      if (mod && event.key.toLowerCase() === 'v') {
        event.preventDefault();
        pasteClipboardNode();
        return;
      }

      const arrowDeltas: Record<string, Position> = {
        ArrowLeft: { x: -1, y: 0 },
        ArrowRight: { x: 1, y: 0 },
        ArrowUp: { x: 0, y: -1 },
        ArrowDown: { x: 0, y: 1 },
      };
      const arrowDelta = arrowDeltas[event.key];
      if (!mod && arrowDelta && selectedNodeId) {
        const node = displayCircuit.nodes.find((entry) => entry.id === selectedNodeId);
        if (!node) {
          return;
        }

        event.preventDefault();
        const stepSize = event.shiftKey ? 10 : 1;
        const size = nodeSize(node);
        const basePosition = nodePositions[selectedNodeId] ?? node.position;
        const nextPosition = clampNodeToWorkspace(
          {
            x: basePosition.x + arrowDelta.x * stepSize,
            y: basePosition.y + arrowDelta.y * stepSize,
          },
          workspaceSize,
          size,
        );
        setNodePositions((previous) => ({
          ...previous,
          [selectedNodeId]: nextPosition,
        }));
        setStatusMessage(
          `Nudged ${selectedNodeId} to ${nextPosition.x}, ${nextPosition.y}${event.shiftKey ? ' (10px)' : ' (1px)'}.`,
        );
        return;
      }

      if (!mod && (event.key === 'Delete' || event.key === 'Backspace')) {
        if (selectedWireId) {
          event.preventDefault();
          setCircuit((previous) => {
            const next = cloneCircuit(previous);
            next.wires = next.wires.filter((wire) => wire.id !== selectedWireId);
            return recalculateNets(next);
          });
          setStatusMessage(`Deleted wire ${selectedWireId}.`);
          setSelectedWireId(null);
          return;
        }

        if (selectedNodeId) {
          event.preventDefault();
          setCircuit((previous) => removeNodeAndConnections(previous, selectedNodeId));
          setSelectedNodeId(null);
          setSelectedWireId(null);
          if (pendingWireSource?.nodeId === selectedNodeId) {
            setPendingWireSource(null);
          }
          setStatusMessage(`Deleted node ${selectedNodeId} and detached connected wires.`);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    clipboardNode,
    nodePositions,
    pendingWireSource?.nodeId,
    selectedNodeId,
    selectedWireId,
    workspaceSize,
    displayCircuit.nodes,
  ]);

  const step = () => {
    setSnapshot(engineRef.current.step(simulationStepSeconds));
    setStatusMessage(`Advanced one simulation step (${simulationStepSeconds.toExponential(3)}s).`);
  };

  const reset = () => {
    setRunning(false);
    engineRef.current.reset();
    setSnapshot(engineRef.current.settle());
    setStatusMessage('Simulation reset.');
  };

  const clearWorkspace = () => {
    const hasWorkspaceContent = circuit.nodes.length > 0 || circuit.wires.length > 0;
    if (hasWorkspaceContent && typeof window !== 'undefined') {
      const confirmed = window.confirm(
        `Clear the current workspace?\n\nThis removes ${circuit.nodes.length} node(s) and ${circuit.wires.length} wire(s) from the canvas. Your saved custom chip library will not be deleted.`,
      );
      if (!confirmed) {
        setStatusMessage('Kept the current workspace.');
        return;
      }
    }

    const nextCircuit = emptyWorkspaceCircuit();
    setRunning(false);
    setCircuit(nextCircuit);
    setNodePositions({});
    setWorkspaceSize({
      width: WORKSPACE_DEFAULT_WIDTH,
      height: WORKSPACE_DEFAULT_HEIGHT,
    });
    setSelectedNodeId(null);
    setSelectedWireId(null);
    setPendingWireSource(null);
    setClipboardNode(null);
    setEditingChipId(null);
    setExportPreview(JSON.stringify(nextCircuit, null, 2));
    setStatusMessage('Cleared the workspace. Custom chips in the library were left untouched.');
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
    setSnapshot(engineRef.current.settle());
    setStatusMessage(`Toggled ${nodeId} to ${nextValue}.`);
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
      const position = spawnPosition(nodeType, nodeIndex, workspaceSize);

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
      setSelectedWireId(null);
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
      const position = spawnPosition('CHIP', nodeIndex, workspaceSize);

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
      setSelectedWireId(null);
      return recalculateNets(next);
    });

    setStatusMessage(`Placed custom chip ${chip.name} on workspace.`);
  };

  const moveNode = (nodeId: string, position: Position) => {
    const node = displayCircuit.nodes.find((entry) => entry.id === nodeId);
    const size = node ? nodeSize(node) : defaultNodeSizeForType('INPUT');
    setNodePositions((previous) => ({
      ...previous,
      [nodeId]: clampNodeToWorkspace(position, workspaceSize, size),
    }));
  };

  const deleteNode = (nodeId: string) => {
    setCircuit((previous) => removeNodeAndConnections(previous, nodeId));
    setSelectedNodeId((previous) => (previous === nodeId ? null : previous));
    setSelectedWireId(null);
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
    setSelectedWireId(null);
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
      const sourceSize = nodeSize(sourceNode);
      const targetSize = nodeSize(targetNode);
      const sourceY = sourceNode.position.y + sourceSize.height * 0.5;
      pinToUse = [...candidatePins].sort((a, b) => {
        const yA = targetNode.position.y + targetSize.height * ((layout[a.id]?.y ?? 50) / 100);
        const yB = targetNode.position.y + targetSize.height * ((layout[b.id]?.y ?? 50) / 100);
        return Math.abs(yA - sourceY) - Math.abs(yB - sourceY);
      })[0];
    }

    connectPendingWireToPin(targetNodeId, pinToUse.id);
  };

  const deleteWire = (wireId: string) => {
    setCircuit((previous) => {
      const next = cloneCircuit(previous);
      next.wires = next.wires.filter((wire) => wire.id !== wireId);
      return recalculateNets(next);
    });
    setSelectedWireId((previous) => (previous === wireId ? null : previous));
    setStatusMessage(`Deleted wire ${wireId}.`);
  };

  const updateWireTargetPin = (wireId: string, targetPinId: string) => {
    const wire = circuit.wires.find((entry) => entry.id === wireId);
    if (!wire) {
      setStatusMessage(`Wire ${wireId} was not found.`);
      return;
    }

    const targetNode = displayCircuit.nodes.find((node) => node.id === wire.to.nodeId);
    if (!targetNode) {
      setStatusMessage(`Target node ${wire.to.nodeId} was not found.`);
      return;
    }

    const targetPins = resolveNodePins(targetNode, chipLibrary).inputPins;
    if (!targetPins.some((pin) => pin.id === targetPinId)) {
      setStatusMessage(`Pin ${targetPinId} is not a valid input pin on ${targetNode.id}.`);
      return;
    }

    setCircuit((previous) => {
      const next = cloneCircuit(previous);
      next.wires = next.wires.map((entry) =>
        entry.id === wireId
          ? {
              ...entry,
              to: {
                ...entry.to,
                pinId: targetPinId,
              },
            }
          : entry,
      );
      return recalculateNets(next);
    });
    setStatusMessage(`Wire ${wireId} target switched to ${wire.to.nodeId}.${targetPinId}.`);
  };

  const updateWireSourcePin = (wireId: string, sourcePinId: string) => {
    const wire = circuit.wires.find((entry) => entry.id === wireId);
    if (!wire) {
      setStatusMessage(`Wire ${wireId} was not found.`);
      return;
    }

    const sourceNode = displayCircuit.nodes.find((node) => node.id === wire.from.nodeId);
    if (!sourceNode) {
      setStatusMessage(`Source node ${wire.from.nodeId} was not found.`);
      return;
    }

    const sourcePins = resolveNodePins(sourceNode, chipLibrary).outputPins;
    if (!sourcePins.some((pin) => pin.id === sourcePinId)) {
      setStatusMessage(`Pin ${sourcePinId} is not a valid output pin on ${sourceNode.id}.`);
      return;
    }

    setCircuit((previous) => {
      const next = cloneCircuit(previous);
      next.wires = next.wires.map((entry) =>
        entry.id === wireId
          ? {
              ...entry,
              from: {
                ...entry.from,
                pinId: sourcePinId,
              },
            }
          : entry,
      );
      return recalculateNets(next);
    });
    setStatusMessage(`Wire ${wireId} source switched to ${wire.from.nodeId}.${sourcePinId}.`);
  };

  const updateNodeSize = (nodeId: string, width: number, height: number) => {
    const currentNode = displayCircuit.nodes.find((entry) => entry.id === nodeId);
    if (!currentNode) {
      setStatusMessage(`Node ${nodeId} was not found.`);
      return;
    }
    const currentSize = nodeSize(currentNode);
    const bounds = nodeSizeBounds(currentNode);
    const nextWidth = Number.isFinite(width) ? Math.round(width) : currentSize.width;
    const nextHeight = Number.isFinite(height) ? Math.round(height) : currentSize.height;
    const clampedWidth = clamp(nextWidth, bounds.minWidth, bounds.maxWidth);
    const clampedHeight = clamp(nextHeight, bounds.minHeight, bounds.maxHeight);
    updateCircuitNode(nodeId, (entry) => ({
      ...entry,
      parameters: {
        ...(entry.parameters ?? {}),
        width: clampedWidth,
        height: clampedHeight,
      },
    }));
    setStatusMessage(`Resized ${nodeId} to ${clampedWidth} x ${clampedHeight}.`);
  };

  const loadChipIntoDesigner = (chipId: string) => {
    const chip = chipLibrary.find((entry) => entry.id === chipId);
    if (!chip) {
      setStatusMessage(`Chip ${chipId} not found.`);
      return;
    }

    const appearance = asRecord(chip.metadata?.appearance);
    const suppressedKeys = Array.isArray(chip.metadata?.suppressedAutoVisualKeys)
      ? chip.metadata.suppressedAutoVisualKeys.filter((value): value is string => typeof value === 'string')
      : [];
    const internalCircuit = recalculateNets(cloneCircuit(chip.internalCircuit));
    const internalPositions = Object.fromEntries(internalCircuit.nodes.map((node) => [node.id, node.position]));

    setRunning(false);
    setCircuit(internalCircuit);
    setNodePositions(internalPositions);
    setWorkspaceSize(workspaceSizeForCircuit(internalCircuit));
    setSelectedNodeId(null);
    setSelectedWireId(null);
    setPendingWireSource(null);
    setChipIdDraft(chip.id);
    setChipNameDraft(chip.name);
    setChipPinDrafts(buildPinDraftsFromChip(chip));
    setChipVisualDrafts(normalizeChipVisualElements(chip.metadata?.visualElements));
    setSuppressedAutoVisualKeys(suppressedKeys);
    setChipAppearanceDraft({
      shape:
        appearance.shape === 'rounded' || appearance.shape === 'seven-segment'
          ? appearance.shape
          : DEFAULT_CHIP_APPEARANCE.shape,
      bodyColor:
        typeof appearance.bodyColor === 'string' ? appearance.bodyColor : DEFAULT_CHIP_APPEARANCE.bodyColor,
      accentColor:
        typeof appearance.accentColor === 'string' ? appearance.accentColor : DEFAULT_CHIP_APPEARANCE.accentColor,
      textColor:
        typeof appearance.textColor === 'string' ? appearance.textColor : DEFAULT_CHIP_APPEARANCE.textColor,
      symbol: typeof appearance.symbol === 'string' ? appearance.symbol : DEFAULT_CHIP_APPEARANCE.symbol,
    });
    setEditingChipId(chip.id);
    setExportPreview(exportCircuitAsVerilog(internalCircuit).content);
    setStatusMessage(
      describeSelfReferencingChip(internalCircuit, chip.id)
      ?? `Opened ${chip.name} internals on the workspace. Edit the canvas, then press Update Chip to save it back.`,
    );
  };

  const importChipJson = (payload: string) => {
    try {
      const parsed = JSON.parse(payload) as unknown;
      const candidates = Array.isArray(parsed) ? parsed : [parsed];
      const incoming: ChipDefinition[] = [];
      const skippedRecursive: string[] = [];

      for (const candidate of candidates) {
        if (typeof candidate !== 'object' || candidate === null) {
          continue;
        }

        const chip = candidate as ChipDefinition;
        if (!chip.id || !chip.name || !Array.isArray(chip.publicPins) || !chip.internalCircuit) {
          continue;
        }
        if (findSelfReferencingChipNodes(chip.internalCircuit, chip.id).length > 0) {
          skippedRecursive.push(chip.name);
          continue;
        }
        incoming.push(chip);
      }

      if (incoming.length === 0) {
        setStatusMessage(
          skippedRecursive.length > 0
            ? `Skipped ${skippedRecursive.join(', ')}: chip JSON contains an instance of itself.`
            : 'No valid chip definitions were found in the import payload.',
        );
        return;
      }

      const byId = new Map(chipLibrary.map((chip) => [chip.id, chip]));
      for (const chip of incoming) {
        byId.set(chip.id, chip);
      }
      const hydrated = hydrateNestedChipVisualsInLibrary([...byId.values()]);
      setChipLibrary(hydrated.chips);
      setStatusMessage(
        `Imported ${incoming.length} chip definition(s).${
          skippedRecursive.length > 0 ? ` Skipped recursive chip(s): ${skippedRecursive.join(', ')}.` : ''
        }${hydrated.addedVisualCount > 0 ? ` Added ${hydrated.addedVisualCount} nested face element(s).` : ''}`,
      );
    } catch {
      setStatusMessage('Chip import failed: invalid JSON payload.');
    }
  };

  const exportChipJsonToClipboard = async (chipId: string) => {
    const chip = chipLibrary.find((entry) => entry.id === chipId);
    if (!chip) {
      setStatusMessage(`Chip ${chipId} was not found.`);
      return;
    }

    const payload = JSON.stringify(chip, null, 2);
    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(payload);
        setStatusMessage(`Copied ${chip.name} JSON to clipboard.`);
      } else {
        setExportPreview(payload);
        setStatusMessage(`Clipboard unavailable; ${chip.name} JSON pushed to preview panel.`);
      }
    } catch {
      setExportPreview(payload);
      setStatusMessage(`Clipboard write failed; ${chip.name} JSON pushed to preview panel.`);
    }
  };

  const exportChipLibraryJson = async () => {
    const payload = JSON.stringify(chipLibrary, null, 2);
    const filename = `vfcs-chip-library-${new Date().toISOString().slice(0, 10)}.json`;
    setExportPreview(payload);

    let copied = false;
    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(payload);
        copied = true;
      }
    } catch {
      copied = false;
    }

    const downloaded = downloadJsonFile(filename, payload);
    const destinations = [
      'preview panel',
      copied ? 'clipboard' : null,
      downloaded ? filename : null,
    ].filter(Boolean);

    setStatusMessage(`Exported ${chipLibrary.length} chip(s) to ${destinations.join(', ')}.`);
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

    const selfReferenceWarning = describeSelfReferencingChip(designerSourceCircuit, chipId);
    if (selfReferenceWarning) {
      setStatusMessage(selfReferenceWarning);
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
      sourceCircuit: designerSourceCircuit,
      chipId,
      chipName: chipNameDraft.trim(),
      publicPins: built.publicPins,
      metadata: {
        appearance: chipAppearance,
        pinLayout: built.pinLayout,
        pinBindings: built.pinBindings,
        visualElements: chipVisualDrafts,
        suppressedAutoVisualKeys,
      },
    });

    const wasExisting = chipLibrary.some((entry) => entry.id === chip.id);
    setChipLibrary((previous) => {
      const filtered = previous.filter((entry) => entry.id !== chip.id);
      return [chip, ...filtered];
    });
    setEditingChipId(chip.id);

    setStatusMessage(
      `${wasExisting ? 'Updated' : 'Saved'} chip ${chip.name} (${chip.id}) with ${chip.publicPins.length} public pins.`,
    );
  };

  const startNewChipDesigner = () => {
    const usedIds = new Set(chipLibrary.map((chip) => chip.id));
    const currentDraftId = sanitizeId(chipIdDraft);
    if (currentDraftId) {
      usedIds.add(currentDraftId);
    }

    let nextIndex = 1;
    while (usedIds.has(`empty_chip_${nextIndex}`)) {
      nextIndex += 1;
    }

    const nextChipId = `empty_chip_${nextIndex}`;
    const nextChipName = `Empty Chip ${nextIndex}`;
    setEditingChipId(null);
    setChipIdDraft(nextChipId);
    setChipNameDraft(nextChipName);
    setChipPinDrafts([]);
    setChipAppearanceDraft(DEFAULT_CHIP_APPEARANCE);
    setChipVisualDrafts([]);
    setSuppressedAutoVisualKeys([]);
    setStatusMessage(
      `Started ${nextChipName}. Add pins manually, or use Reset Designer to pull pins from the workspace.`,
    );
  };

  const clearChipLibrary = () => {
    setChipLibrary([]);
    setEditingChipId(null);
    setSuppressedAutoVisualKeys([]);
    setStatusMessage('Cleared local chip library.');
  };

  const deleteChipFromLibrary = (chipId: string) => {
    const chip = chipLibrary.find((entry) => entry.id === chipId);
    if (!chip) {
      setStatusMessage(`Chip ${chipId} was not found.`);
      return;
    }

    const placedInstances = circuit.nodes.filter((node) => node.nodeType === 'CHIP' && node.chipRefId === chipId);
    if (placedInstances.length > 0 && typeof window !== 'undefined') {
      const confirmed = window.confirm(
        `Delete ${chip.name} from the chip library?\n\n${placedInstances.length} placed instance(s) on the workspace will remain, but they will show as missing until you re-import or recreate this chip.`,
      );
      if (!confirmed) {
        setStatusMessage(`Kept ${chip.name} in the chip library.`);
        return;
      }
    }

    setChipLibrary((previous) => previous.filter((entry) => entry.id !== chipId));
    if (editingChipId === chipId) {
      setEditingChipId(null);
      setChipIdDraft('');
      setChipNameDraft('');
      setChipPinDrafts([]);
      setChipAppearanceDraft(DEFAULT_CHIP_APPEARANCE);
      setChipVisualDrafts([]);
      setSuppressedAutoVisualKeys([]);
    }
    setStatusMessage(`Deleted ${chip.name} (${chip.id}) from the chip library.`);
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

  const addChipVisual = (type: ChipVisualElementType) => {
    setChipVisualDrafts((previous) => [...previous, createVisualElement(type, previous.length)]);
  };

  const addSevenSegmentVisualPreset = () => {
    setChipVisualDrafts(
      createSevenSegmentPreset(
        chipVisualOutputPins,
        chipVisualSourceOptions.map((source) => ({
          nodeId: source.nodeId,
          pinId: source.pinId,
          label: source.label,
        })),
      ),
    );
    setChipAppearanceDraft((previous) => ({
      ...previous,
      shape: 'seven-segment',
      symbol: previous.symbol === 'CHIP' ? '7SEG' : previous.symbol,
    }));
    setStatusMessage('Added seven-segment visual preset. Bind any unmatched bars to public output pins.');
  };

  const importNestedChipVisuals = () => {
    const nextVisualDrafts = mergeNestedChipVisualElements({
      circuit: designerSourceCircuit,
      chipLibrary,
      existing: chipVisualDrafts,
      suppressedAutoKeys: new Set(),
    });
    const added = nextVisualDrafts.length - chipVisualDrafts.length;
    setSuppressedAutoVisualKeys((previous) => previous.filter((key) => !key.startsWith('nested:')));
    setChipVisualDrafts(nextVisualDrafts);
    setStatusMessage(
      added > 0
        ? `Pulled ${added} face element(s) from visual chip(s) placed in the workspace.`
        : 'No new nested chip face elements were found to pull in.',
    );
  };

  const updateChipVisual = (visualId: string, patch: Partial<ChipVisualElement>) => {
    const rebindingVisual =
      'type' in patch
      || 'bindingPinId' in patch
      || 'sourceNodeId' in patch
      || 'sourcePinId' in patch;
    setChipVisualDrafts((previous) =>
      {
        const target = previous.find((visual) => visual.id === visualId);
        if (!target) {
          return previous;
        }

        const movingGroup =
          target.groupId
          && (typeof patch.x === 'number' || typeof patch.y === 'number')
          && !rebindingVisual;
        if (movingGroup) {
          const nextX = typeof patch.x === 'number' ? patch.x : target.x;
          const nextY = typeof patch.y === 'number' ? patch.y : target.y;
          const deltaX = nextX - target.x;
          const deltaY = nextY - target.y;
          return previous.map((visual) =>
            visual.groupId === target.groupId
              ? {
                  ...visual,
                  x: clamp(visual.x + deltaX, 2, 98),
                  y: clamp(visual.y + deltaY, 2, 98),
                }
              : visual,
          );
        }

        return previous.map((visual) =>
          visual.id === visualId
            ? { ...visual, ...(rebindingVisual ? { autoKey: undefined } : {}), ...patch }
            : visual,
        );
      },
    );
  };

  const scaleChipVisualGroup = (groupId: string, scaleFactor: number) => {
    const factor = Number.isFinite(scaleFactor) ? clamp(scaleFactor, 0.1, 5) : 1;
    const currentMembers = chipVisualDrafts.filter((visual) => visual.groupId === groupId);
    if (currentMembers.length === 0) {
      setStatusMessage(`No face group ${groupId} was found.`);
      return;
    }

    const groupLabel = currentMembers.find((visual) => visual.groupLabel)?.groupLabel ?? groupId;
    setChipVisualDrafts((previous) => {
      const members = previous.filter((visual) => visual.groupId === groupId);
      if (members.length === 0) {
        return previous;
      }

      const left = Math.min(...members.map((visual) => visual.x - visual.width / 2));
      const right = Math.max(...members.map((visual) => visual.x + visual.width / 2));
      const top = Math.min(...members.map((visual) => visual.y - visual.height / 2));
      const bottom = Math.max(...members.map((visual) => visual.y + visual.height / 2));
      const centerX = (left + right) / 2;
      const centerY = (top + bottom) / 2;
      const scaledMembers = members.map((visual) => ({
        id: visual.id,
        x: centerX + (visual.x - centerX) * factor,
        y: centerY + (visual.y - centerY) * factor,
        width: clamp(visual.width * factor, 2, 95),
        height: clamp(visual.height * factor, 2, 95),
      }));
      const scaledLeft = Math.min(...scaledMembers.map((visual) => visual.x - visual.width / 2));
      const scaledRight = Math.max(...scaledMembers.map((visual) => visual.x + visual.width / 2));
      const scaledTop = Math.min(...scaledMembers.map((visual) => visual.y - visual.height / 2));
      const scaledBottom = Math.max(...scaledMembers.map((visual) => visual.y + visual.height / 2));
      let shiftX = scaledLeft < 2 ? 2 - scaledLeft : 0;
      let shiftY = scaledTop < 2 ? 2 - scaledTop : 0;
      if (scaledRight + shiftX > 98) {
        shiftX = 98 - scaledRight;
      }
      if (scaledBottom + shiftY > 98) {
        shiftY = 98 - scaledBottom;
      }
      const scaledById = new Map(scaledMembers.map((visual) => [visual.id, visual]));

      return previous.map((visual) => {
        const scaled = scaledById.get(visual.id);
        if (!scaled) {
          return visual;
        }

        return {
          ...visual,
          x: clamp(scaled.x + shiftX, 2, 98),
          y: clamp(scaled.y + shiftY, 2, 98),
          width: scaled.width,
          height: scaled.height,
        };
      });
    });
    setStatusMessage(`Scaled ${groupLabel} face group by ${Math.round(factor * 100)}%.`);
  };

  const removeChipVisual = (visualId: string) => {
    const visual = chipVisualDrafts.find((entry) => entry.id === visualId);
    const key = visual ? autoVisualKey(visual) : null;
    if (key) {
      setSuppressedAutoVisualKeys((previous) =>
        previous.includes(key) ? previous : [...previous, key],
      );
    }
    setChipVisualDrafts((previous) => previous.filter((visual) => visual.id !== visualId));
  };

  const resetChipDesigner = () => {
    setEditingChipId(null);
    setChipIdDraft('chip_tff_demo');
    setChipNameDraft('T Flip-Flop Demo Chip');
    setChipPinDrafts(buildPinDraftsFromCircuit(circuit, []));
    setChipAppearanceDraft(DEFAULT_CHIP_APPEARANCE);
    setChipVisualDrafts([]);
    setSuppressedAutoVisualKeys([]);
    setStatusMessage('Reset chip designer to current workspace pin defaults.');
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

  const importTruthTableText = (payload = truthTableImportDraft, sourceName = 'pasted truth table') => {
    try {
      const result = buildCircuitFromTruthTableText(payload, sourceName);
      const nextPositions = Object.fromEntries(result.circuit.nodes.map((node) => [node.id, node.position]));
      const warningSuffix =
        result.summary.warnings.length > 0 ? ` ${result.summary.warnings.length} warning(s); see preview.` : '';

      setRunning(false);
      setCircuit(result.circuit);
      setNodePositions(nextPositions);
      setWorkspaceSize(result.workspaceSize);
      setSelectedNodeId(null);
      setSelectedWireId(null);
      setPendingWireSource(null);
      setExportPreview(result.preview);
      setStatusMessage(
        `Built ${result.summary.nodeCount} node(s) and ${result.summary.wireCount} wire(s) from ${result.summary.rowCount} truth-table row(s).${warningSuffix}`,
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown truth-table import error.';
      setStatusMessage(`Truth table import failed: ${message}`);
      setExportPreview(`Truth table import failed:\n\n${message}`);
    }
  };

  const importTruthTableFile = async (file: File) => {
    const bytes = new Uint8Array(await file.arrayBuffer());
    if (isNativeLogicFridayBinary(bytes)) {
      try {
        const result = buildCircuitFromLogicFridayBytes(bytes, file.name);
        const nextPositions = Object.fromEntries(result.circuit.nodes.map((node) => [node.id, node.position]));

        setRunning(false);
        setCircuit(result.circuit);
        setNodePositions(nextPositions);
        setWorkspaceSize(result.workspaceSize);
        setSelectedNodeId(null);
        setSelectedWireId(null);
        setPendingWireSource(null);
        setExportPreview(result.preview);
        setStatusMessage(
          `Recovered ${result.summary.outputCount} Logic Friday equation(s) from ${file.name} and built ${result.summary.nodeCount} node(s).`,
        );
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown native Logic Friday import error.';
        setStatusMessage(`Native .lfcn import failed: ${message}`);
        setExportPreview(`Native .lfcn import failed:\n\n${message}`);
      }
      return;
    }

    const payload = new TextDecoder('utf-8').decode(bytes);
    setTruthTableImportDraft(payload);
    importTruthTableText(payload, file.name);
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
              onClick={clearWorkspace}
              className="rounded-md border border-[#7a4a20] bg-[#2d1b0d] px-3 py-2 text-[#ffd28a] hover:border-signalHot"
              title="Remove all nodes and wires from the current workspace without deleting the chip library."
            >
              Clear Workspace
            </button>
            <button
              type="button"
              onClick={startNewChipDesigner}
              className="rounded-md border border-panelBorder bg-[#06233d] px-3 py-2 hover:border-accent"
            >
              New Empty Chip
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
        <span className="rounded border border-panelBorder px-2 py-1 text-slate-300">
          Keys: arrows nudge selected 1px, Shift+arrows nudge 10px, Del deletes selected, Ctrl/Cmd+C copy node, Ctrl/Cmd+V paste node
        </span>

        <label className="rounded border border-panelBorder px-2 py-1 text-slate-300">
          Canvas W
          <input
            type="number"
            min={WORKSPACE_MIN_WIDTH}
            max={WORKSPACE_MAX_WIDTH}
            value={workspaceSize.width}
            onChange={(event) => {
              const next = Number(event.target.value);
              if (!Number.isFinite(next)) {
                return;
              }
              setWorkspaceSize((previous) => ({
                ...previous,
                width: clamp(Math.round(next), WORKSPACE_MIN_WIDTH, WORKSPACE_MAX_WIDTH),
              }));
            }}
            className="ml-2 w-20 rounded border border-panelBorder bg-[#031a30] px-1 py-[1px] text-slate-100"
          />
        </label>
        <label className="rounded border border-panelBorder px-2 py-1 text-slate-300">
          Canvas H
          <input
            type="number"
            min={WORKSPACE_MIN_HEIGHT}
            max={WORKSPACE_MAX_HEIGHT}
            value={workspaceSize.height}
            onChange={(event) => {
              const next = Number(event.target.value);
              if (!Number.isFinite(next)) {
                return;
              }
              setWorkspaceSize((previous) => ({
                ...previous,
                height: clamp(Math.round(next), WORKSPACE_MIN_HEIGHT, WORKSPACE_MAX_HEIGHT),
              }));
            }}
            className="ml-2 w-20 rounded border border-panelBorder bg-[#031a30] px-1 py-[1px] text-slate-100"
          />
        </label>
      </section>

      <TruthTableImportPanel
        importDraft={truthTableImportDraft}
        onImportDraftChange={setTruthTableImportDraft}
        onImportText={() => importTruthTableText()}
        onImportFile={importTruthTableFile}
      />

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
          selectedWireId={selectedWireId}
          pendingWireSource={pendingWireSource}
          chipLibrary={chipLibrary}
          onSelectNode={selectNode}
          onSelectWire={selectWire}
          onClearSelection={clearSelection}
          onMoveNode={moveNode}
          onAttemptConnectToNode={attemptConnectToNode}
          onToggleInputNode={toggleInputNode}
        />
        <InspectorPanel
          circuit={displayCircuit}
          selectedNodeId={selectedNodeId}
          selectedWireId={selectedWireId}
          nodeOutputs={snapshot.nodeOutputs}
          nodeStates={snapshot.nodeStates}
          pendingWireSource={pendingWireSource}
          chipLibrary={chipLibrary}
          onStartWireFromPin={startWireFromPin}
          onCancelPendingWire={() => setPendingWireSource(null)}
          onConnectPendingWireToPin={connectPendingWireToPin}
          onDeleteWire={deleteWire}
          onUpdateWireSourcePin={updateWireSourcePin}
          onUpdateWireTargetPin={updateWireTargetPin}
          onDeleteNode={deleteNode}
          onToggleInputNode={toggleInputNode}
          onUpdateNodeLabel={updateNodeLabel}
          onUpdateClockFrequency={updateClockFrequency}
          onUpdateNodeSize={updateNodeSize}
          onLoadChipIntoDesigner={loadChipIntoDesigner}
          clockTick={snapshot.tick}
          clockInfo={nextClockTransitions}
        />
      </section>

      <ChipLibraryPanel
        chipIdDraft={chipIdDraft}
        chipNameDraft={chipNameDraft}
        editingChipId={editingChipId}
        chipLibrary={chipLibrary}
        chipPinDrafts={chipPinDrafts}
        chipPinSourceOptions={chipPinSourceOptions}
        chipDesignerWarning={chipDesignerWarning}
        chipAppearanceDraft={chipAppearanceDraft}
        chipVisualDrafts={chipVisualDrafts}
        chipVisualOutputPins={chipVisualOutputPins}
        chipVisualSourceOptions={chipVisualSourceOptions}
        onChipIdDraftChange={(value) => {
          setChipIdDraft(value);
          if (editingChipId && value !== editingChipId) {
            setEditingChipId(null);
          }
        }}
        onChipNameDraftChange={setChipNameDraft}
        onChipPinDraftChange={updateChipPinDraft}
        onAddChipPinDraft={addChipPinDraft}
        onRemoveChipPinDraft={removeChipPinDraft}
        onChipAppearanceDraftChange={(patch) => setChipAppearanceDraft((previous) => ({ ...previous, ...patch }))}
        onAddChipVisual={addChipVisual}
        onAddSevenSegmentVisualPreset={addSevenSegmentVisualPreset}
        onImportNestedChipVisuals={importNestedChipVisuals}
        onUpdateChipVisual={updateChipVisual}
        onScaleChipVisualGroup={scaleChipVisualGroup}
        onRemoveChipVisual={removeChipVisual}
        onStartNewChip={startNewChipDesigner}
        onCreateChip={createChip}
        onClearLibrary={clearChipLibrary}
        onExportChipLibrary={exportChipLibraryJson}
        onAddChipToWorkspace={addChipInstance}
        onEditChip={loadChipIntoDesigner}
        onExportChipJson={exportChipJsonToClipboard}
        onDeleteChip={deleteChipFromLibrary}
        onImportChipJson={importChipJson}
        onResetDesigner={resetChipDesigner}
      />

      <StatusPanel
        tick={snapshot.tick}
        timeSeconds={snapshot.timeSeconds}
        simulationStepSeconds={simulationStepSeconds}
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
