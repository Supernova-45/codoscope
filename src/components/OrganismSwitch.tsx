import { hasSynonymShift, useAtlasStore } from '../store/atlasStore';
import { chooseStoryPosition } from '../utils/atlas';
import { MethodBadge } from './MethodBadge';

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
  const primaryStory = document.per_organism[selectedOrganism]?.[storyPosition];
  const comparisonStory = comparison
    ? document.per_organism[comparison]?.[storyPosition]
    : null;
  const primaryTop = primaryStory?.synonym_readout[0];
  const comparisonTop = comparisonStory?.synonym_readout[0];

  return (
    <section className="panel organism-panel hero" id="organism-story">
      <div className="panel-header">
        <div>
          <span className="panel-step">01 · change the organism</span>
          <h2>Whose codon dialect?</h2>
          <p className="hero-caption">
            Hold the sequence fixed. Only the organism token changes.
          </p>
        </div>
        <MethodBadge method="output" />
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
            <span>
              <strong>{shiftCount}</strong> codons change their top synonym
            </span>
            <span className="shift-narrative">
              Codon {storyPosition + 1} encodes {storyToken.aa3}:{' '}
              {primaryTop?.label} {(Number(primaryTop?.score ?? 0) * 100).toFixed(0)}%
              {' → '}
              {comparisonTop?.label} {(Number(comparisonTop?.score ?? 0) * 100).toFixed(0)}%.
              Observed-{storyToken.aa3} support is{' '}
              {(Number(primaryStory?.aa_confidence ?? 0) * 100).toFixed(0)}% vs{' '}
              {(Number(comparisonStory?.aa_confidence ?? 0) * 100).toFixed(0)}%. →
            </span>
          </button>
        )}
      </div>
    </section>
  );
}
