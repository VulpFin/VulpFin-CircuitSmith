import { useEffect, useMemo, useRef, useState } from 'react';
import {
  BRANDING,
  createChipDefinitionFromCircuit,
  type ChipDefinition,
  type CircuitDefinition,
  type LogicValue,
} from '@vfcs/circuit-model';
import { exportCircuitAsLigicJson, exportCircuitAsVerilog } from '@vfcs/exporters';
import { searchDigikeyParts } from '@vfcs/integrations';
import { getMappingsForLogicalType } from '@vfcs/part-mapper';
import { SimulationEngine } from '@vfcs/sim-core';
import { ComponentPalette } from './components/ComponentPalette.js';
import { InspectorPanel } from './components/InspectorPanel.js';
import { StatusPanel } from './components/StatusPanel.js';
import { WorkspaceCanvas } from './components/WorkspaceCanvas.js';
import { PALETTE_ITEMS } from './data/componentPalette.js';
import { T_FLIP_FLOP_DEMO } from './data/demoCircuit.js';

function cloneCircuit(circuit: CircuitDefinition): CircuitDefinition {
  return structuredClone(circuit);
}

function initialExportPreview(): string {
  const verilog = exportCircuitAsVerilog(T_FLIP_FLOP_DEMO);
  return verilog.content;
}

export default function App() {
  const [circuit] = useState<CircuitDefinition>(() => cloneCircuit(T_FLIP_FLOP_DEMO));
  const engineRef = useRef<SimulationEngine>(new SimulationEngine(circuit));

  const [snapshot, setSnapshot] = useState(() => engineRef.current.getSnapshot());
  const [running, setRunning] = useState(false);
  const [statusMessage, setStatusMessage] = useState('Ready.');
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>('tff_main');
  const [exportPreview, setExportPreview] = useState(initialExportPreview);
  const [chipDraft, setChipDraft] = useState<ChipDefinition | null>(null);

  const ledSignal = useMemo<LogicValue>(() => {
    return (snapshot.nodeStates.output_led?.value as LogicValue) ?? 'X';
  }, [snapshot.nodeStates]);

  useEffect(() => {
    if (!running) {
      return;
    }

    const handle = window.setInterval(() => {
      setSnapshot(engineRef.current.step());
    }, 500);

    return () => {
      window.clearInterval(handle);
    };
  }, [running]);

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

  const toggleClockInput = () => {
    const current = (engineRef.current.getSnapshot().nodeOutputs.input_clk?.OUT as LogicValue) ?? '0';
    engineRef.current.setInput('input_clk', current === '1' ? '0' : '1');
    setSnapshot(engineRef.current.step());
    setStatusMessage('Toggled CLK input and stepped simulation.');
  };

  const toggleTInput = () => {
    const current = (engineRef.current.getSnapshot().nodeOutputs.input_t?.OUT as LogicValue) ?? '0';
    engineRef.current.setInput('input_t', current === '1' ? '0' : '1');
    setSnapshot(engineRef.current.step());
    setStatusMessage('Toggled T input and stepped simulation.');
  };

  const makeChip = () => {
    const nextChip = createChipDefinitionFromCircuit({
      sourceCircuit: circuit,
      chipId: 'chip_tff_demo',
      chipName: 'T Flip-Flop Demo Chip',
      publicPins: [
        { id: 'T', name: 'T', direction: 'input' },
        { id: 'CLK', name: 'CLK', direction: 'input' },
        { id: 'Q', name: 'Q', direction: 'output' },
      ],
    });
    setChipDraft(nextChip);
    setStatusMessage('Created a placeholder reusable chip definition from current circuit.');
  };

  const exportLigic = () => {
    const file = exportCircuitAsLigicJson(circuit);
    setExportPreview(file.content);
    setStatusMessage(`Generated ${file.filename}.`);
  };

  const exportVerilog = () => {
    const file = exportCircuitAsVerilog(circuit);
    const warningPrefix = file.warnings.length > 0 ? ` (${file.warnings.length} warning(s))` : '';
    setExportPreview(file.content);
    setStatusMessage(`Generated ${file.filename}${warningPrefix}.`);
  };

  const findRealParts = async () => {
    const mappings = getMappingsForLogicalType('TFF');
    const placeholder = await searchDigikeyParts({ logicalType: 'TFF', keyword: 'flip-flop' });

    const firstTitles = mappings[0]?.options.map((option) => option.title).join(', ') ?? 'No mappings';
    setStatusMessage(`Part mapping options: ${firstTitles}. DigiKey integration: ${placeholder.status}.`);
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
              onClick={makeChip}
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
          onClick={toggleTInput}
          className="rounded border border-panelBorder bg-[#031a30] px-2 py-1 uppercase tracking-[0.15em] hover:border-accent"
        >
          Toggle T Input
        </button>
        <button
          type="button"
          onClick={toggleClockInput}
          className="rounded border border-panelBorder bg-[#031a30] px-2 py-1 uppercase tracking-[0.15em] hover:border-accent"
        >
          Toggle Clock Input
        </button>
        {chipDraft ? (
          <span className="rounded border border-accentSoft px-2 py-1 text-accent">Chip Draft: {chipDraft.name}</span>
        ) : (
          <span className="rounded border border-panelBorder px-2 py-1 text-slate-300">No chip draft created yet.</span>
        )}
      </section>

      <section className="grid flex-1 gap-4 lg:grid-cols-[280px_minmax(0,1fr)_320px]">
        <ComponentPalette items={PALETTE_ITEMS} />
        <WorkspaceCanvas
          circuit={circuit}
          nodeOutputs={snapshot.nodeOutputs}
          selectedNodeId={selectedNodeId}
          onSelectNode={setSelectedNodeId}
        />
        <InspectorPanel circuit={circuit} selectedNodeId={selectedNodeId} nodeOutputs={snapshot.nodeOutputs} />
      </section>

      <StatusPanel
        tick={snapshot.tick}
        running={running}
        ledSignal={ledSignal}
        statusMessage={statusMessage}
        exportPreview={exportPreview}
      />
    </main>
  );
}