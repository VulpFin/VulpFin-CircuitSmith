import type { ChipDefinition } from '@vfcs/circuit-model';

interface ChipLibraryPanelProps {
  chipIdDraft: string;
  chipNameDraft: string;
  chipLibrary: ChipDefinition[];
  onChipIdDraftChange: (value: string) => void;
  onChipNameDraftChange: (value: string) => void;
  onCreateChip: () => void;
  onClearLibrary: () => void;
}

export function ChipLibraryPanel({
  chipIdDraft,
  chipNameDraft,
  chipLibrary,
  onChipIdDraftChange,
  onChipNameDraftChange,
  onCreateChip,
  onClearLibrary,
}: ChipLibraryPanelProps) {
  return (
    <section className="rounded-xl border border-panelBorder bg-panel/80 p-4 shadow-panelGlow backdrop-blur-sm">
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-[0.2em] text-accent">Make Chip Workflow</h2>
      <p className="mb-3 text-xs text-slate-300">
        Creates a reusable chip from the current circuit and persists it to local storage.
      </p>

      <div className="grid gap-2 md:grid-cols-2">
        <label className="text-xs uppercase tracking-[0.12em] text-accentSoft">
          Chip ID
          <input
            value={chipIdDraft}
            onChange={(event) => onChipIdDraftChange(event.target.value)}
            className="mt-1 w-full rounded border border-panelBorder bg-[#031a30] px-2 py-1 text-sm text-slate-100 outline-none focus:border-accent"
          />
        </label>

        <label className="text-xs uppercase tracking-[0.12em] text-accentSoft">
          Chip Name
          <input
            value={chipNameDraft}
            onChange={(event) => onChipNameDraftChange(event.target.value)}
            className="mt-1 w-full rounded border border-panelBorder bg-[#031a30] px-2 py-1 text-sm text-slate-100 outline-none focus:border-accent"
          />
        </label>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={onCreateChip}
          className="rounded border border-accent bg-[#083251] px-3 py-2 text-xs uppercase tracking-[0.12em] hover:bg-[#0a3b5f]"
        >
          Save Chip
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
        <div className="mb-2 text-xs uppercase tracking-[0.15em] text-accentSoft">Saved Chips ({chipLibrary.length})</div>
        {chipLibrary.length === 0 ? (
          <p className="text-xs text-slate-300">No chips saved yet.</p>
        ) : (
          <ul className="space-y-1 text-xs text-slate-200">
            {chipLibrary.slice(0, 6).map((chip) => (
              <li key={chip.id}>
                {chip.name} ({chip.id}) - v{chip.version}
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}