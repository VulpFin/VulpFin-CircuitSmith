import { useEffect, useRef, useState, type CSSProperties } from 'react';
import type { ChipDefinition, CircuitDefinition, LogicValue, Position } from '@vfcs/circuit-model';
import {
  nodeSymbol,
  resolveChipAppearance,
  resolveChipPinLayout,
  resolveNodePins,
} from '../lib/nodePins.js';

interface PendingWireSource {
  nodeId: string;
  pinId: string;
}

interface WorkspaceCanvasProps {
  circuit: CircuitDefinition;
  workspaceSize: {
    width: number;
    height: number;
  };
  nodeOutputs: Record<string, Record<string, LogicValue>>;
  nodeStates: Record<string, Record<string, unknown>>;
  selectedNodeId: string | null;
  pendingWireSource: PendingWireSource | null;
  chipLibrary: ChipDefinition[];
  onSelectNode: (nodeId: string) => void;
  onMoveNode: (nodeId: string, position: Position) => void;
  onAttemptConnectToNode: (targetNodeId: string) => void;
  onToggleInputNode: (nodeId: string) => void;
}

interface DragState {
  nodeId: string;
  offsetX: number;
  offsetY: number;
  startX: number;
  startY: number;
}

const NODE_WIDTH = 164;
const NODE_HEIGHT = 100;

function nodeSignalClass(signal: LogicValue | undefined): string {
  if (signal === '1') {
    return 'signal-on';
  }
  if (signal === '0') {
    return 'signal-off';
  }
  if (signal === 'ERR') {
    return 'signal-err';
  }
  return 'signal-unknown';
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

function outputSignalForNode(
  nodeId: string,
  outputPinIds: string[],
  nodeType: string,
  nodeOutputs: Record<string, Record<string, LogicValue>>,
  nodeStates: Record<string, Record<string, unknown>>,
): LogicValue {
  if (nodeType === 'OUTPUT' || nodeType === 'LED') {
    const stateValue = nodeStates[nodeId]?.value as LogicValue | undefined;
    return stateValue ?? 'X';
  }

  for (const pinId of outputPinIds) {
    const value = nodeOutputs[nodeId]?.[pinId];
    if (value) {
      return value;
    }
  }

  return 'X';
}

export function WorkspaceCanvas({
  circuit,
  workspaceSize,
  nodeOutputs,
  nodeStates,
  selectedNodeId,
  pendingWireSource,
  chipLibrary,
  onSelectNode,
  onMoveNode,
  onAttemptConnectToNode,
  onToggleInputNode,
}: WorkspaceCanvasProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [dragState, setDragState] = useState<DragState | null>(null);
  const [hasDragged, setHasDragged] = useState(false);

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
      const distance =
        Math.abs(event.clientX - dragState.startX) + Math.abs(event.clientY - dragState.startY);
      if (distance > 4) {
        setHasDragged(true);
      }

      onMoveNode(dragState.nodeId, {
        x: Math.round(nextX),
        y: Math.round(nextY),
      });
    };

    const handleMouseUp = () => {
      setDragState(null);
      window.setTimeout(() => setHasDragged(false), 0);
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
        Drag nodes to reposition. Double-click INPUT nodes to toggle. Use inspector pin controls to start wiring.
      </p>

      <div className="overflow-auto">
        <div
          ref={containerRef}
          className="relative overflow-hidden rounded-lg border border-panelBorder/60"
          style={{
            width: `${workspaceSize.width}px`,
            minHeight: `${workspaceSize.height}px`,
            height: `${workspaceSize.height}px`,
          }}
        >
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
          const pinInfo = resolveNodePins(node, chipLibrary);
          const firstSignal = outputSignalForNode(
            node.id,
            pinInfo.outputPins.map((pin) => pin.id),
            node.nodeType,
            nodeOutputs,
            nodeStates,
          );

          const selected = selectedNodeId === node.id;
          const isTargetable =
            Boolean(pendingWireSource) &&
            pendingWireSource?.nodeId !== node.id &&
            pinInfo.inputPins.length > 0;

          const symbol = nodeSymbol(node, chipLibrary);
          const chipAppearance = resolveChipAppearance(node, chipLibrary);
          const chipPinLayout = resolveChipPinLayout(node, chipLibrary);

          const customStyle: CSSProperties = chipAppearance
            ? {
                backgroundColor: chipAppearance.bodyColor,
                color: chipAppearance.textColor,
                borderColor: chipAppearance.accentColor,
                borderRadius: chipAppearance.shape === 'rounded' ? '1rem' : '0.5rem',
                clipPath:
                  chipAppearance.shape === 'seven-segment'
                    ? 'polygon(8% 0%, 92% 0%, 100% 12%, 100% 88%, 92% 100%, 8% 100%, 0% 88%, 0% 12%)'
                    : undefined,
              }
            : {};

          return (
            <button
              key={node.id}
              type="button"
              onMouseDown={(event) => {
                if (event.button !== 0) {
                  return;
                }
                const rect = event.currentTarget.getBoundingClientRect();
                setHasDragged(false);
                setDragState({
                  nodeId: node.id,
                  offsetX: event.clientX - rect.left,
                  offsetY: event.clientY - rect.top,
                  startX: event.clientX,
                  startY: event.clientY,
                });
              }}
              onDoubleClick={() => {
                if (node.nodeType === 'INPUT') {
                  onToggleInputNode(node.id);
                }
              }}
              onClick={() => {
                if (hasDragged) {
                  return;
                }
                onSelectNode(node.id);
                if (isTargetable) {
                  onAttemptConnectToNode(node.id);
                }
              }}
              className={`${nodeSignalClass(firstSignal)} absolute w-[164px] border p-3 text-left transition hover:border-accent ${
                selected ? 'ring-2 ring-accent' : ''
              } ${isTargetable ? 'border-dashed border-signalHot' : ''}`}
              style={{ left: node.position.x, top: node.position.y, height: `${NODE_HEIGHT}px`, ...customStyle }}
              title={node.nodeType === 'INPUT' ? 'Double-click to toggle value' : undefined}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="text-[11px] uppercase tracking-[0.15em] text-accentSoft">{node.nodeType}</div>
                <span className="rounded border border-panelBorder/80 px-1 py-[1px] text-[10px] uppercase tracking-[0.15em] text-accentSoft">
                  {symbol}
                </span>
              </div>
              <div className="font-semibold text-slate-100" style={{ color: chipAppearance?.textColor ?? undefined }}>
                {node.label ?? node.id}
              </div>

              {node.nodeType === 'LED' ? (
                <div className="mt-2 flex items-center gap-2 text-xs text-slate-300">
                  <span className={`led-indicator ${firstSignal === '1' ? 'led-on' : 'led-off'}`} />
                  LED: {firstSignal}
                </div>
              ) : null}

              {node.nodeType === 'OUTPUT' ? (
                <div className="mt-2 text-xs text-slate-300">OUT: {firstSignal}</div>
              ) : null}

              {node.nodeType === 'CLOCK' ? (
                <div className="mt-2 space-y-1 text-xs text-slate-300">
                  <div>Freq: {Number(node.parameters?.frequencyHz ?? 1).toLocaleString()} Hz</div>
                  <div className="flex items-center gap-2">
                    <span className={`led-indicator ${firstSignal === '1' ? 'led-on' : 'led-off'}`} />
                    CLK: {firstSignal}
                  </div>
                </div>
              ) : null}

              {node.nodeType !== 'OUTPUT' && node.nodeType !== 'LED' && node.nodeType !== 'CLOCK' ? (
                <div className="mt-1 text-xs text-slate-300">Signal: {firstSignal}</div>
              ) : null}

              {node.nodeType === 'CHIP' && selected ? (
                <div className="pointer-events-none absolute inset-0">
                  {Object.entries(chipPinLayout).map(([pinId, point]) => (
                    <div
                      key={`${node.id}-${pinId}`}
                      className="absolute -translate-x-1/2 -translate-y-1/2 rounded-full border border-black/60 bg-[#7bd0ff] px-[3px] py-[1px] text-[8px] leading-none text-black"
                      style={{
                        left: `${point.x}%`,
                        top: `${point.y}%`,
                      }}
                      title={pinId}
                    >
                      {pinId.slice(0, 3)}
                    </div>
                  ))}
                </div>
              ) : null}
            </button>
          );
        })}
        </div>
      </div>
    </section>
  );
}
