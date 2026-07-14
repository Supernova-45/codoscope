import { create } from 'zustand';
import type { AtlasDocument } from '../types/atlas';
import { fetchAtlas, fetchFixture } from '../utils/api';
import { chooseStoryPosition } from '../utils/atlas';

interface AtlasState {
  document: AtlasDocument | null;
  loading: boolean;
  error: string | null;
  selectedOrganism: string;
  compareOrganism: string | null;
  selectedPosition: number | null;
  hoveredLayer: number | null;
  compareMode: boolean;
  liveMode: boolean;

  loadFixture: () => Promise<void>;
  loadLive: (sequence: string, organisms: number[]) => Promise<void>;
  setOrganism: (org: string) => void;
  setCompareOrganism: (org: string | null) => void;
  setPosition: (pos: number | null) => void;
  setHoveredLayer: (layer: number | null) => void;
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

export const useAtlasStore = create<AtlasState>((set, get) => ({
  document: null,
  loading: false,
  error: null,
  selectedOrganism: '',
  compareOrganism: null,
  selectedPosition: null,
  hoveredLayer: null,
  compareMode: true,
  liveMode: false,

  loadFixture: async () => {
    set({ loading: true, error: null });
    try {
      const doc = await fetchFixture();
      const { selected, compared } = initialOrganisms(doc);
      set({
        document: doc,
        selectedOrganism: selected,
        compareOrganism: compared,
        selectedPosition: chooseStoryPosition(doc),
        compareMode: Boolean(compared),
        loading: false,
        liveMode: false,
      });
    } catch (e) {
      set({ error: (e as Error).message, loading: false });
    }
  },

  loadLive: async (sequence, organisms) => {
    set({ loading: true, error: null });
    try {
      const doc = await fetchAtlas({ sequence, organisms });
      const { selected, compared } = initialOrganisms(doc);
      set({
        document: doc,
        selectedOrganism: selected,
        compareOrganism: compared,
        selectedPosition: chooseStoryPosition(doc),
        compareMode: Boolean(compared),
        loading: false,
        liveMode: true,
      });
    } catch (e) {
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
  setPosition: (pos) => set({ selectedPosition: pos }),
  setHoveredLayer: (layer) => set({ hoveredLayer: layer }),
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
