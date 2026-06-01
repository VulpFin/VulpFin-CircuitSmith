import type { SimulationDiagnostic } from '@vfcs/sim-core';

interface StatusPanelProps {
  tick: number;
  running: boolean;
  ledSignal: string;
  clockInfo: Array<{
    nodeId: string;
    label: string;
    frequencyHz: number;
    nextTick: number;
    nextState: string;
    ticksUntilToggle: number;
    secondsToToggle: number | null;
  }>;
  statusMessage: string;
  exportPreview: string;
  diagnostics: SimulationDiagnostic[];
}

export function StatusPanel({
  tick,
  running,
  ledSignal,
  clockInfo,
  statusMessage,
  exportPreview,
  diagnostics,
}: StatusPanelProps) {
  const primaryClock = clockInfo[0] ?? null;

  return (
    <section className="rounded-xl border border-panelBorder bg-panel/80 p-4 shadow-panelGlow backdrop-blur-sm">
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-[0.2em] text-accent">Simulation and Status</h2>
      <div className="grid gap-3 md:grid-cols-5">
        <div className="rounded-lg border border-panelBorder/70 bg-[#031a30] p-3 text-sm">
          <div className="text-xs uppercase tracking-[0.15em] text-accentSoft">Tick</div>
          <div className="text-lg font-semibold">{tick}</div>
        </div>
        <div className="rounded-lg border border-panelBorder/70 bg-[#031a30] p-3 text-sm">
          <div className="text-xs uppercase tracking-[0.15em] text-accentSoft">Run State</div>
          <div className="text-lg font-semibold">{running ? 'Running' : 'Paused'}</div>
        </div>
        <div className="rounded-lg border border-panelBorder/70 bg-[#031a30] p-3 text-sm">
          <div className="text-xs uppercase tracking-[0.15em] text-accentSoft">LED Output</div>
          <div className="text-lg font-semibold text-signalHot">{ledSignal}</div>
        </div>
        <div className="rounded-lg border border-panelBorder/70 bg-[#031a30] p-3 text-sm">
          <div className="text-xs uppercase tracking-[0.15em] text-accentSoft">Clock Next Tick</div>
          {primaryClock ? (
            <div className="space-y-1 text-xs">
              <div>
                {primaryClock.label}: tick {primaryClock.nextTick}
              </div>
              <div>
                in {primaryClock.ticksUntilToggle} tick(s) {'->'} {primaryClock.nextState}
              </div>
              <div>
                {running && primaryClock.secondsToToggle != null
                  ? `~${primaryClock.secondsToToggle.toFixed(2)}s`
                  : 'Run sim for ETA'}
              </div>
            </div>
          ) : (
            <div className="text-xs text-slate-300">No CLOCK node</div>
          )}
        </div>
        <div className="rounded-lg border border-panelBorder/70 bg-[#031a30] p-3 text-sm">
          <div className="text-xs uppercase tracking-[0.15em] text-accentSoft">Last Action</div>
          <div className="text-sm">{statusMessage}</div>
        </div>
      </div>

      <div className="mt-3 rounded-lg border border-panelBorder/70 bg-[#020f1e] p-3">
        <div className="mb-2 text-xs uppercase tracking-[0.15em] text-accentSoft">Diagnostics</div>
        {diagnostics.length === 0 ? (
          <p className="text-xs text-slate-300">No diagnostics in current snapshot.</p>
        ) : (
          <ul className="space-y-1 text-xs text-slate-200">
            {diagnostics.slice(0, 8).map((item, index) => (
              <li key={`${item.code}-${index}`}>
                <span className={item.severity === 'error' ? 'text-[#ffb5b5]' : 'text-[#ffd199]'}>
                  [{item.severity.toUpperCase()}] {item.code}
                </span>{' '}
                {item.message}
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="mt-3 rounded-lg border border-panelBorder/70 bg-[#020f1e] p-3">
        <div className="mb-2 text-xs uppercase tracking-[0.15em] text-accentSoft">Export Preview</div>
        <pre className="max-h-40 overflow-auto whitespace-pre-wrap text-xs text-slate-200">{exportPreview}</pre>
      </div>
    </section>
  );
}
