import { useAtlasStore } from '../store/atlasStore';
import { BarList, EntropyGauge } from './BarList';

export function ReadoutPanel() {
  const document = useAtlasStore((s) => s.document);
  const selectedOrganism = useAtlasStore((s) => s.selectedOrganism);
  const compareOrganism = useAtlasStore((s) => s.compareOrganism);
  const compareMode = useAtlasStore((s) => s.compareMode);
  const selectedPosition = useAtlasStore((s) => s.selectedPosition);

  if (!document || selectedPosition === null) {
    return (
      <section className="panel readout-panel empty">
        <p>Select a codon position to see the model readout.</p>
      </section>
    );
  }

  const token = document.tokens[selectedPosition];
  const readout = document.per_organism[selectedOrganism]?.[selectedPosition];
  const compareReadout = compareMode && compareOrganism
    ? document.per_organism[compareOrganism]?.[selectedPosition]
    : null;

  if (!token || !readout) return null;

  const hasSynonyms = token.aa !== 'M' && token.aa !== 'W';

  return (
    <section className="panel readout-panel">
      <div className="panel-header">
        <h2>Position {selectedPosition} readout</h2>
        <span className="panel-meta">
          {token.aa3} · {token.codon} · true input
        </span>
      </div>

      <div className="readout-grid">
        <div className="readout-section aa-section">
          <BarList
            title="Amino acid (what protein)"
            entries={readout.aa_readout}
            animateKey={`aa-${selectedOrganism}-${selectedPosition}`}
            highlightLabel={readout.true_aa}
          />
          <div className="confidence-chip">
            <span>AA confidence</span>
            <strong>{(readout.aa_confidence * 100).toFixed(1)}%</strong>
          </div>
        </div>

        {hasSynonyms ? (
          <div className={`readout-section synonym-section ${compareMode ? 'compare' : ''}`}>
            <BarList
              title={`Synonymous codon (${selectedOrganism})`}
              entries={readout.synonym_readout}
              animateKey={`syn-${selectedOrganism}-${selectedPosition}`}
              highlightLabel={readout.true_codon}
            />
            {compareReadout && (
              <BarList
                title={`Synonymous codon (${compareOrganism})`}
                entries={compareReadout.synonym_readout}
                animateKey={`syn-${compareOrganism}-${selectedPosition}`}
                highlightLabel={compareReadout.true_codon}
              />
            )}
            <EntropyGauge value={readout.synonym_entropy} label="Synonym entropy" />
          </div>
        ) : (
          <div className="readout-section synonym-section trivial">
            <p className="trivial-note">
              {token.aa3} has only one codon — no synonymous choice to visualize.
            </p>
          </div>
        )}
      </div>
    </section>
  );
}
