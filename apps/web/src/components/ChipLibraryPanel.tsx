import { useEffect, useMemo, useRef, useState } from 'react';
import type { ChipDefinition, PinDirection } from '@vfcs/circuit-model';
import { sanitizePinPercent } from '../lib/chipDesigner.js';

export interface ChipPinSourceOption {
  id: string;
  label: string;
  nodeType: string;
  direction: PinDirection;
}

export interface ChipPinDraft {
  draftId: string;
  enabled: boolean;
  id: string;
  name: string;
  direction: PinDirection;
  sourceNodeId?: string;
  pinX?: number;
  pinY?: number;
}

export interface ChipAppearanceDraft {
  shape: 'rect' | 'rounded' | 'seven-segment';
  bodyColor: string;
  accentColor: string;
  textColor: string;
  symbol: string;
}

interface ChipLibraryPanelProps {
  chipIdDraft: string;
  chipNameDraft: string;
  editingChipId: string | null;
  chipLibrary: ChipDefinition[];
  chipPinDrafts: ChipPinDraft[];
  chipPinSourceOptions: ChipPinSourceOption[];
  chipAppearanceDraft: ChipAppearanceDraft;
  onChipIdDraftChange: (value: string) => void;
  onChipNameDraftChange: (value: string) => void;
  onChipPinDraftChange: (draftId: string, patch: Partial<ChipPinDraft>) => void;
  onAddChipPinDraft: () => void;
  onRemoveChipPinDraft: (draftId: string) => void;
  onChipAppearanceDraftChange: (patch: Partial<ChipAppearanceDraft>) => void;
  onStartNewChip: () => void;
  onCreateChip: () => void;
  onClearLibrary: () => void;
  onAddChipToWorkspace: (chipId: string) => void;
  onEditChip: (chipId: string) => void;
  onExportChipJson: (chipId: string) => void;
  onImportChipJson: (payload: string) => void;
  onResetDesigner: () => void;
}

interface PinDragState {
  draftId: string;
}

function clampPercent(value: number): number {
  return sanitizePinPercent(value);
}

function draftPoint(draft: ChipPinDraft): { x: number; y: number } {
  return {
    x: clampPercent(draft.pinX ?? 50),
    y: clampPercent(draft.pinY ?? 50),
  };
}

function isSourceCompatible(source: ChipPinSourceOption | undefined, direction: PinDirection): boolean {
  if (!source) {
    return false;
  }

  if (direction === 'bidirectional' || direction === 'output') {
    return true;
  }

  return source.direction === 'input' || source.direction === 'bidirectional';
}

function formatSourceOption(source: ChipPinSourceOption): string {
  return `${source.label} (${source.id}, ${source.nodeType})`;
}

export function ChipLibraryPanel({
  chipIdDraft,
  chipNameDraft,
  editingChipId,
  chipLibrary,
  chipPinDrafts,
  chipPinSourceOptions,
  chipAppearanceDraft,
  onChipIdDraftChange,
  onChipNameDraftChange,
  onChipPinDraftChange,
  onAddChipPinDraft,
  onRemoveChipPinDraft,
  onChipAppearanceDraftChange,
  onStartNewChip,
  onCreateChip,
  onClearLibrary,
  onAddChipToWorkspace,
  onEditChip,
  onExportChipJson,
  onImportChipJson,
  onResetDesigner,
}: ChipLibraryPanelProps) {
  const previewRef = useRef<HTMLDivElement | null>(null);
  const [dragState, setDragState] = useState<PinDragState | null>(null);
  const [importDraft, setImportDraft] = useState('');

  useEffect(() => {
    if (!dragState) {
      return;
    }

    const handleMouseMove = (event: MouseEvent) => {
      const preview = previewRef.current;
      if (!preview) {
        return;
      }

      const rect = preview.getBoundingClientRect();
      const x = ((event.clientX - rect.left) / Math.max(rect.width, 1)) * 100;
      const y = ((event.clientY - rect.top) / Math.max(rect.height, 1)) * 100;

      onChipPinDraftChange(dragState.draftId, {
        pinX: clampPercent(x),
        pinY: clampPercent(y),
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
  }, [dragState, onChipPinDraftChange]);

  const enabledDrafts = chipPinDrafts.filter((draft) => draft.enabled);
  const sourceById = useMemo(
    () => new Map(chipPinSourceOptions.map((source) => [source.id, source])),
    [chipPinSourceOptions],
  );

  return (
    <section className="rounded-xl border border-panelBorder bg-panel/80 p-4 shadow-panelGlow backdrop-blur-sm">
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-[0.2em] text-accent">Custom Chip Designer</h2>
      <p className="mb-3 text-xs text-slate-300">
        Design custom chips (like 7-segment modules), choose public pins, place them on the chip face, then save and place them from the palette.
      </p>
      {editingChipId ? (
        <p className="mb-3 rounded border border-panelBorder/70 bg-[#031a30] px-2 py-1 text-xs text-signalHot">
          Editing existing chip: {editingChipId}
        </p>
      ) : null}

      <div className="grid gap-2 md:grid-cols-2">
        <label className="text-xs uppercase tracking-[0.12em] text-accentSoft">
          Chip ID
          <input
            value={chipIdDraft}
            onChange={(event) => onChipIdDraftChange(event.target.value)}
            placeholder="chip_my_design"
            className="mt-1 w-full rounded border border-panelBorder bg-[#031a30] px-2 py-1 text-sm text-slate-100 outline-none focus:border-accent"
          />
        </label>

        <label className="text-xs uppercase tracking-[0.12em] text-accentSoft">
          Chip Name
          <input
            value={chipNameDraft}
            onChange={(event) => onChipNameDraftChange(event.target.value)}
            placeholder="My Custom Chip"
            className="mt-1 w-full rounded border border-panelBorder bg-[#031a30] px-2 py-1 text-sm text-slate-100 outline-none focus:border-accent"
          />
        </label>
      </div>

      <div className="mt-3 grid gap-3 lg:grid-cols-[minmax(0,1fr)_300px]">
        <div className="rounded-lg border border-panelBorder/70 bg-[#020f1e] p-3">
          <div className="mb-2 flex items-center justify-between">
            <div className="text-xs uppercase tracking-[0.15em] text-accentSoft">Public Pins</div>
            <button
              type="button"
              onClick={onAddChipPinDraft}
              className="rounded border border-panelBorder bg-[#031a30] px-2 py-1 text-[10px] uppercase tracking-[0.12em] hover:border-accent"
            >
              Add Pin
            </button>
          </div>
          <div className="space-y-2">
            {chipPinDrafts.length === 0 ? (
              <p className="rounded border border-panelBorder/60 bg-[#031a30] px-3 py-2 text-xs text-slate-300">
                No public pins yet. Add pins manually, or use Reset Designer to pull available inputs/outputs from the workspace.
              </p>
            ) : null}
            {chipPinDrafts.map((draft) => {
              const selectedSource = draft.sourceNodeId ? sourceById.get(draft.sourceNodeId) : undefined;
              const compatibleSources = chipPinSourceOptions.filter((source) =>
                isSourceCompatible(source, draft.direction),
              );
              const hasInvalidSource = Boolean(draft.sourceNodeId && !selectedSource);
              const hasIncompatibleSource = Boolean(selectedSource && !isSourceCompatible(selectedSource, draft.direction));

              return (
                <div key={draft.draftId} className="rounded border border-panelBorder/60 p-2">
                  <div className="grid gap-2 sm:grid-cols-[auto_1fr_1fr_auto_auto] sm:items-center">
                    <input
                      type="checkbox"
                      checked={draft.enabled}
                      onChange={(event) => onChipPinDraftChange(draft.draftId, { enabled: event.target.checked })}
                      className="justify-self-start"
                    />
                    <input
                      value={draft.id}
                      onChange={(event) => onChipPinDraftChange(draft.draftId, { id: event.target.value })}
                      className="rounded border border-panelBorder bg-[#031a30] px-2 py-1 text-xs text-slate-100 outline-none focus:border-accent"
                      placeholder="PIN_ID"
                    />
                    <input
                      value={draft.name}
                      onChange={(event) => onChipPinDraftChange(draft.draftId, { name: event.target.value })}
                      className="rounded border border-panelBorder bg-[#031a30] px-2 py-1 text-xs text-slate-100 outline-none focus:border-accent"
                      placeholder="Pin name"
                    />
                    <select
                      value={draft.direction}
                      onChange={(event) => {
                        const direction = event.target.value as PinDirection;
                        const source = draft.sourceNodeId ? sourceById.get(draft.sourceNodeId) : undefined;
                        onChipPinDraftChange(draft.draftId, {
                          direction,
                          sourceNodeId: isSourceCompatible(source, direction) ? draft.sourceNodeId : undefined,
                        });
                      }}
                      className="rounded border border-panelBorder bg-[#031a30] px-2 py-1 text-xs text-slate-100 outline-none focus:border-accent"
                    >
                      <option value="input">IN</option>
                      <option value="output">OUT</option>
                      <option value="bidirectional">BIDI</option>
                    </select>
                    <button
                      type="button"
                      onClick={() => onRemoveChipPinDraft(draft.draftId)}
                      className="rounded border border-[#6e2e2e] bg-[#301111] px-2 py-1 text-[10px] uppercase tracking-[0.1em] text-[#ffb5b5] sm:justify-self-end"
                    >
                      X
                    </button>
                  </div>

                  <div className="mt-2 grid gap-2 sm:grid-cols-[1fr_auto] sm:items-center">
                    <label className="text-[10px] uppercase tracking-[0.12em] text-slate-400">
                      Bind public pin to internal node
                      <select
                        value={draft.sourceNodeId ?? ''}
                        onChange={(event) =>
                          onChipPinDraftChange(draft.draftId, {
                            sourceNodeId: event.target.value || undefined,
                          })
                        }
                        className="mt-1 w-full rounded border border-panelBorder bg-[#031a30] px-2 py-1 text-xs normal-case tracking-normal text-slate-100 outline-none focus:border-accent"
                      >
                        <option value="">Unbound / manual only</option>
                        {hasInvalidSource ? (
                          <option value={draft.sourceNodeId}>{draft.sourceNodeId} (missing)</option>
                        ) : null}
                        {hasIncompatibleSource && selectedSource ? (
                          <option value={selectedSource.id}>{formatSourceOption(selectedSource)} - wrong direction</option>
                        ) : null}
                        {compatibleSources.map((source) => (
                          <option key={source.id} value={source.id}>
                            {formatSourceOption(source)}
                          </option>
                        ))}
                      </select>
                    </label>
                    <span
                      className={`rounded border px-2 py-1 text-[10px] uppercase tracking-[0.12em] ${
                        hasInvalidSource || hasIncompatibleSource
                          ? 'border-[#7a4a20] bg-[#2d1b0d] text-[#ffd28a]'
                          : draft.sourceNodeId
                            ? 'border-panelBorder bg-[#031a30] text-accentSoft'
                            : 'border-panelBorder/60 bg-[#020f1e] text-slate-400'
                      }`}
                    >
                      {hasInvalidSource
                        ? 'Missing binding'
                        : hasIncompatibleSource
                          ? 'Wrong direction'
                          : draft.sourceNodeId
                            ? 'Bound'
                            : 'Unbound'}
                    </span>
                  </div>

                  <div className="mt-2 flex flex-wrap items-center justify-between gap-1 text-[10px] uppercase tracking-[0.12em] text-slate-400">
                    <span>{selectedSource ? `Source: ${formatSourceOption(selectedSource)}` : 'No internal source selected'}</span>
                    <span>
                      Pos: {Math.round(clampPercent(draft.pinX ?? 50))}, {Math.round(clampPercent(draft.pinY ?? 50))}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="rounded-lg border border-panelBorder/70 bg-[#020f1e] p-3">
          <div className="mb-2 text-xs uppercase tracking-[0.15em] text-accentSoft">Visual Style</div>
          <div className="space-y-2">
            <label className="block text-[10px] uppercase tracking-[0.12em] text-slate-300">
              Shape
              <select
                value={chipAppearanceDraft.shape}
                onChange={(event) =>
                  onChipAppearanceDraftChange({
                    shape: event.target.value as ChipAppearanceDraft['shape'],
                  })
                }
                className="mt-1 w-full rounded border border-panelBorder bg-[#031a30] px-2 py-1 text-xs text-slate-100"
              >
                <option value="rect">Rectangle</option>
                <option value="rounded">Rounded</option>
                <option value="seven-segment">Seven Segment</option>
              </select>
            </label>

            <label className="block text-[10px] uppercase tracking-[0.12em] text-slate-300">
              Symbol
              <input
                value={chipAppearanceDraft.symbol}
                onChange={(event) => onChipAppearanceDraftChange({ symbol: event.target.value })}
                className="mt-1 w-full rounded border border-panelBorder bg-[#031a30] px-2 py-1 text-xs text-slate-100"
                maxLength={6}
              />
            </label>

            <div className="grid grid-cols-3 gap-2">
              <label className="text-[10px] uppercase tracking-[0.12em] text-slate-300">
                Body
                <input
                  type="color"
                  value={chipAppearanceDraft.bodyColor}
                  onChange={(event) => onChipAppearanceDraftChange({ bodyColor: event.target.value })}
                  className="mt-1 h-8 w-full rounded border border-panelBorder bg-[#031a30]"
                />
              </label>
              <label className="text-[10px] uppercase tracking-[0.12em] text-slate-300">
                Accent
                <input
                  type="color"
                  value={chipAppearanceDraft.accentColor}
                  onChange={(event) => onChipAppearanceDraftChange({ accentColor: event.target.value })}
                  className="mt-1 h-8 w-full rounded border border-panelBorder bg-[#031a30]"
                />
              </label>
              <label className="text-[10px] uppercase tracking-[0.12em] text-slate-300">
                Text
                <input
                  type="color"
                  value={chipAppearanceDraft.textColor}
                  onChange={(event) => onChipAppearanceDraftChange({ textColor: event.target.value })}
                  className="mt-1 h-8 w-full rounded border border-panelBorder bg-[#031a30]"
                />
              </label>
            </div>

            <div>
              <div className="mb-1 text-[10px] uppercase tracking-[0.12em] text-slate-300">Pin Placement (drag pins)</div>
              <div ref={previewRef} className="relative h-44 overflow-hidden rounded border border-panelBorder/70 bg-[#061322]">
                <div
                  className="absolute inset-[10px] border"
                  style={{
                    backgroundColor: chipAppearanceDraft.bodyColor,
                    borderColor: chipAppearanceDraft.accentColor,
                    color: chipAppearanceDraft.textColor,
                    borderRadius: chipAppearanceDraft.shape === 'rounded' ? '1rem' : '0.5rem',
                    clipPath:
                      chipAppearanceDraft.shape === 'seven-segment'
                        ? 'polygon(8% 0%, 92% 0%, 100% 12%, 100% 88%, 92% 100%, 8% 100%, 0% 88%, 0% 12%)'
                        : undefined,
                  }}
                >
                  <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-xs uppercase tracking-[0.18em]">
                    {chipAppearanceDraft.symbol || 'CHIP'}
                  </div>
                </div>

                {enabledDrafts.map((draft) => {
                  const point = draftPoint(draft);
                  const markerColor =
                    draft.direction === 'input'
                      ? '#4da3ff'
                      : draft.direction === 'output'
                        ? '#ff9f43'
                        : '#8bdd91';

                  return (
                    <button
                      key={draft.draftId}
                      type="button"
                      onMouseDown={(event) => {
                        event.preventDefault();
                        event.stopPropagation();
                        setDragState({ draftId: draft.draftId });
                      }}
                      className="absolute -translate-x-1/2 -translate-y-1/2 rounded-full border border-black/60 px-1 py-[1px] text-[9px] leading-none text-black"
                      style={{
                        left: `${point.x}%`,
                        top: `${point.y}%`,
                        backgroundColor: markerColor,
                      }}
                      title={`${draft.name} (${draft.direction})`}
                    >
                      {draft.name.slice(0, 3).toUpperCase()}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={onStartNewChip}
          className="rounded border border-panelBorder bg-[#031a30] px-3 py-2 text-xs uppercase tracking-[0.12em] hover:border-accent"
        >
          New Chip
        </button>
        <button
          type="button"
          onClick={onCreateChip}
          className="rounded border border-accent bg-[#083251] px-3 py-2 text-xs uppercase tracking-[0.12em] hover:bg-[#0a3b5f]"
        >
          {editingChipId ? 'Update Chip' : 'Save Chip'}
        </button>
        <button
          type="button"
          onClick={onResetDesigner}
          className="rounded border border-panelBorder bg-[#031a30] px-3 py-2 text-xs uppercase tracking-[0.12em] hover:border-accent"
        >
          Reset Designer
        </button>
        <button
          type="button"
          onClick={onClearLibrary}
          className="rounded border border-panelBorder bg-[#031a30] px-3 py-2 text-xs uppercase tracking-[0.12em] hover:border-accent"
        >
          Clear Chip Library
        </button>
      </div>

      <div className="mt-3 rounded-lg border border-panelBorder/70 bg-[#020f1e] p-3">
        <div className="mb-2 text-xs uppercase tracking-[0.15em] text-accentSoft">Import Chip JSON</div>
        <textarea
          value={importDraft}
          onChange={(event) => setImportDraft(event.target.value)}
          placeholder='Paste one chip JSON object or an array of chips here...'
          className="h-24 w-full rounded border border-panelBorder bg-[#031a30] px-2 py-1 text-xs text-slate-100 outline-none focus:border-accent"
        />
        <div className="mt-2">
          <button
            type="button"
            onClick={() => onImportChipJson(importDraft)}
            className="rounded border border-panelBorder bg-[#031a30] px-3 py-1 text-[10px] uppercase tracking-[0.12em] hover:border-accent"
          >
            Import JSON
          </button>
        </div>
      </div>

      <div className="mt-3 rounded-lg border border-panelBorder/70 bg-[#020f1e] p-3">
        <div className="mb-2 text-xs uppercase tracking-[0.15em] text-accentSoft">Saved Chips ({chipLibrary.length})</div>
        {chipLibrary.length === 0 ? (
          <p className="text-xs text-slate-300">No chips saved yet.</p>
        ) : (
          <div className="space-y-2 text-xs text-slate-200">
            {chipLibrary.slice(0, 12).map((chip) => (
              <div key={chip.id} className="rounded border border-panelBorder/60 bg-[#031a30] p-2">
                <div>
                  <div>
                    {chip.name} ({chip.id})
                  </div>
                  <div className="text-[10px] uppercase tracking-[0.12em] text-slate-400">
                    Pins: {chip.publicPins.length} Version: {chip.version}
                  </div>
                </div>
                <div className="mt-2 flex flex-wrap gap-1">
                  <button
                    type="button"
                    onClick={() => onAddChipToWorkspace(chip.id)}
                    className="rounded border border-panelBorder bg-[#06233d] px-2 py-1 text-[10px] uppercase tracking-[0.12em] hover:border-accent"
                  >
                    Place
                  </button>
                  <button
                    type="button"
                    onClick={() => onEditChip(chip.id)}
                    className="rounded border border-panelBorder bg-[#06233d] px-2 py-1 text-[10px] uppercase tracking-[0.12em] hover:border-accent"
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    onClick={() => onExportChipJson(chip.id)}
                    className="rounded border border-panelBorder bg-[#06233d] px-2 py-1 text-[10px] uppercase tracking-[0.12em] hover:border-accent"
                  >
                    Copy JSON
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
