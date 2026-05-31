import type { ChipDefinition } from '@vfcs/circuit-model';
import type { PaletteItem } from '../data/componentPalette.js';
import { nodeSymbol } from '../lib/nodePins.js';

interface ComponentPaletteProps {
  items: PaletteItem[];
  onAddComponent: (nodeType: string) => void;
  chipLibrary: ChipDefinition[];
  onAddChipInstance: (chipId: string) => void;
}

export function ComponentPalette({
  items,
  onAddComponent,
  chipLibrary,
  onAddChipInstance,
}: ComponentPaletteProps) {
  return (
    <aside className="rounded-xl border border-panelBorder bg-panel/80 p-4 shadow-panelGlow backdrop-blur-sm">
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-[0.2em] text-accent">Component Palette</h2>
      <p className="mb-3 text-xs text-slate-300">Click any component to add it to the canvas.</p>
      <div className="space-y-2">
        {items.map((item) => (
          <button
            type="button"
            key={item.type}
            onClick={() => onAddComponent(item.type)}
            className="w-full rounded-lg border border-panelBorder/80 bg-[#04182c] px-3 py-2 text-left text-sm transition hover:border-accent hover:bg-[#06233d]"
          >
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-2">
                <span className="rounded border border-panelBorder/90 px-1 py-[1px] text-[10px] uppercase tracking-[0.15em] text-accentSoft">
                  {item.symbol}
                </span>
                {item.label}
              </span>
              <span className="text-[10px] uppercase tracking-[0.15em] text-accentSoft">{item.category}</span>
            </div>
          </button>
        ))}
      </div>

      <div className="mt-4 border-t border-panelBorder/60 pt-3">
        <h3 className="mb-2 text-xs uppercase tracking-[0.18em] text-accentSoft">Custom Chips</h3>
        {chipLibrary.length === 0 ? (
          <p className="text-xs text-slate-300">No saved chips yet.</p>
        ) : (
          <div className="space-y-2">
            {chipLibrary.slice(0, 10).map((chip) => {
              const appearance = (chip.metadata?.appearance as Record<string, unknown> | undefined) ?? undefined;
              const bodyColor =
                typeof appearance?.bodyColor === 'string' ? appearance.bodyColor : '#173a53';
              const symbol = nodeSymbol(
                { id: chip.id, nodeType: 'CHIP', chipRefId: chip.id, position: { x: 0, y: 0 } },
                chipLibrary,
              );

              return (
                <button
                  key={chip.id}
                  type="button"
                  onClick={() => onAddChipInstance(chip.id)}
                  className="w-full rounded-lg border border-panelBorder/80 bg-[#04182c] px-3 py-2 text-left text-sm transition hover:border-accent hover:bg-[#06233d]"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="flex items-center gap-2">
                      <span
                        className="inline-block h-3 w-3 rounded-sm border border-black/40"
                        style={{ backgroundColor: bodyColor }}
                      />
                      <span className="rounded border border-panelBorder/90 px-1 py-[1px] text-[10px] uppercase tracking-[0.15em] text-accentSoft">
                        {symbol}
                      </span>
                      <span>{chip.name}</span>
                    </span>
                    <span className="text-[10px] uppercase tracking-[0.15em] text-accentSoft">chip</span>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </aside>
  );
}
