import { useAtlasStore } from '../store/atlasStore';

export function OrganismSwitch() {
  const document = useAtlasStore((s) => s.document);
  const selectedOrganism = useAtlasStore((s) => s.selectedOrganism);
  const compareOrganism = useAtlasStore((s) => s.compareOrganism);
  const compareMode = useAtlasStore((s) => s.compareMode);
  const setOrganism = useAtlasStore((s) => s.setOrganism);
  const setCompareOrganism = useAtlasStore((s) => s.setCompareOrganism);
  const setCompareMode = useAtlasStore((s) => s.setCompareMode);

  if (!document) return null;

  return (
    <section className="panel organism-panel hero">
      <div className="panel-header">
        <h2>Organism switch</h2>
        <p className="hero-caption">
          Hold the sequence fixed — switch organism and watch synonymous preferences move while the amino acid stays put.
        </p>
      </div>

      <div className="organism-controls">
        <div className="organism-segmented">
          {document.organisms.map((org) => (
            <button
              key={org}
              type="button"
              className={`org-btn ${selectedOrganism === org ? 'active' : ''}`}
              onClick={() => setOrganism(org)}
            >
              {org.split(' (')[0]}
              <span className="org-taxid">{org.match(/\((\d+)\)/)?.[1]}</span>
            </button>
          ))}
        </div>

        <label className="compare-toggle">
          <input
            type="checkbox"
            checked={compareMode}
            onChange={(e) => setCompareMode(e.target.checked)}
          />
          Compare organisms side-by-side
        </label>

        {compareMode && (
          <div className="compare-select">
            <label htmlFor="compare-org">Compare with:</label>
            <select
              id="compare-org"
              value={compareOrganism ?? ''}
              onChange={(e) => setCompareOrganism(e.target.value || null)}
            >
              {document.organisms
                .filter((o) => o !== selectedOrganism)
                .map((org) => (
                  <option key={org} value={org}>{org}</option>
                ))}
            </select>
          </div>
        )}
      </div>
    </section>
  );
}
