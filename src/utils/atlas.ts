import type {
  AtlasDocument,
  PositionReadout,
  ReadoutEntry,
} from '../types/atlas';

const SCHEMA_VERSION = /^biojspace\/[^/]+-(\d+)\.(\d+)$/;
const SUPPORTED_MAJOR = 1;
const READOUT_KINDS = new Set([
  'aa_mean',
  'codon',
  'derived',
  'sae',
  'phenotype',
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function assertReadout(
  value: unknown,
  organism: string,
  position: number,
): asserts value is PositionReadout {
  if (!isRecord(value) || value.pos !== position) {
    throw new Error(`Invalid readout for ${organism} at position ${position}`);
  }

  for (const field of ['aa_readout', 'synonym_readout'] as const) {
    const entries = value[field];
    if (!Array.isArray(entries)) {
      throw new Error(`Missing ${field} for ${organism} at position ${position}`);
    }
    entries.forEach((entry: unknown) => {
      if (
        !isRecord(entry)
        || typeof entry.label !== 'string'
        || typeof entry.kind !== 'string'
        || !READOUT_KINDS.has(entry.kind)
        || typeof entry.score !== 'number'
        || !Number.isFinite(entry.score)
      ) {
        throw new Error(`Invalid ${field} entry at position ${position}`);
      }
    });
  }

  for (const field of ['aa_confidence', 'synonym_entropy'] as const) {
    const score = value[field];
    if (
      typeof score !== 'number'
      || !Number.isFinite(score)
      || score < 0
      || score > 1
    ) {
      throw new Error(`Invalid ${field} at position ${position}`);
    }
  }
}

export function validateAtlasDocument(value: unknown): asserts value is AtlasDocument {
  if (!isRecord(value)) {
    throw new Error('Atlas response is not a JSON object');
  }

  const match = typeof value.schema_version === 'string'
    ? SCHEMA_VERSION.exec(value.schema_version)
    : null;
  if (!match) {
    throw new Error('Atlas response has an invalid schema version');
  }
  if (Number(match[1]) !== SUPPORTED_MAJOR) {
    throw new Error(`Unsupported schema version: ${value.schema_version}`);
  }

  if (
    !isRecord(value.model)
    || typeof value.model.name !== 'string'
    || typeof value.model.n_layers !== 'number'
    || typeof value.model.hidden_size !== 'number'
  ) {
    throw new Error('Atlas response has invalid model metadata');
  }
  if (typeof value.sequence_id !== 'string') {
    throw new Error('Atlas response is missing sequence_id');
  }
  if (
    !Array.isArray(value.organisms)
    || value.organisms.length === 0
    || !value.organisms.every((organism) => typeof organism === 'string')
  ) {
    throw new Error('Atlas response has no valid organisms');
  }
  if (!Array.isArray(value.tokens) || value.tokens.length === 0) {
    throw new Error('Atlas response has no sequence tokens');
  }

  value.tokens.forEach((token, index) => {
    if (
      !isRecord(token)
      || token.pos !== index
      || typeof token.codon !== 'string'
      || !/^[ACGT]{3}$/.test(token.codon)
      || typeof token.aa !== 'string'
      || typeof token.aa3 !== 'string'
    ) {
      throw new Error(`Invalid token at position ${index}`);
    }
  });

  if (!isRecord(value.per_organism)) {
    throw new Error('Atlas response is missing per-organism readouts');
  }
  for (const organism of value.organisms as string[]) {
    const readouts = value.per_organism[organism];
    if (!Array.isArray(readouts) || readouts.length !== value.tokens.length) {
      throw new Error(`Readout length mismatch for ${organism}`);
    }
    readouts.forEach((readout, position) => {
      assertReadout(readout, organism, position);
    });
  }

  if (
    value.organism_default !== undefined
    && (
      typeof value.organism_default !== 'string'
      || !(value.organisms as string[]).includes(value.organism_default)
    )
  ) {
    throw new Error('Atlas response has an invalid default organism');
  }
}

function entryScores(entries: ReadoutEntry[]): Map<string, number> {
  return new Map(entries.map((entry) => [entry.label, entry.score]));
}

export function synonymDistance(
  first: PositionReadout,
  second: PositionReadout,
): number {
  const a = entryScores(first.synonym_readout);
  const b = entryScores(second.synonym_readout);
  const labels = new Set([...a.keys(), ...b.keys()]);
  let distance = 0;
  labels.forEach((label) => {
    distance += Math.abs((a.get(label) ?? 0) - (b.get(label) ?? 0));
  });
  return distance / 2;
}

export function chooseStoryPosition(document: AtlasDocument): number {
  const [firstOrganism, secondOrganism] = document.organisms;
  if (!firstOrganism || !secondOrganism) return document.tokens.length > 1 ? 1 : 0;

  const first = document.per_organism[firstOrganism];
  const second = document.per_organism[secondOrganism];
  let bestPosition = document.tokens.length > 1 ? 1 : 0;
  let bestDistance = -1;

  document.tokens.forEach((token, position) => {
    if (position === 0 || token.aa === 'M' || token.aa === 'W') return;
    const a = first?.[position];
    const b = second?.[position];
    if (!a || !b) return;
    const topChanged = a.synonym_readout[0]?.label !== b.synonym_readout[0]?.label;
    const distance = synonymDistance(a, b) + (topChanged ? 1 : 0);
    if (distance > bestDistance) {
      bestDistance = distance;
      bestPosition = position;
    }
  });

  return bestPosition;
}
