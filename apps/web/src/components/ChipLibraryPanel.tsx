import { useEffect, useMemo, useRef, useState } from 'react';
import type { ChipDefinition, PinDefinition, PinDirection } from '@vfcs/circuit-model';
import type { ChipVisualElement, ChipVisualElementType } from '../lib/chipVisuals.js';
import { sanitizePinPercent } from '../lib/chipDesigner.js';
import { chipMatchesSearch, groupChips } from '../lib/chipGrouping.js';
import { ChipVisualLayer } from './ChipVisualLayer.js';

export interface ChipPinSourceOption {
  id: string;
  nodeId: string;
  pinId?: string;
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
  sourcePinId?: string;
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
  chipDesignerWarning: string | null;
  chipAppearanceDraft: ChipAppearanceDraft;
  chipVisualDrafts: ChipVisualElement[];
  chipVisualOutputPins: PinDefinition[];
  chipVisualSourceOptions: ChipPinSourceOption[];
  onChipIdDraftChange: (value: string) => void;
  onChipNameDraftChange: (value: string) => void;
  onChipPinDraftChange: (draftId: string, patch: Partial<ChipPinDraft>) => void;
  onAddChipPinDraft: () => void;
  onRemoveChipPinDraft: (draftId: string) => void;
  onChipAppearanceDraftChange: (patch: Partial<ChipAppearanceDraft>) => void;
  onAddChipVisual: (type: ChipVisualElementType) => void;
  onAddSevenSegmentVisualPreset: () => void;
  onImportNestedChipVisuals: () => void;
  onUpdateChipVisual: (visualId: string, patch: Partial<ChipVisualElement>) => void;
  onScaleChipVisualGroup: (groupId: string, scaleFactor: number) => void;
  onRemoveChipVisual: (visualId: string) => void;
  onStartNewChip: () => void;
  onCreateChip: () => void;
  onClearLibrary: () => void;
  onExportChipLibrary: () => void;
  onAddChipToWorkspace: (chipId: string) => void;
  onEditChip: (chipId: string) => void;
  onExportChipJson: (chipId: string) => void;
  onDeleteChip: (chipId: string) => void;
  onImportChipJson: (payload: string) => void;
  onResetDesigner: () => void;
}

type DesignerDragState =
  | { kind: 'pin'; id: string }
  | { kind: 'visual'; id: string };

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
    return source.direction === 'output' || source.direction === 'bidirectional';
  }

  return source.direction === 'input' || source.direction === 'bidirectional';
}

function sourceKey(nodeId: string, pinId?: string): string {
  return pinId ? `${nodeId}.${pinId}` : nodeId;
}

function draftSourceKey(draft: ChipPinDraft): string {
  return draft.sourceNodeId ? sourceKey(draft.sourceNodeId, draft.sourcePinId) : '';
}

function formatSourceOption(source: ChipPinSourceOption): string {
  const pinSuffix = source.pinId ? `.${source.pinId}` : '';
  return `${source.label}${pinSuffix} (${source.nodeId}${pinSuffix}, ${source.nodeType})`;
}

function sourcePriority(source: ChipPinSourceOption, direction: PinDirection): number {
  if (direction === 'input') {
    return source.direction === 'input' ? 0 : 1;
  }

  if (direction === 'output') {
    return source.direction === 'output' ? 0 : 1;
  }

  return source.direction === 'bidirectional' ? 0 : source.direction === 'input' ? 1 : 2;
}

interface ChipVisualGroupSummary {
  id: string;
  label: string;
  count: number;
  width: number;
  height: number;
}

function chipVisualGroupSummaries(visuals: ChipVisualElement[]): ChipVisualGroupSummary[] {
  const groups = new Map<string, ChipVisualElement[]>();
  for (const visual of visuals) {
    if (!visual.groupId) {
      continue;
    }
    const members = groups.get(visual.groupId) ?? [];
    members.push(visual);
    groups.set(visual.groupId, members);
  }

  return [...groups.entries()].map(([id, members]) => {
    const left = Math.min(...members.map((visual) => visual.x - visual.width / 2));
    const right = Math.max(...members.map((visual) => visual.x + visual.width / 2));
    const top = Math.min(...members.map((visual) => visual.y - visual.height / 2));
    const bottom = Math.max(...members.map((visual) => visual.y + visual.height / 2));
    return {
      id,
      label: members.find((visual) => visual.groupLabel)?.groupLabel ?? id,
      count: members.length,
      width: Math.max(0, right - left),
      height: Math.max(0, bottom - top),
    };
  });
}

export function ChipLibraryPanel({
  chipIdDraft,
  chipNameDraft,
  editingChipId,
  chipLibrary,
  chipPinDrafts,
  chipPinSourceOptions,
  chipDesignerWarning,
  chipAppearanceDraft,
  chipVisualDrafts,
  chipVisualOutputPins,
  chipVisualSourceOptions,
  onChipIdDraftChange,
  onChipNameDraftChange,
  onChipPinDraftChange,
  onAddChipPinDraft,
  onRemoveChipPinDraft,
  onChipAppearanceDraftChange,
  onAddChipVisual,
  onAddSevenSegmentVisualPreset,
  onImportNestedChipVisuals,
  onUpdateChipVisual,
  onScaleChipVisualGroup,
  onRemoveChipVisual,
  onStartNewChip,
  onCreateChip,
  onClearLibrary,
  onExportChipLibrary,
  onAddChipToWorkspace,
  onEditChip,
  onExportChipJson,
  onDeleteChip,
  onImportChipJson,
  onResetDesigner,
}: ChipLibraryPanelProps) {
  const previewRef = useRef<HTMLDivElement | null>(null);
  const [dragState, setDragState] = useState<DesignerDragState | null>(null);
  const [importDraft, setImportDraft] = useState('');
  const [groupScaleDrafts, setGroupScaleDrafts] = useState<Record<string, string>>({});
  const [chipLibrarySearch, setChipLibrarySearch] = useState('');
  const [collapsedLibraryGroups, setCollapsedLibraryGroups] = useState<string[]>([]);

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

      if (dragState.kind === 'pin') {
        onChipPinDraftChange(dragState.id, {
          pinX: clampPercent(x),
          pinY: clampPercent(y),
        });
      } else {
        onUpdateChipVisual(dragState.id, {
          x: clampPercent(x),
          y: clampPercent(y),
        });
      }
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
  }, [dragState, onChipPinDraftChange, onUpdateChipVisual]);

  const enabledDrafts = chipPinDrafts.filter((draft) => draft.enabled);
  const sourceById = useMemo(
    () => new Map(chipPinSourceOptions.map((source) => [source.id, source])),
    [chipPinSourceOptions],
  );
  const visualGroups = useMemo(() => chipVisualGroupSummaries(chipVisualDrafts), [chipVisualDrafts]);
  const visibleLibraryGroups = useMemo(
    () => groupChips(chipLibrary.filter((chip) => chipMatchesSearch(chip, chipLibrarySearch))),
    [chipLibrary, chipLibrarySearch],
  );

  const toggleLibraryGroup = (groupId: string) => {
    setCollapsedLibraryGroups((previous) =>
      previous.includes(groupId)
        ? previous.filter((id) => id !== groupId)
        : [...previous, groupId],
    );
  };

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
      {chipDesignerWarning ? (
        <p className="mb-3 rounded border border-[#7a4a20] bg-[#2d1b0d] px-2 py-1 text-xs text-[#ffd28a]">
          {chipDesignerWarning}
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
              const selectedSourceKey = draftSourceKey(draft);
              const selectedSource = selectedSourceKey ? sourceById.get(selectedSourceKey) : undefined;
              const compatibleSources = chipPinSourceOptions
                .filter((source) => isSourceCompatible(source, draft.direction))
                .sort(
                  (a, b) =>
                    sourcePriority(a, draft.direction) - sourcePriority(b, draft.direction)
                    || a.label.localeCompare(b.label)
                    || a.id.localeCompare(b.id),
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
                        const source = selectedSourceKey ? sourceById.get(selectedSourceKey) : undefined;
                        onChipPinDraftChange(draft.draftId, {
                          direction,
                          sourceNodeId: isSourceCompatible(source, direction) ? source?.nodeId : undefined,
                          sourcePinId: isSourceCompatible(source, direction) ? source?.pinId : undefined,
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
                        value={selectedSourceKey}
                        onChange={(event) => {
                          const source = sourceById.get(event.target.value);
                          onChipPinDraftChange(draft.draftId, {
                            sourceNodeId: source?.nodeId,
                            sourcePinId: source?.pinId,
                          });
                        }}
                        className="mt-1 w-full rounded border border-panelBorder bg-[#031a30] px-2 py-1 text-xs normal-case tracking-normal text-slate-100 outline-none focus:border-accent"
                      >
                        <option value="">Unbound / manual only</option>
                        {hasInvalidSource ? (
                          <option value={selectedSourceKey}>
                            {draft.sourcePinId ? `${draft.sourceNodeId}.${draft.sourcePinId}` : draft.sourceNodeId} (missing)
                          </option>
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

            <div className="rounded border border-panelBorder/70 bg-[#031a30] p-2">
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                <div className="text-[10px] uppercase tracking-[0.12em] text-slate-300">
                  Face Elements
                </div>
                <div className="flex flex-wrap gap-1">
                  <button
                    type="button"
                    onClick={() => onAddChipVisual('led')}
                    className="rounded border border-panelBorder px-2 py-1 text-[9px] uppercase hover:border-accent"
                  >
                    + LED
                  </button>
                  <button
                    type="button"
                    onClick={() => onAddChipVisual('segment')}
                    className="rounded border border-panelBorder px-2 py-1 text-[9px] uppercase hover:border-accent"
                  >
                    + Segment
                  </button>
                  <button
                    type="button"
                    onClick={() => onAddChipVisual('label')}
                    className="rounded border border-panelBorder px-2 py-1 text-[9px] uppercase hover:border-accent"
                  >
                    + Label
                  </button>
                  <button
                    type="button"
                    onClick={onAddSevenSegmentVisualPreset}
                    className="rounded border border-[#7a4a20] bg-[#2d1b0d] px-2 py-1 text-[9px] uppercase text-[#ffd28a] hover:border-signalHot"
                  >
                    7-Seg Preset
                  </button>
                  <button
                    type="button"
                    onClick={onImportNestedChipVisuals}
                    className="rounded border border-accent/70 bg-[#06233d] px-2 py-1 text-[9px] uppercase text-accent hover:border-accent"
                    title="Pull LEDs, segments, and labels from visual chip instances placed in the workspace."
                  >
                    Pull Chip Faces
                  </button>
                </div>
              </div>

              {chipVisualDrafts.length === 0 ? (
                <p className="text-[10px] text-slate-400">
                  Add lights, segments, or labels and bind them to public output pins.
                </p>
              ) : (
                <>
                  {visualGroups.length > 0 ? (
                    <div className="mb-2 space-y-2 rounded border border-accent/30 bg-[#021a2a] p-2">
                      <div className="flex items-center justify-between gap-2 text-[10px] uppercase tracking-[0.12em] text-accent">
                        <span>Face Groups</span>
                        <span className="text-[8px] text-accentSoft">scale whole displays</span>
                      </div>
                      {visualGroups.map((group) => {
                        const customScale = groupScaleDrafts[group.id] ?? '110';
                        const applyCustomScale = () => {
                          const scalePercent = Number(customScale);
                          if (Number.isFinite(scalePercent) && scalePercent > 0) {
                            onScaleChipVisualGroup(group.id, scalePercent / 100);
                          }
                        };

                        return (
                          <div key={group.id} className="rounded border border-panelBorder/70 bg-[#020f1e] p-2">
                            <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
                              <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-200">
                                {group.label}
                              </span>
                              <span className="text-[8px] uppercase tracking-[0.12em] text-slate-400">
                                {group.count} pieces, {Math.round(group.width)}% x {Math.round(group.height)}%
                              </span>
                            </div>
                            <div className="flex flex-wrap items-center gap-1">
                              {[0.75, 0.9, 1.1, 1.25].map((scaleFactor) => (
                                <button
                                  key={scaleFactor}
                                  type="button"
                                  onClick={() => onScaleChipVisualGroup(group.id, scaleFactor)}
                                  className="rounded border border-panelBorder px-2 py-1 text-[9px] uppercase hover:border-accent"
                                >
                                  {Math.round(scaleFactor * 100)}%
                                </button>
                              ))}
                              <input
                                type="number"
                                min={10}
                                max={500}
                                step={5}
                                value={customScale}
                                onChange={(event) =>
                                  setGroupScaleDrafts((previous) => ({
                                    ...previous,
                                    [group.id]: event.target.value,
                                  }))
                                }
                                className="w-16 rounded border border-panelBorder bg-[#031a30] px-1 py-1 text-[9px] text-slate-100"
                                aria-label={`Scale ${group.label} by percent`}
                              />
                              <button
                                type="button"
                                onClick={applyCustomScale}
                                className="rounded border border-accent/70 bg-[#06233d] px-2 py-1 text-[9px] uppercase text-accent hover:border-accent"
                              >
                                Apply %
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : null}

                  <div className="max-h-72 space-y-2 overflow-auto pr-1">
                    {chipVisualDrafts.map((visual) => (
                      <div key={visual.id} className="rounded border border-panelBorder/60 bg-[#020f1e] p-2">
                        {visual.groupId ? (
                          <div className="mb-1 flex items-center justify-between gap-2 text-[8px] uppercase tracking-[0.12em] text-accentSoft">
                            <span>Group: {visual.groupLabel ?? visual.groupId}</span>
                            <span>drag any piece to move group</span>
                          </div>
                        ) : null}
                        <div className="grid grid-cols-[1fr_1fr_auto] gap-1">
                          <select
                            value={visual.type}
                            onChange={(event) =>
                              onUpdateChipVisual(visual.id, {
                                type: event.target.value as ChipVisualElementType,
                              })
                            }
                            className="rounded border border-panelBorder bg-[#031a30] px-1 py-1 text-[10px]"
                          >
                            <option value="led">LED</option>
                            <option value="segment">Segment</option>
                            <option value="label">Label</option>
                          </select>
                          <select
                            value={
                              visual.sourceNodeId
                                ? sourceKey(visual.sourceNodeId, visual.sourcePinId)
                                : visual.bindingPinId
                                  ? `public:${visual.bindingPinId}`
                                  : ''
                            }
                            disabled={visual.type === 'label'}
                            onChange={(event) => {
                              const value = event.target.value;
                              if (value.startsWith('public:')) {
                                onUpdateChipVisual(visual.id, {
                                  bindingPinId: value.slice('public:'.length),
                                  sourceNodeId: undefined,
                                  sourcePinId: undefined,
                                });
                                return;
                              }
                              const source = chipVisualSourceOptions.find((entry) => entry.id === value);
                              onUpdateChipVisual(visual.id, {
                                bindingPinId: undefined,
                                sourceNodeId: source?.nodeId,
                                sourcePinId: source?.pinId,
                              });
                            }}
                            className="rounded border border-panelBorder bg-[#031a30] px-1 py-1 text-[10px] disabled:opacity-50"
                          >
                            <option value="">Unbound</option>
                            <optgroup label="Internal signals">
                              {chipVisualSourceOptions.map((source) => (
                                <option key={source.id} value={source.id}>
                                  {formatSourceOption(source)}
                                </option>
                              ))}
                            </optgroup>
                            <optgroup label="Public output pins">
                            {chipVisualOutputPins.map((pin) => (
                              <option key={pin.id} value={`public:${pin.id}`}>
                                {pin.name} ({pin.id})
                              </option>
                            ))}
                            </optgroup>
                          </select>
                          <button
                            type="button"
                            onClick={() => onRemoveChipVisual(visual.id)}
                            className="rounded border border-[#6e2e2e] bg-[#301111] px-2 text-[10px] text-[#ffb5b5]"
                          >
                            X
                          </button>
                        </div>

                      {visual.type === 'label' ? (
                        <input
                          value={visual.text ?? ''}
                          onChange={(event) => onUpdateChipVisual(visual.id, { text: event.target.value })}
                          placeholder="Label text"
                          className="mt-1 w-full rounded border border-panelBorder bg-[#031a30] px-1 py-1 text-[10px]"
                        />
                      ) : null}

                      <div className="mt-1 grid grid-cols-5 gap-1">
                        {([
                          ['X', 'x', visual.x],
                          ['Y', 'y', visual.y],
                          ['W', 'width', visual.width],
                          ['H', 'height', visual.height],
                          ['ROT', 'rotation', visual.rotation],
                        ] as const).map(([label, key, value]) => (
                          <label key={key} className="text-[8px] uppercase text-slate-400">
                            {label}
                            <input
                              type="number"
                              value={Math.round(value * 10) / 10}
                              onChange={(event) => {
                                const next = Number(event.target.value);
                                if (Number.isFinite(next)) {
                                  onUpdateChipVisual(visual.id, { [key]: next });
                                }
                              }}
                              className="mt-[2px] w-full rounded border border-panelBorder bg-[#031a30] px-1 py-[2px] text-[9px] text-slate-100"
                            />
                          </label>
                        ))}
                      </div>

                      <div className="mt-1 grid grid-cols-2 gap-1">
                        <label className="text-[8px] uppercase text-slate-400">
                          On/Text
                          <input
                            type="color"
                            value={visual.color}
                            onChange={(event) => onUpdateChipVisual(visual.id, { color: event.target.value })}
                            className="mt-[2px] h-6 w-full rounded border border-panelBorder bg-[#031a30]"
                          />
                        </label>
                        {visual.type !== 'label' ? (
                          <label className="text-[8px] uppercase text-slate-400">
                            Off
                            <input
                              type="color"
                              value={visual.offColor}
                              onChange={(event) => onUpdateChipVisual(visual.id, { offColor: event.target.value })}
                              className="mt-[2px] h-6 w-full rounded border border-panelBorder bg-[#031a30]"
                            />
                          </label>
                        ) : null}
                      </div>
                    </div>
                  ))}
                </div>
                </>
              )}
            </div>

            <div>
              <div className="mb-1 text-[10px] uppercase tracking-[0.12em] text-slate-300">
                Face Preview (drag pins and elements)
              </div>
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
                  <ChipVisualLayer elements={chipVisualDrafts} preview />
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
                        setDragState({ kind: 'pin', id: draft.draftId });
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

                {chipVisualDrafts.map((visual) => (
                  <button
                    key={`drag-${visual.id}`}
                    type="button"
                    onMouseDown={(event) => {
                      event.preventDefault();
                      event.stopPropagation();
                      setDragState({ kind: 'visual', id: visual.id });
                    }}
                    className="absolute z-20 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/70 bg-black/70"
                    style={{ left: `${visual.x}%`, top: `${visual.y}%` }}
                    title={visual.groupId ? `Drag ${visual.groupLabel ?? visual.groupId} group` : `Drag ${visual.type}`}
                  />
                ))}
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
          New Empty Chip
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
          onClick={onExportChipLibrary}
          className="rounded border border-panelBorder bg-[#031a30] px-3 py-2 text-xs uppercase tracking-[0.12em] hover:border-accent"
        >
          Export Library JSON
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
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <div className="text-xs uppercase tracking-[0.15em] text-accentSoft">Saved Chips ({chipLibrary.length})</div>
          {chipLibrary.length > 0 ? (
            <div className="text-[10px] uppercase tracking-[0.12em] text-slate-400">
              {visibleLibraryGroups.reduce((sum, group) => sum + group.chips.length, 0)} shown
            </div>
          ) : null}
        </div>
        {chipLibrary.length === 0 ? (
          <p className="text-xs text-slate-300">No chips saved yet.</p>
        ) : (
          <>
            <input
              value={chipLibrarySearch}
              onChange={(event) => setChipLibrarySearch(event.target.value)}
              placeholder="Search saved chips..."
              className="mb-2 w-full rounded border border-panelBorder bg-[#031a30] px-2 py-1 text-xs text-slate-100 outline-none focus:border-accent"
            />

            {visibleLibraryGroups.length === 0 ? (
              <p className="rounded border border-panelBorder/60 bg-[#031a30] px-3 py-2 text-xs text-slate-300">
                No saved chips match "{chipLibrarySearch}".
              </p>
            ) : (
              <div className="max-h-[32rem] space-y-2 overflow-auto pr-1 text-xs text-slate-200">
                {visibleLibraryGroups.map((group) => {
                  const collapsed = collapsedLibraryGroups.includes(group.id);
                  return (
                    <section key={group.id} className="rounded border border-panelBorder/70 bg-[#031a30]">
                      <button
                        type="button"
                        onClick={() => toggleLibraryGroup(group.id)}
                        className="flex w-full items-center justify-between gap-2 border-b border-panelBorder/50 px-2 py-2 text-left"
                      >
                        <span className="truncate text-[10px] font-semibold uppercase tracking-[0.14em] text-accentSoft">
                          {group.name}
                        </span>
                        <span className="shrink-0 text-[9px] uppercase tracking-[0.12em] text-slate-400">
                          {group.chips.length} {collapsed ? '+' : '-'}
                        </span>
                      </button>

                      {collapsed ? null : (
                        <div className="space-y-2 p-2">
                          {group.chips.map((chip) => (
                            <div key={chip.id} className="rounded border border-panelBorder/60 bg-[#020f1e] p-2">
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
                                <button
                                  type="button"
                                  onClick={() => onDeleteChip(chip.id)}
                                  className="rounded border border-[#6e2e2e] bg-[#301111] px-2 py-1 text-[10px] uppercase tracking-[0.12em] text-[#ffb5b5] hover:border-[#ff8f8f]"
                                >
                                  Delete
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </section>
                  );
                })}
              </div>
            )}
          </>
        )}
      </div>
    </section>
  );
}
