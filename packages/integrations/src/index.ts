import { getMappingsForLogicalType, PHYSICAL_PART_DATABASE } from '@vfcs/part-mapper';

export interface IntegrationQuery {
  logicalType?: string;
  manufacturerPartNumber?: string;
  keyword?: string;
}

export interface IntegrationPartSearchHit {
  id: string;
  manufacturerPartNumber: string;
  family: string;
  description: string;
  capabilities: string[];
  sourceNote: string;
}

export interface IntegrationSearchResult {
  integration: 'digikey' | 'easyeda-lcsc' | 'snapeda-snapmagic' | 'kicad-mapper';
  status: 'seeded-catalog' | 'not-implemented';
  message: string;
  query: IntegrationQuery;
  results: IntegrationPartSearchHit[];
}

function normalize(input: string | undefined): string {
  return (input ?? '').trim().toLowerCase();
}

function placeholderResult(
  integration: IntegrationSearchResult['integration'],
  query: IntegrationQuery,
  message: string,
): IntegrationSearchResult {
  return {
    integration,
    status: 'not-implemented',
    message,
    query,
    results: [],
  };
}

function uniqueById(items: IntegrationPartSearchHit[]): IntegrationPartSearchHit[] {
  const seen = new Set<string>();
  const output: IntegrationPartSearchHit[] = [];

  for (const item of items) {
    if (seen.has(item.id)) {
      continue;
    }
    seen.add(item.id);
    output.push(item);
  }

  return output;
}

export async function searchDigikeyParts(query: IntegrationQuery): Promise<IntegrationSearchResult> {
  const mpnFilter = normalize(query.manufacturerPartNumber);
  const keywordFilter = normalize(query.keyword);
  const logicalTypeFilter = normalize(query.logicalType);

  const mappedParts = logicalTypeFilter
    ? getMappingsForLogicalType(query.logicalType ?? '').flatMap((mapping) => mapping.options)
    : [];

  const mappedHits = mappedParts.flatMap((option) =>
    (option.parts ?? []).map((part) => ({
      id: part.id,
      manufacturerPartNumber: part.manufacturerPartNumber,
      family: part.family,
      description: part.description,
      capabilities: part.capabilities,
      sourceNote: `Mapped via ${option.title}`,
    })),
  );

  const catalogHits = PHYSICAL_PART_DATABASE.map((part) => ({
    id: part.id,
    manufacturerPartNumber: part.manufacturerPartNumber,
    family: part.family,
    description: part.description,
    capabilities: part.capabilities,
    sourceNote: 'Seeded local DigiKey adapter catalog',
  }));

  let results = uniqueById([...mappedHits, ...catalogHits]);

  if (logicalTypeFilter) {
    results = results.filter(
      (result) =>
        result.capabilities.some((capability) => capability.toLowerCase() === logicalTypeFilter) ||
        result.sourceNote.toLowerCase().includes(logicalTypeFilter),
    );
  }

  if (mpnFilter) {
    results = results.filter((result) => result.manufacturerPartNumber.toLowerCase().includes(mpnFilter));
  }

  if (keywordFilter) {
    results = results.filter((result) => {
      const searchable = [
        result.id,
        result.manufacturerPartNumber,
        result.family,
        result.description,
        ...result.capabilities,
      ]
        .join(' ')
        .toLowerCase();
      return searchable.includes(keywordFilter);
    });
  }

  return {
    integration: 'digikey',
    status: 'seeded-catalog',
    message:
      'Using seeded local catalog adapter (no external API call yet). Query/response contract is stable for a future live DigiKey client.',
    query,
    results,
  };
}

export async function searchEasyedaLcscParts(query: IntegrationQuery): Promise<IntegrationSearchResult> {
  return placeholderResult(
    'easyeda-lcsc',
    query,
    'EasyEDA/LCSC integration is a placeholder. Add API client + part normalization when integration work begins.',
  );
}

export async function lookupSnapedaModels(query: IntegrationQuery): Promise<IntegrationSearchResult> {
  return placeholderResult(
    'snapeda-snapmagic',
    query,
    'SnapEDA/SnapMagic lookup is a placeholder. Hook symbol/footprint/model search in a future integration sprint.',
  );
}

export async function mapToKicadSymbols(query: IntegrationQuery): Promise<IntegrationSearchResult> {
  return placeholderResult(
    'kicad-mapper',
    query,
    'KiCad symbol and footprint mapping remains stubbed until the KiCad export pipeline is implemented.',
  );
}