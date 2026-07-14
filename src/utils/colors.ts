import type { ReadoutKind } from '../types/atlas';

export type AaClass = 'hydrophobic' | 'polar' | 'positive' | 'negative' | 'special';

const AA_CLASS: Record<string, AaClass> = {
  A: 'hydrophobic', V: 'hydrophobic', L: 'hydrophobic', I: 'hydrophobic',
  M: 'special', F: 'hydrophobic', W: 'hydrophobic', P: 'hydrophobic',
  S: 'polar', T: 'polar', N: 'polar', Q: 'polar', Y: 'polar', C: 'polar',
  K: 'positive', R: 'positive', H: 'positive',
  D: 'negative', E: 'negative',
  G: 'special',
};

export const AA_CLASS_COLORS: Record<AaClass, { bg: string; text: string; border: string }> = {
  hydrophobic: { bg: '#2d4a3e', text: '#a8d5ba', border: '#4a7c59' },
  polar: { bg: '#2a3d5c', text: '#a8c8e8', border: '#4a7ab5' },
  positive: { bg: '#4a2d3d', text: '#e8a8c8', border: '#b54a7a' },
  negative: { bg: '#3d2d4a', text: '#c8a8e8', border: '#7a4ab5' },
  special: { bg: '#3d3d2d', text: '#e8e8a8', border: '#b5b54a' },
};

export function getAaClass(aa: string): AaClass {
  return AA_CLASS[aa] ?? 'special';
}

export function getAaColors(aa: string) {
  return AA_CLASS_COLORS[getAaClass(aa)];
}

export const READOUT_COLORS: Record<ReadoutKind, string> = {
  aa_mean: '#5b9fd4',
  codon: '#d4a05b',
  derived: '#8b8b8b',
  sae: '#9b59d4',
  phenotype: '#59d49b',
};

export const CONCEPT_COLORS: Record<string, string> = {
  organism_taxid: '#e07a5f',
  rel_position_in_CDS: '#81b29a',
  amino_acid_identity: '#3d5a80',
  aa_chem_class: '#6a4c93',
  GC3_wobble: '#8b8b8b',
};

export const CONCEPT_LABELS: Record<string, string> = {
  organism_taxid: 'Organism (taxid)',
  rel_position_in_CDS: 'Position in CDS',
  amino_acid_identity: 'Amino acid identity',
  aa_chem_class: 'AA chemical class',
  GC3_wobble: 'GC3 wobble (flat)',
};
