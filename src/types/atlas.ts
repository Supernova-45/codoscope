export type ReadoutKind = 'aa_mean' | 'codon' | 'derived' | 'sae' | 'phenotype';

export interface ReadoutEntry {
  label: string;
  kind: ReadoutKind;
  score: number;
}

export interface Token {
  pos: number;
  codon: string;
  aa: string;
  aa3: string;
  frame: number;
}

export interface PositionReadout {
  pos: number;
  predicted_aa?: string;
  true_aa?: string;
  true_codon?: string;
  aa_readout: ReadoutEntry[];
  synonym_readout: ReadoutEntry[];
  aa_confidence: number;
  synonym_entropy: number;
}

export interface ConceptLayer {
  kind: 'clf' | 'reg';
  baseline: number;
  scores: number[];
}

export interface ConceptLayers {
  layers: number[];
  concepts: Record<string, ConceptLayer>;
}

export interface AtlasDocument {
  schema_version: string;
  model: {
    name: string;
    repo?: string;
    type?: string;
    n_layers: number;
    hidden_size: number;
  };
  sequence_id: string;
  organism_default?: string;
  organisms: string[];
  tokens: Token[];
  per_organism: Record<string, PositionReadout[]>;
  concept_layers?: ConceptLayers;
}

export interface AtlasRequest {
  sequence: string;
  organisms: number[];
}

export interface OrganismInfo {
  taxid: number;
  name: string;
}
