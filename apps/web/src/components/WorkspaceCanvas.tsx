import { useEffect, useRef, useState } from 'react';
import { DEFAULT_NODE_LIBRARY } from '@vfcs/sim-core';
import type { CircuitDefinition, LogicValue, Position } from '@vfcs/circuit-model';

interface PendingWireSource {
  nodeId: string;
  pinId: string;
}

interface WorkspaceCanvasProps {
  circuit: CircuitDefinition;
  nodeOutputs: Record<string, Record<string, LogicValue>>;
  selectedNodeId: string | null;
  pendingWireSource: PendingWireSource | null;
  onSelectNode: (nodeId: string) => void;
  onMoveNode: (nodeId: string, position: Position) => void;
  onAttemptConnectToNode: (targetNodeId: string) => void;
}

interface DragState {
  nodeId: string;
  offsetX: number;
  offsetY: number;
}

const NODE_WIDTH = 144;
const NODE_HEIGHT = 88;

function nodeSignalClass(signal: LogicValue | undefined): string {
  if (signal === '1') {
    return 'signal-on';
  }
  return 'signal-off';
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function sourceAnchor(position: Position): Position {
  return {
    x: position.x + NODE_WIDTH,
    y: position.y + NODE_HEIGHT * 0.5,
  };
}

function targetAnchor(position: Position): Position {
  return {
    x: position.x,
    y: position.y + NODE_HEIGHT * 0.5,
  };
}

export function WorkspaceCanvas({
  circuit,
  nodeOutputs,
  selectedNodeId,
  pendingWireSource,
  onSelectNode,
  onMoveNode,
  onAttemptConnectToNode,
}: WorkspaceCanvasProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [dragState, setDragState] = useState<DragState | null>(null);

  useEffect(() => {
    if (!dragState) {
      return;
    }

    const handleMouseMove = (event: MouseEvent) => {
      const container = containerRef.current;
      if (!container) {
        return;
      }

      const rect = container.getBoundingClientRect();
      const nextX = clamp(event.clientX - rect.left - dragState.offsetX, 0, Math.max(0, rect.width - NODE_WIDTH));
      const nextY = clamp(event.clientY - rect.top - dragState.offsetY, 0, Math.max(0, rect.height - NODE_HEIGHT));

      onMoveNode(dragState.nodeId, {
        x: Math.round(nextX),
        y: Math.round(nextY),
      });
    };

    const handleMouseUp = () => {
      setDragState(null);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [dragState, onMoveNode]);

  const nodeById = new Map(circuit.nodes.map((node) => [node.id, node]));

  return (
    <section className="grid-canvas relative rounded-xl border border-panelBorder bg-[#020f1e] p-4 shadow-panelGlow">
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-[0.2em] text-accent">Workspace</h2>
      <p className="mb-4 text-xs text-slate-300">
        Drag nodes to reposition. Select a source pin in the inspector, then click a target node to create a wire.
      </p>

      <div ref={containerRef} className="relative min-h-[420px] overflow-hidden rounded-lg border border-panelBorder/60">
        <svg className="pointer-events-none absolute inset-0 h-full w-full">
          {circuit.wires.map((wire) => {
            const sourceNode = nodeById.get(wire.from.nodeId);
            const targetNode = nodeById.get(wire.to.nodeId);
            if (!sourceNode || !targetNode) {
              return null;
            }

            const from = sourceAnchor(sourceNode.position);
            const to = targetAnchor(targetNode.position);
            const cx = (from.x + to.x) * 0.5;

            return (
              <path
                key={wire.id}
                d={`M ${from.x} ${from.y} C ${cx} ${from.y}, ${cx} ${to.y}, ${to.x} ${to.y}`}
                stroke="rgba(59, 213, 255, 0.75)"
                strokeWidth="2"
                fill="none"
              />
            );
          })}
        </svg>

        {circuit.nodes.map((node) => {
          const outputPins = nodeOutputs[node.id] ?? {};
          const firstSignal = Object.values(outputPins)[0] ?? 'X';
          const selected = selectedNodeId === node.id;
          const isTargetable =
            Boolean(pendingWireSource) &&
            pendingWireSource?.nodeId !== node.id &&
            (DEFAULT_NODE_LIBRARY[node.nodeType]?.inputPins.length ?? 0) > 0;

          return (
            <button
              key={node.id}
              type="button"
              onMouseDown={(event) => {
                if (event.button !== 0) {
                  return;
                }
                const rect = event.currentTarget.getBoundingClientRect();
                setDragState({
                  nodeId: node.id,
                  offsetX: event.clientX - rect.left,
                  offsetY: event.clientY - rect.top,
                });
              }}
              onClick={() => {
                onSelectNode(node.id);
                if (isTargetable) {
                  onAttemptConnectToNode(node.id);
                }
              }}
              className={`${nodeSignalClass(firstSignal)} absolute w-36 rounded-lg border bg-[#031a30]/90 p-3 text-left transition hover:border-accent ${
                selected ? 'ring-2 ring-accent' : ''
              } ${isTargetable ? 'border-dashed border-signalHot' : ''}`}
              style={{ left: node.position.x, top: node.position.y, height: `${NODE_HEIGHT}px` }}
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