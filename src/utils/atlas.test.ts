import { describe, expect, it } from 'vitest';
import type { AtlasDocument, PositionReadout } from '../types/atlas';
import {
  chooseStoryPosition,
  synonymDistance,
  validateAtlasDocument,
} from './atlas';

function readout(pos: number, first: number): PositionReadout {
  return {
    pos,
    true_aa: pos === 0 ? 'Met' : 'Ala',
    true_codon: pos === 0 ? 'ATG' : 'GCT',
    aa_readout: [{ label: pos === 0 ? 'Met' : 'Ala', kind: 'aa_mean', score: 1 }],
    synonym_readout: [
      { label: 'GCT', kind: 'codon', score: first },
      { label: 'GCC', kind: 'codon', score: 1 - first },
    ],
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
});

describe('organism comparison helpers', () => {
  it('calculates total-variation distance on synonymous probabilities', () => {
    expect(synonymDistance(readout(1, 0.9), readout(1, 0.1))).toBeCloseTo(0.8);
  });

  it('selects the strongest non-context-free organism shift', () => {
    expect(chooseStoryPosition(document())).toBe(1);
  });
});
