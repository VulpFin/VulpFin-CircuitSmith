import { useEffect, useMemo, useState } from 'react';
import type { ChipDefinition } from '@vfcs/circuit-model';
import type { PaletteItem } from '../data/componentPalette.js';
import { chipMatchesSearch, groupChips } from '../lib/chipGrouping.js';
import { nodeSymbol } from '../lib/nodePins.js';

interface PaletteMenu {
  id: string;
  name: string;
  itemTypes: string[];
  collapsed?: boolean;
}

interface ComponentPaletteProps {
  items: PaletteItem[];
  onAddComponent: (nodeType: string) => void;
  chipLibrary: ChipDefinition[];
  onAddChipInstance: (chipId: string) => void;
}

const PALETTE_MENU_STORAGE_KEY = 'vfcs.palette-menus.v1';

const DEFAULT_MENU_LAYOUT: PaletteMenu[] = [
  {
    id: 'primitives',
    name: 'Primitives',
    itemTypes: ['INPUT', 'VCC', 'GND', 'VSS', 'LED', 'OUTPUT', 'CLOCK', 'NOT', 'AND', 'OR', 'NAND', 'NOR', 'XOR', 'XNOR', 'TRISTATE_BUFFER'],
  },
  {
    id: 'routing',
    name: 'Mux / Decode',
    itemTypes: ['MUX2', 'MUX4', 'DEMUX2', 'DECODER2TO4'],
  },
  {
    id: 'math',
    name: 'Arithmetic',
    itemTypes: ['HALF_ADDER', 'FULL_ADDER'],
  },
  {
    id: 'bus',
    name: 'Bus Tools',
    itemTypes: ['BUS_JOIN8', 'BUS_SPLIT8', 'BUS_PROBE8'],
  },
  {
    id: 'sequential',
    name: 'Sequential',
    itemTypes: ['DFF', 'TFF', 'REGISTER8'],
  },
];

function createMenuId(name: string, menus: PaletteMenu[]): string {
  const base =
    name
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'menu';
  const used = new Set(menus.map((menu) => menu.id));
  let candidate = base;
  let suffix = 2;

  while (used.has(candidate)) {
    candidate = `${base}-${suffix}`;
    suffix += 1;
  }

  return candidate;
}

function normalizeMenus(items: PaletteItem[], candidateMenus: PaletteMenu[]): PaletteMenu[] {
  const knownTypes = new Set(items.map((item) => item.type));
  const usedTypes = new Set<string>();
  const menus = candidateMenus
    .filter(
      (menu) =>
        typeof menu.id === 'string'
        && typeof menu.name === 'string'
        && Array.isArray(menu.itemTypes)
        && menu.id.trim()
        && menu.name.trim(),
    )
    .map((menu) => {
      const itemTypes: string[] = [];
      for (const type of menu.itemTypes) {
        if (!knownTypes.has(type) || usedTypes.has(type)) {
          continue;
        }
        itemTypes.push(type);
        usedTypes.add(type);
      }

      return {
        ...menu,
        name: menu.name.trim(),
        itemTypes,
      };
    });

  if (menus.length === 0) {
    menus.push({ id: 'components', name: 'Components', itemTypes: [] });
  }

  const missingTypes = items.map((item) => item.type).filter((type) => !usedTypes.has(type));
  if (missingTypes.length > 0) {
    const otherMenu = menus.find((menu) => menu.id === 'other');
    if (otherMenu) {
      otherMenu.itemTypes = [...otherMenu.itemTypes, ...missingTypes];
    } else {
      menus.push({ id: 'other', name: 'Other', itemTypes: missingTypes });
    }
  }

  return menus;
}

function readStoredMenus(items: PaletteItem[]): PaletteMenu[] {
  if (typeof window === 'undefined') {
    return normalizeMenus(items, DEFAULT_MENU_LAYOUT);
  }

  try {
    const raw = window.localStorage.getItem(PALETTE_MENU_STORAGE_KEY);
    if (!raw) {
      return normalizeMenus(items, DEFAULT_MENU_LAYOUT);
    }

    const parsed = JSON.parse(raw) as PaletteMenu[];
    if (!Array.isArray(parsed)) {
      return normalizeMenus(items, DEFAULT_MENU_LAYOUT);
    }

    return normalizeMenus(items, parsed);
  } catch {
    return normalizeMenus(items, DEFAULT_MENU_LAYOUT);
  }
}

function moveArrayItem<T>(items: T[], index: number, offset: number): T[] {
  const nextIndex = index + offset;
  if (index < 0 || nextIndex < 0 || nextIndex >= items.length) {
    return items;
  }

  const next = [...items];
  const [item] = next.splice(index, 1);
  next.splice(nextIndex, 0, item);
  return next;
}

export function ComponentPalette({
  items,
  onAddComponent,
  chipLibrary,
  onAddChipInstance,
}: ComponentPaletteProps) {
  const [menus, setMenus] = useState<PaletteMenu[]>(() => readStoredMenus(items));
  const [customizing, setCustomizing] = useState(false);
  const [newMenuName, setNewMenuName] = useState('');
  const [chipsCollapsed, setChipsCollapsed] = useState(false);
  const [chipSearch, setChipSearch] = useState('');
  const [collapsedChipGroups, setCollapsedChipGroups] = useState<string[]>([]);

  const itemByType = useMemo(() => new Map(items.map((item) => [item.type, item])), [items]);
  const visibleChipGroups = useMemo(
    () => groupChips(chipLibrary.filter((chip) => chipMatchesSearch(chip, chipSearch))),
    [chipLibrary, chipSearch],
  );

  useEffect(() => {
    setMenus((previous) => normalizeMenus(items, previous));
  }, [items]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    window.localStorage.setItem(PALETTE_MENU_STORAGE_KEY, JSON.stringify(menus));
  }, [menus]);

  const addMenu = () => {
    const name = newMenuName.trim();
    if (!name) {
      return;
    }

    setMenus((previous) => [
      ...previous,
      {
        id: createMenuId(name, previous),
        name,
        itemTypes: [],
      },
    ]);
    setNewMenuName('');
  };

  const renameMenu = (menuId: string, name: string) => {
    setMenus((previous) =>
      previous.map((menu) => (menu.id === menuId ? { ...menu, name: name || 'Untitled Menu' } : menu)),
    );
  };

  const toggleMenu = (menuId: string) => {
    setMenus((previous) =>
      previous.map((menu) => (menu.id === menuId ? { ...menu, collapsed: !menu.collapsed } : menu)),
    );
  };

  const moveMenu = (menuId: string, offset: number) => {
    setMenus((previous) => moveArrayItem(previous, previous.findIndex((menu) => menu.id === menuId), offset));
  };

  const removeMenu = (menuId: string) => {
    setMenus((previous) => {
      if (previous.length <= 1) {
        return previous;
      }

      const removed = previous.find((menu) => menu.id === menuId);
      const remaining = previous.filter((menu) => menu.id !== menuId);
      if (!removed || removed.itemTypes.length === 0) {
        return remaining;
      }

      return remaining.map((menu, index) =>
        index === 0 ? { ...menu, itemTypes: [...menu.itemTypes, ...removed.itemTypes] } : menu,
      );
    });
  };

  const moveItemToMenu = (itemType: string, targetMenuId: string) => {
    setMenus((previous) =>
      previous.map((menu) => {
        const withoutItem = menu.itemTypes.filter((type) => type !== itemType);
        if (menu.id === targetMenuId) {
          return { ...menu, itemTypes: [...withoutItem, itemType], collapsed: false };
        }
        return { ...menu, itemTypes: withoutItem };
      }),
    );
  };

  const moveItemWithinMenu = (menuId: string, itemType: string, offset: number) => {
    setMenus((previous) =>
      previous.map((menu) =>
        menu.id === menuId
          ? { ...menu, itemTypes: moveArrayItem(menu.itemTypes, menu.itemTypes.indexOf(itemType), offset) }
          : menu,
      ),
    );
  };

  const resetMenus = () => {
    setMenus(normalizeMenus(items, DEFAULT_MENU_LAYOUT));
    setNewMenuName('');
  };

  const toggleChipGroup = (groupId: string) => {
    setCollapsedChipGroups((previous) =>
      previous.includes(groupId)
        ? previous.filter((id) => id !== groupId)
        : [...previous, groupId],
    );
  };

  return (
    <aside className="rounded-xl border border-panelBorder bg-panel/80 p-4 shadow-panelGlow backdrop-blur-sm">
      <div className="mb-3 flex items-start justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-[0.2em] text-accent">Component Palette</h2>
          <p className="mt-2 text-xs text-slate-300">Open a menu, then click a component to add it to the canvas.</p>
        </div>
        <button
          type="button"
          onClick={() => setCustomizing((value) => !value)}
          className="rounded border border-panelBorder bg-[#031a30] px-2 py-1 text-[10px] uppercase tracking-[0.12em] hover:border-accent"
        >
          {customizing ? 'Done' : 'Customize'}
        </button>
      </div>

      {customizing ? (
        <div className="mb-3 rounded-lg border border-panelBorder/70 bg-[#020f1e] p-2">
          <div className="mb-2 text-[10px] uppercase tracking-[0.14em] text-accentSoft">Palette Menus</div>
          <div className="flex gap-2">
            <input
              value={newMenuName}
              onChange={(event) => setNewMenuName(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault();
                  addMenu();
                }
              }}
              placeholder="New menu name"
              className="min-w-0 flex-1 rounded border border-panelBorder bg-[#031a30] px-2 py-1 text-xs text-slate-100 outline-none focus:border-accent"
            />
            <button
              type="button"
              onClick={addMenu}
              className="rounded border border-panelBorder bg-[#06233d] px-2 py-1 text-[10px] uppercase tracking-[0.12em] hover:border-accent"
            >
              Add
            </button>
          </div>
          <button
            type="button"
            onClick={resetMenus}
            className="mt-2 rounded border border-panelBorder bg-[#031a30] px-2 py-1 text-[10px] uppercase tracking-[0.12em] text-slate-300 hover:border-accent"
          >
            Reset Default Menus
          </button>
        </div>
      ) : null}

      <div className="space-y-3">
        {menus.map((menu, menuIndex) => {
          const menuItems = menu.itemTypes
            .map((type) => itemByType.get(type))
            .filter((item): item is PaletteItem => Boolean(item));

          return (
            <section key={menu.id} className="rounded-lg border border-panelBorder/80 bg-[#020f1e]">
              <div className="flex items-center gap-2 border-b border-panelBorder/60 px-2 py-2">
                <button
                  type="button"
                  onClick={() => toggleMenu(menu.id)}
                  className="flex min-w-0 flex-1 items-center justify-between gap-2 text-left"
                >
                  <span className="min-w-0 truncate text-xs font-semibold uppercase tracking-[0.16em] text-accentSoft">
                    {menu.name}
                  </span>
                  <span className="shrink-0 text-[10px] uppercase tracking-[0.12em] text-slate-400">
                    {menuItems.length} {menu.collapsed ? '+' : '-'}
                  </span>
                </button>

                {customizing ? (
                  <div className="flex shrink-0 items-center gap-1">
                    <button
                      type="button"
                      onClick={() => moveMenu(menu.id, -1)}
                      disabled={menuIndex === 0}
                      className="rounded border border-panelBorder bg-[#031a30] px-1.5 py-1 text-[10px] disabled:opacity-30"
                    >
                      Up
                    </button>
                    <button
                      type="button"
                      onClick={() => moveMenu(menu.id, 1)}
                      disabled={menuIndex === menus.length - 1}
                      className="rounded border border-panelBorder bg-[#031a30] px-1.5 py-1 text-[10px] disabled:opacity-30"
                    >
                      Down
                    </button>
                  </div>
                ) : null}
              </div>

              {customizing ? (
                <div className="border-b border-panelBorder/60 px-2 py-2">
                  <div className="flex gap-2">
                    <input
                      value={menu.name}
                      onChange={(event) => renameMenu(menu.id, event.target.value)}
                      className="min-w-0 flex-1 rounded border border-panelBorder bg-[#031a30] px-2 py-1 text-xs text-slate-100 outline-none focus:border-accent"
                    />
                    <button
                      type="button"
                      onClick={() => removeMenu(menu.id)}
                      disabled={menus.length <= 1}
                      className="rounded border border-[#6e2e2e] bg-[#301111] px-2 py-1 text-[10px] uppercase tracking-[0.1em] text-[#ffb5b5] disabled:opacity-30"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              ) : null}

              {menu.collapsed ? null : (
                <div className="space-y-2 p-2">
                  {menuItems.length === 0 ? (
                    <p className="rounded border border-panelBorder/60 bg-[#031a30] px-3 py-2 text-xs text-slate-300">
                      Empty menu. Turn on Customize and move components here.
                    </p>
                  ) : null}

                  {menuItems.map((item, itemIndex) => (
                    <div
                      key={item.type}
                      className="rounded-lg border border-panelBorder/80 bg-[#04182c] p-2 transition hover:border-accent hover:bg-[#06233d]"
                    >
                      <button type="button" onClick={() => onAddComponent(item.type)} className="w-full text-left text-sm">
                        <div className="flex items-center justify-between">
                          <span className="flex min-w-0 items-center gap-2">
                            <span className="rounded border border-panelBorder/90 px-1 py-[1px] text-[10px] uppercase tracking-[0.15em] text-accentSoft">
                              {item.symbol}
                            </span>
                            <span className="truncate">{item.label}</span>
                          </span>
                          <span className="shrink-0 text-[10px] uppercase tracking-[0.15em] text-accentSoft">
                            {item.category}
                          </span>
                        </div>
                      </button>

                      {customizing ? (
                        <div className="mt-2 flex flex-wrap items-center gap-1 border-t border-panelBorder/50 pt-2">
                          <button
                            type="button"
                            onClick={() => moveItemWithinMenu(menu.id, item.type, -1)}
                            disabled={itemIndex === 0}
                            className="rounded border border-panelBorder bg-[#031a30] px-1.5 py-1 text-[10px] disabled:opacity-30"
                          >
                            Up
                          </button>
                          <button
                            type="button"
                            onClick={() => moveItemWithinMenu(menu.id, item.type, 1)}
                            disabled={itemIndex === menuItems.length - 1}
                            className="rounded border border-panelBorder bg-[#031a30] px-1.5 py-1 text-[10px] disabled:opacity-30"
                          >
                            Down
                          </button>
                          <select
                            value={menu.id}
                            onChange={(event) => moveItemToMenu(item.type, event.target.value)}
                            className="min-w-0 flex-1 rounded border border-panelBorder bg-[#031a30] px-2 py-1 text-[10px] text-slate-100 outline-none focus:border-accent"
                          >
                            {menus.map((targetMenu) => (
                              <option key={targetMenu.id} value={targetMenu.id}>
                                Move to {targetMenu.name}
                              </option>
                            ))}
                          </select>
                        </div>
                      ) : null}
                    </div>
                  ))}
                </div>
              )}
            </section>
          );
        })}
      </div>

      <div className="mt-4 rounded-lg border border-panelBorder/80 bg-[#020f1e]">
        <button
          type="button"
          onClick={() => setChipsCollapsed((value) => !value)}
          className="flex w-full items-center justify-between border-b border-panelBorder/60 px-2 py-2 text-left"
        >
          <span className="text-xs font-semibold uppercase tracking-[0.16em] text-accentSoft">Custom Chips</span>
          <span className="text-[10px] uppercase tracking-[0.12em] text-slate-400">
            {chipLibrary.length} {chipsCollapsed ? '+' : '-'}
          </span>
        </button>

        {chipsCollapsed ? null : (
          <div className="space-y-2 p-2">
            {chipLibrary.length === 0 ? (
              <p className="text-xs text-slate-300">No saved chips yet.</p>
            ) : (
              <>
                <input
                  value={chipSearch}
                  onChange={(event) => setChipSearch(event.target.value)}
                  placeholder="Search custom chips..."
                  className="w-full rounded border border-panelBorder bg-[#031a30] px-2 py-1 text-xs text-slate-100 outline-none focus:border-accent"
                />

                {visibleChipGroups.length === 0 ? (
                  <p className="rounded border border-panelBorder/60 bg-[#031a30] px-3 py-2 text-xs text-slate-300">
                    No custom chips match "{chipSearch}".
                  </p>
                ) : (
                  <div className="max-h-[28rem] space-y-2 overflow-auto pr-1">
                    {visibleChipGroups.map((group) => {
                      const collapsed = collapsedChipGroups.includes(group.id);
                      return (
                        <section key={group.id} className="rounded border border-panelBorder/70 bg-[#031a30]">
                          <button
                            type="button"
                            onClick={() => toggleChipGroup(group.id)}
                            className="flex w-full items-center justify-between gap-2 border-b border-panelBorder/50 px-2 py-1.5 text-left"
                          >
                            <span className="truncate text-[10px] font-semibold uppercase tracking-[0.14em] text-accentSoft">
                              {group.name}
                            </span>
                            <span className="shrink-0 text-[9px] uppercase tracking-[0.12em] text-slate-400">
                              {group.chips.length} {collapsed ? '+' : '-'}
                            </span>
                          </button>

                          {collapsed ? null : (
                            <div className="space-y-1.5 p-2">
                              {group.chips.map((chip) => {
                                const appearance = (chip.metadata?.appearance as Record<string, unknown> | undefined) ?? undefined;
                                const bodyColor = typeof appearance?.bodyColor === 'string' ? appearance.bodyColor : '#173a53';
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
                                      <span className="flex min-w-0 items-center gap-2">
                                        <span
                                          className="inline-block h-3 w-3 rounded-sm border border-black/40"
                                          style={{ backgroundColor: bodyColor }}
                                        />
                                        <span className="rounded border border-panelBorder/90 px-1 py-[1px] text-[10px] uppercase tracking-[0.15em] text-accentSoft">
                                          {symbol}
                                        </span>
                                        <span className="truncate">{chip.name}</span>
                                      </span>
                                      <span className="shrink-0 text-[10px] uppercase tracking-[0.15em] text-accentSoft">
                                        chip
                                      </span>
                                    </div>
                                  </button>
                                );
                              })}
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
        )}
      </div>
    </aside>
  );
}
