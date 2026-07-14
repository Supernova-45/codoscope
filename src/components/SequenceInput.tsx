import { useState } from 'react';
import { useAtlasStore } from '../store/atlasStore';
import { fetchOrganisms } from '../utils/api';
import type { OrganismInfo } from '../types/atlas';

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
  const [sequence, setSequence] = useState('');
  const [selectedTaxids, setSelectedTaxids] = useState<number[]>([562, 1423, 287]);
  const [organisms, setOrganisms] = useState<OrganismInfo[]>(DEMO_ORGANISMS);
  const [expanded, setExpanded] = useState(false);

  const apiAvailable = Boolean(import.meta.env.VITE_API_URL);

  const loadOrganismList = async () => {
    try {
      const list = await fetchOrganisms();
      if (list.length) setOrganisms(list.slice(0, 50));
    } catch {
      /* use demo list */
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const clean = sequence.toUpperCase().replace(/\s/g, '');
    await loadLive(clean, selectedTaxids);
  };

  const toggleTaxid = (taxid: number) => {
    setSelectedTaxids((prev) =>
      prev.includes(taxid)
        ? prev.length > 1 ? prev.filter((t) => t !== taxid) : prev
        : [...prev, taxid],
    );
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
        <textarea
          value={sequence}
          onChange={(e) => setSequence(e.target.value)}
          placeholder="Paste a coding sequence (ATG start, length divisible by 3, ACGT only)..."
          rows={3}
        />
        <div className="organism-checkboxes" onFocus={loadOrganismList}>
          {organisms.map((org) => (
            <label key={org.taxid}>
              <input
                type="checkbox"
                checked={selectedTaxids.includes(org.taxid)}
                onChange={() => toggleTaxid(org.taxid)}
              />
              {org.name} ({org.taxid})
            </label>
          ))}
        </div>
        <button type="submit" disabled={loading || !sequence.trim() || selectedTaxids.length === 0}>
          {loading ? 'Running DeCodon…' : 'Analyze sequence'}
        </button>
      </form>
    </section>
  );
}
