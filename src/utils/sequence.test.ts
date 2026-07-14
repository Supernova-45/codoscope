import { describe, expect, it } from 'vitest';
import { normalizeSequence, validateCodingSequence } from './sequence';

const valid = `ATG${'GCT'.repeat(19)}`;

describe('coding-sequence validation', () => {
  it('normalizes whitespace and lowercase DNA', () => {
    expect(normalizeSequence(`atg\n${'gct'.repeat(19)}`)).toBe(valid);
  });

  it('accepts a clean CDS and trims a terminal stop from the count', () => {
    expect(validateCodingSequence(`${valid}TAA`)).toEqual({
      sequence: `${valid}TAA`,
      codonCount: 20,
      error: null,
    });
  });

  it.each([
    ['', 'Paste a coding sequence'],
    [`GTG${'GCT'.repeat(19)}`, 'must start with ATG'],
    [`ATG${'GCT'.repeat(18)}`, 'at least 20'],
    [`ATG${'GCT'.repeat(9)}TAG${'GCT'.repeat(9)}`, 'Internal stop codon'],
    [`ATG${'GCN'.repeat(19)}`, 'A, C, G, and T only'],
    [`${valid}A`, 'not divisible by 3'],
  ])('rejects invalid input: %s', (sequence, message) => {
    expect(validateCodingSequence(sequence).error).toContain(message);
  });
});
