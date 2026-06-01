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
  selectedWireId: string | null;
  nodeOutputs: Record<string, Record<string, LogicValue>>;
  pendingWireSource: PendingWireSource | null;
  chipLibrary: ChipDefinition[];
  onStartWireFromPin: (source: PendingWireSource) => void;
  onCancelPendingWire: () => void;
  onConnectPendingWireToPin: (targetNodeId: string, targetPinId: string) => void;
  onDeleteWire: (wireId: string) => void;
  onUpdateWireSourcePin: (wireId: string, sourcePinId: string) => void;
  onUpdateWireTargetPin: (wireId: string, targetPinId: string) => void;
  onDeleteNode: (nodeId: string) => void;
  onToggleInputNode: (nodeId: string) => void;
  onUpdateNodeLabel: (nodeId: string, label: string) => void;
  onUpdateClockFrequency: (nodeId: string, frequencyHz: number) => void;
  onUpdateChipInstanceSize: (nodeId: string, width: number, height: number) => void;
  onLoadChipIntoDesigner: (chipId: string) => void;
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
  selectedWireId,
  nodeOutputs,
  pendingWireSource,
  chipLibrary,
  onStartWireFromPin,
  onCancelPendingWire,
  onConnectPendingWireToPin,
  onDeleteWire,
  onUpdateWireSourcePin,
  onUpdateWireTargetPin,
  onDeleteNode,
  onToggleInputNode,
  onUpdateNodeLabel,
  onUpdateClockFrequency,
  onUpdateChipInstanceSize,
  onLoadChipIntoDesigner,
  clockTick,
  clockRunning,
  clockInfo,
}: InspectorPanelProps) {
  const node = circuit.nodes.find((entry) => entry.id === selectedNodeId) ?? null;
  const selectedWire = selectedWireId ? circuit.wires.find((entry) => entry.id === selectedWireId) ?? null : null;
  const wireSourceNode = selectedWire ? circuit.nodes.find((entry) => entry.id === selectedWire.from.nodeId) ?? null : null;
  const wireTargetNode = selectedWire ? circuit.nodes.find((entry) => entry.id === selectedWire.to.nodeId) ?? null : null;
  const wireSourcePins = wireSourceNode ? resolveNodePins(wireSourceNode, chipLibrary).outputPins : [];
  const wireTargetPins = wireTargetNode ? resolveNodePins(wireTargetNode, chipLibrary).inputPins : [];

  if (!node && !selectedWire) {
    return (
      <aside className="rounded-xl border border-panelBorder bg-panel/80 p-4 shadow-panelGlow backdrop-blur-sm">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-[0.2em] text-accent">Inspector</h2>
        <p className="text-sm text-slate-300">
          Select a node or wire in the workspace to inspect state and edit its configuration.
        </p>
      </aside>
    );
  }

  const outputs = node ? nodeOutputs[node.id] ?? {} : {};
  const mappings = node ? getMappingsForLogicalType(node.nodeType) : [];
  const pinInfo = node ? resolveNodePins(node, chipLibrary) : { inputPins: [], outputPins: [] };
  const chipPinLayout = node ? resolveChipPinLayout(node, chipLibrary) : {};
  const selectedClockInfo = node ? clockInfo.find((entry) => entry.nodeId === node.id) : undefined;

  const currentClockHzRaw = Number(node?.parameters?.frequencyHz ?? 1);
  const currentClockHz = Number.isFinite(currentClockHzRaw)
    ? Math.min(MAX_CLOCK_HZ, Math.max(MIN_CLOCK_HZ, currentClockHzRaw))
    : 1;

  const chipWidthRaw = Number(node?.parameters?.width ?? 176);
  const chipHeightRaw = Number(node?.parameters?.height ?? 104);
  const chipWidth = Number.isFinite(chipWidthRaw) ? chipWidthRaw : 176;
  const chipHeight = Number.isFinite(chipHeightRaw) ? chipHeightRaw : 104;

  return (
    <aside className="rounded-xl border border-panelBorder bg-panel/80 p-4 shadow-panelGlow backdrop-blur-sm">
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-[0.2em] text-accent">Inspector</h2>
      <div className="space-y-4 text-sm">
        {selectedWire ? (
          <div className="rounded border border-panelBorder/70 bg-[#031a30] p-3">
            <div className="text-xs uppercase tracking-[0.15em] text-accentSoft">Selected Wire</div>
            <div className="mt-1 text-xs text-slate-300">ID: {selectedWire.id}</div>
            <div className="text-xs text-slate-300">
              {selectedWire.from.nodeId}.{selectedWire.from.pinId} {'->'} {selectedWire.to.nodeId}.{selectedWire.to.pinId}
            </div>

            {wireSourceNode ? (
              <label className="mt-2 block text-[10px] uppercase tracking-[0.12em] text-slate-300">
                Source Pin
                <select
                  value={selectedWire.from.pinId}
                  onChange={(event) => onUpdateWireSourcePin(selectedWire.id, event.target.value)}
                  className="mt-1 w-full rounded border border-panelBorder bg-[#020f1e] px-2 py-1 text-xs text-slate-100"
                >
                  {wireSourcePins.map((pin) => (
                    <option key={pin.id} value={pin.id}>
                      {wireSourceNode.id}.{pin.id}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}

            {wireTargetNode ? (
              <label className="mt-2 block text-[10px] uppercase tracking-[0.12em] text-slate-300">
                Target Pin
                <select
                  value={selectedWire.to.pinId}
                  onChange={(event) => onUpdateWireTargetPin(selectedWire.id, event.target.value)}
                  className="mt-1 w-full rounded border border-panelBorder bg-[#020f1e] px-2 py-1 text-xs text-slate-100"
                >
                  {wireTargetPins.map((pin) => (
                    <option key={pin.id} value={pin.id}>
                      {wireTargetNode.id}.{pin.id}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}

            <button
              type="button"
              onClick={() => onDeleteWire(selectedWire.id)}
              className="mt-2 w-full rounded border border-[#6e2e2e] bg-[#301111] px-2 py-1 text-[10px] uppercase tracking-[0.12em] text-[#ffb5b5] hover:border-[#8f3c3c]"
            >
              Delete Wire
            </button>
          </div>
        ) : null}

        {node ? (
          <>
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
              <div className="space-y-2">
                <div className="text-xs uppercase tracking-[0.15em] text-accentSoft">Chip Instance</div>
                <div className="grid grid-cols-2 gap-2">
                  <label className="text-[10px] uppercase tracking-[0.12em] text-slate-300">
                    Width
                    <input
                      type="number"
                      min={120}
                      max={480}
                      value={Math.round(chipWidth)}
                      onChange={(event) => {
                        const nextWidth = Number(event.target.value);
                        if (!Number.isFinite(nextWidth)) {
                          return;
                        }
                        onUpdateChipInstanceSize(node.id, nextWidth, chipHeight);
                      }}
                      className="mt-1 w-full rounded border border-panelBorder bg-[#031a30] px-2 py-1 text-xs text-slate-100"
                    />
                  </label>
                  <label className="text-[10px] uppercase tracking-[0.12em] text-slate-300">
                    Height
                    <input
                      type="number"
                      min={84}
                      max={280}
                      value={Math.round(chipHeight)}
                      onChange={(event) => {
                        const nextHeight = Number(event.target.value);
                        if (!Number.isFinite(nextHeight)) {
                          return;
                        }
                        onUpdateChipInstanceSize(node.id, chipWidth, nextHeight);
                      }}
                      className="mt-1 w-full rounded border border-panelBorder bg-[#031a30] px-2 py-1 text-xs text-slate-100"
                    />
                  </label>
                </div>
                {node.chipRefId ? (
                  <button
                    type="button"
                    onClick={() => onLoadChipIntoDesigner(node.chipRefId ?? '')}
                    className="w-full rounded border border-panelBorder bg-[#031a30] px-2 py-1 text-left text-xs uppercase tracking-[0.12em] hover:border-accent"
                  >
                    Edit Chip Definition ({node.chipRefId})
                  </button>
                ) : null}
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
          </>
        ) : null}
      </div>
    </aside>
  );
}
