import { create } from 'zustand';
import type { AtlasDocument } from '../types/atlas';
import { fetchAtlas, fetchFixture, validateSchema } from '../utils/api';

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
}

export const useAtlasStore = create<AtlasState>((set) => ({
  document: null,
  loading: false,
  error: null,
  selectedOrganism: '',
  compareOrganism: null,
  selectedPosition: null,
  hoveredLayer: null,
  compareMode: false,
  liveMode: false,

  loadFixture: async () => {
    set({ loading: true, error: null });
    try {
      const doc = await fetchFixture();
      validateSchema(doc);
      set({
        document: doc,
        selectedOrganism: doc.organism_default ?? doc.organisms[0],
        compareOrganism: doc.organisms[1] ?? null,
        selectedPosition: 1,
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
      validateSchema(doc);
      set({
        document: doc,
        selectedOrganism: doc.organism_default ?? doc.organisms[0],
        compareOrganism: doc.organisms[1] ?? null,
        selectedPosition: 1,
        loading: false,
        liveMode: true,
      });
    } catch (e) {
      set({ error: (e as Error).message, loading: false });
    }
  },

  setOrganism: (org) => set({ selectedOrganism: org }),
  setCompareOrganism: (org) => set({ compareOrganism: org }),
  setPosition: (pos) => set({ selectedPosition: pos }),
  setHoveredLayer: (layer) => set({ hoveredLayer: layer }),
  setCompareMode: (on) => set({ compareMode: on }),
  setLiveMode: (on) => set({ liveMode: on }),
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
