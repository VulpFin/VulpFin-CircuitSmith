import type { ChipDefinition, CircuitDefinition, LogicValue } from '@vfcs/circuit-model';
import { getMappingsForLogicalType } from '@vfcs/part-mapper';
import { resolveChipPinLayout, resolveNodePins } from '../lib/nodePins.js';

interface PendingWireSource {
  nodeId: string;
  pinId: string;
}

interface InspectorPanelProps {
  circuit: CircuitDefinition;
  selectedNodeId: string | null;
  nodeOutputs: Record<string, Record<string, LogicValue>>;
  pendingWireSource: PendingWireSource | null;
  chipLibrary: ChipDefinition[];
  onStartWireFromPin: (source: PendingWireSource) => void;
  onCancelPendingWire: () => void;
  onConnectPendingWireToPin: (targetNodeId: string, targetPinId: string) => void;
  onDeleteNode: (nodeId: string) => void;
  onToggleInputNode: (nodeId: string) => void;
  onUpdateNodeLabel: (nodeId: string, label: string) => void;
  onUpdateClockFrequency: (nodeId: string, frequencyHz: number) => void;
  clockTick: number;
  clockRunning: boolean;
  clockInfo: Array<{
    nodeId: string;
    nextTick: number;
    nextState: LogicValue;
    ticksUntilToggle: number;
    secondsToToggle: number | null;
  }>;
}

const MIN_CLOCK_HZ = 1;
const MAX_CLOCK_HZ = 10_000_000_000;

export function InspectorPanel({
  circuit,
  selectedNodeId,
  nodeOutputs,
  pendingWireSource,
  chipLibrary,
  onStartWireFromPin,
  onCancelPendingWire,
  onConnectPendingWireToPin,
  onDeleteNode,
  onToggleInputNode,
  onUpdateNodeLabel,
  onUpdateClockFrequency,
  clockTick,
  clockRunning,
  clockInfo,
}: InspectorPanelProps) {
  const node = circuit.nodes.find((entry) => entry.id === selectedNodeId) ?? null;

  if (!node) {
    return (
      <aside className="rounded-xl border border-panelBorder bg-panel/80 p-4 shadow-panelGlow backdrop-blur-sm">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-[0.2em] text-accent">Inspector</h2>
        <p className="text-sm text-slate-300">Select a node in the workspace to inspect its state and mapping options.</p>
      </aside>
    );
  }

  const outputs = nodeOutputs[node.id] ?? {};
  const mappings = getMappingsForLogicalType(node.nodeType);
  const pinInfo = resolveNodePins(node, chipLibrary);
  const chipPinLayout = resolveChipPinLayout(node, chipLibrary);
  const selectedClockInfo = clockInfo.find((entry) => entry.nodeId === node.id);

  const currentClockHzRaw = Number(node.parameters?.frequencyHz ?? 1);
  const currentClockHz = Number.isFinite(currentClockHzRaw)
    ? Math.min(MAX_CLOCK_HZ, Math.max(MIN_CLOCK_HZ, currentClockHzRaw))
    : 1;

  return (
    <aside className="rounded-xl border border-panelBorder bg-panel/80 p-4 shadow-panelGlow backdrop-blur-sm">
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-[0.2em] text-accent">Inspector</h2>
      <div className="space-y-4 text-sm">
        <div>
          <div className="text-xs uppercase tracking-[0.15em] text-accentSoft">Node</div>
          <div className="text-slate-300">ID: {node.id}</div>
          <div className="text-slate-300">Type: {node.nodeType}</div>
          <label className="mt-2 block text-xs uppercase tracking-[0.12em] text-accentSoft">
            Label
            <input
              value={node.label ?? ''}
              onChange={(event) => onUpdateNodeLabel(node.id, event.target.value)}
              className="mt-1 w-full rounded border border-panelBorder bg-[#031a30] px-2 py-1 text-sm text-slate-100 outline-none focus:border-accent"
            />
          </label>
        </div>

        <div>
          <div className="text-xs uppercase tracking-[0.15em] text-accentSoft">Signals</div>
          <ul className="mt-1 space-y-1 text-slate-200">
            {Object.entries(outputs).length === 0 ? (
              <li>No output pins</li>
            ) : (
              Object.entries(outputs).map(([pinId, value]) => (
                <li key={pinId}>
                  {pinId}: <span className="text-signalHot">{value}</span>
                </li>
              ))
            )}
          </ul>
        </div>

        {node.nodeType === 'INPUT' ? (
          <button
            type="button"
            onClick={() => onToggleInputNode(node.id)}
            className="w-full rounded border border-panelBorder bg-[#031a30] px-2 py-1 text-left text-xs uppercase tracking-[0.12em] hover:border-accent"
          >
            Toggle Input State
          </button>
        ) : null}

        {node.nodeType === 'CLOCK' ? (
          <div>
            <div className="text-xs uppercase tracking-[0.15em] text-accentSoft">Clock Frequency</div>
            <label className="mt-1 block text-xs text-slate-300">
              1 Hz to 10 GHz
              <input
                type="number"
                min={MIN_CLOCK_HZ}
                max={MAX_CLOCK_HZ}
                value={currentClockHz}
                onChange={(event) => {
                  const next = Number(event.target.value);
                  if (!Number.isFinite(next)) {
                    return;
                  }
                  const clamped = Math.min(MAX_CLOCK_HZ, Math.max(MIN_CLOCK_HZ, next));
                  onUpdateClockFrequency(node.id, clamped);
                }}
                className="mt-1 w-full rounded border border-panelBorder bg-[#031a30] px-2 py-1 text-sm text-slate-100 outline-none focus:border-accent"
              />
            </label>
            <div className="mt-2 rounded border border-panelBorder/70 bg-[#031a30] p-2 text-xs text-slate-300">
              <div>Tick now: {clockTick}</div>
              <div>Next toggle tick: {selectedClockInfo?.nextTick ?? '-'}</div>
              <div>Ticks until toggle: {selectedClockInfo?.ticksUntilToggle ?? '-'}</div>
              <div>Next state: {selectedClockInfo?.nextState ?? '-'}</div>
              <div>
                ETA:{' '}
                {clockRunning && selectedClockInfo?.secondsToToggle != null
                  ? `${selectedClockInfo.secondsToToggle.toFixed(2)}s at current sim pace`
                  : 'start Run Simulation for real-time ETA'}
              </div>
            </div>
          </div>
        ) : null}

        {pinInfo.outputPins.length ? (
          <div>
            <div className="text-xs uppercase tracking-[0.15em] text-accentSoft">Wire Source</div>
            <div className="mt-1 space-y-2">
              {pinInfo.outputPins.map((pin) => {
                const active = pendingWireSource?.nodeId === node.id && pendingWireSource?.pinId === pin.id;
                return (
                  <button
                    key={pin.id}
                    type="button"
                    onClick={() => onStartWireFromPin({ nodeId: node.id, pinId: pin.id })}
                    className={`w-full rounded border px-2 py-1 text-left text-xs uppercase tracking-[0.12em] transition ${
                      active
                        ? 'border-signalHot bg-[#40240e] text-signalHot'
                        : 'border-panelBorder bg-[#031a30] hover:border-accent'
                    }`}
                  >
                    Start wire from {pin.name}
                  </button>
                );
              })}
              {pendingWireSource ? (
                <button
                  type="button"
                  onClick={onCancelPendingWire}
                  className="w-full rounded border border-panelBorder bg-[#031a30] px-2 py-1 text-left text-xs uppercase tracking-[0.12em] hover:border-accent"
                >
                  Cancel wire mode
                </button>
              ) : null}
            </div>
          </div>
        ) : null}

        {pinInfo.inputPins.length ? (
          <div>
            <div className="text-xs uppercase tracking-[0.15em] text-accentSoft">Input Pins</div>
            <ul className="mt-1 space-y-1 text-xs text-slate-300">
              {pinInfo.inputPins.map((pin) => {
                const connected = circuit.wires.some(
                  (wire) => wire.to.nodeId === node.id && wire.to.pinId === pin.id,
                );
                const canConnect =
                  Boolean(pendingWireSource)
                  && pendingWireSource.nodeId !== node.id
                  && !connected;

                return (
                  <li key={pin.id} className="rounded border border-panelBorder/50 bg-[#031a30] p-2">
                    <div className="flex items-center justify-between gap-2">
                      <span>
                        {pin.name} ({pin.id}) {connected ? '[wired]' : '[open]'}
                      </span>
                      {canConnect ? (
                        <button
                          type="button"
                          onClick={() => onConnectPendingWireToPin(node.id, pin.id)}
                          className="rounded border border-panelBorder px-2 py-[2px] text-[10px] uppercase tracking-[0.12em] hover:border-accent"
                        >
                          Connect Here
                        </button>
                      ) : null}
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        ) : null}

        {node.nodeType === 'CHIP' ? (
          <div>
            <div className="text-xs uppercase tracking-[0.15em] text-accentSoft">Chip Pin Layout</div>
            <ul className="mt-1 space-y-1 text-xs text-slate-300">
              {Object.entries(chipPinLayout).map(([pinId, point]) => (
                <li key={pinId}>
                  {pinId}: ({Math.round(point.x)}, {Math.round(point.y)})
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        <div>
          <div className="text-xs uppercase tracking-[0.15em] text-accentSoft">Physical Mapping</div>
          {mappings.length === 0 ? (
            <p className="mt-1 text-slate-300">No direct mapping seeded for this node type yet.</p>
          ) : (
            <ul className="mt-1 space-y-2 text-slate-200">
              {mappings[0].options.map((option) => (
                <li key={option.optionId} className="rounded-md border border-panelBorder/70 bg-[#031a30] p-2">
                  <div className="font-medium">{option.title}</div>
                  <div className="text-xs text-slate-300">{option.description}</div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <button
          type="button"
          onClick={() => onDeleteNode(node.id)}
          className="w-full rounded border border-[#6e2e2e] bg-[#301111] px-3 py-2 text-xs uppercase tracking-[0.12em] text-[#ffb5b5] hover:border-[#8f3c3c]"
        >
          Delete Selected Node
        </button>
      </div>
    </aside>
  );
}
