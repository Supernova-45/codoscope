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

export interface RankedReadoutEntry extends ReadoutEntry {
  rank: number;
}

export interface LensLayerReadout {
  layer: number;
  pos: number;
  aa_readout: RankedReadoutEntry[];
  codon_readout: RankedReadoutEntry[];
}

export interface LensPositionReadout {
  pos: number;
  layers: LensLayerReadout[];
}

export interface LensMetadata {
  method: 'logit_lens' | 'jacobian_lens';
  status: 'baseline' | 'validated' | 'development';
  layers: number[];
  top_k: number;
  model_revision: string;
  lens_revision?: string;
  score_units: 'probability';
  normalization: string;
  source_position: string;
  target_positions: string;
  fit?: {
    corpus_manifest: string;
    n_sequences: number;
    skip_first: number;
  };
  per_organism: Record<string, LensPositionReadout[]>;
  rank_tracks: Record<string, Record<string, number[][]>>;
}

export type MeasurementMethod =
  | 'output'
  | 'logit_lens'
  | 'jacobian_lens'
  | 'probe';

export interface ExampleRecommendation {
  primary_organism: string;
  compare_organism?: string;
  position?: number;
  layer?: number;
}

export interface AtlasExample {
  id: string;
  eyebrow: string;
  title: string;
  takeaway: string;
  description: string;
  data_path: string;
  method: MeasurementMethod;
  source_label: string;
  source_accession: string;
  model_revision: string;
  recommendation: ExampleRecommendation;
}

export interface ExampleManifest {
  schema_version: 'codoscope/examples-1.0';
  default_example: string;
  examples: AtlasExample[];
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
  lens?: LensMetadata;
}

export interface AtlasRequest {
  sequence: string;
  organisms: number[];
}

export interface OrganismInfo {
  taxid: number;
  name: string;
}
