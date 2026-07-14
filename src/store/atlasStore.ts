import { create } from 'zustand';
import type { AtlasDocument, AtlasExample } from '../types/atlas';
import {
  fetchAtlas,
  fetchAtlasDocument,
  fetchExampleManifest,
  fetchFixture,
} from '../utils/api';
import { chooseStoryPosition } from '../utils/atlas';

let documentRequest = 0;

interface AtlasState {
  document: AtlasDocument | null;
  examples: AtlasExample[];
  selectedExampleId: string | null;
  loading: boolean;
  error: string | null;
  selectedOrganism: string;
  compareOrganism: string | null;
  selectedPosition: number | null;
  selectedLayer: number | null;
  hoveredLayer: number | null;
  pinnedLabels: string[];
  compareMode: boolean;
  liveMode: boolean;

  initialize: () => Promise<void>;
  loadFixture: () => Promise<void>;
  loadExample: (id: string) => Promise<void>;
  loadLive: (sequence: string, organisms: number[]) => Promise<void>;
  setOrganism: (org: string) => void;
  setCompareOrganism: (org: string | null) => void;
  setPosition: (pos: number | null) => void;
  setSelectedLayer: (layer: number | null) => void;
  setHoveredLayer: (layer: number | null) => void;
  togglePinnedLabel: (label: string) => void;
  setCompareMode: (on: boolean) => void;
  setLiveMode: (on: boolean) => void;
  clearError: () => void;
}

function initialOrganisms(document: AtlasDocument) {
  const selected = (
    document.organism_default
    && document.organisms.includes(document.organism_default)
  )
    ? document.organism_default
    : document.organisms[0];
  return {
    selected,
    compared: document.organisms.find((organism) => organism !== selected) ?? null,
  };
}

function stateForDocument(document: AtlasDocument, example?: AtlasExample) {
  const initial = initialOrganisms(document);
  const primary = (
    example
    && document.organisms.includes(example.recommendation.primary_organism)
  )
    ? example.recommendation.primary_organism
    : initial.selected;
  const recommendedCompare = example?.recommendation.compare_organism;
  const compared = (
    recommendedCompare
    && recommendedCompare !== primary
    && document.organisms.includes(recommendedCompare)
  )
    ? recommendedCompare
    : document.organisms.find((organism) => organism !== primary) ?? null;
  const recommendedPosition = example?.recommendation.position;
  const position = (
    recommendedPosition !== undefined
    && recommendedPosition >= 0
    && recommendedPosition < document.tokens.length
  )
    ? recommendedPosition
    : chooseStoryPosition({
      ...document,
      organisms: compared ? [primary, compared] : document.organisms,
    });
  return {
    document,
    selectedOrganism: primary,
    compareOrganism: compared,
    selectedPosition: position,
    selectedLayer: example?.recommendation.layer ?? document.model.n_layers,
    compareMode: Boolean(compared),
    pinnedLabels: [] as string[],
    loading: false,
    liveMode: false,
  };
}

export const useAtlasStore = create<AtlasState>((set, get) => ({
  document: null,
  examples: [],
  selectedExampleId: null,
  loading: false,
  error: null,
  selectedOrganism: '',
  compareOrganism: null,
  selectedPosition: null,
  selectedLayer: null,
  hoveredLayer: null,
  pinnedLabels: [],
  compareMode: true,
  liveMode: false,

  initialize: async () => {
    const requestId = ++documentRequest;
    set({ loading: true, error: null });
    try {
      const manifest = await fetchExampleManifest();
      const params = new URLSearchParams(window.location.search);
      const requestedId = params.get('example') ?? manifest.default_example;
      const example = manifest.examples.find((item) => item.id === requestedId)
        ?? manifest.examples.find((item) => item.id === manifest.default_example)
        ?? manifest.examples[0];
      if (!example) throw new Error('No atlas examples are configured');
      const document = await fetchAtlasDocument(example.data_path);
      if (requestId !== documentRequest) return;
      const next = stateForDocument(document, example);

      const urlPrimary = params.get('organism');
      const urlCompare = params.get('compare');
      const urlPositionValue = params.get('position');
      const urlLayerValue = params.get('layer');
      const urlPosition = urlPositionValue === null ? null : Number(urlPositionValue);
      const urlLayer = urlLayerValue === null ? null : Number(urlLayerValue);
      if (urlPrimary && document.organisms.includes(urlPrimary)) {
        next.selectedOrganism = urlPrimary;
      }
      if (
        urlCompare
        && urlCompare !== next.selectedOrganism
        && document.organisms.includes(urlCompare)
      ) {
        next.compareOrganism = urlCompare;
        next.compareMode = true;
      }
      if (
        urlPosition !== null
        && Number.isInteger(urlPosition)
        && urlPosition >= 0
        && urlPosition < document.tokens.length
      ) {
        next.selectedPosition = urlPosition;
      }
      if (
        urlLayer !== null
        && Number.isInteger(urlLayer)
        && urlLayer >= 0
        && urlLayer <= document.model.n_layers
      ) {
        next.selectedLayer = urlLayer;
      }
      const pins = params.get('pins')?.split(',').filter(Boolean).slice(0, 4) ?? [];
      next.pinnedLabels = pins;

      set({
        ...next,
        examples: manifest.examples,
        selectedExampleId: example.id,
      });
    } catch (e) {
      if (requestId !== documentRequest) return;
      set({ error: (e as Error).message, loading: false });
    }
  },

  loadFixture: async () => {
    const requestId = ++documentRequest;
    set({ loading: true, error: null });
    try {
      const doc = await fetchFixture();
      if (requestId !== documentRequest) return;
      set({
        ...stateForDocument(doc),
        selectedExampleId: null,
      });
    } catch (e) {
      if (requestId !== documentRequest) return;
      set({ error: (e as Error).message, loading: false });
    }
  },

  loadExample: async (id) => {
    const example = get().examples.find((item) => item.id === id);
    if (!example || id === get().selectedExampleId) return;
    const requestId = ++documentRequest;
    set({ loading: true, error: null });
    try {
      const document = await fetchAtlasDocument(example.data_path);
      if (requestId !== documentRequest) return;
      set({
        ...stateForDocument(document, example),
        selectedExampleId: example.id,
      });
    } catch (e) {
      if (requestId !== documentRequest) return;
      set({ error: (e as Error).message, loading: false });
    }
  },

  loadLive: async (sequence, organisms) => {
    const requestId = ++documentRequest;
    set({ loading: true, error: null });
    try {
      const doc = await fetchAtlas({ sequence, organisms });
      if (requestId !== documentRequest) return;
      const { selected, compared } = initialOrganisms(doc);
      set({
        document: doc,
        selectedExampleId: null,
        selectedOrganism: selected,
        compareOrganism: compared,
        selectedPosition: chooseStoryPosition(doc),
        selectedLayer: doc.model.n_layers,
        pinnedLabels: [],
        compareMode: Boolean(compared),
        loading: false,
        liveMode: true,
      });
    } catch (e) {
      if (requestId !== documentRequest) return;
      set({ error: (e as Error).message, loading: false });
    }
  },

  setOrganism: (org) => {
    const { document, compareOrganism } = get();
    if (!document?.organisms.includes(org)) return;
    const nextCompare = compareOrganism === org
      ? document.organisms.find((candidate) => candidate !== org) ?? null
      : compareOrganism;
    set({ selectedOrganism: org, compareOrganism: nextCompare });
  },
  setCompareOrganism: (org) => {
    const { document, selectedOrganism } = get();
    if (org && (!document?.organisms.includes(org) || org === selectedOrganism)) return;
    set({ compareOrganism: org });
  },
  setPosition: (pos) => {
    const { document } = get();
    if (pos !== null && (!document || pos < 0 || pos >= document.tokens.length)) return;
    set({ selectedPosition: pos });
  },
  setSelectedLayer: (layer) => {
    const { document } = get();
    if (layer !== null && (!document || layer < 0 || layer > document.model.n_layers)) return;
    set({ selectedLayer: layer });
  },
  setHoveredLayer: (layer) => set({ hoveredLayer: layer }),
  togglePinnedLabel: (label) => {
    const pinned = get().pinnedLabels;
    set({
      pinnedLabels: pinned.includes(label)
        ? pinned.filter((item) => item !== label)
        : [...pinned, label].slice(-4),
    });
  },
  setCompareMode: (on) => {
    const { document, selectedOrganism, compareOrganism } = get();
    const fallback = document?.organisms.find((organism) => organism !== selectedOrganism) ?? null;
    set({
      compareMode: on && Boolean(compareOrganism ?? fallback),
      compareOrganism: compareOrganism ?? fallback,
    });
  },
  setLiveMode: (on) => set({ liveMode: on }),
  clearError: () => set({ error: null }),
}));

export function getTopSynonym(doc: AtlasDocument, org: string, pos: number): string | null {
  const readout = doc.per_organism[org]?.[pos];
  if (!readout?.synonym_readout?.length) return null;
  return readout.synonym_readout[0].label;
}

export function hasSynonymShift(
  doc: AtlasDocument,
  orgA: string,
  orgB: string,
  pos: number,
): boolean {
  const topA = getTopSynonym(doc, orgA, pos);
  const topB = getTopSynonym(doc, orgB, pos);
  if (!topA || !topB) return false;
  const token = doc.tokens[pos];
  if (!token) return false;
  if (token.aa === 'M' || token.aa === 'W') return false;
  return topA !== topB;
}
