import { useEffect, useMemo, useRef, useState } from 'react';
import { useAtlasStore } from '../store/atlasStore';
import { fetchFixture, fetchOrganisms } from '../utils/api';
import type { OrganismInfo } from '../types/atlas';
import { validateCodingSequence } from '../utils/sequence';

const DEMO_ORGANISMS = [
  { taxid: 562, name: 'E. coli' },
  { taxid: 1423, name: 'B. subtilis' },
  { taxid: 287, name: 'P. aeruginosa' },
];

export function SequenceInput() {
  const loadLive = useAtlasStore((s) => s.loadLive);
  const loadFixture = useAtlasStore((s) => s.loadFixture);
  const liveMode = useAtlasStore((s) => s.liveMode);
  const loading = useAtlasStore((s) => s.loading);
  const document = useAtlasStore((s) => s.document);
  const [sequence, setSequence] = useState('');
  const [selectedTaxids, setSelectedTaxids] = useState<number[]>([562, 1423, 287]);
  const [organisms, setOrganisms] = useState<OrganismInfo[]>(DEMO_ORGANISMS);
  const [expanded, setExpanded] = useState(false);
  const [query, setQuery] = useState('');
  const [organismError, setOrganismError] = useState<string | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);
  const [organismsLoading, setOrganismsLoading] = useState(false);
  const organismRequest = useRef(0);

  const apiAvailable = Boolean(import.meta.env.VITE_API_URL);
  const validation = useMemo(() => (
    sequence.trim() ? validateCodingSequence(sequence) : null
  ), [sequence]);

  useEffect(() => {
    if (!apiAvailable) return;
    const requestId = ++organismRequest.current;
    const timeout = window.setTimeout(async () => {
      setOrganismsLoading(true);
      try {
        const list = await fetchOrganisms(query);
        if (requestId !== organismRequest.current) return;
        setOrganisms((previous) => {
          const selected = previous.filter((organism) => (
            selectedTaxids.includes(organism.taxid)
          ));
          const selectedIds = new Set(selected.map((organism) => organism.taxid));
          return [...selected, ...list.filter((organism) => !selectedIds.has(organism.taxid))];
        });
        setOrganismError(null);
      } catch (error) {
        if (requestId !== organismRequest.current) return;
        setOrganismError((error as Error).message);
      } finally {
        if (requestId === organismRequest.current) setOrganismsLoading(false);
      }
    }, query ? 250 : 0);
    return () => {
      window.clearTimeout(timeout);
      organismRequest.current += 1;
    };
  }, [apiAvailable, query, selectedTaxids]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const result = validateCodingSequence(sequence);
    if (result.error) {
      setLocalError(result.error);
      return;
    }
    setLocalError(null);
    await loadLive(result.sequence, selectedTaxids);
  };

  const toggleTaxid = (taxid: number) => {
    setSelectedTaxids((prev) => {
      if (prev.includes(taxid)) {
        return prev.length > 1 ? prev.filter((value) => value !== taxid) : prev;
      }
      return prev.length < 5 ? [...prev, taxid] : prev;
    });
  };

  const useDemoSequence = async () => {
    try {
      const demo = liveMode ? await fetchFixture() : document;
      if (!demo) return;
      setSequence(demo.tokens.map((token) => token.codon).join(''));
      setLocalError(null);
    } catch (error) {
      setLocalError((error as Error).message);
    }
  };

  if (!apiAvailable) {
    return (
      <section className="panel input-panel collapsed">
        <button
          type="button"
          className="input-toggle"
          onClick={() => setExpanded(!expanded)}
          aria-expanded={expanded}
          aria-controls="static-inference-note"
        >
          Analyze your own sequence {expanded ? '▲' : '▼'}
        </button>
        {expanded && (
          <p className="input-note" id="static-inference-note">
            Live inference is not enabled on this static deployment yet. The
            curated examples remain fully interactive and use real, precomputed
            DeCodon measurements.
          </p>
        )}
      </section>
    );
  }

  return (
    <section className="panel input-panel">
      <div className="panel-header">
        <h2>Live sequence</h2>
        {liveMode && (
          <button type="button" className="back-btn" onClick={() => loadFixture()}>
            ← Back to demo
          </button>
        )}
      </div>
      <form onSubmit={handleSubmit}>
        <label className="field-label" htmlFor="coding-sequence">
          Coding sequence
        </label>
        <textarea
          id="coding-sequence"
          value={sequence}
          onChange={(e) => {
            setSequence(e.target.value);
            setLocalError(null);
          }}
          placeholder="Paste a coding sequence (ATG start, length divisible by 3, ACGT only)..."
          rows={3}
          spellCheck={false}
          aria-describedby="sequence-help"
          aria-invalid={Boolean(localError ?? validation?.error)}
        />
        <div id="sequence-help" className="field-help">
          <span>
            {validation
              ? `${validation.codonCount} coding codons`
              : '20–512 codons · ATG start · standard genetic code'}
          </span>
          <button type="button" className="text-button" onClick={useDemoSequence}>
            Use demo sequence
          </button>
        </div>
        {(localError ?? validation?.error) && (
          <p className="field-error" role="alert">{localError ?? validation?.error}</p>
        )}

        <fieldset className="organism-fieldset">
        <legend>Choose up to five supported organisms</legend>
        <div className="organism-picker-header">
          <label className="field-label" htmlFor="organism-search">
            Organisms <span>{selectedTaxids.length}/5 selected</span>
          </label>
          <input
            id="organism-search"
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search name or taxid"
          />
        </div>
        <div className="organism-checkboxes">
          {organisms.map((org) => (
            <label key={org.taxid}>
              <input
                type="checkbox"
                checked={selectedTaxids.includes(org.taxid)}
                onChange={() => toggleTaxid(org.taxid)}
                disabled={!selectedTaxids.includes(org.taxid) && selectedTaxids.length >= 5}
              />
              {org.name} ({org.taxid})
            </label>
          ))}
        </div>
        {organismsLoading && <p className="input-note" role="status">Searching supported organisms…</p>}
        {!organismsLoading && query && organisms.length === 0 && (
          <p className="input-note">No supported organisms match this search.</p>
        )}
        {organismError && <p className="field-error" role="alert">{organismError}</p>}
        </fieldset>
        <button
          type="submit"
          disabled={
            loading
            || !sequence.trim()
            || Boolean(validation?.error)
            || selectedTaxids.length === 0
          }
        >
          {loading ? 'Running DeCodon…' : 'Analyze sequence'}
        </button>
      </form>
    </section>
  );
}
