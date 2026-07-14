import { describe, expect, it } from 'vitest';
import type { AtlasDocument, PositionReadout } from '../types/atlas';
import {
  chooseStoryPosition,
  synonymDistance,
  validateAtlasDocument,
} from './atlas';

function readout(pos: number, first: number): PositionReadout {
  const synonyms = [
    { label: 'GCT', kind: 'codon' as const, score: first },
    { label: 'GCC', kind: 'codon' as const, score: 1 - first },
  ].sort((a, b) => b.score - a.score);
  return {
    pos,
    true_aa: pos === 0 ? 'Met' : 'Ala',
    true_codon: pos === 0 ? 'ATG' : 'GCT',
    aa_readout: [{ label: pos === 0 ? 'Met' : 'Ala', kind: 'aa_mean', score: 1 }],
    synonym_readout: synonyms,
    aa_confidence: 1,
    synonym_entropy: 0.5,
  };
}

function document(): AtlasDocument {
  return {
    schema_version: 'biojspace/decodon-1.0',
    model: { name: 'DeCodon', n_layers: 12, hidden_size: 1024 },
    sequence_id: 'test',
    organism_default: 'A (1)',
    organisms: ['A (1)', 'B (2)'],
    tokens: [
      { pos: 0, codon: 'ATG', aa: 'M', aa3: 'Met', frame: 0 },
      { pos: 1, codon: 'GCT', aa: 'A', aa3: 'Ala', frame: 0 },
      { pos: 2, codon: 'GCC', aa: 'A', aa3: 'Ala', frame: 0 },
    ],
    per_organism: {
      'A (1)': [readout(0, 0.5), readout(1, 0.9), readout(2, 0.55)],
      'B (2)': [readout(0, 0.5), readout(1, 0.1), readout(2, 0.45)],
    },
    concept_layers: {
      layers: [0, 1],
      concepts: {
        organism_taxid: {
          kind: 'clf',
          baseline: 0.5,
          scores: [0.5, 0.9],
        },
      },
    },
  };
}

describe('atlas contract validation', () => {
  it('accepts a valid document', () => {
    expect(() => validateAtlasDocument(document())).not.toThrow();
  });

  it('rejects unsupported major versions', () => {
    const value = document();
    value.schema_version = 'biojspace/decodon-2.0';
    expect(() => validateAtlasDocument(value)).toThrow('Unsupported schema');
  });

  it('rejects mismatched organism readouts', () => {
    const value = document();
    value.per_organism['B (2)'].pop();
    expect(() => validateAtlasDocument(value)).toThrow('length mismatch');
  });

  it('accepts compact measured lens readouts and rank tracks', () => {
    const value = document();
    const positions = value.tokens.map((token) => ({
      pos: token.pos,
      layers: [{
        layer: 12,
        pos: token.pos,
        aa_readout: [{
          label: token.aa3,
          kind: 'aa_mean' as const,
          score: 1,
          rank: 1,
        }],
        codon_readout: [{
          label: token.codon,
          kind: 'codon' as const,
          score: 1,
          rank: 1,
        }],
      }],
    }));
    value.lens = {
      method: 'logit_lens',
      status: 'baseline',
      layers: [12],
      top_k: 1,
      model_revision: 'test-revision',
      score_units: 'probability',
      normalization: 'codon-only softmax',
      source_position: 'same position',
      target_positions: 'current only',
      per_organism: {
        'A (1)': positions,
        'B (2)': positions,
      },
      rank_tracks: {
        'A (1)': { GCT: [[1], [1], [1]] },
        'B (2)': { GCT: [[1], [1], [1]] },
      },
    };
    expect(() => validateAtlasDocument(value)).not.toThrow();
  });
});

describe('organism comparison helpers', () => {
  it('calculates total-variation distance on synonymous probabilities', () => {
    expect(synonymDistance(readout(1, 0.9), readout(1, 0.1))).toBeCloseTo(0.8);
  });

  it('selects the strongest non-context-free organism shift', () => {
    expect(chooseStoryPosition(document())).toBe(1);
  });
});
