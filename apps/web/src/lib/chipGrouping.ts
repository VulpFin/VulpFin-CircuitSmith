import type { ChipDefinition } from '@vfcs/circuit-model';

export interface ChipGroup {
  id: string;
  name: string;
  chips: ChipDefinition[];
}

interface GroupRule {
  id: string;
  name: string;
  patterns: RegExp[];
}

const GROUP_RULES: GroupRule[] = [
  {
    id: 'display',
    name: 'Display / Encoding',
    patterns: [/display/, /segment/, /\b7\s*seg/, /\b15\s*seg/, /\bbcd\b/, /bin.*dec/, /hex/, /dabble/],
  },
  {
    id: 'arithmetic',
    name: 'Arithmetic',
    patterns: [/adder/, /subtract/, /subtractor/, /\balu\b/, /carry/, /sum/],
  },
  {
    id: 'compare',
    name: 'Comparators',
    patterns: [/comparator/, /compare/, /greater/, /less/, /equal/],
  },
  {
    id: 'memory',
    name: 'Memory / Sequential',
    patterns: [/register/, /latch/, /flip[\s_-]*flop/, /\bdff\b/, /\btff\b/, /memory/],
  },
  {
    id: 'bus',
    name: 'Buffers / Bus',
    patterns: [/buffer/, /\bbus\b/, /tri[\s_-]*state/, /driver/, /transceiver/],
  },
  {
    id: 'routing',
    name: 'Routing / Decode',
    patterns: [/mux/, /demux/, /decoder/, /encoder/, /selector/, /router/],
  },
  {
    id: 'logic',
    name: 'Logic',
    patterns: [/\blogic\b/, /\band\b/, /\bor\b/, /\bxor\b/, /\bnand\b/, /\bnor\b/, /\bnot\b/, /gate/],
  },
];

const GROUP_ORDER = [...GROUP_RULES.map((rule) => rule.id), 'other'];

function slugify(value: string): string {
  return (
    value
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'other'
  );
}

function stringMetadata(chip: ChipDefinition, keys: string[]): string | null {
  for (const key of keys) {
    const value = chip.metadata?.[key];
    if (typeof value === 'string' && value.trim().length > 0) {
      return value.trim();
    }
  }

  return null;
}

export function chipGroupName(chip: ChipDefinition): string {
  const metadataGroup = stringMetadata(chip, ['group', 'chipGroup', 'category', 'libraryGroup']);
  if (metadataGroup) {
    return metadataGroup;
  }

  const haystack = `${chip.id} ${chip.name} ${chip.metadata?.appearance ? JSON.stringify(chip.metadata.appearance) : ''}`
    .toLowerCase()
    .replace(/[_-]+/g, ' ');
  const matchedRule = GROUP_RULES.find((rule) => rule.patterns.some((pattern) => pattern.test(haystack)));
  return matchedRule?.name ?? 'Other';
}

export function chipMatchesSearch(chip: ChipDefinition, query: string): boolean {
  const normalized = query.trim().toLowerCase();
  if (!normalized) {
    return true;
  }

  const appearance = chip.metadata?.appearance as Record<string, unknown> | undefined;
  const symbol = typeof appearance?.symbol === 'string' ? appearance.symbol : '';
  const group = chipGroupName(chip);
  return [chip.id, chip.name, chip.version, symbol, group]
    .some((value) => value.toLowerCase().includes(normalized));
}

export function groupChips(chips: ChipDefinition[]): ChipGroup[] {
  const groups = new Map<string, ChipGroup>();

  for (const chip of chips) {
    const name = chipGroupName(chip);
    const id = slugify(name);
    const group = groups.get(id) ?? { id, name, chips: [] };
    group.chips.push(chip);
    groups.set(id, group);
  }

  return [...groups.values()]
    .map((group) => ({
      ...group,
      chips: [...group.chips].sort((a, b) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id)),
    }))
    .sort((a, b) => {
      const orderA = GROUP_ORDER.indexOf(a.id);
      const orderB = GROUP_ORDER.indexOf(b.id);
      const normalizedA = orderA < 0 ? Number.MAX_SAFE_INTEGER : orderA;
      const normalizedB = orderB < 0 ? Number.MAX_SAFE_INTEGER : orderB;
      return normalizedA - normalizedB || a.name.localeCompare(b.name);
    });
}
