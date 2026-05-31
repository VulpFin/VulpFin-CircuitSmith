import type { CircuitDefinition, LogicValue } from '@vfcs/circuit-model';
import { getMappingsForLogicalType } from '@vfcs/part-mapper';
import { DEFAULT_NODE_LIBRARY } from '@vfcs/sim-core';

interface PendingWireSource {
  nodeId: string;
  pinId: string;
}

interface InspectorPanelProps {
  circuit: CircuitDefinition;
  selectedNodeId: string | null;
  nodeOutputs: Record<string, Record<string, LogicValue>>;
  pendingWireSource: PendingWireSource | null;
  onStartWireFromPin: (source: PendingWireSource) => void;
  onCancelPendingWire: () => void;
  onDeleteNode: (nodeId: string) => void;
}

export function InspectorPanel({
  circuit,
  selectedNodeId,
  nodeOutputs,
  pendingWireSource,
  onStartWireFromPin,
  onCancelPendingWire,
  onDeleteNode,
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
  const definition = DEFAULT_NODE_LIBRARY[node.nodeType];

  return (
    <aside className="rounded-xl border border-panelBorder bg-panel/80 p-4 shadow-panelGlow backdrop-blur-sm">
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-[0.2em] text-accent">Inspector</h2>
      <div className="space-y-4 text-sm">
        <div>
          <div className="text-xs uppercase tracking-[0.15em] text-accentSoft">Node</div>
          <div className="font-semibold">{node.label ?? node.id}</div>
          <div className="text-slate-300">ID: {node.id}</div>
          <div className="text-slate-300">Type: {node.nodeType}</div>
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

        {definition?.outputPins.length ? (
          <div>
            <div className="text-xs uppercase tracking-[0.15em] text-accentSoft">Wire Source</div>
            <div className="mt-1 space-y-2">
              {definition.outputPins.map((pin) => {
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