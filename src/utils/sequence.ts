export const MIN_CODONS = 20;
export const MAX_CODONS = 512;
const STOP_CODONS = new Set(['TAA', 'TAG', 'TGA']);

export interface SequenceValidation {
  sequence: string;
  codonCount: number;
  error: string | null;
}

export function normalizeSequence(raw: string): string {
  return raw.toUpperCase().replace(/\s/g, '');
}

export function validateCodingSequence(raw: string): SequenceValidation {
  const sequence = normalizeSequence(raw);
  const rawCodonCount = Math.floor(sequence.length / 3);

  if (!sequence) {
    return { sequence, codonCount: 0, error: 'Paste a coding sequence to continue.' };
  }
  if (!/^[ACGT]+$/.test(sequence)) {
    return {
      sequence,
      codonCount: rawCodonCount,
      error: 'Use DNA bases A, C, G, and T only.',
    };
  }
  if (sequence.length % 3 !== 0) {
    return {
      sequence,
      codonCount: rawCodonCount,
      error: `Length ${sequence.length} is not divisible by 3.`,
    };
  }
  if (!sequence.startsWith('ATG')) {
    return {
      sequence,
      codonCount: rawCodonCount,
      error: 'A coding sequence must start with ATG.',
    };
  }

  const codons = sequence.match(/.{3}/g) ?? [];
  const codingCodons = STOP_CODONS.has(codons.at(-1) ?? '')
    ? codons.slice(0, -1)
    : codons;
  const internalStop = codingCodons.findIndex((codon) => STOP_CODONS.has(codon));
  if (internalStop >= 0) {
    return {
      sequence,
      codonCount: codingCodons.length,
      error: `Internal stop codon at position ${internalStop}.`,
    };
  }
  if (codingCodons.length < MIN_CODONS) {
    return {
      sequence,
      codonCount: codingCodons.length,
      error: `Use at least ${MIN_CODONS} coding codons.`,
    };
  }
  if (codingCodons.length > MAX_CODONS) {
    return {
      sequence,
      codonCount: codingCodons.length,
      error: `Use no more than ${MAX_CODONS} coding codons.`,
    };
  }

  return { sequence, codonCount: codingCodons.length, error: null };
}
