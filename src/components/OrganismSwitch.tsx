import { hasSynonymShift, useAtlasStore } from '../store/atlasStore';
import { chooseStoryPosition } from '../utils/atlas';

export function OrganismSwitch() {
  const document = useAtlasStore((s) => s.document);
  const selectedOrganism = useAtlasStore((s) => s.selectedOrganism);
  const compareOrganism = useAtlasStore((s) => s.compareOrganism);
  const compareMode = useAtlasStore((s) => s.compareMode);
  const setOrganism = useAtlasStore((s) => s.setOrganism);
  const setCompareOrganism = useAtlasStore((s) => s.setCompareOrganism);
  const setCompareMode = useAtlasStore((s) => s.setCompareMode);
  const setPosition = useAtlasStore((s) => s.setPosition);

  if (!document) return null;
  const comparison = compareOrganism && compareOrganism !== selectedOrganism
    ? compareOrganism
    : null;
  const shiftCount = comparison
    ? document.tokens.filter((token) => (
        hasSynonymShift(document, selectedOrganism, comparison, token.pos)
      )).length
    : 0;
  const storyPosition = chooseStoryPosition({
    ...document,
    organisms: comparison
      ? [selectedOrganism, comparison]
      : document.organisms,
  });
  const storyToken = document.tokens[storyPosition];

  return (
    <section className="panel organism-panel hero">
      <div className="panel-header">
        <h2>Organism switch</h2>
        <p className="hero-caption">
          Hold the sequence fixed — switch organism and watch synonymous preferences move while the amino acid stays put.
        </p>
      </div>

      <div className="organism-controls">
        <div className="organism-segmented" role="group" aria-label="Primary organism">
          {document.organisms.map((org) => (
            <button
              key={org}
              type="button"
              className={`org-btn ${selectedOrganism === org ? 'active' : ''}`}
              onClick={() => setOrganism(org)}
              aria-pressed={selectedOrganism === org}
            >
              {org.split(' (')[0]}
              <span className="org-taxid">{org.match(/\((\d+)\)/)?.[1]}</span>
            </button>
          ))}
        </div>

        {document.organisms.length > 1 && (
          <label className="compare-toggle">
            <input
              type="checkbox"
              checked={compareMode}
              onChange={(e) => setCompareMode(e.target.checked)}
            />
            Compare organisms side-by-side
          </label>
        )}

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

        {compareMode && comparison && storyToken && (
          <button
            type="button"
            className="shift-summary"
            onClick={() => setPosition(storyPosition)}
          >
            <span><strong>{shiftCount}</strong> positions change their top synonymous codon</span>
            <span>
              Jump to strongest shift: {storyToken.aa3} {storyToken.codon} at position {storyPosition} →
            </span>
          </button>
        )}
      </div>
    </section>
  );
}
