import type {
  AtlasDocument,
  PositionReadout,
  ReadoutEntry,
} from '../types/atlas';

const SCHEMA_VERSION = /^biojspace\/[^/]+-(\d+)\.(\d+)$/;
const SUPPORTED_MAJOR = 1;

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
    const expectedKind = field === 'aa_readout' ? 'aa_mean' : 'codon';
    entries.forEach((entry: unknown, index: number) => {
      if (
        !isRecord(entry)
        || typeof entry.label !== 'string'
        || entry.kind !== expectedKind
        || typeof entry.score !== 'number'
        || !Number.isFinite(entry.score)
        || entry.score < 0
        || entry.score > 1
      ) {
        throw new Error(`Invalid ${field} entry at position ${position}`);
      }
      if (
        index > 0
        && isRecord(entries[index - 1])
        && typeof entries[index - 1].score === 'number'
        && entries[index - 1].score < entry.score
      ) {
        throw new Error(`${field} must be sorted by descending score`);
      }
    });
  }

  if (
    typeof value.true_codon !== 'string'
    || !/^[ACGT]{3}$/.test(value.true_codon)
    || typeof value.true_aa !== 'string'
  ) {
    throw new Error(`Missing observed codon or amino acid at position ${position}`);
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
      || typeof token.frame !== 'number'
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
    typeof value.organism_default !== 'string'
    || !(value.organisms as string[]).includes(value.organism_default)
  ) {
    throw new Error('Atlas response has an invalid default organism');
  }

  if (!isRecord(value.concept_layers)) {
    throw new Error('Atlas response is missing concept-layer evidence');
  }
  const layers = value.concept_layers.layers;
  const concepts = value.concept_layers.concepts;
  if (
    !Array.isArray(layers)
    || layers.length === 0
    || !layers.every((layer) => Number.isInteger(layer) && Number(layer) >= 0)
    || !isRecord(concepts)
  ) {
    throw new Error('Atlas response has invalid concept-layer evidence');
  }
  Object.entries(concepts).forEach(([name, concept]) => {
    if (
      !isRecord(concept)
      || (concept.kind !== 'clf' && concept.kind !== 'reg')
      || typeof concept.baseline !== 'number'
      || !Array.isArray(concept.scores)
      || concept.scores.length !== layers.length
      || !concept.scores.every((score) => (
        typeof score === 'number' && Number.isFinite(score)
      ))
    ) {
      throw new Error(`Invalid concept-layer series: ${name}`);
    }
  });

  if (value.lens !== undefined) {
    assertLens(value.lens, value.organisms as string[], value.tokens.length);
  }
}

function assertLens(value: unknown, organisms: string[], tokenCount: number): void {
  if (
    !isRecord(value)
    || (value.method !== 'logit_lens' && value.method !== 'jacobian_lens')
    || !['baseline', 'validated', 'development'].includes(String(value.status))
    || !Array.isArray(value.layers)
    || value.layers.length === 0
    || !value.layers.every((layer) => Number.isInteger(layer))
    || typeof value.top_k !== 'number'
    || typeof value.model_revision !== 'string'
    || value.score_units !== 'probability'
    || typeof value.normalization !== 'string'
    || typeof value.source_position !== 'string'
    || typeof value.target_positions !== 'string'
    || !isRecord(value.per_organism)
    || !isRecord(value.rank_tracks)
  ) {
    throw new Error('Atlas response has invalid lens metadata');
  }
  const perOrganism = value.per_organism as Record<string, unknown>;
  const rankTracks = value.rank_tracks as Record<string, unknown>;

  organisms.forEach((organism) => {
    const positions = perOrganism[organism];
    if (!Array.isArray(positions) || positions.length !== tokenCount) {
      throw new Error(`Lens position length mismatch for ${organism}`);
    }
    positions.forEach((position, index) => {
      if (
        !isRecord(position)
        || position.pos !== index
        || !Array.isArray(position.layers)
        || position.layers.length !== (value.layers as unknown[]).length
      ) {
        throw new Error(`Invalid lens readout for ${organism} at position ${index}`);
      }
      position.layers.forEach((layerReadout, layerIndex) => {
        if (
          !isRecord(layerReadout)
          || layerReadout.pos !== index
          || layerReadout.layer !== (value.layers as unknown[])[layerIndex]
        ) {
          throw new Error(`Invalid lens layer at ${organism} position ${index}`);
        }
        for (const field of ['aa_readout', 'codon_readout'] as const) {
          const entries = layerReadout[field];
          if (
            !Array.isArray(entries)
            || !entries.every((entry, rank) => (
              isRecord(entry)
              && typeof entry.label === 'string'
              && typeof entry.score === 'number'
              && entry.score >= 0
              && entry.score <= 1
              && entry.rank === rank + 1
            ))
          ) {
            throw new Error(`Invalid ${field} lens entries at position ${index}`);
          }
        }
      });
    });

    const organismTracks = rankTracks[organism];
    if (!isRecord(organismTracks)) {
      throw new Error(`Missing lens rank tracks for ${organism}`);
    }
    Object.entries(organismTracks).forEach(([label, rows]) => {
      if (
        !/^[ACGT]{3}$/.test(label)
        || !Array.isArray(rows)
        || rows.length !== tokenCount
        || !rows.every((row) => (
          Array.isArray(row)
          && row.length === (value.layers as unknown[]).length
          && row.every((rank) => Number.isInteger(rank) && Number(rank) >= 1)
        ))
      ) {
        throw new Error(`Invalid lens rank track for ${organism} ${label}`);
      }
    });
  });
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
