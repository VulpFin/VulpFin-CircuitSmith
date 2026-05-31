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
  type ChipDefinition,
  type CircuitDefinition,
  type LogicValue,
  type PinDefinition,
  type Position,
} from '@vfcs/circuit-model';
import { exportCircuitAsLigicJson, exportCircuitAsVerilog } from '@vfcs/exporters';
import { searchDigikeyParts } from '@vfcs/integrations';
import { SimulationEngine, type SimulationSnapshot, DEFAULT_NODE_LIBRARY } from '@vfcs/sim-core';
import { ChipLibraryPanel } from './components/ChipLibraryPanel.js';
import { ComponentPalette } from './components/ComponentPalette.js';
import { InspectorPanel } from './components/InspectorPanel.js';
import { StatusPanel } from './components/StatusPanel.js';
import { WorkspaceCanvas } from './components/WorkspaceCanvas.js';
import { PALETTE_ITEMS } from './data/componentPalette.js';
import { T_FLIP_FLOP_DEMO } from './data/demoCircuit.js';

const CHIP_LIBRARY_STORAGE_KEY = 'vfcs.chip-library.v1';

interface PendingWireSource {
  nodeId: string;
  pinId: string;
}

function initialCircuit(): CircuitDefinition {
  return recalculateNets(cloneCircuit(T_FLIP_FLOP_DEMO));
}

function initialExportPreview(): string {
  const verilog = exportCircuitAsVerilog(T_FLIP_FLOP_DEMO);
  return verilog.content;
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

function derivePublicPins(circuit: CircuitDefinition): PinDefinition[] {
  const output: PinDefinition[] = [];
  const idSet = new Set<string>();

  const createUniquePinId = (source: string): string => {
    const base = sanitizeId(source).toUpperCase() || 'PIN';
    let candidate = base;
    let index = 1;
    while (idSet.has(candidate)) {
      index += 1;
      candidate = `${base}_${index}`;
    }
    idSet.add(candidate);
    return candidate;
  };

  for (const node of circuit.nodes) {
    if (node.nodeType === 'INPUT') {
      output.push({
        id: createUniquePinId(node.label ?? node.id),
        name: node.label ?? node.id,
        direction: 'input',
      });
    }
  }

  for (const node of circuit.nodes) {
    if (node.nodeType === 'OUTPUT') {
      output.push({
        id: createUniquePinId(node.label ?? node.id),
        name: node.label ?? node.id,
        direction: 'output',
      });
    }
  }

  return output;
}

export default function App() {
  const [circuit, setCircuit] = useState<CircuitDefinition>(initialCircuit);
  const [nodePositions, setNodePositions] = useState<Record<string, Position>>(() =>
    Object.fromEntries(initialCircuit().nodes.map((node) => [node.id, node.position])),
  );

  const engineRef = useRef<SimulationEngine>(new SimulationEngine(circuit));
  const [snapshot, setSnapshot] = useState<SimulationSnapshot>(() => engineRef.current.getSnapshot());

  const [running, setRunning] = useState(false);
  const [statusMessage, setStatusMessage] = useState('Ready.');
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>('tff_main');
  const [pendingWireSource, setPendingWireSource] = useState<PendingWireSource | null>(null);
  const [exportPreview, setExportPreview] = useState(initialExportPreview);

  const [chipLibrary, setChipLibrary] = useState<ChipDefinition[]>(readChipLibrary);
  const [chipIdDraft, setChipIdDraft] = useState('chip_tff_demo');
  const [chipNameDraft, setChipNameDraft] = useState('T Flip-Flop Demo Chip');

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
    const outputNode = displayCircuit.nodes.find((node) => node.nodeType === 'OUTPUT');
    if (!outputNode) {
      return 'X';
    }

    return (snapshot.nodeStates[outputNode.id]?.value as LogicValue) ?? 'X';
  }, [displayCircuit.nodes, snapshot.nodeStates]);

  useEffect(() => {
    const next = engineRef.current.getSnapshot();
    setSnapshot(next);
  }, []);

  useEffect(() => {
    const nextEngine = new SimulationEngine(circuit);
    engineRef.current = nextEngine;
    setSnapshot(nextEngine.getSnapshot());
  }, [circuit]);

  useEffect(() => {
    setNodePositions((previous) => {
      const next: Record<string, Position> = {};
      for (const node of circuit.nodes) {
        next[node.id] = previous[node.id] ?? node.position;
      }
      return next;
    });
  }, [circuit.nodes]);

  useEffect(() => {
    if (!running) {
      return;
    }

    const handle = window.setInterval(() => {
      setSnapshot(engineRef.current.step());
    }, 400);

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
    setStatusMessage(`Toggled ${nodeId} to ${nextValue} and stepped simulation.`);
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
      const position = {
        x: 40 + (nodeIndex % 6) * 170,
        y: 40 + Math.floor(nodeIndex / 6) * 110,
      };

      const nextCircuit: CircuitDefinition = {
        ...cloneCircuit(previous),
        nodes: [
          ...previous.nodes,
          {
            id,
            nodeType,
            label: definition.label,
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

  const moveNode = (nodeId: string, position: Position) => {
    setNodePositions((previous) => ({
      ...previous,
      [nodeId]: position,
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

  const attemptConnectToNode = (targetNodeId: string) => {
    if (!pendingWireSource) {
      return;
    }

    if (pendingWireSource.nodeId === targetNodeId) {
      setStatusMessage('Cannot connect a wire from a node back to itself in this MVP editor.');
      return;
    }

    const targetNode = circuit.nodes.find((node) => node.id === targetNodeId);
    if (!targetNode) {
      setStatusMessage(`Target node ${targetNodeId} was not found.`);
      return;
    }

    const targetDefinition = DEFAULT_NODE_LIBRARY[targetNode.nodeType];
    if (!targetDefinition || targetDefinition.inputPins.length === 0) {
      setStatusMessage(`Node ${targetNodeId} has no input pins available.`);
      return;
    }

    const openPin = targetDefinition.inputPins.find(
      (pin) => !circuit.wires.some((wire) => wire.to.nodeId === targetNodeId && wire.to.pinId === pin.id),
    );
    const pinToUse = openPin ?? targetDefinition.inputPins[0];

    setCircuit((previous) => {
      const wireId = createWireId(previous);
      const next = cloneCircuit(previous);
      next.wires = [
        ...next.wires,
        {
          id: wireId,
          from: { nodeId: pendingWireSource.nodeId, pinId: pendingWireSource.pinId },
          to: { nodeId: targetNodeId, pinId: pinToUse.id },
        },
      ];
      return recalculateNets(next);
    });

    setPendingWireSource(null);
    setStatusMessage(
      `Connected ${pendingWireSource.nodeId}.${pendingWireSource.pinId} -> ${targetNodeId}.${pinToUse.id}.`,
    );
  };

  const createChip = () => {
    const chipId = sanitizeId(chipIdDraft || chipNameDraft || 'chip');
    if (!chipId || !chipNameDraft.trim()) {
      setStatusMessage('Chip ID and chip name are required.');
      return;
    }

    const chipPins = derivePublicPins(displayCircuit);
    if (chipPins.length === 0) {
      setStatusMessage('Circuit must include at least one INPUT or OUTPUT node to create public chip pins.');
      return;
    }

    const chip = createChipDefinitionFromCircuit({
      sourceCircuit: displayCircuit,
      chipId,
      chipName: chipNameDraft.trim(),
      publicPins: chipPins,
    });

    setChipLibrary((previous) => {
      const filtered = previous.filter((entry) => entry.id !== chip.id);
      return [chip, ...filtered];
    });

    setStatusMessage(`Saved chip ${chip.name} (${chip.id}) with ${chip.publicPins.length} public pins.`);
  };

  const clearChipLibrary = () => {
    setChipLibrary([]);
    setStatusMessage('Cleared local chip library.');
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
        <button
          type="button"
          onClick={() => toggleInputNode('input_t')}
          className="rounded border border-panelBorder bg-[#031a30] px-2 py-1 uppercase tracking-[0.15em] hover:border-accent"
        >
          Toggle T Input
        </button>
        <button
          type="button"
          onClick={() => toggleInputNode('input_clk')}
          className="rounded border border-panelBorder bg-[#031a30] px-2 py-1 uppercase tracking-[0.15em] hover:border-accent"
        >
          Toggle Clock Input
        </button>
        <span className="rounded border border-panelBorder px-2 py-1 text-slate-300">
          {pendingWireSource
            ? `Wire mode: ${pendingWireSource.nodeId}.${pendingWireSource.pinId} -> click target node`
            : 'Wire mode inactive'}
        </span>
      </section>

      <section className="grid flex-1 gap-4 lg:grid-cols-[280px_minmax(0,1fr)_320px]">
        <ComponentPalette items={PALETTE_ITEMS} onAddComponent={addComponent} />
        <WorkspaceCanvas
          circuit={displayCircuit}
          nodeOutputs={snapshot.nodeOutputs}
          selectedNodeId={selectedNodeId}
          pendingWireSource={pendingWireSource}
          onSelectNode={setSelectedNodeId}
          onMoveNode={moveNode}
          onAttemptConnectToNode={attemptConnectToNode}
        />
        <InspectorPanel
          circuit={displayCircuit}
          selectedNodeId={selectedNodeId}
          nodeOutputs={snapshot.nodeOutputs}
          pendingWireSource={pendingWireSource}
          onStartWireFromPin={startWireFromPin}
          onCancelPendingWire={() => setPendingWireSource(null)}
          onDeleteNode={deleteNode}
        />
      </section>

      <ChipLibraryPanel
        chipIdDraft={chipIdDraft}
        chipNameDraft={chipNameDraft}
        chipLibrary={chipLibrary}
        onChipIdDraftChange={setChipIdDraft}
        onChipNameDraftChange={setChipNameDraft}
        onCreateChip={createChip}
        onClearLibrary={clearChipLibrary}
      />

      <StatusPanel
        tick={snapshot.tick}
        running={running}
        ledSignal={ledSignal}
        statusMessage={statusMessage}
        exportPreview={exportPreview}
        diagnostics={snapshot.diagnostics}
      />
    </main>
  );
}