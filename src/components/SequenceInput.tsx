import { useEffect, useMemo, useState } from 'react';
import { useAtlasStore } from '../store/atlasStore';
import { fetchOrganisms } from '../utils/api';
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

  const apiAvailable = Boolean(import.meta.env.VITE_API_URL);
  const validation = useMemo(() => (
    sequence.trim() ? validateCodingSequence(sequence) : null
  ), [sequence]);

  useEffect(() => {
    if (!apiAvailable) return;
    const timeout = window.setTimeout(async () => {
      try {
        const list = await fetchOrganisms(query);
        if (list.length) setOrganisms(list);
        setOrganismError(null);
      } catch (error) {
        setOrganismError((error as Error).message);
      }
    }, query ? 250 : 0);
    return () => window.clearTimeout(timeout);
  }, [apiAvailable, query]);

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

  const useDemoSequence = () => {
    if (!document) return;
    setSequence(document.tokens.map((token) => token.codon).join(''));
    setLocalError(null);
  };

  if (!apiAvailable) {
    return (
      <section className="panel input-panel collapsed">
        <button type="button" className="input-toggle" onClick={() => setExpanded(!expanded)}>
          Live inference {expanded ? '▲' : '▼'}
        </button>
        {expanded && (
          <p className="input-note">
            Tier 1 live inference requires a backend. Set <code>VITE_API_URL</code> at build time and deploy the FastAPI server.
            The demo below uses real DeCodon output from the fixture.
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
        />
        <div id="sequence-help" className="field-help">
          <span>{validation ? `${validation.codonCount} coding codons` : '20–512 coding codons'}</span>
          <button type="button" className="text-button" onClick={useDemoSequence}>
            Use demo sequence
          </button>
        </div>
        {(localError ?? validation?.error) && (
          <p className="field-error" role="alert">{localError ?? validation?.error}</p>
        )}

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
        {organismError && <p className="field-error">{organismError}</p>}
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
