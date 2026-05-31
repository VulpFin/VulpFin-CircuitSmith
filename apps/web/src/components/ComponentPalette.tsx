import type { PaletteItem } from '../data/componentPalette.js';

interface ComponentPaletteProps {
  items: PaletteItem[];
}

export function ComponentPalette({ items }: ComponentPaletteProps) {
  return (
    <aside className="rounded-xl border border-panelBorder bg-panel/80 p-4 shadow-panelGlow backdrop-blur-sm">
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-[0.2em] text-accent">Component Palette</h2>
      <div className="space-y-2">
        {items.map((item) => (
          <button
            type="button"
            key={item.type}
            className="w-full rounded-lg border border-panelBorder/80 bg-[#04182c] px-3 py-2 text-left text-sm transition hover:border-accent hover:bg-[#06233d]"
          >
            <div className="flex items-center justify-between">
              <span>{item.label}</span>
              <span className="text-[10px] uppercase tracking-[0.15em] text-accentSoft">{item.category}</span>
            </div>
          </button>
        ))}
      </div>
    </aside>
  );
}