interface TruthTableImportPanelProps {
  importDraft: string;
  onImportDraftChange: (value: string) => void;
  onImportText: () => void;
  onImportFile: (file: File) => void | Promise<void>;
}

const SAMPLE_TABLE = `A,B,,Y
0,0,,0
0,1,,1
1,0,,1
1,1,,0`;

export function TruthTableImportPanel({
  importDraft,
  onImportDraftChange,
  onImportText,
  onImportFile,
}: TruthTableImportPanelProps) {
  return (
    <section className="rounded-xl border border-panelBorder bg-panel/80 p-3 shadow-panelGlow backdrop-blur-sm">
      <details>
        <summary className="cursor-pointer text-sm font-semibold uppercase tracking-[0.2em] text-accent">
          Truth Table / Logic Friday Import
        </summary>

        <div className="mt-3 grid gap-3 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div>
            <p className="mb-2 text-xs text-slate-300">
              Upload or paste a Logic Friday-style CSV truth table. Use a blank column, double comma, or pipe to split inputs from outputs.
            </p>
            <textarea
              value={importDraft}
              onChange={(event) => onImportDraftChange(event.target.value)}
              placeholder={SAMPLE_TABLE}
              className="h-36 w-full rounded border border-panelBorder bg-[#031a30] px-2 py-2 font-mono text-xs text-slate-100 outline-none focus:border-accent"
            />
          </div>

          <div className="rounded-lg border border-panelBorder/70 bg-[#020f1e] p-3 text-xs text-slate-300">
            <div className="mb-2 text-[10px] uppercase tracking-[0.14em] text-accentSoft">Supported Shape</div>
            <pre className="mb-3 overflow-auto rounded border border-panelBorder/60 bg-[#031a30] p-2 text-[10px] text-slate-200">
{SAMPLE_TABLE}
            </pre>
            <p className="mb-2">
              Values: <span className="text-slate-100">0</span>, <span className="text-slate-100">1</span>, or{' '}
              <span className="text-slate-100">X/-/?</span> for don&apos;t-care.
            </p>
            <p>
              Native binary <span className="font-mono text-slate-100">.lfcn</span> files are imported when embedded SOP equations are present; text/CSV exports are imported directly.
            </p>
          </div>
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={onImportText}
            className="rounded border border-accent bg-[#083251] px-3 py-2 text-xs uppercase tracking-[0.12em] hover:bg-[#0a3b5f]"
          >
            Build Circuit From Table
          </button>
          <label className="cursor-pointer rounded border border-panelBorder bg-[#031a30] px-3 py-2 text-xs uppercase tracking-[0.12em] hover:border-accent">
            Upload .lfcn / .csv / .txt
            <input
              type="file"
              accept=".lfcn,.csv,.txt,text/csv,text/plain"
              className="hidden"
              onChange={(event) => {
                const file = event.currentTarget.files?.[0];
                event.currentTarget.value = '';
                if (file) {
                  void onImportFile(file);
                }
              }}
            />
          </label>
        </div>
      </details>
    </section>
  );
}
