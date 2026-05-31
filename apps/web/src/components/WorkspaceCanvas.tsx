import type { CircuitDefinition, LogicValue } from '@vfcs/circuit-model';

interface WorkspaceCanvasProps {
  circuit: CircuitDefinition;
  nodeOutputs: Record<string, Record<string, LogicValue>>;
  selectedNodeId: string | null;
  onSelectNode: (nodeId: string) => void;
}

function nodeSignalClass(signal: LogicValue | undefined): string {
  if (signal === '1') {
    return 'signal-on';
  }
  return 'signal-off';
}

export function WorkspaceCanvas({
  circuit,
  nodeOutputs,
  selectedNodeId,
  onSelectNode,
}: WorkspaceCanvasProps) {
  return (
    <section className="grid-canvas relative rounded-xl border border-panelBorder bg-[#020f1e] p-4 shadow-panelGlow">
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-[0.2em] text-accent">Workspace</h2>
      <p className="mb-4 text-xs text-slate-300">
        Editor shell is ready for gate, chip, and wire tooling. React Flow or custom SVG/canvas renderer can plug in here.
      </p>

      <div className="relative min-h-[320px]">
        {circuit.nodes.map((node) => {
          const outputPins = nodeOutputs[node.id] ?? {};
          const firstSignal = Object.values(outputPins)[0] ?? 'X';
          const selected = selectedNodeId === node.id;

          return (
            <button
              key={node.id}
              type="button"
              onClick={() => onSelectNode(node.id)}
              className={`${nodeSignalClass(firstSignal)} absolute w-36 rounded-lg border bg-[#031a30]/90 p-3 text-left transition hover:border-accent ${
                selected ? 'ring-2 ring-accent' : ''
              }`}
              style={{ left: node.position.x, top: node.position.y }}
            >
              <div className="text-[11px] uppercase tracking-[0.15em] text-accentSoft">{node.nodeType}</div>
              <div className="font-semibold text-slate-100">{node.label ?? node.id}</div>
              <div className="mt-1 text-xs text-slate-300">Signal: {firstSignal}</div>
            </button>
          );
        })}
      </div>
    </section>
  );
}